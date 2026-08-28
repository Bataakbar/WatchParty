export function safeSendMessage<T = unknown>(
  message: unknown,
  responseCallback?: (response: T | undefined) => void,
): void {
  try {
    if (typeof chrome !== "undefined" && chrome.runtime?.id) {
      chrome.runtime.sendMessage(message, (res) => {
        const _err = chrome.runtime?.lastError;
        if (responseCallback && !_err) {
          responseCallback(res as T);
        }
      });
    }
  } catch {
    // Context invalidated or extension reloaded
  }
}

export function safeTabSendMessage<T = unknown>(
  tabId: number,
  message: unknown,
  options?: chrome.tabs.MessageSendOptions,
  responseCallback?: (response: T | undefined) => void,
): void {
  try {
    if (typeof chrome !== "undefined" && chrome.tabs?.sendMessage) {
      if (options) {
        chrome.tabs.sendMessage(tabId, message, options, (res) => {
          const _err = chrome.runtime?.lastError;
          if (responseCallback && !_err) {
            responseCallback(res as T);
          }
        });
      } else {
        chrome.tabs.sendMessage(tabId, message, (res) => {
          const _err = chrome.runtime?.lastError;
          if (responseCallback && !_err) {
            responseCallback(res as T);
          }
        });
      }
    }
  } catch {
    // Tab or extension context unavailable
  }
}
