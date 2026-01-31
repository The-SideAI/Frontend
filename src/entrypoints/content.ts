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

    // 초기화는 public/inject-init.js에서 수행
  },
});
