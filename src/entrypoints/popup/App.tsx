import { useEffect, useRef, useState } from "react";
import { browser } from "wxt/browser";
import { CustomSelect } from "./CustomSelect";
import { CustomDateTime } from "./CustomDateTime";
import "./App.css";

type Step = "login" | "loginForm" | "permission" | "denied" | "category" | "mode" | "conversation" | "purpose" | "analyzing" | "result" | "monitoring";

interface FormData {
  hasPermission: boolean;
  category: string;
  mode: "realtime" | "report" | "";
  selectionMode: "message" | "time";
  conversationStart: string;
  conversationEnd: string;
  conversationStartTime: string;
  conversationEndTime: string;
  purpose: string;
}

interface SelectionUpdatedMessage {
  type: "SELECTION_UPDATED";
  conversationStart?: string;
  conversationEnd?: string;
}

interface Message {
  type: "TEXT";
  content: string;
  sender: string;
  timestamp: string;
}

interface AnalyzeRequest {
  uuid: string;
  messages: Message[];
  platform: string;
  type: string;
}

interface ReasonItem {
  source: string;
  note: string;
}

interface AnalysisResult {
  riskLevel: string;
  summary: string;
  type: string;
  reason: ReasonItem[];
  recommendedQuestions: string[];
  recommendations?: string[];
}

