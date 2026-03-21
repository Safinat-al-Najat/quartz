import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [
    Component.ImageZoom(),  // <-- Add this line
  ],
  footer: Component.Footer({
    links: {
      GitHub: "https://github.com/jackyzha0/quartz",
      "Discord Community": "https://discord.gg/cRFFHYye7t",
    },
  }),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
    component: Component.Breadcrumbs(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.TagList(),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Search({
      enableShortcut: true,
      placeholder: "Search for a topic...",
    }),
    Component.Darkmode(),
    Component.ReaderMode(),
    // Add Recent Notes here - properly configured
    Component.RecentNotes.DesktopOnly({
      title: "Recent Posts",           // Title to display
      limit: 10,                        // Number of posts to show
      showTags: true,                   // Show tags on each post
      filter: (f) => {
        const created = f.dates?.created
        if (!created) return false
        
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        
        return new Date(created) > thirtyDaysAgo
      }
      sort: (a, b) => {
        // Sort by date - newest first
        const dateA = a.dates?.modified || a.dates?.created || new Date(0)
        const dateB = b.dates?.modified || b.dates?.created || new Date(0)
        return dateB.getTime() - dateA.getTime()
      }
    }),
    // Explorer disabled - alphabetical sorting handled in quartz.config.ts
    // Component.Explorer({
    // useSavedState: true,
    // sortFn: (a, b) => {
    // if ((!a.file && !b.file) || (a.file && b.file)) {
    // return a.displayName.localeCompare(b.displayName, undefined, { numeric: true, sensitivity: 'base' })
    // }
    // if (a.file && !b.file) return 1
    // return -1
    // },
    // }),
  ],
  right: [
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
}

// components for pages that display lists of pages (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle(), Component.ContentMeta()],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Search(),
    Component.Darkmode(),
    // Explorer disabled - alphabetical sorting handled in quartz.config.ts
    // Component.Explorer({
    //   sortFn: (a, b) => {
    //     if ((!a.file && !b.file) || (a.file && b.file)) {
    //       return a.displayName.localeCompare(b.displayName, undefined, { numeric: true, sensitivity: 'base' })
    //     }
    //     if (a.file && !b.file) return 1
    //     return -1
    //   },
    // }),
  ],
  right: [],
}
