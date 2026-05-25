function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

async function decryptPayload(
  iv: Uint8Array,
  combined: Uint8Array,
  key: CryptoKey,
): Promise<string> {
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as any },
    key,
    combined as any,
  )
  return new TextDecoder().decode(decrypted)
}

async function deriveKeyFromPassword(
  password: string,
): Promise<{ cryptoKey: CryptoKey; base64Key: string }> {
  const encoder = new TextEncoder()
  const passwordBytes = encoder.encode(password)
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", passwordBytes)
  const hashArray = new Uint8Array(hashBuffer)

  const cryptoKey = await window.crypto.subtle.importKey(
    "raw",
    hashArray,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  )

  return {
    cryptoKey,
    base64Key: bytesToBase64(hashArray),
  }
}

async function importKeyFromBase64(base64Key: string): Promise<CryptoKey> {
  const hashArray = base64ToBytes(base64Key)
  return await window.crypto.subtle.importKey("raw", hashArray as any, { name: "AES-GCM" }, false, [
    "decrypt",
  ])
}

/**
 * Verify the session key against the verification token embedded in the gate container.
 * Returns the CryptoKey if valid, null otherwise.
 */
async function verifySessionKey(
  savedKeyBase64: string,
  verifyToken: string,
): Promise<CryptoKey | null> {
  try {
    const cryptoKey = await importKeyFromBase64(savedKeyBase64)
    const parts = verifyToken.split(":")
    if (parts.length !== 2) return null
    const iv = base64ToBytes(parts[0])
    const combined = base64ToBytes(parts[1])
    const decrypted = await decryptPayload(iv, combined, cryptoKey)
    if (decrypted === "archive-unlocked") {
      return cryptoKey
    }
    return null
  } catch (e) {
    return null
  }
}

// Global cleanup reference for mutation observers
let activeTitleDecryptionObserver: MutationObserver | null = null

// Decrypts/strips title metadata dynamically in the DOM
function setupTitleDecryptionObserver(key?: CryptoKey) {
  if (activeTitleDecryptionObserver) {
    activeTitleDecryptionObserver.disconnect()
    activeTitleDecryptionObserver = null
  }

  const scanAndDecrypt = () => {
    const elements = document.querySelectorAll(
      "a, title, h1, h2, h3, h4, h5, h6, .card-title, .result-item, .note-title, .card-description, .article-title",
    )
    elements.forEach((el) => {
      el.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.nodeValue || ""
          // Robust regex that handles full base64 character set (A-Za-z0-9+/=)
          const match = text.match(/🔒 Locked Content \[([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]+)\]/)
          if (match) {
            if (key) {
              const iv = base64ToBytes(match[1])
              const combined = base64ToBytes(match[2])
              decryptPayload(iv, combined, key)
                .then((decrypted) => {
                  child.nodeValue = text.replace(match[0], decrypted)
                })
                .catch((e) => {
                  console.error("[VAULT] Error decrypting title:", e)
                  child.nodeValue = text.replace(match[0], "🔒 Locked Content")
                })
            } else {
              child.nodeValue = text.replace(match[0], "🔒 Locked Content")
            }
          }
        }
      })
    })
  }

  scanAndDecrypt()

  activeTitleDecryptionObserver = new MutationObserver((mutations) => {
    let shouldScan = false
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        shouldScan = true
        break
      }
    }
    if (shouldScan) {
      scanAndDecrypt()
    }
  })

  activeTitleDecryptionObserver.observe(document.body, {
    childList: true,
    subtree: true,
  })

  window.addCleanup(() => {
    if (activeTitleDecryptionObserver) {
      activeTitleDecryptionObserver.disconnect()
      activeTitleDecryptionObserver = null
    }
  })
}

