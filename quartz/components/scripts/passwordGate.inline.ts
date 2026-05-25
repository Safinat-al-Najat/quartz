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

document.addEventListener("nav", async () => {
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
      const decryptedHtml = await decryptPayload(iv, combined, key);
      encryptedContainer.innerHTML = decryptedHtml;
      gateContainer.remove();
      // Dispatch nav event again so other components (MathJax, syntax highlighting, popovers, etc.)
      // bind listeners and format the decrypted HTML structure.
      document.dispatchEvent(new CustomEvent("nav"));
      return true;
    } catch (e) {
      return false;
    }
  };

  // 1. Check if session has a saved key
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

  // 2. Manual key entry submission flow
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
      const success = await tryDecrypt(cryptoKey);
      if (success) {
        sessionStorage.setItem("archive_session_key", base64Key);
      } else {
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
});
