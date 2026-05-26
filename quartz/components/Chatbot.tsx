import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
// @ts-ignore
import style from "./styles/chatbot.scss"
// @ts-ignore
import script from "./scripts/chatbot.inline"

export interface ChatbotOptions {
  proxyUrl: string
}

const defaultOptions: ChatbotOptions = {
  proxyUrl: "https://safinat-chatbot-proxy.workers.dev/api/chat",
}

export default ((userOpts?: Partial<ChatbotOptions>) => {
  const Chatbot: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
    const opts = { ...defaultOptions, ...userOpts }
    return (
      <div id="quartz-chatbot" class={displayClass} data-proxy-url={opts.proxyUrl}>
        <button id="chatbot-toggle-btn" class="chatbot-toggle-btn" aria-label="Open Chatbot">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </button>
        <div id="chatbot-window" class="chatbot-window chatbot-hidden">
          <div class="chatbot-header">
            <div class="chatbot-header-title">
              <span class="chatbot-status-indicator"></span>
              <h3>Research Assistant</h3>
            </div>
            <div class="chatbot-header-actions">
              <button
                id="chatbot-size-btn"
                class="chatbot-icon-btn"
                aria-label="Expand Chatbot"
                title="Expand"
              >
                <svg
                  class="chatbot-expand-icon"
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M15 3h6v6"></path>
                  <path d="M9 21H3v-6"></path>
                  <path d="M21 3l-7 7"></path>
                  <path d="M3 21l7-7"></path>
                </svg>
                <svg
                  class="chatbot-shrink-icon"
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M8 3v5H3"></path>
                  <path d="M16 21v-5h5"></path>
                  <path d="M3 8l5-5"></path>
                  <path d="M21 16l-5 5"></path>
                </svg>
              </button>
              <button id="chatbot-close-btn" class="chatbot-icon-btn" aria-label="Close Chatbot">
                &times;
              </button>
            </div>
          </div>
          <div id="chatbot-messages" class="chatbot-messages">
            <div class="chatbot-message chatbot-system">
              <p>
                Welcome! Ask me any question related to the research notes on this site, and I will
                search the local content index to find answers for you.
              </p>
            </div>
          </div>
          <form id="chatbot-input-form" class="chatbot-input-form">
            <input
              type="text"
              id="chatbot-input"
              class="chatbot-input"
              placeholder="Ask a question about the notes..."
              autocomplete="off"
              required
            />
            <button type="submit" id="chatbot-submit" class="chatbot-submit" aria-label="Send">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </form>
        </div>
      </div>
    )
  }

  Chatbot.afterDOMLoaded = script
  Chatbot.css = style

  return Chatbot
}) satisfies QuartzComponentConstructor
