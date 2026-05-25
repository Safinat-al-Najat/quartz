import fs from "fs"
import path from "path"
import crypto from "crypto"
import child_process from "child_process"
import matter from "gray-matter"
import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { toHtml } from "hast-util-to-html"

const CONTENT_DIR = path.resolve("content")
const LOCKED_DIR = path.join(CONTENT_DIR, "locked")
const BACKUP_DIR = path.resolve(".quartz-cache/backups")
const OBSIDIAN_IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".svg",
  ".webp",
])

function escapeHtmlAttribute(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function parseObsidianImageAlias(alias = "") {
  const trimmed = alias.trim()
  if (!trimmed) return { alt: "", width: "", height: "" }

  const dimensionOnlyMatch = trimmed.match(/^(\d+)(?:x(\d+))?$/)
  if (dimensionOnlyMatch) {
    const [, width = "", height = ""] = dimensionOnlyMatch
    return { alt: "", width, height }
  }

  const dimensionWithAltMatch = trimmed.match(/^(.*?)\|(\d+)(?:x(\d+))?$/)
  if (!dimensionWithAltMatch) {
    return { alt: trimmed, width: "", height: "" }
  }

  const [, rawAlt = "", width = "", height = ""] = dimensionWithAltMatch
  return { alt: rawAlt.trim(), width, height }
}

function encodeAssetPath(assetPath) {
  return assetPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
}

export function transformObsidianImageEmbeds(markdown) {
  return markdown.replace(
    /!\[\[([^\]\|\#]+)(?:#[^\]\|]+)?(?:\|([^\]]*))?\]\]/g,
    (match, rawPath, rawAlias) => {
      const assetPath = rawPath.trim()
      const ext = path.extname(assetPath).toLowerCase()
      if (!OBSIDIAN_IMAGE_EXTENSIONS.has(ext)) return match

      const { alt, width, height } = parseObsidianImageAlias(rawAlias)
      const attrs = [
        `src="${escapeHtmlAttribute(encodeAssetPath(assetPath))}"`,
        `alt="${escapeHtmlAttribute(alt)}"`,
      ]

      if (width) attrs.push(`width="${escapeHtmlAttribute(width)}"`)
      if (height) attrs.push(`height="${escapeHtmlAttribute(height)}"`)

      return `<img ${attrs.join(" ")} />`
    },
  )
}

// Helper to recursively find files matching an extension
function getFiles(dir, ext, fileList = []) {
  if (!fs.existsSync(dir)) return fileList
  const files = fs.readdirSync(dir)
  for (const file of files) {
    const fp = path.join(dir, file)
    if (fs.statSync(fp).isDirectory()) {
      getFiles(fp, ext, fileList)
    } else if (file.endsWith(ext)) {
      fileList.push(fp)
    }
  }
  return fileList
}

// Helper to clean up empty directories recursively
function removeEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return
  const files = fs.readdirSync(dir)
  if (files.length > 0) {
    for (const file of files) {
      const fp = path.join(dir, file)
      if (fs.statSync(fp).isDirectory()) {
        removeEmptyDirs(fp)
      }
    }
  }
  if (fs.readdirSync(dir).length === 0 && dir !== BACKUP_DIR) {
    fs.rmdirSync(dir)
  }
}

// Compile Markdown body to HTML
async function compileMarkdown(body) {
  body = transformObsidianImageEmbeds(body)
  const processor = unified().use(remarkParse).use(remarkRehype, { allowDangerousHtml: true })
  const mdAst = processor.parse(body)
  const htmlAst = await processor.run(mdAst)
  return toHtml(htmlAst, { allowDangerousHtml: true })
}

// Derive a 256-bit AES key from a plaintext password via SHA-256
function deriveKey(password) {
  return crypto.createHash("sha256").update(password).digest()
}

// Encrypt payload using AES-256-GCM
function encrypt(plaintext, key) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  const combined = Buffer.concat([ciphertext, tag])
  return {
    ivBase64: iv.toString("base64"),
    payloadBase64: combined.toString("base64"),
  }
}

// Restore original notes from backups
function restoreBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return 0
  const backupFiles = getFiles(BACKUP_DIR, ".md")
  let count = 0
  for (const backupFp of backupFiles) {
    const relativePath = path.relative(BACKUP_DIR, backupFp)
    const origFp = path.join(CONTENT_DIR, relativePath)

    fs.mkdirSync(path.dirname(origFp), { recursive: true })
    fs.copyFileSync(backupFp, origFp)
    fs.unlinkSync(backupFp)
    count++
    console.log(`[RESTORE] Restored ${relativePath}`)
  }
  removeEmptyDirs(BACKUP_DIR)
  if (fs.existsSync(BACKUP_DIR) && fs.readdirSync(BACKUP_DIR).length === 0) {
    fs.rmdirSync(BACKUP_DIR)
  }
  return count
}

// Perform boot-time recovery/restoration check for leftover backups (Crash Recovery)
function autoRestoreLeftovers() {
  if (fs.existsSync(BACKUP_DIR)) {
    const backupFiles = getFiles(BACKUP_DIR, ".md")
    if (backupFiles.length > 0) {
      console.warn(
        `[WARN] Found leftover backup files from a previous crashed build. Auto-restoring workspace before proceeding...`,
      )
      const count = restoreBackups()
      console.log(`[INFO] Restored ${count} notes successfully.`)
    }
  }
}

// Load password
function getMasterPassword() {
  let password = process.env.ARCHIVE_PASSWORD
  const configPath = path.resolve("archive-config.json")

  if (!password && fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"))
      password = config.password
    } catch (e) {
      console.error("Error parsing archive-config.json:", e)
    }
  }
  return password
}

