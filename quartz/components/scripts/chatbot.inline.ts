import { FullSlug } from "../../util/path"
import { extractContextChunks, parseMarkdownToHtml } from "./chatbot.helpers"

if (typeof window.addCleanup !== "function") {
  window.addCleanup = () => {}
}

async function setupChatbot(container: HTMLElement, data: ContentIndex, currentSlug: FullSlug) {
  const toggleBtn = container.querySelector("#chatbot-toggle-btn") as HTMLButtonElement
  const closeBtn = container.querySelector("#chatbot-close-btn") as HTMLButtonElement
  const chatWindow = container.querySelector("#chatbot-window") as HTMLDivElement
  const messagesContainer = container.querySelector("#chatbot-messages") as HTMLDivElement
  const inputForm = container.querySelector("#chatbot-input-form") as HTMLFormElement
  const inputField = container.querySelector("#chatbot-input") as HTMLInputElement
  const submitBtn = container.querySelector("#chatbot-submit") as HTMLButtonElement

  if (
    !toggleBtn ||
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
  addCleanup(() => toggleBtn.removeEventListener("click", openChat))

  closeBtn.addEventListener("click", closeChat)
  addCleanup(() => closeBtn.removeEventListener("click", closeChat))

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
