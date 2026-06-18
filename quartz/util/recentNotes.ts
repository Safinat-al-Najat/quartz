import type { QuartzPluginData } from "../plugins/vfile"

function isLockedVaultPage(file: QuartzPluginData): boolean {
  const slug = String(file.slug ?? "")
  return slug === "locked" || slug.startsWith("locked/") || file.frontmatter?.locked === true
}

export function shouldShowInNewTopics(file: QuartzPluginData): boolean {
  if (isLockedVaultPage(file)) return false

  const created = file.dates?.created
  if (!created) return false

  const recentCutoff = new Date()
  recentCutoff.setDate(recentCutoff.getDate() - 10)

  return new Date(created) > recentCutoff
}