async function encryptAll() {
  // Ensure the locked vault directory exists
  if (!fs.existsSync(LOCKED_DIR)) {
    console.log(`Creating missing locked vault directory: ${LOCKED_DIR}`)
    fs.mkdirSync(LOCKED_DIR, { recursive: true })
  }

  // Ensure index.md gateway file exists inside locked vault
  const gateIndexFp = path.join(LOCKED_DIR, "index.md")
  if (!fs.existsSync(gateIndexFp)) {
    console.log(`Creating missing gateway page: ${gateIndexFp}`)
    fs.writeFileSync(
      gateIndexFp,
      `---\ntitle: "Locked"\n---\n# Locked Vault\nThis is the secure vault gateway.\n`,
      "utf8",
    )
  }

  const password = getMasterPassword()
  if (!password) {
    console.error(
      "CRITICAL ERROR: No decryption password found. Define ARCHIVE_PASSWORD env variable or create archive-config.json.",
    )
    process.exit(1)
  }

  const key = deriveKey(password)

  // Generate and save build-time verification token for dynamic validation on any locked page (including folder pages)
  const verificationFile = path.resolve(".quartz-cache/verification.json")
  const verificationText = "archive-unlocked"
  const verificationEncrypted = encrypt(verificationText, key)
  const verificationToken = `${verificationEncrypted.ivBase64}:${verificationEncrypted.payloadBase64}`

  const cacheDir = path.dirname(verificationFile)
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true })
  }
  fs.writeFileSync(verificationFile, JSON.stringify({ verification: verificationToken }), "utf8")

  const mdFiles = getFiles(LOCKED_DIR, ".md")
  let encryptCount = 0

  for (const mdFp of mdFiles) {
    const fileContent = fs.readFileSync(mdFp, "utf8")
    const { data, content: body } = matter(fileContent)
    const relativePath = path.relative(CONTENT_DIR, mdFp)

    // Skip if it contains encrypted container already OR backup file already exists to prevent data loss
    const backupFp = path.join(BACKUP_DIR, relativePath)
    if (body.includes('id="encrypted-container"') || fs.existsSync(backupFp)) {
      console.log(`[SKIP] Already encrypted: ${relativePath}`)
      continue
    }

    console.log(`[ENCRYPT] Folder-level vault page: ${relativePath}`)

    // 1. Back up original note
    fs.mkdirSync(path.dirname(backupFp), { recursive: true })
    fs.writeFileSync(backupFp, fileContent, "utf8")

    // 2. Compile Markdown body to HTML
    const htmlContent = await compileMarkdown(body)
    const realTitle = data.title || path.basename(mdFp, ".md")

    // 3. Prepare JSON payload package
    // Pack original title and frontmatter along with the compiled HTML
    // Do NOT prepend duplicate H1 title here - Quartz's ArticleTitle component is naturally rendered and decrypted.
    const payload = {
      title: realTitle,
      frontmatter: data,
      html: htmlContent,
    }

    // 4. Encrypt JSON payload
    const { ivBase64, payloadBase64 } = encrypt(JSON.stringify(payload), key)
    const payloadString = `${ivBase64}:${payloadBase64}`

    // Encrypt the real title for dynamic sidebar/recent-notes decryption
    const encryptedTitle = encrypt(realTitle, key)
    const titlePayloadString = `${encryptedTitle.ivBase64}:${encryptedTitle.payloadBase64}`

    // 5. Build clean, metadata-purged placeholder content
    // Force title to 🔒 Locked Content, delete tags, description, aliases, summary, and set body to encrypted payload
    const purgedFrontmatter = {
      title: `🔒 Locked Content [${titlePayloadString}]`,
    }

    const placeholderContent = matter.stringify(
      `\n<div id="encrypted-container" data-payload="${payloadString}">\n  <div class="lock-placeholder">This content is encrypted.</div>\n</div>\n`,
      purgedFrontmatter,
    )

    fs.writeFileSync(mdFp, placeholderContent, "utf8")
    encryptCount++
  }

  console.log(`Successfully encrypted ${encryptCount} pages.`)
}

async function main() {
  const args = process.argv.slice(2)
  const isRestore = args.includes("--restore")
  const isBuild = args.includes("--build")

  if (isRestore) {
    console.log("Running restoration process...")
    const count = restoreBackups()
    console.log(`Successfully restored ${count} files.`)
    return
  }

  // Crash Loop Prevention: Always auto-restore leftovers on boot
  autoRestoreLeftovers()

  if (isBuild) {
    console.log("Starting Folder-Level Vault build pipeline...")
    await encryptAll()

    try {
      console.log("Spawning npx quartz build...")
      child_process.execSync("npx quartz build", { stdio: "inherit" })
      console.log("Build completed successfully.")
    } catch (e) {
      console.error("Compilation failed during npx quartz build:", e)
      process.exitCode = 1
    } finally {
      console.log("Restoring plaintext original notes...")
      const count = restoreBackups()
      console.log(`Restored ${count} note files.`)
    }
  } else {
    // Default mode: Encrypt in-place without compiling
    await encryptAll()
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  main().catch((err) => {
    console.error("Build-time pipeline error:", err)
    process.exit(1)
  })
}
