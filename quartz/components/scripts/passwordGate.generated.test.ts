import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"

const root = process.cwd()

test("locked output page has encrypted payload and verification token", () => {
  const lockedIndex = fs.readFileSync(path.join(root, "public", "locked", "index.html"), "utf8")

  assert.match(lockedIndex, /id="encrypted-container"/)
  assert.match(lockedIndex, /data-payload="[^"]+"/)
  assert.match(lockedIndex, /id="password-gate-container"/)
  assert.match(lockedIndex, /data-verify="[^"]+"/)
})

test("locked content index does not expose plaintext vault text", () => {
  const contentIndex = fs.readFileSync(
    path.join(root, "public", "static", "contentIndex.json"),
    "utf8",
  )

  assert.doesNotMatch(contentIndex, /vault index/i)
  assert.doesNotMatch(contentIndex, /AES-256-GCM encryption/i)
})
