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
      title: "New Lessons",
      limit: 5,
    })),
    Component.Explorer({
      useSavedState: true,
    }),
  ],
  right: [
  //   Component.Graph({
  // localGraph: {
  //   drag: true, // Let's you move nodes like in Obsidian
  //   zoom: true, // Let's you scroll to zoom
  //   depth: 1,   // How many steps away to show
  //   scale: 1.1,
  //   repulsion: 1000, // Higher number = more space between notes
  //   forceStep: 10,
  // },
//   globalGraph: {
//     drag: true,
//     zoom: true,
//     repulsion: 1500,
//     linkDistance: 100, // Length of the lines
//   },
// }),
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle(), Component.ContentMeta()],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Search(),
    Component.Darkmode(),
    Component.Explorer(),
  ],
  right: [],
}
