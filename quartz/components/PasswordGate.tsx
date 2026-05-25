import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
// @ts-ignore
import style from "./styles/passwordGate.scss"
// @ts-ignore
import script from "./scripts/passwordGate.inline"

export default (() => {
  const PasswordGate: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
    const isLocked = fileData.slug === "locked" || fileData.slug?.startsWith("locked/")

    if (!isLocked) {
      return null
    }

    return (
      <div id="password-gate-container" class={displayClass} data-slug={fileData.slug}>
        <div id="password-gate-modal" class="password-gate-modal">
          <div class="password-gate-content">
            <span class="password-gate-arabic">بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيمِ</span>
            <h2>Archive Locked</h2>
            <p>This content is part of the protected research archives. Please enter the master decryption key to unlock the archives.</p>
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
