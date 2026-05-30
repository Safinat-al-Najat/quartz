import { FullSlug } from "../../util/path"
import { extractContextChunks, parseMarkdownToHtml, shouldAttachImages } from "./chatbot.helpers"

type ChatbotStoredMessage =
  | { sender: "user" | "system" | "error"; text: string }
  | { sender: "bot"; html: string; text?: string }

type ChatbotConversationTurn = {
  role: "user" | "assistant"
  content: string
}

declare global {
  interface Window {
    __quartzChatbotMessages?: ChatbotStoredMessage[]
    __quartzChatbotExpanded?: boolean
  }
}

if (typeof window.addCleanup !== "function") {
  window.addCleanup = () => {}
}

async function setupChatbot(container: HTMLElement, data: ContentIndex, currentSlug: FullSlug) {
  const toggleBtn = container.querySelector("#chatbot-toggle-btn") as HTMLButtonElement
  const sizeBtn = container.querySelector("#chatbot-size-btn") as HTMLButtonElement
  const closeBtn = container.querySelector("#chatbot-close-btn") as HTMLButtonElement
  const chatWindow = container.querySelector("#chatbot-window") as HTMLDivElement
  const messagesContainer = container.querySelector("#chatbot-messages") as HTMLDivElement
  const inputForm = container.querySelector("#chatbot-input-form") as HTMLFormElement
  const inputField = container.querySelector("#chatbot-input") as HTMLInputElement
  const submitBtn = container.querySelector("#chatbot-submit") as HTMLButtonElement

  if (
    !toggleBtn ||
    !sizeBtn ||
    !closeBtn ||
    !chatWindow ||
    !messagesContainer ||
    !inputForm ||
    !inputField ||
    !submitBtn
  ) {
    return
  }

  const proxyUrl =
    container.dataset.proxyUrl || "https://safinat-chatbot-proxy.workers.dev/api/chat"
  const addCleanup = typeof window.addCleanup === "function" ? window.addCleanup : () => {}
  window.__quartzChatbotMessages ??= []
  window.__quartzChatbotExpanded ??= false

  if (window.__quartzChatbotExpanded) {
    container.classList.add("chatbot-expanded")
    sizeBtn.setAttribute("aria-label", "Shrink Chatbot")
    sizeBtn.setAttribute("title", "Shrink")
  }

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

  const scrollMessagesToBottom = () => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight
  }

  const toggleSize = () => {
    const expanded = !container.classList.contains("chatbot-expanded")
    container.classList.toggle("chatbot-expanded", expanded)
    window.__quartzChatbotExpanded = expanded
    sizeBtn.setAttribute("aria-label", expanded ? "Shrink Chatbot" : "Expand Chatbot")
    sizeBtn.setAttribute("title", expanded ? "Shrink" : "Expand")
    scrollMessagesToBottom()
  }

  const closeLightbox = () => {
    container.querySelector(".chatbot-lightbox")?.remove()
  }

  const openLightbox = (image: HTMLImageElement) => {
    closeLightbox()

    const overlay = document.createElement("div")
    overlay.className = "chatbot-lightbox"
    overlay.setAttribute("role", "dialog")
    overlay.setAttribute("aria-modal", "true")
    overlay.setAttribute("aria-label", image.alt || "Expanded chat image")

    const closeButton = document.createElement("button")
    closeButton.className = "chatbot-lightbox-close"
    closeButton.type = "button"
    closeButton.setAttribute("aria-label", "Close expanded image")
    closeButton.textContent = "×"

    const expandedImage = document.createElement("img")
    expandedImage.src = image.currentSrc || image.src
    expandedImage.alt = image.alt || ""

    overlay.append(closeButton, expandedImage)
    container.appendChild(overlay)
  }

  const onMessagesClick = (event: MouseEvent) => {
    const image = (event.target as Element | null)?.closest(".chatbot-content img")
    if (image instanceof HTMLImageElement) {
      openLightbox(image)
    }
  }

  const onLightboxClick = (event: MouseEvent) => {
    const target = event.target as Element | null
    if (
      target?.closest(".chatbot-lightbox-close") ||
      target?.classList.contains("chatbot-lightbox")
    ) {
      closeLightbox()
    }
  }

  const onLightboxKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      closeLightbox()
    }
  }

  toggleBtn.addEventListener("click", openChat)
  addCleanup(() => toggleBtn.removeEventListener("click", openChat))

  sizeBtn.addEventListener("click", toggleSize)
  addCleanup(() => sizeBtn.removeEventListener("click", toggleSize))

  closeBtn.addEventListener("click", closeChat)
  addCleanup(() => closeBtn.removeEventListener("click", closeChat))

  messagesContainer.addEventListener("click", onMessagesClick)
  addCleanup(() => messagesContainer.removeEventListener("click", onMessagesClick))

  container.addEventListener("click", onLightboxClick)
  addCleanup(() => container.removeEventListener("click", onLightboxClick))

  document.addEventListener("keydown", onLightboxKeydown)
  addCleanup(() => document.removeEventListener("keydown", onLightboxKeydown))
  addCleanup(closeLightbox)

  const renderStoredMessage = (message: ChatbotStoredMessage) => {
    const bubble = document.createElement("div")
    bubble.className = `chatbot-message chatbot-${message.sender}`
    if (message.sender === "bot") {
      const content = document.createElement("div")
      content.className = "chatbot-content"
      content.innerHTML = message.html
      bubble.appendChild(content)
    } else {
      const p = document.createElement("p")
      p.textContent = message.text
      bubble.appendChild(p)
    }
    messagesContainer.appendChild(bubble)
    scrollMessagesToBottom()
    return bubble
  }

  const rememberMessage = (message: ChatbotStoredMessage) => {
    window.__quartzChatbotMessages ??= []
    window.__quartzChatbotMessages.push(message)
  }

  const getRecentUserContext = (currentQuestion: string) => {
    const priorUserMessages = (window.__quartzChatbotMessages ?? [])
      .filter((message): message is { sender: "user"; text: string } => message.sender === "user")
      .map((message) => message.text)
      .slice(-4)

    return [...priorUserMessages, currentQuestion].join("\n")
  }

  const getConversationHistory = (): ChatbotConversationTurn[] => {
    return (window.__quartzChatbotMessages ?? [])
      .flatMap((message): ChatbotConversationTurn[] => {
        if (message.sender === "user") {
          return [{ role: "user", content: message.text }]
        }
        if (message.sender === "bot" && message.text) {
          return [{ role: "assistant", content: message.text }]
        }
        return []
      })
      .slice(-10)
  }

  const addMessage = (text: string, sender: "user" | "error" | "system") => {
    const message = { sender, text } satisfies ChatbotStoredMessage
    rememberMessage(message)
    return renderStoredMessage(message)
  }

  if (window.__quartzChatbotMessages.length > 0) {
    messagesContainer.innerHTML = ""
    for (const message of window.__quartzChatbotMessages) {
      renderStoredMessage(message)
    }
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
    const retrievalQuery = getRecentUserContext(question)
    const contextChunks = extractContextChunks(retrievalQuery, data, currentSlug)
    const contextImages = contextChunks.flatMap((chunk) => chunk.images || [])
    const allowedImageUrls = new Set(contextImages.map((image) => image.url))
    const conversationHistory = getConversationHistory()

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
        body: JSON.stringify({ question, conversationHistory, contextChunks }),
      })

      // Clean typing class and indicator
      textNode.innerHTML = ""

      if (!response.ok) {
        if (response.status === 429) {
          textNode.innerHTML =
            "<p>Rate limit exceeded. Please wait a moment before trying again.</p>"
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
      let finalBotHtml = ""

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
                finalBotHtml = parseMarkdownToHtml(botResponseText, currentSlug, allowedImageUrls)
                textNode.innerHTML = finalBotHtml
                scrollMessagesToBottom()
              }
            } catch {
              // Ignore partial JSON chunks
            }
          }
        }
      }

      if (shouldAttachImages(question) && contextImages.length > 0) {
        const responseHasAllowedImage = contextImages.some((image) =>
          botResponseText.includes(`](${image.url})`),
        )
        if (!responseHasAllowedImage) {
          const imageMarkdown = contextImages
            .slice(0, 3)
            .map((image) => `![${image.alt || "Image"}](${image.url})`)
            .join("\n\n")
          botResponseText = `${botResponseText.trim()}\n\n${imageMarkdown}`.trim()
          finalBotHtml = parseMarkdownToHtml(botResponseText, currentSlug, allowedImageUrls)
          textNode.innerHTML = finalBotHtml
          scrollMessagesToBottom()
        }
      }

      if (finalBotHtml) {
        rememberMessage({ sender: "bot", html: finalBotHtml, text: botResponseText })
      }
    } catch (err: any) {
      textNode.innerHTML = `<p>Connection Error: ${err.message || err}.</p>`
      botBubble.className = "chatbot-message chatbot-error"
      rememberMessage({ sender: "error", text: `Connection Error: ${err.message || err}.` })
    } finally {
      inputField.disabled = false
      submitBtn.disabled = false
      inputField.focus()
      scrollMessagesToBottom()
    }
  }

  inputForm.addEventListener("submit", onSubmit)
  addCleanup(() => inputForm.removeEventListener("submit", onSubmit))
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
