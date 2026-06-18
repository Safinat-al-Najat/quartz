export function buildAssetIndex(): Map<string, string | null>

export function resolveObsidianAssetPath(
  assetPath: string,
  relativeMarkdownPath: string,
  assetIndex: Map<string, string | null>,
): string

export function transformObsidianImageEmbeds(
  markdown: string,
  resolveAssetPath?: (assetPath: string) => string,
): string
