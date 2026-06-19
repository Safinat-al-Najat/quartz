import assert from "node:assert/strict"
import test from "node:test"
import remarkParse from "remark-parse"
import { unified } from "unified"
import { VFile } from "vfile"

import { FrontMatter } from "./frontmatter"
import type { BuildCtx } from "../../util/ctx"

function createProcessor() {
  const ctx = {
    cfg: {
      configuration: {
        locale: "en-US",
      },
    },
    allSlugs: [],
  } as unknown as BuildCtx

  return unified()
    .use(remarkParse)
    .use(FrontMatter().markdownPlugins?.(ctx) ?? [])
}

test("FrontMatter ignores scalar YAML frontmatter instead of crashing", async () => {
  const file = new VFile({
    path: "content/AYAH E TAT'HEER.md",
    value: '---\n<div class="home-bismillah">Bismillah</div>\n---\n\n# Body',
  })

  const processor = createProcessor()
  const ast = processor.parse(file)

  await processor.run(ast, file)

  assert.equal(file.data.frontmatter?.title, "AYAH E TAT'HEER")
})
