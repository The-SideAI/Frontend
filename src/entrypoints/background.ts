export default defineBackground(() => {
  let pinnedWindowId: number | null = null;

  const API_BASE_URL = 'https://8e661f568157.ngrok-free.app';

  interface AnalyzeMessage {
    type: string;
    content: string;
    sender: string;
  }

  // API: 메시지 분석 요청
  const analyzeMessages = async (uuid: string, messages: AnalyzeMessage[], sourceUrl: string) => {
    console.log('[API] Analyzing messages:', {
      url: `${API_BASE_URL}/api/detection/analyze`,
      uuid: uuid,
      messageCount: messages.length,
      sourceUrl: sourceUrl
    });

    try {
      const payload = {
        uuid: uuid,
        messages: messages.map(msg => ({
          type: msg.type === 'image' ? 'IMAGE' : 'TEXT',
          content: msg.content,
          sender: msg.sender
        })),
        sourceUrl: sourceUrl
      };

      console.log('[API] Request payload:', JSON.stringify(payload, null, 2));

      const response = await fetch(`${API_BASE_URL}/api/detection/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          "ngrok-skip-browser-warning": "69420"
        },
        body: JSON.stringify(payload)
      });

      console.log('[API] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[API] Error response:', errorText);
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('[API] Analysis result:', result);
      return result;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[API] Failed to analyze messages:', {
        name: err.name,
        message: err.message,
        stack: err.stack
      });
      throw err;
    }
  };

  // API: 헬스 체크
  const checkHealth = async () => {
    console.log('[API] Health check:', `${API_BASE_URL}/api/detection/health`);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/detection/health`);
      
      console.log('[API] Health response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[API] Health check error:', errorText);
        throw new Error(`Health check failed: ${response.status} - ${errorText}`);
      }
      
      const result = await response.text();
      console.log('[API] Health check result:', result);
      return result;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[API] Health check failed:', {
        name: err.name,
        message: err.message,
        type: err.constructor.name
      });
      
      // CORS 에러 체크
      if (err.message.includes('Failed to fetch') || err.name === 'TypeError') {
        console.error('[API] Possible CORS issue or server not running at:', API_BASE_URL);
      }
      
      throw err;
    }
  };

  // UUID 생성
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const sendCategoryToBackend = async (category: string) => {
    console.log("[Backend] Ready to send category", category);
    await browser.storage.local.set({ category: category });
  };

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Background] Received message:', message?.type);
    
    if (!message || typeof message !== "object") {
      console.log('[Background] Invalid message format');
      sendResponse({ success: false, error: 'Invalid message' });
      return false;
    }

    if (message.type === "PERMISSION_GRANTED") {
      browser.storage.local.set({ hasPermission: true }).then(() => {
        sendResponse({ success: true });
      });
      return true; // 비동기 응답을 위해 필수!
    }

    if (message.type === "CATEGORY_SELECTED") {
      if (typeof message.category === "string") {
        sendCategoryToBackend(message.category).then(() => {
          sendResponse({ success: true });
        });
        return true;
      }
    }

    // 메시지 분석 요청
    if (message.type === "ANALYZE_MESSAGES") {
      const { messages, sourceUrl } = message.payload;
      const uuid = generateUUID();
      
      console.log('[Background] Analyzing messages:', {
        uuid,
        messageCount: messages.length,
        sourceUrl
      });

      analyzeMessages(uuid, messages, sourceUrl)
        .then((result) => {
          console.log('[Background] Analysis complete, result:', result);
          sendResponse({ success: true, result });
        })
        .catch((error: unknown) => {
          const err = error instanceof Error ? error : new Error(String(error));
          console.error('[Background] Analysis failed:', err);
          sendResponse({ success: false, error: err.message || 'Unknown error' });
        });
      
      return true; // 비동기 응답을 위해 필수!
    }

    // 헬스 체크 요청
    if (message.type === "CHECK_API_HEALTH") {
      console.log('[Background] Checking API health...');
      
      checkHealth()
        .then((health) => {
          console.log('[Background] Health check result:', health);
          sendResponse({ success: true, health });
        })
        .catch((error: unknown) => {
          const err = error instanceof Error ? error : new Error(String(error));
          console.error('[Background] Health check failed:', err);
          sendResponse({ success: false, error: err.message || 'Unknown error' });
        });
      
      return true; // 비동기 응답을 위해 필수!
    }

    if (message.type === "RESET_SELECTIONS") {
      browser.tabs.query({ active: true, currentWindow: true })
        .then((tabs) => {
          const tabId = tabs[0]?.id;
          if (!tabId) {
            sendResponse({ success: false, error: 'No active tab' });
            return;
          }
          return browser.tabs.sendMessage(tabId, { type: "RESET_SELECTIONS" })
            .then(() => sendResponse({ success: true }))
            .catch((err) => {
              sendResponse({ success: false, error: err?.message || 'Failed to send message' });
            });
        })
        .catch((err) => {
          sendResponse({ success: false, error: err?.message || 'Failed to query tabs' });
        });

      return true;
    }

    if (message.type === "OPEN_PINNED_POPUP") {
      if (pinnedWindowId) {
        sendResponse({ success: true });
        return false;
      }

      const url = browser.runtime.getURL("/popup.html?pinned=1" as `/popup.html${string}`);
      browser.windows.create({
        url,
        type: "popup",
        width: 420,
        height: 640,
      }).then((created) => {
        pinnedWindowId = created.id ?? null;
        sendResponse({ success: true });
      });
      
      return true;
    }
    
    sendResponse({ success: false, error: 'Unknown message type' });
    return false;
  });

  browser.windows.onRemoved.addListener((windowId) => {
    if (pinnedWindowId === windowId) {
      pinnedWindowId = null;
    }
  });

  // 시작 시 헬스 체크
  checkHealth().catch(err => {
    console.warn('[Background] API server may not be running:', err);
  });
});