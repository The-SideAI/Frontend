import { browser } from "wxt/browser";
import type { PublicPath } from "wxt/browser";
import type {
  Platform,
  MessageRecord,
  MessageExtractorAPI,
} from "../types/extractor";

declare global {
  interface Window {
    MessageExtractor: MessageExtractorAPI;
    COLLECTED_DB: Map<string, MessageRecord>;
    PROCESSED_CONTENTS: Set<string>;
    showData: () => MessageRecord[];
    stopAndExport: () => MessageRecord[];
    analyzeMessages: () => void;
    checkApiHealth: () => void;
  }
}

export default defineContentScript({
  matches: [
    "*://*.instagram.com/*",
    "*://*.web.telegram.org/*"
  ],
  main() {
    const hostname = window.location.hostname;
    let platform: Platform | null = null;
    let platformFile: PublicPath | null = null;

    const platformFiles: Record<Platform, PublicPath> = {
      instagram: "/platforms/instagram.js" as PublicPath,
      telegram: "/platforms/telegram.js" as PublicPath,
    };
    
    if (hostname.includes('instagram.com')) {
      platform = 'instagram';
      platformFile = platformFiles.instagram;
    } else if (hostname.includes('web.telegram.org')) {
      platform = 'telegram';
      platformFile = platformFiles.telegram;
    }

    if (!platform || !platformFile) {
      console.error('[Extractor] Unsupported platform:', hostname);
      return;
    }

    console.log(`[Extractor] Detected platform: ${platform}`);
    void browser.storage.local.set({ currentPlatform: platform });

    const commonScript = document.createElement('script');
    commonScript.src = browser.runtime.getURL("/utils/common.js" as PublicPath);
    commonScript.onload = () => {
      console.log('[Extractor] Common utilities loaded');
      
      const platformScript = document.createElement('script');
      platformScript.src = browser.runtime.getURL(platformFile);
      platformScript.onload = () => {
        console.log(`[Extractor] Platform script loaded: ${platform}`);
        const initScript = document.createElement('script');
        initScript.src = browser.runtime.getURL('/inject-init.js' as PublicPath);
        initScript.dataset.platform = platform;
        initScript.onload = () => {
          initScript.remove();
        };
        (document.head || document.documentElement).appendChild(initScript);
      };
      platformScript.onerror = (error) => {
        console.error(`[Extractor] Failed to load platform script:`, error);
      };
      (document.head || document.documentElement).appendChild(platformScript);
    };
    commonScript.onerror = (error) => {
      console.error('[Extractor] Failed to load common utilities:', error);
    };
    (document.head || document.documentElement).appendChild(commonScript);

    const SOURCE = "dm-collector";

    const buildSelectionLabel = (payload: {
      type: "text" | "image";
      content: string;
    }) => {
      return payload.type === "image" ? "[이미지]" : payload.content;
    };

    let conversationStartLabel: string | null = null;

    const applySelection = async (payload: {
      type: "text" | "image";
      content: string;
      sender: string;
      timestamp: number | null;
      timestampText: string | null;
    }) => {
      const label = buildSelectionLabel({
        type: payload.type,
        content: payload.content,
      });

      const updates: Record<string, string> = {};
      if (!conversationStartLabel) {
        conversationStartLabel = label;
        updates.conversationStart = label;
      } else {
        updates.conversationEnd = label;
      }

      await browser.runtime.sendMessage({
        type: "SELECTION_UPDATED",
        ...updates,
      });
    };

    type AnalyzeMessagesRequest = {
      type: "ANALYZE_MESSAGES";
      payload: {
        messages: MessageRecord[];
        sourceUrl: string;
      };
    };

    type CheckHealthRequest = {
      type: "CHECK_API_HEALTH";
    };

    type ApiRequest = AnalyzeMessagesRequest | CheckHealthRequest;

    // API 요청 처리
    const handleApiRequest = async (data: ApiRequest) => {
      if (data.type === "ANALYZE_MESSAGES") {
        try {
          console.log('[Content] Forwarding analysis request to background');
          const response = await browser.runtime.sendMessage({
            type: "ANALYZE_MESSAGES",
            payload: data.payload
          });

          console.log('[Content] Background response:', response);

          if (response && response.success) {
            console.log('[Content] Analysis result:', response.result);
            
            // 결과를 페이지로 전송
            window.postMessage({
              source: SOURCE,
              type: "ANALYSIS_RESULT",
              payload: response.result
            }, '*');
          } else {
            console.error('[Content] Analysis failed:', response?.error);
            console.error('[Content] Full response:', response);
          }
        } catch (error: unknown) {
          const err = error instanceof Error ? error : new Error(String(error));
          console.error('[Content] API request failed:', err);
          console.error('[Content] Error details:', {
            name: err.name,
            message: err.message,
            stack: err.stack
          });
        }
      } else if (data.type === "CHECK_API_HEALTH") {
        try {
          console.log('[Content] Checking API health');
          const response = await browser.runtime.sendMessage({
            type: "CHECK_API_HEALTH"
          });

          console.log('[Content] Health check response:', response);

          if (response && response.success) {
            console.log('[Content] API Health: ✅', response.health);
          } else {
            console.error('[Content] Health check failed: ❌', response?.error);
            console.error('[Content] Full response:', response);
          }
        } catch (error: unknown) {
          const err = error instanceof Error ? error : new Error(String(error));
          console.error('[Content] Health check failed:', err);
          console.error('[Content] Error details:', {
            name: err.name,
            message: err.message
          });
        }
      }
    };

    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.source !== SOURCE) return;

      // 버블 선택 처리
      if (data.type === "MESSAGE_BUBBLE_SELECTED") {
        void applySelection(data.payload);
      }

      // API 요청 처리
      if (data.type === "ANALYZE_MESSAGES" || data.type === "CHECK_API_HEALTH") {
        void handleApiRequest(data as ApiRequest);
      }
    });

    // 백그라운드에서 온 분석 결과 처리
    browser.runtime.onMessage.addListener((message) => {
      if (message.type === "RESET_SELECTIONS") {
        conversationStartLabel = null;
        return;
      }

      if (message.type === "ANALYSIS_RESULT") {
        console.log('[Content] Received analysis result:', message.payload);
        
        // 결과를 페이지로 전달
        window.postMessage({
          source: SOURCE,
          type: "ANALYSIS_RESULT",
          payload: message.payload
        }, '*');
      }
    });
  },
});