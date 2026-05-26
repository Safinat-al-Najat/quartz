import { ContentDetails } from "../../plugins/emitters/contentIndex"
import { FullSlug, isAbsoluteURL, resolveRelative } from "../../util/path"

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".bmp", ".svg", ".webp"])

const STOP_WORDS = new Set([
  "a",
  "about",
  "above",
  "after",
  "again",
  "against",
  "all",
  "am",
  "an",
  "and",
  "any",
  "are",
  "arent",
  "as",
  "at",
  "be",
  "because",
  "been",
  "before",
  "being",
  "below",
  "between",
  "both",
  "but",
  "by",
  "cant",
  "cannot",
  "could",
  "couldnt",
  "did",
  "didnt",
  "do",
  "does",
  "doesnt",
  "doing",
  "dont",
  "down",
  "during",
  "each",
  "few",
  "for",
  "from",
  "further",
  "had",
  "hadnt",
  "has",
  "hasnt",
  "have",
  "havent",
  "having",
  "he",
  "her",
  "here",
  "him",
  "his",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "isnt",
  "it",
  "its",
  "me",
  "more",
  "most",
  "my",
  "no",
  "nor",
  "not",
  "of",
  "off",
  "on",
  "once",
  "only",
  "or",
  "other",
  "our",
  "out",
  "over",
  "own",
  "same",
  "she",
  "should",
  "so",
  "some",
  "such",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "to",
  "too",
  "under",
  "until",
  "up",
  "very",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "whom",
  "why",
  "with",
  "would",
  "you",
  "your",
])

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, " ")
}

export function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/[\s-]+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
}

function singularize(word: string): string {
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`
  if (word.endsWith("es") && word.length > 4) return word.slice(0, -2)
  if (word.endsWith("s") && word.length > 3) return word.slice(0, -1)
  return word
}

function editDistanceWithin(a: string, b: string, maxDistance: number): boolean {
  if (Math.abs(a.length - b.length) > maxDistance) return false

  const previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  const current = new Array<number>(b.length + 1)

  for (let i = 1; i <= a.length; i++) {
    current[0] = i
    let rowMin = current[0]

    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
      rowMin = Math.min(rowMin, current[j])
    }

    if (rowMin > maxDistance) return false

    for (let j = 0; j <= b.length; j++) {
      previous[j] = current[j]
    }
  }

  return previous[b.length] <= maxDistance
}

function isCloseMatch(keyword: string, candidate: string): boolean {
  const normalizedKeyword = singularize(keyword)
  const normalizedCandidate = singularize(candidate)

  if (normalizedKeyword === normalizedCandidate) return true
  if (
    normalizedCandidate.includes(normalizedKeyword) ||
    normalizedKeyword.includes(normalizedCandidate)
  ) {
    return Math.min(normalizedKeyword.length, normalizedCandidate.length) >= 4
  }

  if (normalizedKeyword.length < 4 || normalizedCandidate.length < 4) return false
  const maxDistance = normalizedKeyword.length >= 7 || normalizedCandidate.length >= 7 ? 2 : 1
  return editDistanceWithin(normalizedKeyword, normalizedCandidate, maxDistance)
}

function fuzzyTokenCount(keyword: string, text: string): number {
  const tokens = tokenize(text)
  let matches = 0
  const seen = new Set<string>()

  for (const token of tokens) {
    if (!seen.has(token) && isCloseMatch(keyword, token)) {
      matches++
      seen.add(token)
    }
  }

  return matches
}

function getExtension(path: string): string {
  const cleanPath = path.split(/[?#]/, 1)[0].toLowerCase()
  const match = cleanPath.match(/\.[a-z0-9]+$/)
  return match?.[0] ?? ""
}

function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")
}

function resolveImageUrl(url: string, sourceSlug: FullSlug): string {
  return resolveMarkdownLink(url, sourceSlug)
}

function extractImages(content: string, sourceSlug: FullSlug): { alt: string; url: string }[] {
  const images: { alt: string; url: string }[] = []
  const seen = new Set<string>()
  const addImage = (alt: string, rawUrl: string) => {
    const cleanUrl = rawUrl.trim()
    if (!cleanUrl || !IMAGE_EXTENSIONS.has(getExtension(cleanUrl))) return
    const url = resolveImageUrl(cleanUrl, sourceSlug)
    const key = `${alt}\x00${url}`
    if (!seen.has(key)) {
      seen.add(key)
      images.push({ alt: alt.trim(), url })
    }
  }

  content.replace(/!\[([^\]]*?)\]\(([^)]*?)\)/g, (_match, alt, url) => {
    addImage(alt, url)
    return _match
  })

  content.replace(
    /!\[\[([^\]\|#]+)(?:#[^\]\|]+)?(?:\|([^\]]*?))?\]\]/g,
    (_match, rawUrl, rawAlias) => {
      const alias = (rawAlias || "").trim()
      const alt = alias.replace(/^\d+x?\d*$/, "").trim() || rawUrl.split("/").pop() || "Image"
      addImage(alt, rawUrl)
      return _match
    },
  )

  return images
}

export function extractContextChunks(question: string, data: ContentIndex) {
  const keywords = tokenize(question)
  if (keywords.length === 0) return []

  const scoredEntries: { slug: string; score: number; details: ContentDetails }[] = []

  for (const [slug, fileData] of Object.entries<ContentDetails>(data)) {
    let score = 0
    const title = fileData.title || ""
    const content = fileData.content || ""
    const tags = fileData.tags || []
    const titleLower = normalizeText(title)
    const contentLower = normalizeText(content)

    for (const keyword of keywords) {
      if (titleLower.includes(keyword)) {
        score += 6
      } else if (fuzzyTokenCount(keyword, title) > 0) {
        score += 4
      }

      if (contentLower.includes(keyword)) {
        const occurrences = contentLower.split(keyword).length - 1
        score += Math.min(occurrences, 8)
      } else {
        score += Math.min(fuzzyTokenCount(keyword, content), 3)
      }

      for (const tag of tags) {
        const normalizedTag = normalizeText(tag)
        if (normalizedTag.includes(keyword)) {
          score += 3
        } else if (fuzzyTokenCount(keyword, tag) > 0) {
          score += 2
        }
      }
    }

    if (score > 0) {
      scoredEntries.push({ slug, score, details: fileData })
    }
  }

  scoredEntries.sort((a, b) => b.score - a.score)

  return scoredEntries.slice(0, 5).map((entry) => ({
    title: entry.details.title || entry.slug,
    slug: entry.slug,
    content: entry.details.content || "",
    images: extractImages(entry.details.content || "", entry.slug as FullSlug),
  }))
}

function resolveMarkdownLink(href: string, currentSlug: FullSlug): string {
  if (
    isAbsoluteURL(href) ||
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  ) {
    return href
  }
  let target = href
  if (target.startsWith("/")) {
    target = target.substring(1)
  }
  return resolveRelative(currentSlug, target as FullSlug)
}

function parseInlineMarkdown(text: string, currentSlug: FullSlug): string {
  let escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

  const codeSpans: string[] = []
  escaped = escaped.replace(/`([^`]+)`/g, (_match, code) => {
    const idx = codeSpans.length
    codeSpans.push(`<code>${code}</code>`)
    return `\x00CODE${idx}\x00`
  })

  escaped = escaped.replace(/!\[([^\]]*?)\]\(([^)]*?)\)/g, (_match, alt, href) => {
    const safeHref = escapeHtmlAttribute(href.trim())
    const safeAlt = escapeHtmlAttribute(alt.trim())
    if (!safeHref || !IMAGE_EXTENSIONS.has(getExtension(safeHref))) return ""
    return `<img src="${safeHref}" alt="${safeAlt}" loading="lazy">`
  })

  escaped = escaped.replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>").replace(/\*\*/g, "")

  escaped = escaped.replace(/\[([^\]]*?)\]\(([^)]*?)\)/g, (_match, linkText, href) => {
    const resolvedHref = resolveMarkdownLink(href, currentSlug)
    return `<a href="${resolvedHref}">${linkText}</a>`
  })

  for (let i = 0; i < codeSpans.length; i++) {
    escaped = escaped.replace(`\x00CODE${i}\x00`, codeSpans[i])
  }

  return escaped
}

