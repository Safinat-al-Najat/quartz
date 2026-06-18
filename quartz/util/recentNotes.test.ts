import assert from "node:assert/strict"
import test from "node:test"

import type { QuartzPluginData } from "../plugins/vfile"
import type { FullSlug } from "./path"
import { shouldShowInNewTopics } from "./recentNotes"

const recentDate = new Date()
recentDate.setDate(recentDate.getDate() - 1)

function page(slug: string): QuartzPluginData {
  return {
    slug: slug as FullSlug,
    dates: {
      created: recentDate,
      modified: recentDate,
      published: recentDate,
    },
  }
}

test("New Topics excludes locked vault pages", () => {
  assert.equal(shouldShowInNewTopics(page("locked/NAMAZ/SALAT/Sections")), false)
})

test("New Topics keeps recent public pages", () => {
  assert.equal(shouldShowInNewTopics(page("RULINGS OF ISLAM/Namaz")), true)
})
