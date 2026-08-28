export interface ChatMessageData {
  id: string;
  username: string;
  role: "HOST" | "GUEST";
  message: string;
  createdAt: number;
}

export class ChatWidget {
  private container: HTMLDivElement | null = null;
  private shadow: ShadowRoot | null = null;
  private isOpen = false;
  private unreadCount = 0;
  private messages: ChatMessageData[] = [];
  private onSendCallback: ((text: string) => void) | null = null;
  private roomCode: string | null = null;

  constructor() {
    this.mount();
  }

  public setOnSend(cb: (text: string) => void): void {
    this.onSendCallback = cb;
  }

  public setRoomInfo(code: string): void {
    this.roomCode = code;
    this.updateHeader();
  }

  public addMessage(msg: ChatMessageData): void {
    if (this.messages.some((m) => m.id === msg.id)) return;
    this.messages.push(msg);
    if (!this.isOpen) {
      this.unreadCount++;
      this.updateBadge();
    }
    this.renderMessages();
  }

  private mount(): void {
    if (document.getElementById("wt-chat-overlay-root")) return;

    this.container = document.createElement("div");
    this.container.id = "wt-chat-overlay-root";
    this.container.style.position = "fixed";
    this.container.style.bottom = "24px";
    this.container.style.right = "24px";
    this.container.style.zIndex = "2147483647";
    this.container.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

    this.shadow = this.container.attachShadow({ mode: "open" });
    this.shadow.innerHTML = `
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        .chat-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, #06b6d4, #0284c7);
          color: #ffffff;
          border: none;
          border-radius: 9999px;
          padding: 12px 18px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(6, 182, 212, 0.4), 0 2px 6px rgba(0,0,0,0.3);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          user-select: none;
        }

        .chat-toggle:hover {
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 12px 28px rgba(6, 182, 212, 0.5);
        }

        .chat-toggle:active {
          transform: scale(0.98);
        }

        .toggle-icon {
          width: 20px;
          height: 20px;
        }

        .unread-badge {
          background: #ef4444;
          color: #ffffff;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 9999px;
          margin-left: 4px;
          display: none;
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }

        .chat-panel {
          display: none;
          flex-direction: column;
          width: 340px;
          height: 460px;
          background: rgba(15, 23, 42, 0.96);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 16px;
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(6, 182, 212, 0.15);
          overflow: hidden;
          animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(16px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .chat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: rgba(30, 41, 59, 0.8);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          color: #f8fafc;
        }

        .header-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: -0.01em;
        }

        .header-title svg {
          color: #22d3ee;
        }

        .room-badge {
          font-size: 11px;
          font-family: monospace;
          background: rgba(6, 182, 212, 0.15);
          color: #22d3ee;
          border: 1px solid rgba(6, 182, 212, 0.3);
          padding: 2px 6px;
          border-radius: 4px;
          letter-spacing: 0.05em;
        }

        .close-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.15s, background 0.15s;
        }

        .close-btn:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.1);
        }

        .messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          scroll-behavior: smooth;
        }

        .messages-container::-webkit-scrollbar {
          width: 5px;
        }

        .messages-container::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #64748b;
          text-align: center;
          font-size: 13px;
          gap: 8px;
        }

        .message-item {
          display: flex;
          flex-direction: column;
          gap: 3px;
          max-width: 90%;
        }

        .message-header {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
        }

        .sender-name {
          font-weight: 600;
          color: #cbd5e1;
        }

        .role-tag {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          padding: 1px 4px;
          border-radius: 3px;
        }

        .role-host {
          background: rgba(234, 179, 8, 0.2);
          color: #facc15;
          border: 1px solid rgba(234, 179, 8, 0.3);
        }

        .role-guest {
          background: rgba(148, 163, 184, 0.15);
          color: #94a3b8;
        }

        .msg-time {
          color: #475569;
          font-size: 10px;
          margin-left: auto;
        }

        .message-body {
          background: rgba(30, 41, 59, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: #f1f5f9;
          padding: 8px 12px;
          border-radius: 10px;
          border-top-left-radius: 2px;
          font-size: 13px;
          line-height: 1.4;
          word-break: break-word;
        }

        .chat-footer {
          padding: 10px 12px;
          background: rgba(15, 23, 42, 0.85);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .chat-input {
          flex: 1;
          background: rgba(30, 41, 59, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 8px;
          padding: 8px 12px;
          color: #ffffff;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }

        .chat-input::placeholder {
          color: #64748b;
        }

        .chat-input:focus {
          border-color: #06b6d4;
          box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.2);
        }

        .send-btn {
          background: #06b6d4;
          color: #ffffff;
          border: none;
          border-radius: 8px;
          padding: 8px 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s, transform 0.1s;
        }

        .send-btn:hover {
          background: #0891b2;
        }

        .send-btn:active {
          transform: scale(0.95);
        }
      </style>

      <button class="chat-toggle" id="wt-toggle-btn" title="Buka WatchTogether Chat">
        <svg class="toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <span>Chat</span>
        <span class="unread-badge" id="wt-unread-badge">0</span>
      </button>

      <div class="chat-panel" id="wt-chat-panel">
        <div class="chat-header">
          <div class="header-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
              <line x1="7" y1="2" x2="7" y2="22"></line>
              <line x1="17" y1="2" x2="17" y2="22"></line>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <line x1="2" y1="7" x2="7" y2="7"></line>
              <line x1="2" y1="17" x2="7" y2="17"></line>
              <line x1="17" y1="17" x2="22" y2="17"></line>
              <line x1="17" y1="7" x2="22" y2="7"></line>
            </svg>
            <span>Party Chat</span>
            <span class="room-badge" id="wt-room-code-badge">ROOM</span>
          </div>
          <button class="close-btn" id="wt-close-btn" title="Tutup Chat">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="messages-container" id="wt-messages-container">
          <div class="empty-state">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>Belum ada pesan. Mulai mengobrol!</span>
          </div>
        </div>

        <div class="chat-footer">
          <input type="text" class="chat-input" id="wt-chat-input" placeholder="Ketik pesan..." maxlength="500" autocomplete="off" />
          <button class="send-btn" id="wt-send-btn" title="Kirim">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(this.container);
    this.setupListeners();
  }

  private updateHeader(): void {
    if (!this.shadow) return;
    const badge = this.shadow.getElementById("wt-room-code-badge");
    if (badge) {
      badge.textContent = this.roomCode ? this.roomCode : "ROOM";
    }
  }

  private updateBadge(): void {
    if (!this.shadow) return;
    const badge = this.shadow.getElementById("wt-unread-badge");
    if (badge) {
      if (this.unreadCount > 0) {
        badge.textContent = this.unreadCount > 99 ? "99+" : String(this.unreadCount);
        badge.style.display = "inline-block";
      } else {
        badge.style.display = "none";
      }
    }
  }

  private setupListeners(): void {
    if (!this.shadow) return;

    const toggleBtn = this.shadow.getElementById("wt-toggle-btn");
    const closeBtn = this.shadow.getElementById("wt-close-btn");
    const panel = this.shadow.getElementById("wt-chat-panel");
    const input = this.shadow.getElementById("wt-chat-input") as HTMLInputElement | null;
    const sendBtn = this.shadow.getElementById("wt-send-btn");

    const toggleChat = (open: boolean) => {
      this.isOpen = open;
      if (panel && toggleBtn) {
        panel.style.display = open ? "flex" : "none";
        toggleBtn.style.display = open ? "none" : "flex";
      }
      if (open) {
        this.unreadCount = 0;
        this.updateBadge();
        this.scrollToBottom();
        setTimeout(() => input?.focus(), 50);
      }
    };

    toggleBtn?.addEventListener("click", () => toggleChat(true));
    closeBtn?.addEventListener("click", () => toggleChat(false));

    const handleSend = () => {
      if (!input) return;
      const text = input.value.trim();
      if (!text) return;
      if (this.onSendCallback) {
        this.onSendCallback(text);
      }
      input.value = "";
    };

    sendBtn?.addEventListener("click", handleSend);

    if (input) {
      input.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        } else if (e.key === "Escape") {
          toggleChat(false);
        }
      });
      input.addEventListener("keyup", (e) => e.stopPropagation());
      input.addEventListener("keypress", (e) => e.stopPropagation());
    }
  }

  private renderMessages(): void {
    if (!this.shadow) return;
    const container = this.shadow.getElementById("wt-messages-container");
    if (!container) return;

    if (this.messages.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <span>Belum ada pesan. Mulai mengobrol!</span>
        </div>
      `;
      return;
    }

    container.innerHTML = this.messages
      .map((msg) => {
        const timeStr = new Date(msg.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        const isHost = msg.role === "HOST";
        const roleBadge = `<span class="role-tag ${isHost ? "role-host" : "role-guest"}>${isHost ? "HOST" : "GUEST"}</span>`;
        const safeName = this.escapeHtml(msg.username);
        const safeBody = this.escapeHtml(msg.message);

        return `
          <div class="message-item">
            <div class="message-header">
              <span class="sender-name">${safeName}</span>
              ${roleBadge}
              <span class="msg-time">${timeStr}</span>
            </div>
            <div class="message-body">${safeBody}</div>
          </div>
        `;
      })
      .join("");

    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    if (!this.shadow) return;
    const container = this.shadow.getElementById("wt-messages-container");
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}
