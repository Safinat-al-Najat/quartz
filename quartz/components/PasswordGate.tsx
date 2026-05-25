import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
// @ts-ignore
import style from "./styles/passwordGate.scss"
// @ts-ignore
import script from "./scripts/passwordGate.inline"
import fs from "fs"
import path from "path"

export default (() => {
  const PasswordGate: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
    const isLocked = fileData.slug === "locked" || fileData.slug?.startsWith("locked/")

    if (!isLocked) {
      return null
    }

    const verificationPath = path.resolve(".quartz-cache/verification.json")
    let verificationToken = ""
    if (fs.existsSync(verificationPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(verificationPath, "utf8"))
        verificationToken = data.verification || ""
      } catch (e) {
        console.error("Error reading verification token:", e)
      }
    }

    return (
      <div
        id="password-gate-container"
        class={displayClass}
        data-slug={fileData.slug}
        data-verify={verificationToken}
      >
        <div id="password-gate-modal" class="password-gate-modal">
          <div class="password-gate-content">
            <span class="password-gate-arabic">بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيمِ</span>
            <h2>Archive Locked</h2>
            <p>
              This content is part of the protected research archives. Please enter the master
              decryption key to unlock the archives.
            </p>
            <div class="password-gate-input-group">
              <input
                type="password"
                id="password-gate-input"
                placeholder="Enter decryption key..."
                autocomplete="off"
              />
              <button id="password-gate-submit-btn">Unlock</button>
            </div>
            <div id="password-gate-error" class="password-gate-error"></div>
          </div>
        </div>
      </div>
    )
  }

  PasswordGate.afterDOMLoaded = script
  PasswordGate.css = style

  return PasswordGate
}) satisfies QuartzComponentConstructor