function App() {
  const [step, setStep] = useState<Step>("login");
  const [loginEmail, setLoginEmail] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [formData, setFormData] = useState<FormData>({
    hasPermission: true,
    category: "",
    mode: "",
    selectionMode: "message",
    conversationStart: "시작 메세지를 선택해주세요",
    conversationEnd: "마지막 메세지를 선택해주세요",
    conversationStartTime: "",
    conversationEndTime: "",
    purpose: "",
  });
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [monitoringResult, setMonitoringResult] = useState<AnalysisResult | null>(null);
  const [monitoringIndex, setMonitoringIndex] = useState(0);
  const [currentPlatform, setCurrentPlatform] = useState<"instagram" | "telegram" | "">("");
  const [timeError, setTimeError] = useState<string>("");
  const selectionModeRef = useRef<FormData["selectionMode"]>("message");
  const pinnedInitRef = useRef(false);
  const monitoringTimerRef = useRef<number | null>(null);
  const rotationTimerRef = useRef<number | null>(null);

  // 콘텐츠에서 시간 제거하는 헬퍼 함수
  const cleanContent = (content: string): string => {
    // 다양한 시간 형식 제거
    // 1. \n\n이후의 시간 (예: "메세지\n\n10:11 PM")
    // 2. \n이후의 시간 (예: "메세지\n22:10")
    // 3. 마지막 줄의 시간만
    let cleaned = content
      // 아이콘 글리프(프라이빗 유즈 영역) 제거
      .replace(/[\uE000-\uF8FF\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}]+/gu, '')
      // 아이콘 + 시간 조합 제거 (예: "\n\n10:10 PM")
      .replace(/\n\s*[\uE000-\uF8FF\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}]+\s*\n?\s*\d{1,2}:\d{2}\s*(AM|PM|am|pm)?$/gu, '')
      .replace(/\n\n\d{1,2}:\d{2}\s*(AM|PM|am|pm)?$/i, '') // \n\n10:11 PM 형식
      .replace(/\n\d{1,2}:\d{2}\s*(AM|PM|am|pm)?$/i, '') // \n10:11 PM 형식
      .replace(/\n(\d{1,2}):(\d{2})$/, '') // \n22:10 형식
      .trim();
    
    // 맨 끝에 남은 빈 줄 제거
    cleaned = cleaned.replace(/\n+$/, '').trim();
    
    return cleaned;
  };

  // API 분석 함수
  const analyzeMessages = async (
    messages: Message[],
    platform: string,
    type: string
  ) => {
    const uuid = crypto.randomUUID();
    const payload: AnalyzeRequest = {
      uuid,
      messages,
      platform,
      type,
    };

    //console.log('\n========== 📤 API REQUEST ==========');
    //console.log('UUID: ' + uuid);
    //console.log('SourceUrl: ' + sourceUrl);
    //console.log('Messages Count: ' + messages.length);
    //console.log('Payload:', payload);
    //console.log('========== END REQUEST ==========\n');

    try {
      const response = await fetch("http://localhost:8080/api/detection/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`API 오류: ${response.status}`);
      }

      const result = await response.json();

      return {
        ...result,
        reason: Array.isArray(result.reason) ? result.reason : [],
        recommendedQuestions: Array.isArray(result.recommendedQuestions)
          ? result.recommendedQuestions
          : [],
        recommendations: Array.isArray(result.recommendations)
          ? result.recommendations.slice(0, 3)
          : [],
      } as AnalysisResult;
      
      //console.log('\n========== 📥 API RESPONSE ==========');
      //console.log('Risk Level: ' + result.riskLevel);
      //console.log('Type: ' + result.type);
      //console.log('Summary: ' + result.summary);
      //console.log('Next Question: ' + result.nextQuestion);
      //console.log('Reasons Count: ' + result.reason.length);
      //result.reason.forEach((r: ReasonItem, i: number) => {
      //  //console.log('  [' + (i + 1) + '] ' + r.source + ': ' + r.quote);
      //});
      //console.log('========== END RESPONSE ==========\n');
      
    } catch (error) {
      console.error("API 호출 실패:", error);
      throw error;
    }
  };

  const handleLoginKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleLoginSubmit();
    }
  };

  const getRiskBadgeClass = (riskLevel: string) => {
    const normalized = (riskLevel || "").toLowerCase();
    if (normalized === "normal") return "safe";
    if (["critical", "high", "medium", "low", "safe"].includes(normalized)) {
      return normalized;
    }
    return "safe";
  };

  useEffect(() => {
    if (!pinnedInitRef.current) {
      pinnedInitRef.current = true;
      const params = new URLSearchParams(window.location.search);
      const isPinned = params.get("pinned") === "1";

      if (!isPinned) {
        void browser.runtime.sendMessage({ type: "OPEN_PINNED_POPUP" });
        window.close();
        return;
      }
    }

    const loadStoredSelections = async () => {
      const stored = (await browser.storage.local.get([
        "category",
        "hasPermission",
        "currentPlatform",
      ])) as {
        category?: string;
        hasPermission?: boolean;
        currentPlatform?: "instagram" | "telegram";
      };

      setFormData((prev) => ({
        ...prev,
        category: stored.category || prev.category,
        hasPermission: stored.hasPermission ?? prev.hasPermission,
      }));

      if (stored.currentPlatform) {
        setCurrentPlatform(stored.currentPlatform);
      }
    };

    const handleMessage = (message: SelectionUpdatedMessage) => {
      if (!message || message.type !== "SELECTION_UPDATED") return;
      if (selectionModeRef.current === "time") return;
      setFormData((prev) => {
        const isStartEmpty = prev.conversationStart === "시작 메세지를 선택해주세요";
        const isEndEmpty = prev.conversationEnd === "마지막 메세지를 선택해주세요";

        if (isStartEmpty && isEndEmpty && message.conversationEnd && !message.conversationStart) {
          return {
            ...prev,
            conversationStart: message.conversationEnd,
          };
        }

        return {
          ...prev,
          conversationStart: message.conversationStart || prev.conversationStart,
          conversationEnd: message.conversationEnd || prev.conversationEnd,
        };
      });
    };

    void loadStoredSelections();
    browser.runtime.onMessage.addListener(handleMessage);

    return () => {
      browser.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  useEffect(() => {
    selectionModeRef.current = formData.selectionMode;
  }, [formData.selectionMode]);

  useEffect(() => {
    if (step !== "conversation") return;
    setFormData((prev) => ({
      ...prev,
      selectionMode: "message",
      conversationStart: "시작 메세지를 선택해주세요",
      conversationEnd: "마지막 메세지를 선택해주세요",
      conversationStartTime: "",
      conversationEndTime: "",
    }));
    void browser.runtime.sendMessage({ type: "RESET_SELECTIONS" });
  }, [step]);

  useEffect(() => {
    if (step !== "monitoring") {
      if (monitoringTimerRef.current) {
        window.clearInterval(monitoringTimerRef.current);
        monitoringTimerRef.current = null;
      }
      if (rotationTimerRef.current) {
        window.clearInterval(rotationTimerRef.current);
        rotationTimerRef.current = null;
      }
      return;
    }

    const platform = formData.category === "job" ? "telegram" : "instagram";

    const buildMonitoringMessages = (): Message[] => {
      const content = formData.purpose?.trim()
        ? `모니터링 목적: ${formData.purpose.trim()}`
        : "실시간 모니터링 중입니다";

      return [
        {
          type: "TEXT",
          content,
          sender: "system",
          timestamp: new Date().toISOString(),
        },
      ];
    };

    const fetchMonitoring = () => {
      analyzeMessages(buildMonitoringMessages(), platform, formData.category)
        .then((result) => {
          setMonitoringResult(result);
        })
        .catch((error) => {
          console.error("모니터링 분석 실패:", error);
        });
    };

    fetchMonitoring();
    monitoringTimerRef.current = window.setInterval(fetchMonitoring, 5000);

    return () => {
      if (monitoringTimerRef.current) {
        window.clearInterval(monitoringTimerRef.current);
        monitoringTimerRef.current = null;
      }
      if (rotationTimerRef.current) {
        window.clearInterval(rotationTimerRef.current);
        rotationTimerRef.current = null;
      }
    };
  }, [step, formData.category, formData.purpose]);

  // 추천 질문 로테이션 타이머 (별도 useEffect)
  useEffect(() => {
    if (step !== "monitoring") return;

    rotationTimerRef.current = window.setInterval(() => {
      setMonitoringIndex((prev) => {
        const length = monitoringResult?.recommendedQuestions?.length || 0;
        if (length === 0) return 0;
        return (prev + 1) % length;
      });
    }, 3000);

    return () => {
      if (rotationTimerRef.current) {
        window.clearInterval(rotationTimerRef.current);
        rotationTimerRef.current = null;
      }
    };
  }, [step, monitoringResult?.recommendedQuestions]);

  // 로그인 단계
  const handleLoginYes = () => {
    setStep("loginForm");
  };

  const handleLoginNo = () => {
    setStep("permission");
  };

  // 로그인 폼 제출
  const handleLoginSubmit = () => {
    if (loginEmail.trim() && loginPassword.trim()) {
      // 아무 문자열이나 입력해도 무조건 로그인 성공
      setLoginEmail("");
      setLoginPassword("");
      void browser.runtime.sendMessage({ type: "PERMISSION_GRANTED" });
      setStep("category");
    }
  };

  const handleLoginCancel = () => {
    setLoginEmail("");
    setLoginPassword("");
    setStep("login");
  };

  // 권한 여부 결정
  const handlePermissionYes = () => {
    void browser.runtime.sendMessage({ type: "PERMISSION_GRANTED" });
    setStep("category");
  };

  const handlePermissionNo = () => {
    setStep("denied");
  };

  // 권한 거부 단계
  const handleRetryPermission = () => {
    setStep("permission");
  };

  const handleCategoryNext = () => {
    if (formData.category) {
      void browser.runtime.sendMessage({
        type: "CATEGORY_SELECTED",
        category: formData.category,
      });
      setStep("mode");
    }
  };

  // 3단계: 모드 선택
  const handleModeBack = () => {
    setStep("category");
  };

  const handleModeSelect = (mode: "realtime" | "report") => {
    setFormData({ ...formData, mode });
    if (mode === "realtime") {
      setStep("monitoring");
    } else {
      setStep("conversation");
    }
  };

  // 4단계: 대화 영역 설정 (레포트 모드)
  const handleConversationBack = () => {
    // 대화 영역 초기화
    setFormData((prev) => ({
      ...prev,
      conversationStart: "시작 메세지를 선택해주세요",
      conversationEnd: "마지막 메세지를 선택해주세요",
    }));
    void browser.runtime.sendMessage({ type: "RESET_SELECTIONS" });
    setStep("mode");
  };

  const handleConversationNext = () => {
    if (formData.selectionMode === "time") {
      if (formData.conversationStartTime && formData.conversationEndTime) {
        setStep("purpose");
      }
      return;
    }

    const isStartSelected = formData.conversationStart !== "시작 메세지를 선택해주세요";
    const isEndSelected = formData.conversationEnd !== "마지막 메세지를 선택해주세요";

    if (isStartSelected && isEndSelected) {
      setStep("purpose");
    }
  };

  const handleClearConversationStart = () => {
    setFormData((prev) => ({
      ...prev,
      conversationStart: "시작 메세지를 선택해주세요",
    }));
    void browser.runtime.sendMessage({ type: "RESET_SELECTIONS" });
  };

  const handleClearConversationEnd = () => {
    setFormData((prev) => ({
      ...prev,
      conversationEnd: "마지막 메세지를 선택해주세요",
    }));
    void browser.runtime.sendMessage({ type: "RESET_SELECTIONS" });
  };

  // 4단계: 목적 입력
  const handlePurposeBack = () => {
    // 대화 영역 초기화
    setFormData((prev) => ({
      ...prev,
      conversationStart: "시작 메세지를 선택해주세요",
      conversationEnd: "마지막 메세지를 선택해주세요",
    }));
    void browser.runtime.sendMessage({ type: "RESET_SELECTIONS" });
    setStep("conversation");
  };

  const handlePurposeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.slice(0, 50);
    setFormData({ ...formData, purpose: value });
  };

  const handleCopyRecommendation = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error("복사 실패:", error);
    }
  };

  const handleAnalyzeStart = () => {
    if (formData.purpose.trim()) {
      setStep("analyzing");

      const startContent = formData.selectionMode === "time"
        ? `시작 시간: ${formData.conversationStartTime}`
        : formData.conversationStart;
      const endContent = formData.selectionMode === "time"
        ? `마지막 시간: ${formData.conversationEndTime}`
        : formData.conversationEnd;

      const exampleMessages: Message[] = [
        {
          type: "TEXT",
          content: startContent,
          sender: "other",
          timestamp: new Date().toISOString(),
        },
        {
          type: "TEXT",
          content: endContent,
          sender: "other",
          timestamp: new Date().toISOString(),
        },
      ];

      // 플랫폼 정보 (카테고리 기반)
      const platform = formData.category === "job" ? "telegram" : "instagram";

      // API 호출
      analyzeMessages(exampleMessages, platform, formData.category)
        .then((result) => {
          setAnalysisResult(result);
          setStep("result");
        })
        .catch((error) => {
          console.error("분석 실패:", error);
          setStep("mode");
        });
    }
  };

  return (
    <div className="app-container">
      {/* 로그인 화면 */}
      {step === "login" && (
        <div className="step permission-step">
          <div className="step-content">
            <h2>로그인</h2>
            <p>이 확장 프로그램을 사용하려면 로그인이 필요합니다.</p>
            <div className="button-group">
              <button className="btn btn-yes" onClick={handleLoginYes}>
                로그인
              </button>
              <button className="btn btn-no" onClick={handleLoginNo}>
                나중에
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 로그인 폼 */}
      {step === "loginForm" && (
        <div className="step permission-step">
          <div className="step-content">
            <h2>로그인</h2>
            <p>이메일 또는 사용자명을 입력해주세요</p>
            <div className="input-group">
              <input
                type="text"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                onKeyPress={handleLoginKeyPress}
                placeholder="이메일 또는 사용자명"
                className="text-input"
                autoFocus
              />
            </div>
            <div className="input-group">
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                onKeyPress={handleLoginKeyPress}
                placeholder="비밀번호"
                className="text-input"
              />
            </div>
            <div className="button-group">
              <button className="btn btn-no" onClick={handleLoginCancel}>
                취소
              </button>
              <button
                className="btn btn-primary"
                onClick={handleLoginSubmit}
                disabled={!loginEmail.trim() || !loginPassword.trim()}
              >
                로그인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 권한 요청 화면 */}
      {step === "permission" && (
        <div className="step permission-step">
          <div className="step-content">
            <h2>접근 권한 허락</h2>
            <p>이 확장 프로그램이 활성화되려면 접근 권한이 필요합니다.</p>
            <div className="button-group">
              <button className="btn btn-yes" onClick={handlePermissionYes}>
                예
              </button>
              <button className="btn btn-no" onClick={handlePermissionNo}>
                아니요
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 권한 거부 단계 */}
      {step === "denied" && (
        <div className="step denied-step">
          <div className="step-content">
            <h2>접근 권한을 허락하셔야 <br />이 기능을 사용할 수 있습니다.</h2>
            <button className="btn btn-primary" onClick={handleRetryPermission}>
              허락하기
            </button>
          </div>
        </div>
      )}

      {/* 2단계: 카테고리 선택 */}
      {step === "category" && (
        <div className="step category-step">
          <div className="step-content">
            <h2>사용자 상황 입력</h2>
            <p className="step-description">카테고리를 선택해주세요</p>
            <CustomSelect
              value={formData.category}
              onChange={(value) => setFormData({ ...formData, category: value })}
              options={[
                { value: "", label: "카테고리 선택" },
                { value: "job", label: "구직" },
                { value: "trade", label: "중고거래" },
                { value: "investment", label: "재태크" },
                { value: "sidebusiness", label: "부업" },
              ]}
            />
            <div className="button-group">
              <button
                className="btn btn-primary"
                onClick={handleCategoryNext}
                disabled={!formData.category}
              >
                다음
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3단계: 모드 선택 */}
      {step === "mode" && (
        <div className="step category-step">
          <div className="step-content">
            <h2>분석 모드 선택</h2>
            <p className="step-description">원하는 분석 방식을 선택해주세요</p>
            <div className="mode-selection">
              <button
                className="mode-card"
                onClick={() => handleModeSelect("realtime")}
              >
                <div className="mode-icon">⚡</div>
                <h3>실시간 모니터링</h3>
                <p className="mode-desc">
                  대화 중 위험 신호를 실시간으로 감지하고<br />
                  답변 추천과 주의사항을 제공합니다
                </p>
              </button>
              <button
                className="mode-card"
                onClick={() => handleModeSelect("report")}
              >
                <div className="mode-icon">📊</div>
                <h3>대화 분석 레포트</h3>
                <p className="mode-desc">
                  지난 대화 내용을 선택하여<br />
                  종합적인 분석 레포트를 생성합니다
                </p>
              </button>
            </div>
            <div className="button-group">
              <button className="btn btn-no" onClick={handleModeBack}>
                이전
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4단계: 대화 영역 설정 (레포트 모드) */}
      {step === "conversation" && (
        <div className="step conversation-step">
          <div className="step-content">
            <h2>대화 영역 설정</h2>
            <p className="step-description">시간 단위, 날짜 단위로 대화를 선택할 수 있습니다</p>
            {currentPlatform === "telegram" && (
              <CustomSelect
                value={formData.selectionMode}
                onChange={(value) => {
                  const mode = value as FormData["selectionMode"];
                  setFormData((prev) => ({
                    ...prev,
                    selectionMode: mode,
                    conversationStart: "시작 메세지를 선택해주세요",
                    conversationEnd: "마지막 메세지를 선택해주세요",
                    conversationStartTime: "",
                    conversationEndTime: "",
                  }));
                  void browser.runtime.sendMessage({ type: "RESET_SELECTIONS" });
                }}
                options={[
                  { value: "message", label: "메세지로 선택" },
                  { value: "time", label: "시간으로 선택" },
                ]}
              />
            )}
            {timeError && (
              <div className="time-error-toast">
                ⚠️ {timeError}
              </div>
            )}
            <div className="conversation-area">
              {formData.selectionMode === "message" ? (
                <>
                  <div className="conversation-item">
                    <span className="label">선택된 시작 메세지:</span>
                    <div className="value-chip">
                      <span className="value">{cleanContent(formData.conversationStart)}</span>
                      {formData.conversationStart !== "시작 메세지를 선택해주세요" && (
                        <button
                          type="button"
                          className="clear-btn"
                          onClick={handleClearConversationStart}
                          aria-label="선택된 시작 메세지 지우기"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="conversation-item">
                    <span className="label">선택된 마지막 메세지:</span>
                    <div className="value-chip">
                      <span className="value">{cleanContent(formData.conversationEnd)}</span>
                      {formData.conversationEnd !== "마지막 메세지를 선택해주세요" && (
                        <button
                          type="button"
                          className="clear-btn"
                          onClick={handleClearConversationEnd}
                          aria-label="선택된 마지막 메세지 지우기"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="conversation-item">
                    <CustomDateTime
                      value={formData.conversationStartTime}
                      onChange={(value) => {
                        setTimeError("");
                        setFormData((prev) => ({
                          ...prev,
                          conversationStartTime: value,
                          conversationEndTime: prev.conversationEndTime && value > prev.conversationEndTime 
                            ? "" 
                            : prev.conversationEndTime,
                        }));
                      }}
                      label="시작 시간 선택"
                    />
                  </div>
                  <div className="conversation-item">
                    <CustomDateTime
                      value={formData.conversationEndTime}
                      onChange={(value) => {
                        if (formData.conversationStartTime && value < formData.conversationStartTime) {
                          setTimeError("마지막 시간은 시작 시간보다 늦어야 합니다");
                          setTimeout(() => setTimeError(""), 3000);
                          return;
                        }
                        setTimeError("");
                        setFormData((prev) => ({
                          ...prev,
                          conversationEndTime: value,
                        }));
                      }}
                      min={formData.conversationStartTime}
                      label="마지막 시간 선택"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="button-group">
              <button className="btn btn-no" onClick={handleConversationBack}>
                이전
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleConversationNext}
                disabled={
                  formData.selectionMode === "time"
                    ? !formData.conversationStartTime || !formData.conversationEndTime
                    : formData.conversationStart === "시작 메세지를 선택해주세요" ||
                      formData.conversationEnd === "마지막 메세지를 선택해주세요"
                }
              >
                다음
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4단계: 목적 입력 */}
      {step === "purpose" && (
        <div className="step purpose-step">
          <div className="step-content">
            <h2>목적 입력</h2>
            <p className="step-description">예: 직업 구해서 출국, 물건 구매 등</p>
            <div className="input-group">
              <input
                type="text"
                value={formData.purpose}
                onChange={handlePurposeChange}
                placeholder="목적을 입력해주세요 (최대 50자)"
                className="text-input"
                maxLength={50}
              />
              <span className="char-count">{formData.purpose.length}/50</span>
            </div>
            <div className="button-group">
              <button className="btn btn-no" onClick={handlePurposeBack}>
                이전
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAnalyzeStart}
                disabled={!formData.purpose.trim()}
              >
                분석 시작
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5단계: 분석 중 */}
      {step === "analyzing" && (
        <div className="step analyzing-step">
          <div className="step-content">
            <div className="spinner"></div>
            <h2>분석 중입니다</h2>
            <p>대화 내용을 분석하고 있습니다. 잠시만 기다려주세요...</p>
          </div>
        </div>
      )}

      {/* 분석 결과 화면 */}
      {step === "result" && analysisResult && (
        <div className="step result-step">
          <div className="step-content">
            <div className="result-header">
              <h2>분석 완료</h2>
              <div className={`risk-badge risk-${getRiskBadgeClass(analysisResult.riskLevel)}`}>
                <div className="risk-level-text">{analysisResult.riskLevel || "SAFE"}</div>
              </div>
            </div>

            {/* 요약 */}
            <div className="result-section">
              <div className="section-header">
                <h3>📋 요약</h3>
              </div>
              <p className="summary-text">{analysisResult.summary}</p>
            </div>

            {/* 타입 */}
            <div className="result-section">
              <div className="section-header">
                <h3>🏷️ 피싱 유형</h3>
              </div>
              <div className="type-box">{analysisResult.type}</div>
            </div>

            {/* 이유 */}
            <div className="result-section">
              <div className="section-header">
                <h3>⚠️ 위험 신호</h3>
              </div>
              <div className="reasons-list">
                {analysisResult.reason.length === 0 ? (
                  <div className="reason-item">
                    <div className="reason-quote">"위험 신호가 없습니다"</div>
                  </div>
                ) : (
                  analysisResult.reason.map((item, index) => (
                    <div key={index} className="reason-item">
                      <div className="reason-header">
                        <span className="reason-number">{index + 1}</span>
                        <span className="reason-source">{item.source}</span>
                      </div>
                      <div className="reason-quote">"{item.note}"</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 추가 권고 사항 */}
            {analysisResult.recommendations && analysisResult.recommendations.length > 0 && (
              <div className="result-section">
                <div className="section-header">
                  <h3>✨ 추가 권고</h3>
                </div>
                <div className="recommendations-list">
                  {analysisResult.recommendations.map((rec, index) => (
                    <div
                      key={index}
                      className="recommendation-box"
                    >
                      <p className="next-question">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="button-group">
              <button 
                className="btn btn-no"
                onClick={() => {
                  setStep("mode");
                  setAnalysisResult(null);
                }}
              >
                다시 분석
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => setStep("monitoring")}
              >
                모니터링 시작
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 실시간 모니터링 모드 */}
      {step === "monitoring" && (
        <div className="step monitoring-step">
          <div className="step-content">
            <div className="monitoring-header">
              <div className="status-badge active monitoring-pulse">실시간 모니터링 중</div>
              <h2>위험 신호 감지 시스템</h2>
              <p className="step-description">대화 내용을 실시간으로 분석하고 있습니다</p>
            </div>

            <div className="monitoring-alert">
              <div className="alert-icon">⚠️</div>
              <h3>답변 추천</h3>
              <button
                type="button"
                className="recommendation-box clickable"
                onClick={() => {
                  const text = monitoringResult?.recommendedQuestions?.length
                    ? monitoringResult.recommendedQuestions[monitoringIndex]
                    : "";
                  if (text) {
                    void handleCopyRecommendation(text);
                  }
                }}
                aria-label="추천 질문 복사"
              >
                <p key={monitoringIndex} className="recommendation-text fade-swap">
                  {monitoringResult?.recommendedQuestions?.length
                    ? monitoringResult.recommendedQuestions[monitoringIndex]
                    : "추천 질문을 불러오는 중입니다..."}
                </p>
              </button>
            </div>

            <div className="warning-reasons">
              <h4>의심가는 대화</h4>
              <ul className="reason-list">
                {monitoringResult?.reason?.length ? (
                  monitoringResult.reason.map((item, index) => (
                    <li key={index}>{item.note}</li>
                  ))
                ) : (
                  <li>분석 결과를 불러오는 중입니다</li>
                )}
              </ul>
            </div>

            <div className="button-group">
              <button
                className="btn btn-no"
                onClick={() => setStep("mode")}
              >
                모드 변경
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;