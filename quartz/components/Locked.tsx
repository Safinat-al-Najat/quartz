import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

export default (() => {
  const Locked: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
    // Critical guard: Only render this folder card component on the main homepage
    if (fileData.slug !== "index" && fileData.slug !== "") {
      return null
    }

    return (
      <div class={`locked-card-container ${displayClass}`}>
        <a href="./locked/" class="locked-folder-card">
          <div class="locked-folder-icon">🔒</div>
          <div class="locked-folder-details">
            <h3 class="locked-folder-title">Locked Vault</h3>
            <p class="locked-folder-desc">
              Access encrypted research archives. Session authentication required.
            </p>
          </div>
          <div class="locked-folder-arrow">→</div>
        </a>
      </div>
    )
  }

  return Locked
}) satisfies QuartzComponentConstructor
