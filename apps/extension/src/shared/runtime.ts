export function isExtensionValid(): boolean {
  try {
    return (
      typeof chrome !== "undefined" &&
      typeof chrome.runtime !== "undefined" &&
      Boolean(chrome.runtime.id)
    );
  } catch {
    return false;
  }
}

export function safeSendMessage<T = unknown>(
  message: unknown,
  responseCallback?: (response: T | undefined) => void,
): boolean {
  if (!isExtensionValid()) return false;
  try {
    chrome.runtime.sendMessage(message, (res) => {
      const _err = chrome.runtime?.lastError;
      if (responseCallback && !_err) {
        responseCallback(res as T);
      }
    });
    return true;
  } catch {
    return false;
  }
}

export function safeTabSendMessage<T = unknown>(
  tabId: number,
  message: unknown,
  options?: chrome.tabs.MessageSendOptions,
  responseCallback?: (response: T | undefined) => void,
): boolean {
  if (!isExtensionValid()) return false;
  try {
    if (typeof chrome.tabs?.sendMessage === "function") {
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
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