export function parseMarkdownToHtml(markdown: string, currentSlug: FullSlug): string {
  const normalized = markdown.replace(/\r\n/g, "\n")
  const blocks = normalized.split(/\n\n+/)
  let html = ""

  for (const block of blocks) {
    const trimmedBlock = block.trim()
    if (!trimmedBlock) continue

    const headingMatch = trimmedBlock.match(/^(#{1,3})\s+(.*)$/)
    if (headingMatch) {
      html += `<p><strong>${parseInlineMarkdown(headingMatch[2], currentSlug)}</strong></p>`
      continue
    }

    const lines = block.split("\n")
    const isList = lines.some((line) => /^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line))

    if (isList) {
      let listState: "none" | "ul" | "ol" = "none"
      for (const line of lines) {
        const ulMatch = line.match(/^\s*[-*]\s+(.*)$/)
        const olMatch = line.match(/^\s*\d+\.\s+(.*)$/)

        if (ulMatch) {
          if (listState !== "ul") {
            if (listState === "ol") html += "</ol>"
            html += "<ul>"
            listState = "ul"
          }
          html += `<li>${parseInlineMarkdown(ulMatch[1], currentSlug)}</li>`
        } else if (olMatch) {
          if (listState !== "ol") {
            if (listState === "ul") html += "</ul>"
            html += "<ol>"
            listState = "ol"
          }
          html += `<li>${parseInlineMarkdown(olMatch[1], currentSlug)}</li>`
        } else {
          if (listState === "ul") {
            html += "</ul>"
            listState = "none"
          } else if (listState === "ol") {
            html += "</ol>"
            listState = "none"
          }
          if (line.trim() !== "") {
            html += `<p>${parseInlineMarkdown(line, currentSlug)}</p>`
          }
        }
      }
      if (listState === "ul") html += "</ul>"
      if (listState === "ol") html += "</ol>"
    } else {
      const parsedLines = lines.map((line) => parseInlineMarkdown(line, currentSlug))
      html += `<p>${parsedLines.join("<br>")}</p>`
    }
  }

  return html
}