// Controls visibility of locked navigation elements and empty parent directories
function updateSidebarVisibility() {
  const isUnlocked = !!sessionStorage.getItem("archive_session_key")
  const links = document.querySelectorAll(
    ".sidebar a[href*='/locked'], .explorer a[href*='/locked'], .backlinks a[href*='/locked'], .recent-notes a[href*='/locked']",
  )

  // 1. Mark files matching 'locked' folder path
  links.forEach((link) => {
    const itemToHide = link.closest("li") || link
    if (isUnlocked) {
      itemToHide.classList.remove("locked-nav-hidden")
      itemToHide.classList.add("locked-nav-visible")
    } else {
      itemToHide.classList.add("locked-nav-hidden")
      itemToHide.classList.remove("locked-nav-visible")
    }
  })

  // 2. Hide Empty Folders recursively bottom-up to prevent "Ghost" parent explorer nodes
  const folderElements = document.querySelectorAll(".explorer-ul li")
  for (let i = folderElements.length - 1; i >= 0; i--) {
    const li = folderElements[i]
    const folderOuter = li.querySelector(".folder-outer")
    if (folderOuter) {
      const childLis = folderOuter.querySelectorAll("ul.content > li")
      if (childLis.length > 0) {
        const allChildrenHidden = Array.from(childLis).every((child) =>
          child.classList.contains("locked-nav-hidden"),
        )
        if (allChildrenHidden) {
          li.classList.add("locked-nav-hidden")
          li.classList.remove("locked-nav-visible")
        } else {
          if (isUnlocked) {
            li.classList.remove("locked-nav-hidden")
            li.classList.add("locked-nav-visible")
          }
        }
      }
    }
  }
}

/**
 * Decrypt the encrypted container's payload and replace the DOM.
 * Returns true on success, false on failure.
 * Does NOT clear the session key on failure — the caller decides.
 */
async function decryptAndReveal(
  encryptedContainer: HTMLElement,
  gateContainer: HTMLElement,
  key: CryptoKey,
): Promise<boolean> {
  const payload = encryptedContainer.getAttribute("data-payload")
  if (!payload) return false

  const parts = payload.split(":")
  if (parts.length !== 2) return false

  const iv = base64ToBytes(parts[0])
  const combined = base64ToBytes(parts[1])

  try {
    const decryptedText = await decryptPayload(iv, combined, key)
    let html = ""
    let title = ""

    try {
      const parsed = JSON.parse(decryptedText)
      html = parsed.html
      title = parsed.title
    } catch (e) {
      html = decryptedText
      const temp = document.createElement("div")
      temp.innerHTML = html
      const h1 = temp.querySelector("h1")
      if (h1) title = h1.textContent || ""
    }

    encryptedContainer.innerHTML = html

    // Update the article title in the beforeBody zone (h1.article-title)
    if (title) {
      const articleTitle = document.querySelector("h1.article-title")
      if (articleTitle) {
        articleTitle.textContent = title
      }
      document.title = title
    }

    gateContainer.remove()

    // Explicitly unhide all locked navigation links and folders
    updateSidebarVisibility()

    return true
  } catch (e) {
    console.error("[VAULT] Decryption failed:", e)
    return false
  }
}

