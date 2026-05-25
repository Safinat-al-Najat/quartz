function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function decryptPayload(iv: Uint8Array, combined: Uint8Array, key: CryptoKey): Promise<string> {
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    combined
  );
  return new TextDecoder().decode(decrypted);
}

async function deriveKeyFromPassword(password: string): Promise<{ cryptoKey: CryptoKey, base64Key: string }> {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", passwordBytes);
  const hashArray = new Uint8Array(hashBuffer);
  
  const cryptoKey = await window.crypto.subtle.importKey(
    "raw",
    hashArray,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  
  return {
    cryptoKey,
    base64Key: bytesToBase64(hashArray)
  };
}

async function importKeyFromBase64(base64Key: string): Promise<CryptoKey> {
  const hashArray = base64ToBytes(base64Key);
  return await window.crypto.subtle.importKey(
    "raw",
    hashArray,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
}

// Global cleanup reference for mutation observers
let activeTitleObserver: MutationObserver | null = null;

// Sets up a MutationObserver on <title> to prevent Quartz SPA router/hydration from overwriting the title
function setupTitleObserver(newTitle: string) {
  // Clear any existing observer first
  if (activeTitleObserver) {
    activeTitleObserver.disconnect();
    activeTitleObserver = null;
  }

  document.title = newTitle;

  const titleEl = document.querySelector("title");
  if (titleEl) {
    activeTitleObserver = new MutationObserver(() => {
      if (document.title !== newTitle) {
        document.title = newTitle;
      }
    });
    activeTitleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });
    
    window.addCleanup(() => {
      if (activeTitleObserver) {
        activeTitleObserver.disconnect();
        activeTitleObserver = null;
      }
    });
  }
}

// Controls visibility of locked navigation elements and empty parent directories
function updateSidebarVisibility() {
  const isUnlocked = !!sessionStorage.getItem("archive_session_key");
  const links = document.querySelectorAll(".sidebar a[href*='/locked'], .explorer a[href*='/locked'], .backlinks a[href*='/locked'], .recent-notes a[href*='/locked']");

  // 1. Mark files matching 'locked' folder path
  links.forEach(link => {
    const itemToHide = link.closest("li") || link;
    if (isUnlocked) {
      itemToHide.classList.remove("locked-nav-hidden");
      itemToHide.classList.add("locked-nav-visible");
    } else {
      itemToHide.classList.add("locked-nav-hidden");
      itemToHide.classList.remove("locked-nav-visible");
    }
  });

  // 2. Hide Empty Folders recursively bottom-up to prevent "Ghost" parent explorer nodes
  const folderElements = document.querySelectorAll(".explorer-ul li");
  for (let i = folderElements.length - 1; i >= 0; i--) {
    const li = folderElements[i];
    const folderOuter = li.querySelector(".folder-outer");
    if (folderOuter) {
      const childLis = folderOuter.querySelectorAll("ul.content > li");
      if (childLis.length > 0) {
        const allChildrenHidden = Array.from(childLis).every(child => child.classList.contains("locked-nav-hidden"));
        if (allChildrenHidden) {
          li.classList.add("locked-nav-hidden");
          li.classList.remove("locked-nav-visible");
        } else {
          if (isUnlocked) {
            li.classList.remove("locked-nav-hidden");
            li.classList.add("locked-nav-visible");
          }
        }
      }
    }
  }
}

async function checkAndDecrypt() {
  // Always update sidebar visibility state at the start of navigation event
  updateSidebarVisibility();

  // Exit early ONLY if completely outside the locked directory tree
  const currentPath = window.location.pathname;
  if (!currentPath.includes("/locked")) {
    return;
  }

  const gateContainer = document.getElementById("password-gate-container");
  const encryptedContainer = document.getElementById("encrypted-container");

  if (!gateContainer || !encryptedContainer) return;

  const payload = encryptedContainer.getAttribute("data-payload");
  if (!payload) return;

  const parts = payload.split(":");
  if (parts.length !== 2) return;

  const iv = base64ToBytes(parts[0]);
  const combined = base64ToBytes(parts[1]);

  const tryDecrypt = async (key: CryptoKey): Promise<boolean> => {
    try {
      const decryptedText = await decryptPayload(iv, combined, key);
      let html = "";
      let title = "";

      try {
        const parsed = JSON.parse(decryptedText);
        html = parsed.html;
        title = parsed.title;
      } catch (e) {
        html = decryptedText;
        const temp = document.createElement("div");
        temp.innerHTML = html;
        const h1 = temp.querySelector("h1");
        if (h1) title = h1.textContent || "";
      }

      encryptedContainer.innerHTML = html;
      
      // Update page title and enforce it via observer to prevent race condition overwrite
      if (title) {
        setupTitleObserver(title);
      }

      gateContainer.remove();

      // Explicitly unhide all locked navigation links and folders
      updateSidebarVisibility();

      // Dispatch nav event so other components (mathjax, popovers, etc.) hydrate the decrypted DOM
      document.dispatchEvent(new CustomEvent("nav"));
      return true;
    } catch (e) {
      return false;
    }
  };

  // 1. Auto-decrypt if valid key in session storage
  const savedKeyBase64 = sessionStorage.getItem("archive_session_key");
  if (savedKeyBase64) {
    try {
      const cryptoKey = await importKeyFromBase64(savedKeyBase64);
      const success = await tryDecrypt(cryptoKey);
      if (success) {
        return;
      } else {
        sessionStorage.removeItem("archive_session_key");
      }
    } catch (e) {
      sessionStorage.removeItem("archive_session_key");
    }
  }

  // 2. Setup manual submission triggers
  const inputEl = document.getElementById("password-gate-input") as HTMLInputElement;
  const submitBtn = document.getElementById("password-gate-submit-btn");
  const errorEl = document.getElementById("password-gate-error");
  const modalContent = gateContainer.querySelector(".password-gate-content");

  if (!inputEl || !submitBtn || !errorEl || !modalContent) return;

  const handleUnlock = async () => {
    const password = inputEl.value;
    if (!password) return;

    errorEl.textContent = "";
    modalContent.classList.remove("shake");

    try {
      const { cryptoKey, base64Key } = await deriveKeyFromPassword(password);
      sessionStorage.setItem("archive_session_key", base64Key);
      const success = await tryDecrypt(cryptoKey);
      if (!success) {
        sessionStorage.removeItem("archive_session_key");
        errorEl.textContent = "Incorrect password. Please try again.";
        setTimeout(() => {
          modalContent.classList.add("shake");
        }, 10);
      }
    } catch (e) {
      errorEl.textContent = "Decryption error occurred.";
      setTimeout(() => {
        modalContent.classList.add("shake");
      }, 10);
    }
  };

  const keypressHandler = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      handleUnlock();
    }
  };

  submitBtn.addEventListener("click", handleUnlock);
  inputEl.addEventListener("keypress", keypressHandler);

  window.addCleanup(() => {
    submitBtn.removeEventListener("click", handleUnlock);
    inputEl.removeEventListener("keypress", keypressHandler);
  });
}

// DUAL-LIFECYCLE RUNTIME INTERCEPT
// Pathway 1: Natively on direct execution (handling cold hard-reloads)
checkAndDecrypt();

// Pathway 2: Hooked into the SPA nav listener (handling page transitions and DOM morph updates)
document.addEventListener("nav", () => {
  checkAndDecrypt();
});
