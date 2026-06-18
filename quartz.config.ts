import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * Quartz 4 Configuration
 *
 * See https://quartz.jzhao.xyz/configuration for more information.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "Islam",
    pageTitleSuffix: "",
    enableSPA: false,
    enablePopovers: true,
    analytics: {
      provider: "plausible",
    },
    locale: "en-US",
    baseUrl: "safinat-al-najat.github.io/quartz",
    // ogImagePath: "/static/preview.png",
    // useIndexHtml: true,
    ignorePatterns: [
      "private",
      "templates",
      ".obsidian",
      "node_modules",
      "public",
      ".quartz-cache",
      ".git",
      "**/AGENTS.md",
    ],
    defaultDateType: "modified",
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        header: "Lexend",
        body: "Inter",
        code: "IBM Plex Mono",
      },
      colors: {
        lightMode: {
          light: "#ffffff",
          lightgray: "#f0f0f0",
          gray: "#a0a0a0",
          darkgray: "#333333",
          dark: "#111111",
          secondary: "#388e3c",
          tertiary: "#81c784",
          highlight: "rgba(56, 142, 60, 0.1)",
          textHighlight: "#fff3bf",
        },
        darkMode: {
          light: "#1a1b1e",
          lightgray: "#2c2e33",
          gray: "#909296",
          darkgray: "#c1c2c5",
          dark: "#ffffff",
          secondary: "#69db7c",
          tertiary: "#b2f2bb",
          highlight: "rgba(105, 219, 124, 0.1)",
          textHighlight: "rgba(255, 255, 255, 0.15)",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "git", "filesystem"],
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "katex" }),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage({
        sort: (a, b) => {
          // Priority 1: Check for Dashboard Weight (if set, it overrides everything)
          const weightA = (a.frontmatter?.weight as number) ?? 999
          const weightB = (b.frontmatter?.weight as number) ?? 999
          if (weightA !== weightB) {
            return (weightA as number) - (weightB as number)
          }

          // Priority 2: Put Subfolders before Files
          // In FolderPage, subfolders are identified because their slug ends with "index"
          const aIsFolder = a.slug?.endsWith("index") ? 0 : 1
          const bIsFolder = b.slug?.endsWith("index") ? 0 : 1
          if (aIsFolder !== bIsFolder) {
            return aIsFolder - bIsFolder
          }

          // Priority 3: Alphabetical sort (by frontmatter title, then fallback to filename)
          const titleA = (a.frontmatter?.title || a.slug || "").toLowerCase()
          const titleB = (b.frontmatter?.title || b.slug || "").toLowerCase()
          return titleA.localeCompare(titleB, undefined, { numeric: true, sensitivity: "base" })
        },
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
    ], // <--- No Plugin.Search() here!
  },
}

export default config
