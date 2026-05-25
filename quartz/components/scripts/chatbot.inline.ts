import { ContentIndex, ContentDetails } from "../../plugins/emitters/contentIndex"
import { FullSlug, resolveRelative, isAbsoluteURL } from "../../util/path"

// Stop words to clean user question for keyword search matching
const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "arent",
  "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
  "cant", "cannot", "could", "couldnt", "did", "didnt", "do", "does", "doesnt", "doing", "dont",
  "down", "during", "each", "few", "for", "from", "further", "had", "hadnt", "has", "hasnt", "have",
  "havent", "having", "he", "hed", "hell", "hes", "her", "here", "heres", "hers", "herself", "him",
  "himself", "his", "how", "hows", "i", "id", "ill", "im", "ive", "if", "in", "into", "is", "isnt",
  "it", "its", "itself", "lets", "me", "more", "most", "mustnt", "my", "myself", "no", "nor", "not",
  "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out",
  "over", "own", "same", "shant", "she", "shed", "shell", "shes", "should", "shouldnt", "so", "some",
  "such", "than", "that", "thats", "the", "their", "theirs", "them", "themselves", "then", "there",
  "theres", "these", "they", "theyd", "theyll", "theyre", "theyve", "this", "those", "through",
  "to", "too", "under", "until", "up", "very", "was", "wasnt", "we", "wed", "well", "were", "weve",
  "werent", "what", "whats", "when", "whens", "where", "wheres", "which", "while", "who", "whos",
  "whom", "why", "whys", "with", "wont", "would", "wouldnt", "you", "youd", "youll", "youre", "youve",
  "your", "yours", "yourself", "yourselves"
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // strip punctuation
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
}

function extractContextChunks(question: string, data: ContentIndex) {
  const keywords = tokenize(question)
  if (keywords.length === 0) return []

  const scoredEntries: { slug: string; score: number; details: ContentDetails }[] = []

  for (const [slug, fileData] of Object.entries<ContentDetails>(data)) {
    let score = 0
    const titleLower = (fileData.title || "").toLowerCase()
    const contentLower = (fileData.content || "").toLowerCase()
    const tags = fileData.tags || []

    for (const keyword of keywords) {
      // Title Match: High weight (5x)
      if (titleLower.includes(keyword)) {
        score += 5
      }

      // Content/Body Match: 1x per frequency occurrence
      if (contentLower.includes(keyword)) {
        const occurrences = contentLower.split(keyword).length - 1
        score += occurrences * 1
      }

      // Tag Match: Moderate weight (3x)
      for (const tag of tags) {
        if (tag.toLowerCase().includes(keyword)) {
          score += 3
        }
      }
    }

    if (score > 0) {
      scoredEntries.push({ slug, score, details: fileData })
    }
  }

  // Sort by score descending
  scoredEntries.sort((a, b) => b.score - a.score)

  // Cap at top 5 context chunks to balance relevance and token counts
  return scoredEntries.slice(0, 5).map((entry) => ({
    title: entry.details.title || entry.slug,
    slug: entry.slug,
    content: entry.details.content || "",
  }))
}

// Custom Stream-Safe Markdown Parsers
function parseBold(text: string): string {
  const parts = text.split("**")
  let html = ""
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      html += parts[i]
    } else {
      // Automatically wrap unclosed trailing asterisks safely in strong tags
      html += `<strong>${parts[i]}</strong>`
    }
  }
  return html
}

function resolveMarkdownLink(href: string, currentSlug: FullSlug): string {
  if (isAbsoluteURL(href) || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return href
  }
  let target = href
  if (target.startsWith("/")) {
    target = target.substring(1)
  }
  return resolveRelative(currentSlug, target as FullSlug)
}

