import assert from "node:assert/strict"
import { test } from "node:test"
// @ts-ignore build script is plain ESM JavaScript
import { transformObsidianImageEmbeds } from "../../../encrypt-archive.js"

test("transforms Obsidian image embeds with dimensions into img tags", () => {
  const markdown = "Before ![[image-1018.webp|418x601]] after"

  assert.equal(
    transformObsidianImageEmbeds(markdown),
    'Before <img src="image-1018.webp" alt="" width="418" height="601" /> after',
  )
})

test("uses resolved asset paths for image embeds", () => {
  const markdown = "![[image-1018.webp|418x601]]"

  assert.equal(
    transformObsidianImageEmbeds(markdown, () => "../../PNGS/pngs/image-1018.webp"),
    '<img src="../../PNGS/pngs/image-1018.webp" alt="" width="418" height="601" />',
  )
})

test("keeps non-image Obsidian embeds unchanged", () => {
  const markdown = "![[Some Note#Heading|Alias]]"

  assert.equal(transformObsidianImageEmbeds(markdown), markdown)
})
