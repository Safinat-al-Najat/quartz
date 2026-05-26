import test from "node:test"
import assert from "node:assert/strict"
import { extractContextChunks, parseMarkdownToHtml, shouldAttachImages } from "./chatbot.helpers"

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

  const chunks = extractContextChunks("show badr map", index, "index" as any)

  assert.deepEqual(chunks[0]?.images, [
    { alt: "Battle map", url: "history/images/badr-map.png" },
    { alt: "Ali portrait", url: "portraits/ali.webp" },
  ])
})

test("extractContextChunks includes image metadata from the content index", () => {
  const index = {
    "hadith/cloak": {
      title: "Hadith E Kisa",
      content: "Hadith under the cloak with the Prophet, Fatima, Hasan, Husayn, and Ali.",
      images: [{ alt: "Hadith E Kisa", url: "../images/kisa.png" }],
      tags: ["hadith"],
    },
  } as any

  const chunks = extractContextChunks("show hadith kisa image", index, "index" as any)

  assert.deepEqual(chunks[0]?.images, [{ alt: "Hadith E Kisa", url: "images/kisa.png" }])
})

test("parseMarkdownToHtml renders markdown images as safe image elements", () => {
  const html = parseMarkdownToHtml(
    "Here is the map:\n\n![Battle map](../images/badr-map.png)",
    "history/badr" as any,
  )

  assert.match(html, /<img src="..\/images\/badr-map.png" alt="Battle map" loading="lazy">/)
})

test("parseMarkdownToHtml strips model-invented images when allowed image URLs are provided", () => {
  const html = parseMarkdownToHtml(
    "Here is one:\n\n![Made up image](missing.png)\n\n![Allowed](real.png)",
    "index" as any,
    new Set(["real.png"]),
  )

  assert.doesNotMatch(html, /missing\.png/)
  assert.match(html, /<img src="real.png" alt="Allowed" loading="lazy">/)
})

test("shouldAttachImages detects image requests without requiring exact wording", () => {
  assert.equal(shouldAttachImages("paste any hadith image from this site"), true)
  assert.equal(shouldAttachImages("an image of a hadith"), true)
  assert.equal(shouldAttachImages("tell me about a hadith"), false)
})
