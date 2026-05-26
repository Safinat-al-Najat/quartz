import test from "node:test"
import assert from "node:assert/strict"
import { extractContextChunks, parseMarkdownToHtml } from "./chatbot.helpers"

test("extractContextChunks tolerates minor spelling mismatches", () => {
  const index = {
    "malik-ransom": {
      slug: "malik-ransom",
      filePath: "malik-ransom.md",
      title: "Malik and Ransom",
      links: [],
      tags: ["story"],
      content: "Notes about Malik, the ransom demand, and the rescue plan.",
    },
    unrelated: {
      slug: "unrelated",
      filePath: "unrelated.md",
      title: "Travel Packing",
      links: [],
      tags: [],
      content: "A checklist for bags and clothing.",
    },
  } as any

  const chunks = extractContextChunks("what happend with malek ransum", index)

  assert.equal(chunks[0]?.slug, "malik-ransom")
})

test("parseMarkdownToHtml renders bold and removes unmatched bold markers", () => {
  const html = parseMarkdownToHtml("This is **important** and **unfinished", "index" as any)

  assert.match(html, /<strong>important<\/strong>/)
  assert.doesNotMatch(html, /\*\*/)
  assert.match(html, /unfinished/)
})

test("extractContextChunks includes markdown and wikilink images from matched notes", () => {
  const index = {
    "history/badr": {
      slug: "history/badr",
      filePath: "history/badr.md",
      title: "Battle of Badr",
      links: [],
      tags: ["history"],
      content:
        "Badr notes include a map.\n\n![Battle map](images/badr-map.png)\n\n![[portraits/ali.webp|Ali portrait]]",
    },
  } as any

  const chunks = extractContextChunks("show badr map", index)

  assert.deepEqual(chunks[0]?.images, [
    { alt: "Battle map", url: "../images/badr-map.png" },
    { alt: "Ali portrait", url: "../portraits/ali.webp" },
  ])
})

test("parseMarkdownToHtml renders markdown images as safe image elements", () => {
  const html = parseMarkdownToHtml(
    "Here is the map:\n\n![Battle map](../images/badr-map.png)",
    "history/badr" as any,
  )

  assert.match(html, /<img src="..\/images\/badr-map.png" alt="Battle map" loading="lazy">/)
})
