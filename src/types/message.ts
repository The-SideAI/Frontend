/**
 * 메시지 발신자 타입
 */
export type MessageSender = "ME" | "OTHER";

/**
 * 메시지 타입
 */
export type MessageType = "text" | "image";

/**
 * 수집된 메시지 데이터 구조
 */
export interface CollectedMessage {
  /** 메시지 고유 ID */
  id: string;
  
  /** 메시지 타입 (텍스트 또는 이미지) */
  type: MessageType;
  
  /** 발신자 (나 또는 상대방) */
  sender: MessageSender;
  
  /** 메시지 내용 (텍스트 또는 이미지 URL) */
  content: string;
  
  /** 메시지 원본 타임스탬프 (없을 수 있음) */
  timestamp: number | null;
  
  /** 수집된 시각 (정렬 보조용) */
  collectedAt: number;
}

/**
 * 인스타그램 DM 인터셉트 메시지
 */
export interface InstaDmInterceptMessage {
  type: "INSTA_DM_INTERCEPT";
  messages: CollectedMessage[];
  totalCount: number;
}

/**
 * 백엔드 전송용 데이터
 */
export interface BackendPayload {
  action: "SEND_TO_SERVER";
  data: InstaDmInterceptMessage;
}