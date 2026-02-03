// 텔레그램 메시지 추출기 (ES5 호환)

window.MessageExtractor = window.MessageExtractor || {};

window.MessageExtractor.Telegram = {
    platform: 'telegram',
    
    config: {
        chatContainer: 'body',
        textNodes: '[data-message-id]',
        images: 'img[class*="message"], img[class*="photo"], img[class*="media"]'
    },
    
    state: {
        recipientUsername: null,
        myUsername: null,
        lastKnownDate: null
    },
    
    init: function() {
        var today = new Date();
        this.state.lastKnownDate = {
            year: today.getFullYear().toString(),
            month: String(today.getMonth() + 1).padStart(2, '0'),
            day: String(today.getDate()).padStart(2, '0')
        };
    },
    
    extractTimeFromContent: function(content) {
        if (!content) return null;
        
        var timePattern = /\n(\d{1,2}):(\d{2})$/;
        var match = content.match(timePattern);
        
        if (match) {
            var hour = match[1].padStart(2, '0');
            var minute = match[2];
            var cleanContent = content.substring(0, match.index);
            
            return {
                time: hour + ':' + minute,
                content: cleanContent
            };
        }
        
        return null;
    },
    
    parseDateSeparator: function(text) {
        if (!text) return null;
        
        var trimmed = text.trim();
        var today = new Date();
        
        if (/^(Today|오늘)$/i.test(trimmed)) {
            var year = today.getFullYear().toString();
            var month = String(today.getMonth() + 1).padStart(2, '0');
            var day = String(today.getDate()).padStart(2, '0');
            
            this.state.lastKnownDate = { year: year, month: month, day: day };
            return { year: year, month: month, day: day };
        }
        
        if (/^(Yesterday|어제)$/i.test(trimmed)) {
            var yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            var year = yesterday.getFullYear().toString();
            var month = String(yesterday.getMonth() + 1).padStart(2, '0');
            var day = String(yesterday.getDate()).padStart(2, '0');
            
            this.state.lastKnownDate = { year: year, month: month, day: day };
            return { year: year, month: month, day: day };
        }
        
        var weekdayPattern = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|월요일|화요일|수요일|목요일|금요일|토요일|일요일)$/i;
        if (weekdayPattern.test(trimmed)) {
            var weekdays = {
                'monday': 1, '월요일': 1,
                'tuesday': 2, '화요일': 2,
                'wednesday': 3, '수요일': 3,
                'thursday': 4, '목요일': 4,
                'friday': 5, '금요일': 5,
                'saturday': 6, '토요일': 6,
                'sunday': 0, '일요일': 0
            };
            
            var targetDay = weekdays[trimmed.toLowerCase()];
            var currentDay = today.getDay();
            
            var daysAgo = currentDay - targetDay;
            if (daysAgo <= 0) daysAgo += 7;
            
            var targetDate = new Date(today);
            targetDate.setDate(targetDate.getDate() - daysAgo);
            
            var year = targetDate.getFullYear().toString();
            var month = String(targetDate.getMonth() + 1).padStart(2, '0');
            var day = String(targetDate.getDate()).padStart(2, '0');
            
            this.state.lastKnownDate = { year: year, month: month, day: day };
            return { year: year, month: month, day: day };
        }
        
        var koreanPattern = /^(\d{1,2})월\s*(\d{1,2})일$/;
        var koreanMatch = trimmed.match(koreanPattern);
        if (koreanMatch) {
            var month = koreanMatch[1].padStart(2, '0');
            var day = koreanMatch[2].padStart(2, '0');
            var year = today.getFullYear().toString();
            
            this.state.lastKnownDate = { year: year, month: month, day: day };
            return { year: year, month: month, day: day };
        }
        
        var englishPattern = /^(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})$/i;
        var englishMatch = trimmed.match(englishPattern);
        if (englishMatch) {
            var monthNames = {
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
            var month = monthNames[englishMatch[1].toLowerCase()];
            var day = englishMatch[2].padStart(2, '0');
            var year = today.getFullYear().toString();
            
            this.state.lastKnownDate = { year: year, month: month, day: day };
            return { year: year, month: month, day: day };
        }
        
        var dotPattern = /^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?$/;
        var dotMatch = trimmed.match(dotPattern);
        if (dotMatch) {
            var year = dotMatch[1];
            var month = dotMatch[2].padStart(2, '0');
            var day = dotMatch[3].padStart(2, '0');
            
            this.state.lastKnownDate = { year: year, month: month, day: day };
            return { year: year, month: month, day: day };
        }
        
        return null;
    },
    
    parseTimeText: function(text) {
        var dateInfo = this.parseDateSeparator(text);
        if (dateInfo) {
            return null;
        }
        
        if (!text) return null;

        var cleaned = text.replace(/[\uE000-\uF8FF]/g, '').trim();

        var timePattern = /^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?$/;
        var match = cleaned.match(timePattern);
        if (!match) return null;

        var hour = parseInt(match[1], 10);
        var minute = match[2];
        var meridiem = match[3];

        if (meridiem) {
            var mer = meridiem.toLowerCase();
            if (mer === 'pm' && hour !== 12) hour += 12;
            if (mer === 'am' && hour === 12) hour = 0;
        }

        var date = this.state.lastKnownDate || {
            year: new Date().getFullYear().toString(),
            month: String(new Date().getMonth() + 1).padStart(2, '0'),
            day: String(new Date().getDate()).padStart(2, '0')
        };

        var time = hour.toString().padStart(2, '0') + ':' + minute;
        var dateStr = date.year + '-' + date.month + '-' + date.day + 'T' + time + ':00';
        var timestamp = new Date(dateStr).getTime();

        return {
            timestamp: timestamp,
            text: date.year.slice(2) + '. ' + date.month + '. ' + date.day + '. ' + time
        };
    },
    
    shouldFilterOut: function(text) {
        if (!text || !text.trim()) return true;
        var trimmed = text.trim();
        
        if (trimmed.length === 1 && trimmed !== '.') return true;
        if (/^\d{1,2}:\d{2}\s*(AM|PM|am|pm)?$/.test(trimmed)) return true;
        if (this.parseDateSeparator(trimmed)) return true;
        
        return false;
    },

    getMessageTextElement: function(node) {
        if (!node || !node.querySelector) return node;
        return node.querySelector('.text-content, .message-text, [dir="auto"]') || node;
    },

    getMessageText: function(node) {
        if (!node) return '';

        // 1단계: 직접 텍스트 추출 시도
        var directText = (node.innerText || node.textContent || '').trim();
        
        // 2단계: .message-text, .text-content 등에서 찾기
        if (!directText && node.querySelector) {
            var textElements = node.querySelectorAll(
                '.text-content, .message-text, .text, [class*="text"], [dir="auto"]'
            );
            
            var parts = [];
            for (var i = 0; i < textElements.length; i++) {
                var el = textElements[i];
                var t = (el.innerText || el.textContent || '').trim();
                if (!t) continue;
                
                // 시간만 있는 텍스트 제외
                if (/^\d{1,2}:\d{2}\s*(AM|PM|am|pm)?$/.test(t)) continue;
                
                // 중복 제거 (이미 parts에 있으면 스킵)
                if (parts.indexOf(t) === -1) {
                    parts.push(t);
                }
            }
            
            if (parts.length > 0) {
                directText = parts.join(' ');
            }
        }

        if (!directText) return '';

        // 아이콘 글리프 제거
        directText = directText.replace(/[\uE000-\uF8FF]/g, '').trim();

        return directText;
    },

    getMessageNodes: function(chatContainer) {
        if (!chatContainer || !chatContainer.querySelectorAll) return [];
        
        // 시도 1: data-message-id (가장 정확)
        var nodes = chatContainer.querySelectorAll('[data-message-id]');
        if (nodes.length > 0) {
            console.log('[Telegram] Found ' + nodes.length + ' messages via [data-message-id]');
            return nodes;
        }
        
        // 시도 2: role="article" 
        nodes = chatContainer.querySelectorAll('div[role="article"]');
        if (nodes.length > 0) {
            console.log('[Telegram] Found ' + nodes.length + ' messages via role="article"');
            return nodes;
        }
        
        // 시도 3: message 클래스 패턴
        nodes = chatContainer.querySelectorAll('[class*="Message"], [class*="message"]');
        if (nodes.length > 5 && nodes.length < 1000) {
            console.log('[Telegram] Found ' + nodes.length + ' messages via class pattern');
            return nodes;
        }
        
        // 시도 4: 더 광범위한 검색 (화면에 보이는 메시지 버블)
        var allDivs = chatContainer.querySelectorAll('div[class]');
        var messageLike = [];
        
        for (var i = 0; i < allDivs.length && messageLike.length < 200; i++) {
            var div = allDivs[i];
            var text = (div.innerText || '').trim();
            
            // 텍스트가 있고, 너무 길지 않고 (전체 페이지 아님), 화면에 보이는 것
            if (text && text.length > 0 && text.length < 1000) {
                var rect = div.getBoundingClientRect();
                if (rect.width > 50 && rect.height > 20) {
                    messageLike.push(div);
                }
            }
        }
        
        if (messageLike.length > 0) {
            console.log('[Telegram] Found ' + messageLike.length + ' messages via fallback search');
            return messageLike;
        }
        
        console.warn('[Telegram] No messages found!');
        return [];
    },
    
    identifySpeaker: function(element) {
        var current = element;
        var depth = 0;
        
        while (current && depth < 15) {
            var className = typeof current.className === 'string' ? current.className : '';
            if (/\b(is-out|message-out|own)\b/.test(className)) {
                return "나 (Me)";
            }
            if (/\b(is-in|message-in|from)\b/.test(className)) {
                return "상대방 (Other)";
            }
            current = current.parentElement;
            depth++;
        }
        
        var rect = element.getBoundingClientRect();
        var viewportWidth = window.innerWidth;
        var elementCenterX = rect.left + (rect.width / 2);
        
        return elementCenterX > viewportWidth / 2 ? "나 (Me)" : "상대방 (Other)";
    },
    
    findNearestTime: function(element) {
        var current = element;
        var attempts = 0;
        
        while (current && attempts < 20) {
            var allTexts = current.querySelectorAll('div, span, time');
            for (var i = 0; i < allTexts.length; i++) {
                var node = allTexts[i];
                var text = (node.innerText || '').trim() || (node.textContent || '').trim();
                if (text) {
                    var timeInfo = this.parseTimeText(text);
                    if (timeInfo) return timeInfo;
                }
            }
            
            current = current.parentElement;
            attempts++;
        }
        
        return null;
    },
    
    findNearestDateSeparator: function(element) {
        var current = element;
        var attempts = 0;
        
        while (current && attempts < 30) {
            var sibling = current.previousElementSibling;
            var siblingAttempts = 0;
            
            while (sibling && siblingAttempts < 20) {
                var text = (sibling.innerText || '').trim() || (sibling.textContent || '').trim();
                if (text) {
                    var dateInfo = this.parseDateSeparator(text);
                    if (dateInfo) return dateInfo;
                }
                
                var childDivs = sibling.querySelectorAll('div, span');
                for (var i = 0; i < childDivs.length; i++) {
                    var child = childDivs[i];
                    var childText = (child.innerText || '').trim() || (child.textContent || '').trim();
                    if (childText) {
                        var dateInfo = this.parseDateSeparator(childText);
                        if (dateInfo) return dateInfo;
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
    
    preScan: function(chatContainer) {
        // 필요없음
    },
    
    processContent: function(text, node) {
        var extracted = this.extractTimeFromContent(text);
        
        if (!extracted) {
            return {
                content: text,
                timestamp: null,
                timestampText: null
            };
        }
        
        var dateInfo = this.findNearestDateSeparator(node);
        var date = dateInfo || this.state.lastKnownDate;
        
        if (!date) {
            return {
                content: extracted.content,
                timestamp: null,
                timestampText: null
            };
        }
        
        var timeParts = extracted.time.split(':');
        var hour = timeParts[0];
        var minute = timeParts[1];
        
        var dateStr = date.year + '-' + date.month + '-' + date.day + 'T' + hour + ':' + minute + ':00';
        var timestamp = new Date(dateStr).getTime();
        var timestampText = date.year.slice(2) + '. ' + date.month + '. ' + date.day + '. ' + extracted.time;
        
        return {
            content: extracted.content,
            timestamp: timestamp,
            timestampText: timestampText
        };
    },
    
    extractUsername: function() {
        if (!this.state.recipientUsername) {
            var headerSelectors = [
                '.chat-info .peer-title',
                '.peer-title',
                'header .name'
            ];
            
            for (var i = 0; i < headerSelectors.length; i++) {
                var el = document.querySelector(headerSelectors[i]);
                if (el) {
                    var text = (el.innerText || el.textContent || '').trim();
                    if (text && text.length > 0 && text.length < 50) {
                        this.state.recipientUsername = text;
                        break;
                    }
                }
            }
        }
        
        return {
            recipient: this.state.recipientUsername,
            me: this.state.myUsername
        };
    },
    
    filterMessageData: function(data) {
        var result = {};
        for (var key in data) {
            if (key !== 'id' && key !== 'sequence' && key !== 'collectedAt') {
                result[key] = data[key];
            }
        }
        return result;
    }
};