async function checkAndDecrypt() {
  // Always update sidebar visibility state at the start of navigation event
  updateSidebarVisibility()

  // Get verification token from any gate container on the page (or from a cached source)
  const gateContainer = document.getElementById("password-gate-container")
  const verifyToken = gateContainer?.getAttribute("data-verify") || ""

  // Initialize title decryption observer based on session key state
  const savedKeyBase64 = sessionStorage.getItem("archive_session_key")
  if (savedKeyBase64 && verifyToken) {
    // Verify the key is valid before using it for title decryption
    const verifiedKey = await verifySessionKey(savedKeyBase64, verifyToken)
    if (verifiedKey) {
      setupTitleDecryptionObserver(verifiedKey)
    } else {
      // Key is invalid — clear it
      sessionStorage.removeItem("archive_session_key")
      setupTitleDecryptionObserver(undefined)
    }
  } else if (savedKeyBase64) {
    // We have a key but no verification token on this page — still try to use it for titles
    try {
      const cryptoKey = await importKeyFromBase64(savedKeyBase64)
      setupTitleDecryptionObserver(cryptoKey)
    } catch (e) {
      setupTitleDecryptionObserver(undefined)
    }
  } else {
    setupTitleDecryptionObserver(undefined)
  }

  // Exit early if completely outside the locked directory tree
  const currentPath = window.location.pathname
  if (!currentPath.includes("/locked")) {
    return
  }

  const encryptedContainer = document.getElementById("encrypted-container")

  if (!gateContainer || !encryptedContainer) return

  // ──────────────────────────────────────────────────────
  // FAST PATH: Auto-decrypt using verified session key
  // ──────────────────────────────────────────────────────
  const currentSavedKey = sessionStorage.getItem("archive_session_key")
  if (currentSavedKey) {
    // First verify the key is still valid using the verification token
    if (verifyToken) {
      const verifiedKey = await verifySessionKey(currentSavedKey, verifyToken)
      if (verifiedKey) {
        // Key is verified — decrypt the page content
        const success = await decryptAndReveal(encryptedContainer, gateContainer, verifiedKey)
        if (success) {
          return // All done — no password prompt needed
        }
        // Payload decryption failed but key is verified — don't clear the key
        // This can happen if a single file's encryption is corrupted
        console.warn("[VAULT] Payload decryption failed despite valid key. Showing gate.")
      } else {
        // Verification failed — the key is invalid, clear it
        sessionStorage.removeItem("archive_session_key")
      }
    } else {
      // No verification token available, try direct decryption
      try {
        const cryptoKey = await importKeyFromBase64(currentSavedKey)
        const success = await decryptAndReveal(encryptedContainer, gateContainer, cryptoKey)
        if (success) {
          return
        }
        sessionStorage.removeItem("archive_session_key")
      } catch (e) {
        sessionStorage.removeItem("archive_session_key")
      }
    }
  }

  // ──────────────────────────────────────────────────────
  // MANUAL PATH: Show the password gate for user input
  // ──────────────────────────────────────────────────────
  const inputEl = document.getElementById("password-gate-input") as HTMLInputElement
  const submitBtn = document.getElementById("password-gate-submit-btn")
  const errorEl = document.getElementById("password-gate-error")
  const modalContent = gateContainer.querySelector(".password-gate-content")

  if (!inputEl || !submitBtn || !errorEl || !modalContent) return

  const handleUnlock = async () => {
    const password = inputEl.value
    if (!password) return

    errorEl.textContent = ""
    modalContent.classList.remove("shake")

    try {
      const { cryptoKey, base64Key } = await deriveKeyFromPassword(password)

      // Verify the key against the verification token first
      if (verifyToken) {
        const parts = verifyToken.split(":")
        if (parts.length === 2) {
          const iv = base64ToBytes(parts[0])
          const combined = base64ToBytes(parts[1])
          try {
            const result = await decryptPayload(iv, combined, cryptoKey)
            if (result !== "archive-unlocked") {
              throw new Error("Verification mismatch")
            }
          } catch (e) {
            errorEl.textContent = "Incorrect password. Please try again."
            setTimeout(() => {
              modalContent.classList.add("shake")
            }, 10)
            return
          }
        }
      }

      // Password verified — store the key in session
      sessionStorage.setItem("archive_session_key", base64Key)

      const success = await decryptAndReveal(encryptedContainer, gateContainer, cryptoKey)
      if (success) {
        // Set up title decryption observer now that we have a valid key
        setupTitleDecryptionObserver(cryptoKey)
        // Update sidebar visibility
        updateSidebarVisibility()
      } else {
        sessionStorage.removeItem("archive_session_key")
        errorEl.textContent = "Decryption error occurred."
        setTimeout(() => {
          modalContent.classList.add("shake")
        }, 10)
      }
    } catch (e) {
      errorEl.textContent = "Decryption error occurred."
      setTimeout(() => {
        modalContent.classList.add("shake")
      }, 10)
    }
  }

  const keypressHandler = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      handleUnlock()
    }
  }

  submitBtn.addEventListener("click", handleUnlock)
  inputEl.addEventListener("keypress", keypressHandler)

  window.addCleanup(() => {
    submitBtn.removeEventListener("click", handleUnlock)
    inputEl.removeEventListener("keypress", keypressHandler)
  })
}

// DUAL-LIFECYCLE RUNTIME INTERCEPT
// Pathway 1: Natively on direct execution (handling cold hard-reloads)
checkAndDecrypt()

// Pathway 2: Hooked into the SPA nav listener (handling page transitions and DOM morph updates)
document.addEventListener("nav", () => {
  checkAndDecrypt()
})
