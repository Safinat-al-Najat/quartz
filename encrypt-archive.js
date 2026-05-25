import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { toHtml } from 'hast-util-to-html';

const CONTENT_DIR = path.resolve('content');
const BACKUP_DIR = path.resolve('.quartz-cache/backups');

// Helper to recursively find files matching an extension
function getFiles(dir, ext, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fp = path.join(dir, file);
    if (fs.statSync(fp).isDirectory()) {
      getFiles(fp, ext, fileList);
    } else if (file.endsWith(ext)) {
      fileList.push(fp);
    }
  }
  return fileList;
}

// Helper to clean up empty directories recursively
function removeEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  if (files.length > 0) {
    for (const file of files) {
      const fp = path.join(dir, file);
      if (fs.statSync(fp).isDirectory()) {
        removeEmptyDirs(fp);
      }
    }
  }
  // Check again after subdirs are removed
  if (fs.readdirSync(dir).length === 0 && dir !== BACKUP_DIR) {
    fs.rmdirSync(dir);
  }
}

// Compile Markdown body to HTML using the local remark/unified plugins
async function compileMarkdown(body) {
  const processor = unified()
    .use(remarkParse)
    .use(remarkRehype, { allowDangerousHtml: true });
  const mdAst = processor.parse(body);
  const htmlAst = await processor.run(mdAst);
  return toHtml(htmlAst, { allowDangerousHtml: true });
}

// Derive a 256-bit AES key from a plaintext password via SHA-256 hashing
function deriveKey(password) {
  return crypto.createHash('sha256').update(password).digest();
}

// Encrypt compiled HTML using AES-256-GCM
function encrypt(htmlString, key) {
  const iv = crypto.randomBytes(12); // 12-byte random IV
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(htmlString, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag(); // 16-byte auth tag
  const combined = Buffer.concat([ciphertext, tag]); // Append auth tag to ciphertext
  return {
    ivBase64: iv.toString('base64'),
    payloadBase64: combined.toString('base64')
  };
}

// Restore original files from backups
function restoreBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return 0;
  const backupFiles = getFiles(BACKUP_DIR, '.md');
  let count = 0;
  for (const backupFp of backupFiles) {
    const relativePath = path.relative(BACKUP_DIR, backupFp);
    const origFp = path.join(CONTENT_DIR, relativePath);
    
    // Ensure parent directory in content/ exists
    fs.mkdirSync(path.dirname(origFp), { recursive: true });
    
    fs.copyFileSync(backupFp, origFp);
    fs.unlinkSync(backupFp);
    count++;
    console.log(`[RESTORE] Restored ${relativePath}`);
  }
  removeEmptyDirs(BACKUP_DIR);
  if (fs.existsSync(BACKUP_DIR) && fs.readdirSync(BACKUP_DIR).length === 0) {
    fs.rmdirSync(BACKUP_DIR);
  }
  return count;
}

// Main execution block
async function main() {
  const args = process.argv.slice(2);
  const isRestore = args.includes('--restore');

  if (isRestore) {
    console.log('Running restoration process...');
    const count = restoreBackups();
    console.log(`Successfully restored ${count} files.`);
    return;
  }

  // Interruption Recovery: check for pre-existing backups and restore them first
  if (fs.existsSync(BACKUP_DIR) && getFiles(BACKUP_DIR, '.md').length > 0) {
    console.log(`Warning: Found leftover backup files. Restoring original content first...`);
    restoreBackups();
  }

  // Password Loading: env secret first, config file fallback
  let password = process.env.ARCHIVE_PASSWORD;
  const configPath = path.resolve('archive-config.json');

  if (!password && fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      password = config.password;
    } catch (e) {
      console.error('Error parsing archive-config.json:', e);
    }
  }

  if (!password) {
    console.error('CRITICAL ERROR: No decryption password found. Define ARCHIVE_PASSWORD env variable or create archive-config.json.');
    process.exit(1);
  }

  const key = deriveKey(password);
  const mdFiles = getFiles(CONTENT_DIR, '.md');
  let encryptCount = 0;

  for (const mdFp of mdFiles) {
    const fileContent = fs.readFileSync(mdFp, 'utf8');
    const { data, content: body } = matter(fileContent);

    if (data && data.locked === true) {
      console.log(`[ENCRYPT] Found locked page: ${path.relative(CONTENT_DIR, mdFp)}`);

      // 1. Save original note state to backup directory
      const relativePath = path.relative(CONTENT_DIR, mdFp);
      const backupFp = path.join(BACKUP_DIR, relativePath);
      fs.mkdirSync(path.dirname(backupFp), { recursive: true });
      fs.writeFileSync(backupFp, fileContent, 'utf8');

      // 2. Compile Markdown body to HTML
      const htmlContent = await compileMarkdown(body);

      // 3. Encrypt compiled HTML
      const { ivBase64, payloadBase64 } = encrypt(htmlContent, key);

      // 4. Overwrite original note with encrypted payload layout
      const payloadString = `${ivBase64}:${payloadBase64}`;
      const placeholderContent = matter.stringify(
        `\n<div id="encrypted-container" data-payload="${payloadString}">\n  <div class="lock-placeholder">This content is encrypted.</div>\n</div>\n`,
        data
      );
      fs.writeFileSync(mdFp, placeholderContent, 'utf8');
      encryptCount++;
    }
  }

  console.log(`Successfully encrypted ${encryptCount} pages.`);
}

main().catch(err => {
  console.error('Build-time pipeline error:', err);
  process.exit(1);
});