function parseInlineMarkdown(text: string, currentSlug: FullSlug): string {
  // Safe HTML escapes keeping UTF-8 special characters intact
  let escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

  // Inline code: extract `code` spans first so their contents are protected
  // from bold/link processing. Use a placeholder approach for stream safety.
  const codeSpans: string[] = []
  escaped = escaped.replace(/`([^`]+)`/g, (_match, code) => {
    const idx = codeSpans.length
    codeSpans.push(`<code>${code}</code>`)
    return `\x00CODE${idx}\x00`
  })

  escaped = parseBold(escaped)

  // Link parsing: convert [title](href)
  const linkRegex = /\[([^\]]*?)\]\(([^)]*?)\)/g
  escaped = escaped.replace(linkRegex, (_match, linkText, href) => {
    const resolvedHref = resolveMarkdownLink(href, currentSlug)
    return `<a href="${resolvedHref}">${linkText}</a>`
  })

  // Restore code spans from placeholders
  for (let i = 0; i < codeSpans.length; i++) {
    escaped = escaped.replace(`\x00CODE${i}\x00`, codeSpans[i])
  }

  return escaped
}

function parseMarkdownToHtml(markdown: string, currentSlug: FullSlug): string {
  const normalized = markdown.replace(/\r\n/g, "\n")
  const blocks = normalized.split(/\n\n+/)
  let html = ""

  for (const block of blocks) {
    const trimmedBlock = block.trim()
    if (!trimmedBlock) continue

    // Heading detection: render ### / ## / # as bold paragraphs
    // to keep DOM flat and stream-safe (no <h1>-<h6> nesting concerns)
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

async function setupChatbot(container: HTMLElement, data: ContentIndex, currentSlug: FullSlug) {
  const toggleBtn = container.querySelector("#chatbot-toggle-btn") as HTMLButtonElement
  const closeBtn = container.querySelector("#chatbot-close-btn") as HTMLButtonElement
  const chatWindow = container.querySelector("#chatbot-window") as HTMLDivElement
  const messagesContainer = container.querySelector("#chatbot-messages") as HTMLDivElement
  const inputForm = container.querySelector("#chatbot-input-form") as HTMLFormElement
  const inputField = container.querySelector("#chatbot-input") as HTMLInputElement
  const submitBtn = container.querySelector("#chatbot-submit") as HTMLButtonElement

  if (!toggleBtn || !closeBtn || !chatWindow || !messagesContainer || !inputForm || !inputField || !submitBtn) {
    return
  }

  const proxyUrl = container.dataset.proxyUrl || "https://safinat-chatbot-proxy.workers.dev/api/chat"

  // Restore toggle state
  const isChatOpen = sessionStorage.getItem("chatbot-open") === "true"
  if (isChatOpen) {
    chatWindow.classList.remove("chatbot-hidden")
    container.classList.add("chatbot-window-active")
  }

  // Handle open
  const openChat = () => {
    chatWindow.classList.remove("chatbot-hidden")
    container.classList.add("chatbot-window-active")
    sessionStorage.setItem("chatbot-open", "true")
    inputField.focus()
  }

  // Handle close
  const closeChat = () => {
    chatWindow.classList.add("chatbot-hidden")
    container.classList.remove("chatbot-window-active")
    sessionStorage.setItem("chatbot-open", "false")
  }

  toggleBtn.addEventListener("click", openChat)
  window.addCleanup(() => toggleBtn.removeEventListener("click", openChat))

  closeBtn.addEventListener("click", closeChat)
  window.addCleanup(() => closeBtn.removeEventListener("click", closeChat))

  const scrollMessagesToBottom = () => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight
  }

  const addMessage = (text: string, sender: "user" | "bot" | "error" | "system") => {
    const bubble = document.createElement("div")
    bubble.className = `chatbot-message chatbot-${sender}`
    const p = document.createElement("p")
    p.textContent = text
    bubble.appendChild(p)
    messagesContainer.appendChild(bubble)
    scrollMessagesToBottom()
    return bubble
  }

  // Submit Handler
  const onSubmit = async (e: Event) => {
    e.preventDefault()
    const question = inputField.value.trim()
    if (!question) return

    // Clean input and disable submission during request lifecycle
    inputField.value = ""
    inputField.disabled = true
    submitBtn.disabled = true

    // Render user message bubble
    addMessage(question, "user")

    // Retrieve matching context notes from local search index
    const contextChunks = extractContextChunks(question, data)

    // Render temporary typing indicator bubble
    const botBubble = document.createElement("div")
    botBubble.className = "chatbot-message chatbot-bot"
    const textNode = document.createElement("div")
    textNode.className = "chatbot-content"
    textNode.innerHTML = '<p class="chatbot-typing">...</p>'
    botBubble.appendChild(textNode)
    messagesContainer.appendChild(botBubble)
    scrollMessagesToBottom()

    try {
      const response = await fetch(proxyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question, contextChunks }),
      })

      // Clean typing class and indicator
      textNode.innerHTML = ""

      if (!response.ok) {
        if (response.status === 429) {
          textNode.innerHTML = "<p>Rate limit exceeded. Please wait a moment before trying again.</p>"
          botBubble.className = "chatbot-message chatbot-error"
        } else {
          textNode.innerHTML = `<p>Error: Unable to fetch response (Status ${response.status}).</p>`
          botBubble.className = "chatbot-message chatbot-error"
        }
        return
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let sseBuffer = ""
      let botResponseText = ""

      if (!reader) {
        textNode.innerHTML = "<p>Error: Stream reader not supported by browser response.</p>"
        botBubble.className = "chatbot-message chatbot-error"
        return
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        sseBuffer += decoder.decode(value, { stream: true })
        const lines = sseBuffer.split("\n")
        sseBuffer = lines.pop() || ""

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          if (trimmed.startsWith("data: ")) {
            const dataStr = trimmed.substring(6).trim()
            if (dataStr === "[DONE]") {
              break
            }
            try {
              const parsed = JSON.parse(dataStr)
              const deltaContent = parsed.choices?.[0]?.delta?.content
              if (deltaContent) {
                botResponseText += deltaContent
                textNode.innerHTML = parseMarkdownToHtml(botResponseText, currentSlug)
                scrollMessagesToBottom()
              }
            } catch {
              // Ignore partial JSON chunks
            }
          }
        }
      }

    } catch (err: any) {
      textNode.innerHTML = `<p>Connection Error: ${err.message || err}.</p>`
      botBubble.className = "chatbot-message chatbot-error"
    } finally {
      inputField.disabled = false
      submitBtn.disabled = false
      inputField.focus()
      scrollMessagesToBottom()
    }
  }

  inputForm.addEventListener("submit", onSubmit)
  window.addCleanup(() => inputForm.removeEventListener("submit", onSubmit))
}

// Quartz SPA nav hook
document.addEventListener("nav", async (e: CustomEventMap["nav"]) => {
  const currentSlug = e.detail.url
  const data = await fetchData
  const chatbotElement = document.getElementById("quartz-chatbot")
  if (chatbotElement) {
    await setupChatbot(chatbotElement, data, currentSlug)
  }
})
