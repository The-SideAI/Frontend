// 텔레그램 메시지 추출기

window.MessageExtractor = window.MessageExtractor || {};

window.MessageExtractor.Telegram = {
    platform: 'telegram',
    
    config: {
        chatContainer: '.scrollable-y, .bubble-group-container, [class*="scroller"], .chat-history',
        textNodes: 'div[role="article"] div:not(:empty), .message-text, .text-content, .message .bubble, [class*="bubble"][class*="content"]',
        images: 'img[class*="message"], img[class*="photo"], img[class*="media"], .message img'
    },
    
    state: {
        recipientUsername: null,
        myUsername: null,
        lastKnownDate: null
    },
    
    init: function() {
        const today = new Date();
        this.state.lastKnownDate = {
            year: today.getFullYear().toString(),
            month: String(today.getMonth() + 1).padStart(2, '0'),
            day: String(today.getDate()).padStart(2, '0')
        };
    },
    
    // content 끝의 시간 파싱 (예: "하이\n22:10" -> {time: "22:10", content: "하이"})
    extractTimeFromContent: function(content) {
        if (!content) return null;
        
        // content 끝의 시간 패턴 추출 (HH:MM)
        const timePattern = /\n(\d{1,2}):(\d{2})$/;
        const match = content.match(timePattern);
        
        if (match) {
            const hour = match[1].padStart(2, '0');
            const minute = match[2];
            const cleanContent = content.substring(0, match.index);
            
            return {
                time: `${hour}:${minute}`,
                content: cleanContent
            };
        }
        
        return null;
    },
    
    // 날짜 구분선 파싱 (예: "Saturday", "Friday", "Today", "Yesterday")
    parseDateSeparator: function(text) {
        if (!text) return null;
        
        const trimmed = text.trim();
        const today = new Date();
        
        // "Today" 패턴
        if (/^(Today|오늘)$/i.test(trimmed)) {
            const year = today.getFullYear().toString();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            
            this.state.lastKnownDate = { year, month, day };
            return { year, month, day };
        }
        
        // "Yesterday" 패턴
        if (/^(Yesterday|어제)$/i.test(trimmed)) {
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const year = yesterday.getFullYear().toString();
            const month = String(yesterday.getMonth() + 1).padStart(2, '0');
            const day = String(yesterday.getDate()).padStart(2, '0');
            
            this.state.lastKnownDate = { year, month, day };
            return { year, month, day };
        }
        
        // 요일 패턴: "Monday", "Tuesday", etc.
        const weekdayPattern = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|월요일|화요일|수요일|목요일|금요일|토요일|일요일)$/i;
        if (weekdayPattern.test(trimmed)) {
            const weekdays = {
                'monday': 1, '월요일': 1,
                'tuesday': 2, '화요일': 2,
                'wednesday': 3, '수요일': 3,
                'thursday': 4, '목요일': 4,
                'friday': 5, '금요일': 5,
                'saturday': 6, '토요일': 6,
                'sunday': 0, '일요일': 0
            };
            
            const targetDay = weekdays[trimmed.toLowerCase()];
            const currentDay = today.getDay();
            
            // 이번 주 또는 지난 주의 해당 요일 찾기 (과거 날짜)
            let daysAgo = currentDay - targetDay;
            if (daysAgo <= 0) daysAgo += 7; // 지난 주로 이동
            
            const targetDate = new Date(today);
            targetDate.setDate(targetDate.getDate() - daysAgo);
            
            const year = targetDate.getFullYear().toString();
            const month = String(targetDate.getMonth() + 1).padStart(2, '0');
            const day = String(targetDate.getDate()).padStart(2, '0');
            
            this.state.lastKnownDate = { year, month, day };
            return { year, month, day };
        }
        
        // 한국어 패턴: "2월 1일", "12월 31일"
        const koreanPattern = /^(\d{1,2})월\s*(\d{1,2})일$/;
        const koreanMatch = trimmed.match(koreanPattern);
        if (koreanMatch) {
            const month = koreanMatch[1].padStart(2, '0');
            const day = koreanMatch[2].padStart(2, '0');
            const year = today.getFullYear().toString();
            
            this.state.lastKnownDate = { year, month, day };
            return { year, month, day };
        }
        
        // 영어 패턴: "January 31", "Feb 1"
        const englishPattern = /^(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})$/i;
        const englishMatch = trimmed.match(englishPattern);
        if (englishMatch) {
            const monthNames = {
                'january': '01', 'jan': '01',
                'february': '02', 'feb': '02',
                'march': '03', 'mar': '03',
                'april': '04', 'apr': '04',
                'may': '05',
                'june': '06', 'jun': '06',
                'july': '07', 'jul': '07',
                'august': '08', 'aug': '08',
                'september': '09', 'sep': '09',
                'october': '10', 'oct': '10',
                'november': '11', 'nov': '11',
                'december': '12', 'dec': '12'
            };
            const month = monthNames[englishMatch[1].toLowerCase()];
            const day = englishMatch[2].padStart(2, '0');
            const year = today.getFullYear().toString();
            
            this.state.lastKnownDate = { year, month, day };
            return { year, month, day };
        }
        
        // YYYY. M. D. 패턴
        const dotPattern = /^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?$/;
        const dotMatch = trimmed.match(dotPattern);
        if (dotMatch) {
            const year = dotMatch[1];
            const month = dotMatch[2].padStart(2, '0');
            const day = dotMatch[3].padStart(2, '0');
            
            this.state.lastKnownDate = { year, month, day };
            return { year, month, day };
        }
        
        return null;
    },
    
    parseTimeText: function(text) {
        // 날짜 구분선 체크
        const dateInfo = this.parseDateSeparator(text);
        if (dateInfo) {
            return null; // 날짜 구분선은 메시지가 아님
        }
        
        if (!text) return null;

        // 아이콘 글리프 제거 및 공백 정리
        const cleaned = text
            .replace(/[\uE000-\uF8FF\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}]+/gu, '')
            .trim();

        // 시간 패턴 (예: 22:10, 10:10 PM)
        const timePattern = /^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?$/;
        const match = cleaned.match(timePattern);
        if (!match) return null;

        let hour = parseInt(match[1], 10);
        const minute = match[2];
        const meridiem = match[3];

        if (meridiem) {
            const mer = meridiem.toLowerCase();
            if (mer === 'pm' && hour !== 12) hour += 12;
            if (mer === 'am' && hour === 12) hour = 0;
        }

        const date = this.state.lastKnownDate || {
            year: new Date().getFullYear().toString(),
            month: String(new Date().getMonth() + 1).padStart(2, '0'),
            day: String(new Date().getDate()).padStart(2, '0')
        };

        const time = `${hour.toString().padStart(2, '0')}:${minute}`;
        const dateStr = `${date.year}-${date.month}-${date.day}T${time}:00`;
        const timestamp = new Date(dateStr).getTime();

        return {
            timestamp: timestamp,
            text: `${date.year.slice(2)}. ${date.month}. ${date.day}. ${time}`
        };
    },
    
    shouldFilterOut: function(text) {
        if (!text || !text.trim()) return true;
        const trimmed = text.trim();
        
        // 기본 필터링
        if (trimmed.length === 1 && trimmed !== '.') return true;

        // 시간만 있는 텍스트는 필터링
        if (/^\d{1,2}:\d{2}\s*(AM|PM|am|pm)?$/.test(trimmed)) return true;
        
        // 날짜 구분선 필터링
        if (this.parseDateSeparator(trimmed)) return true;
        
        return false;
    },

    // 텔레그램 전용: 메시지 텍스트 요소 찾기
    getMessageTextElement: function(node) {
        if (!node || !node.querySelector) return node;
        return node.querySelector(
            '.text-content, .message-text, .message-text-content, .text-entity, [dir="auto"]'
        ) || node;
    },

    // 텔레그램 전용: 메시지 텍스트 추출 (노드가 컨테이너여도 동작)
    getMessageText: function(node) {
        if (!node) return '';

        const textEl = this.getMessageTextElement(node);
        let text = (textEl && (textEl.innerText || textEl.textContent)) || '';
        text = text.trim();

        if (!text && node.querySelectorAll) {
            const parts = [];
            const candidates = node.querySelectorAll(
                '.text-content, .message-text, .message-text-content, .text-entity, [dir="auto"], span, div'
            );
            candidates.forEach((el) => {
                const t = (el.innerText || el.textContent || '').trim();
                if (!t) return;
                // 시간/아이콘만 있는 조각은 제외
                if (/^\d{1,2}:\d{2}\s*(AM|PM|am|pm)?$/.test(t)) return;
                parts.push(t);
            });
            text = parts.join(' ').trim();
        }

        if (!text) return '';

        // 아이콘 글리프 제거
        text = text.replace(/[\uE000-\uF8FF\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}]+/gu, '').trim();

        return text;
    },

    // 텔레그램 전용: 메시지 버블 노드 수집
    getMessageNodes: function(chatContainer) {
        if (!chatContainer || !chatContainer.querySelectorAll) return [];
        
        // 시도 1: role="article" (Telegram Web 표준)
        var nodes = chatContainer.querySelectorAll('div[role="article"]');
        if (nodes.length > 0) return nodes;
        
        // 시도 2: data-message-id 속성
        nodes = chatContainer.querySelectorAll('[data-message-id]');
        if (nodes.length > 0) return nodes;
        
        // 시도 3: class 패턴 (bubble, message 등)
        nodes = chatContainer.querySelectorAll('[class*="bubble"], [class*="message"]');
        if (nodes.length > 0) {
            // 너무 많으면 필터링 (예: 1000개 이상은 뭔가 잘못된 것)
            if (nodes.length < 1000) return nodes;
        }
        
        // 시도 4: 더 깊은 검색
        nodes = chatContainer.querySelectorAll('div[class]');
        // 메시지처럼 보이는 요소들만 필터링 (class가 있고 텍스트가 있는 것)
        var filtered = [];
        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].innerText && nodes[i].innerText.trim().length > 0) {
                filtered.push(nodes[i]);
                if (filtered.length > 200) break; // 너무 많으면 멈춤
            }
        }
        return filtered.length > 0 ? filtered : [];
    },
    
    identifySpeaker: function(element) {
        let current = element;
        let depth = 0;
        
        while (current && depth < 15) {
            const className = typeof current.className === 'string' ? current.className : '';
            if (/\b(is-out|message-out|bubble-out|out)\b/.test(className)) {
                return "나 (Me)";
            }
            if (/\b(is-in|message-in|bubble-in|in)\b/.test(className)) {
                return "상대방 (Other)";
            }
            if (current.classList && current.classList.contains('message')) {
                // message 요소 기본은 상대방으로 간주
                return "상대방 (Other)";
            }
            current = current.parentElement;
            depth++;
        }
        
        // 뷰포트 기반 판별로 폴백
        const rect = element.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const elementCenterX = rect.left + (rect.width / 2);
        
        return elementCenterX > viewportWidth / 2 ? "나 (Me)" : "상대방 (Other)";
    },
    
    findNearestTime: function(element) {
        let current = element;
        let attempts = 0;
        
        while (current && attempts < 20) {
            const allTexts = current.querySelectorAll('div, span, time');
            for (const node of allTexts) {
                const text = node.innerText?.trim() || node.textContent?.trim();
                if (text) {
                    const timeInfo = this.parseTimeText(text);
                    if (timeInfo) return timeInfo;
                }
            }
            
            current = current.parentElement;
            attempts++;
        }
        
        return null;
    },
    
    // 텔레그램 전용: 특정 요소에서 가장 가까운 날짜 구분선 찾기
    findNearestDateSeparator: function(element) {
        let current = element;
        let attempts = 0;
        
        // 상위로 올라가면서 날짜 구분선 찾기
        while (current && attempts < 30) {
            // 형제 요소들 중에서 날짜 구분선 찾기
            let sibling = current.previousElementSibling;
            let siblingAttempts = 0;
            
            while (sibling && siblingAttempts < 20) {
                const text = (sibling.innerText || '').trim() || (sibling.textContent || '').trim();
                if (text) {
                    const dateInfo = this.parseDateSeparator(text);
                    if (dateInfo) {
                        return dateInfo;
                    }
                }
                
                // 하위 요소들도 확인
                const childDivs = sibling.querySelectorAll('div, span');
                for (const child of childDivs) {
                    const childText = (child.innerText || '').trim() || (child.textContent || '').trim();
                    if (childText) {
                        const dateInfo = this.parseDateSeparator(childText);
                        if (dateInfo) {
                            return dateInfo;
                        }
                    }
                }
                
                sibling = sibling.previousElementSibling;
                siblingAttempts++;
            }
            
            current = current.parentElement;
            attempts++;
        }
        
        return null;
    },
    
    // 텔레그램 전용: 스캔 전 날짜 구분선 수집 (사용 안 함, 제거 가능)
    preScan: function(chatContainer) {
        // 각 메시지마다 가장 가까운 날짜를 찾으므로 preScan 불필요
    },
    
    // 텔레그램 전용: content 처리 및 timestamp 생성
    processContent: function(text, node) {
        const extracted = this.extractTimeFromContent(text);
        
        if (!extracted) {
            return {
                content: text,
                timestamp: null,
                timestampText: null
            };
        }
        
        // 가장 가까운 날짜 구분선 찾기
        const dateInfo = this.findNearestDateSeparator(node);
        const date = dateInfo || this.state.lastKnownDate;
        
        if (!date) {
            return {
                content: extracted.content,
                timestamp: null,
                timestampText: null
            };
        }
        
        const timeParts = extracted.time.split(':');
        const hour = timeParts[0];
        const minute = timeParts[1];
        
        const dateStr = `${date.year}-${date.month}-${date.day}T${hour}:${minute}:00`;
        const timestamp = new Date(dateStr).getTime();
        const timestampText = `${date.year.slice(2)}. ${date.month}. ${date.day}. ${extracted.time}`;
        
        return {
            content: extracted.content,
            timestamp: timestamp,
            timestampText: timestampText
        };
    },
    
    extractUsername: function() {
        // 할 일: 텔레그램 사용자명 추출 구현
        return {
            recipient: this.state.recipientUsername,
            me: this.state.myUsername
        };
    },
    
    // 텔레그램 전용: 메시지 데이터 필터링 (불필요한 필드 제거)
    filterMessageData: function(data) {
        const { id, sequence, collectedAt, ...rest } = data;
        return rest;
    }
};
