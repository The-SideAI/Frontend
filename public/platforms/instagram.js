// 인스타그램 메시지 추출기

window.MessageExtractor = window.MessageExtractor || {};

window.MessageExtractor.Instagram = {
    platform: 'instagram',
    
    config: {
        chatContainer: '[role="grid"]',
        textNodes: 'div[dir="auto"], span[dir="auto"]',
        images: 'img'
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
    
    parseTimeText: function(text) {
        const fullPattern = /(\d{2,4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(오전|오후)\s*(\d{1,2}):(\d{2})/;
        const timeOnlyPattern = /^(오전|오후)\s*(\d{1,2}):(\d{2})$/;
        
        const fullMatch = text.match(fullPattern);
        if (fullMatch) {
            let year = fullMatch[1];
            if (year.length === 2) year = `20${year}`;
            const month = fullMatch[2].padStart(2, '0');
            const day = fullMatch[3].padStart(2, '0');
            const meridiem = fullMatch[4];
            let hour = parseInt(fullMatch[5]);
            const minute = fullMatch[6];
            
            if (meridiem === '오후' && hour !== 12) hour += 12;
            else if (meridiem === '오전' && hour === 12) hour = 0;
            
            this.state.lastKnownDate = { year, month, day };
            
            return {
                timestamp: new Date(`${year}-${month}-${day}T${hour.toString().padStart(2, '0')}:${minute}:00`).getTime(),
                text: text
            };
        }
        
        const timeMatch = text.match(timeOnlyPattern);
        if (timeMatch && this.state.lastKnownDate) {
            const meridiem = timeMatch[1];
            let hour = parseInt(timeMatch[2]);
            const minute = timeMatch[3];
            
            if (meridiem === '오후' && hour !== 12) hour += 12;
            else if (meridiem === '오전' && hour === 12) hour = 0;
            
            const { year, month, day } = this.state.lastKnownDate;
            
            return {
                timestamp: new Date(`${year}-${month}-${day}T${hour.toString().padStart(2, '0')}:${minute}:00`).getTime(),
                text: `${year.slice(2)}. ${month}. ${day}. ${text}`
            };
        }
        
        return null;
    },
    
    shouldFilterOut: function(text) {
        if (!text || !text.trim()) return true;
        const trimmed = text.trim();
        
        if (this.state.recipientUsername && trimmed === this.state.recipientUsername) return true;
        if (this.state.myUsername && trimmed === this.state.myUsername) return true;
        if (/^\([월화수목금토일]\)\s*(오전|오후)\s*\d{1,2}:\d{2}$/.test(trimmed)) return true;
        
        const filters = [
            '님의 스토리에 답장을 보냈습니다',
            '스토리를 볼 수 없습니다',
            '회원님이 자신에게 보낸 답장',
            '님의 스토리에 공감했습니다',
            '님이 회원님에게 보낸 답장',
            '스토리에 답장',
            '스토리에 공감',
            '회원님',
            '자신에게',
            '공감했습니다',
            '답장을 보냈습니다',
            '릴스',
            '릴',
            'Reels',
            'reel',
            'shared a reel',
            'shared a video',
            '영상을 공유했습니다',
            '동영상',
            '이용할 수 없는 메시지',
            '이 콘텐츠는 콘텐츠 소유자가 삭제했거나 공개 범위 설정에 의해 숨겨졌을 수 있습니다'
        ];
        
        if (filters.some(filter => trimmed.includes(filter))) return true;
        if (/^(오전|오후)\s*\d{1,2}:\d{2}$/.test(trimmed)) return true;
        if (/^\d{2,4}\.\s*\d{1,2}\.\s*\d{1,2}\.\s*(오전|오후)\s*\d{1,2}:\d{2}$/.test(trimmed)) return true;
        if (trimmed.length === 1) return true;
        
        return false;
    },
    
    identifySpeaker: function(element) {
        const rect = element.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const elementCenterX = rect.left + (rect.width / 2);
        
        if (rect.left > viewportWidth * 0.6) return "나 (Me)";
        if (rect.left + rect.width < viewportWidth * 0.4) return "상대방 (Other)";
        if (elementCenterX > viewportWidth / 2) return "나 (Me)";
        
        if (element.parentElement) {
            const siblings = Array.from(element.parentElement.children);
            const rightCount = siblings.filter(sib => {
                const sibRect = sib.getBoundingClientRect();
                return sibRect.left + sibRect.width / 2 > viewportWidth / 2;
            }).length;
            
            if (rightCount > siblings.length * 0.6 && elementCenterX > viewportWidth * 0.4) {
                return "나 (Me)";
            }
            if (rightCount < siblings.length * 0.4 && elementCenterX < viewportWidth * 0.6) {
                return "상대방 (Other)";
            }
        }
        
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
            
            if (current.previousElementSibling) {
                const prevText = current.previousElementSibling.innerText?.trim() || 
                               current.previousElementSibling.textContent?.trim();
                if (prevText) {
                    const timeInfo = this.parseTimeText(prevText);
                    if (timeInfo) return timeInfo;
                }
            }
            
            current = current.parentElement;
            attempts++;
        }
        
        current = element;
        attempts = 0;
        while (current && attempts < 20) {
            if (current.nextElementSibling) {
                const nextText = current.nextElementSibling.innerText?.trim() || 
                               current.nextElementSibling.textContent?.trim();
                if (nextText) {
                    const timeInfo = this.parseTimeText(nextText);
                    if (timeInfo) return timeInfo;
                }
            }
            
            current = current.parentElement;
            attempts++;
        }
        
        return null;
    },
    
    extractUsername: function() {
        if (!this.state.recipientUsername) {
            const selectors = [
                'header [role="heading"]', 'header h2', 'header h1', 'header span',
                '[role="navigation"] + div h1', '[role="banner"] h1'
            ];
            
            for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                for (const el of elements) {
                    const text = el.innerText?.trim() || el.textContent?.trim();
                    if (text && text.length > 0 && text.length < 50) {
                        const systemWords = ['메시지', '검색', '설정', '새 메시지', '받은 메시지함'];
                        if (!systemWords.some(word => text.includes(word))) {
                            this.state.recipientUsername = text;
                            break;
                        }
                    }
                }
                if (this.state.recipientUsername) break;
            }
        }
        
        if (!this.state.myUsername) {
            const profileLinks = document.querySelectorAll('a[href*="/"]');
            for (const link of profileLinks) {
                const href = link.getAttribute('href');
                if (href && href.startsWith('/') && !href.includes('explore') && !href.includes('direct')) {
                    const username = href.replace('/', '').trim();
                    if (username && username.length > 0 && username.length < 30) {
                        this.state.myUsername = username;
                        break;
                    }
                }
            }
        }
        
        return {
            recipient: this.state.recipientUsername,
            me: this.state.myUsername
        };
    }
};