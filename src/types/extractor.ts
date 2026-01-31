export type Platform = "instagram" | "telegram";

export interface TimeInfo {
  timestamp: number | null;
  text: string | null;
}

export interface MessageRecord {
  id: string;
  type: "text" | "image";
  sender: string;
  content: string;
  timestamp: number | null;
  timestampText: string | null;
  sequence: number;
  collectedAt: number;
}

export interface ExtractorConfig {
  chatContainer: string;
  textNodes: string;
  images: string;
}

export interface PlatformExtractor {
  config: ExtractorConfig;
  init?: () => void;
  extractUsername: () => { recipient?: string; me?: string };
  shouldFilterOut: (text: string) => boolean;
  findNearestTime: (node: Element) => TimeInfo | null;
  identifySpeaker: (node: Element) => string;
}

export interface MessageExtractorAPI {
  Instagram: PlatformExtractor;
  Telegram: PlatformExtractor;
  createStatusBox: (platform: string) => HTMLElement;
  normalizeContent: (text: string) => string;
  isElementInViewport: (el: Element) => boolean;
  sortMessages: (data: MessageRecord[]) => MessageRecord[];
  getStatistics: (data: MessageRecord[]) => {
    total: number;
    myMessages: number;
    otherMessages: number;
    textMessages: number;
    imageMessages: number;
    withTimestamp: number;
    withoutTimestamp: number;
  };
}
