import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [],
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
    Component.DesktopOnly(Component.RecentNotes({
      title: "New Topics",
      limit: 3,
    })),
    // Component.Explorer({
    //   useSavedState: true,
    //   sortFn: (a, b) => {
    //     // Folders before files, both sorted alphabetically
    //     if ((!a.file && !b.file) || (a.file && b.file)) {
    //       return a.displayName.localeCompare(b.displayName, undefined, { numeric: true })
    //     }
    //     if (a.file && !b.file) return 1
    //     return -1
    //   },
    // }),
  ],
  right: [
    // Component.Graph({
    //   localGraph: {
    //     drag: true,
    //     zoom: true,
    //     depth: 1,
    //     scale: 1.1,
    //     repulsion: 1000,
    //     forceStep: 10,
    //   },
    //   globalGraph: {
    //     drag: true,
    //     zoom: true,
    //     repulsion: 1500,
    //     linkDistance: 100,
    //   },
    // }),
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
    // Component.Explorer({
    //   sortFn: (a, b) => {
    //     if ((!a.file && !b.file) || (a.file && b.file)) {
    //       return a.displayName.localeCompare(b.displayName, undefined, { numeric: true })
    //     }
    //     if (a.file && !b.file) return 1
    //     return -1
    //   },
    // }),
  ],
  right: [],
}
