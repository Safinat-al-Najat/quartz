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
