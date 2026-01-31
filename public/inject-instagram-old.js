// 인스타그램 DM 메시지 수집기

(function() {
    if (!document.body) {
        setTimeout(() => {
            const script = document.createElement('script');
            script.textContent = document.currentScript?.textContent || '';
            (document.head || document.documentElement).appendChild(script);
        }, 100);
        return;
    }
    
    let statusBox = document.createElement('div');
    statusBox.style.position = 'fixed';
    statusBox.style.bottom = '20px';
    statusBox.style.right = '20px';
    statusBox.style.background = 'rgba(0, 0, 0, 0.8)';
    statusBox.style.color = '#fff';
    statusBox.style.padding = '10px 15px';
    statusBox.style.borderRadius = '8px';
    statusBox.style.zIndex = '99999';
    statusBox.style.fontSize = '14px';
    statusBox.innerText = '🔴 Scanner waiting...';
    document.body.appendChild(statusBox);

    window.COLLECTED_DB = new Map();
    window.PROCESSED_CONTENTS = new Set();
    
    let lastTablePrint = 0;
    let messageCounter = 0;
    let recipientUsername = null;
    let myUsername = null;
    
    const today = new Date();
    let lastKnownDate = {
        year: today.getFullYear().toString(),
        month: String(today.getMonth() + 1).padStart(2, '0'),
        day: String(today.getDate()).padStart(2, '0')
    };
    
    function extractRecipientUsername() {
        const selectors = [
            'header [role="heading"]',
            'header h2',
            'header h1',
            'header span',
            '[role="navigation"] + div h1',
            '[role="banner"] h1'
        ];
        
        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
                const text = el.innerText?.trim() || el.textContent?.trim();
                if (text && text.length > 0 && text.length < 50) {
                    const systemWords = ['메시지', '검색', '설정', '새 메시지', '받은 메시지함'];
                    if (!systemWords.some(word => text.includes(word))) {
                        return text;
                    }
                }
            }
        }
        return null;
    }
    
    function parseTimeText(text) {
        const fullPattern = /(\d{2,4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(오전|오후)\s*(\d{1,2}):(\d{2})/;
        const timeOnlyPattern = /^(오전|오후)\s*(\d{1,2}):(\d{2})$/;
        
        const fullMatch = text.match(fullPattern);
        if (fullMatch) {
            let year = fullMatch[1];
            if (year.length === 2) {
                year = `20${year}`;
            }
            const month = fullMatch[2].padStart(2, '0');
            const day = fullMatch[3].padStart(2, '0');
            const meridiem = fullMatch[4];
            let hour = parseInt(fullMatch[5]);
            const minute = fullMatch[6];
            
            if (meridiem === '오후' && hour !== 12) hour += 12;
            else if (meridiem === '오전' && hour === 12) hour = 0;
            
            lastKnownDate = { year, month, day };
            
            return {
                timestamp: new Date(`${year}-${month}-${day}T${hour.toString().padStart(2, '0')}:${minute}:00`).getTime(),
                text: text
            };
        }
        
        const timeMatch = text.match(timeOnlyPattern);
        if (timeMatch && lastKnownDate) {
            const meridiem = timeMatch[1];
            let hour = parseInt(timeMatch[2]);
            const minute = timeMatch[3];
            
            if (meridiem === '오후' && hour !== 12) hour += 12;
            else if (meridiem === '오전' && hour === 12) hour = 0;
            
            const { year, month, day } = lastKnownDate;
            
            return {
                timestamp: new Date(`${year}-${month}-${day}T${hour.toString().padStart(2, '0')}:${minute}:00`).getTime(),
                text: `${year.slice(2)}. ${month}. ${day}. ${text}`
            };
        }
        
        return null;
    }
    
    function isElementInViewport(element) {
        const rect = element.getBoundingClientRect();
        const isVerticalInViewport = rect.top < window.innerHeight && rect.bottom > 0;
        const isHorizontalInViewport = rect.left < window.innerWidth && rect.right > 0;
        const hasMinHeight = rect.height > 5;
        const hasMinWidth = rect.width > 5;
        
        return isVerticalInViewport && isHorizontalInViewport && hasMinHeight && hasMinWidth;
    }

    function findNearestTime(element) {
        let current = element;
        let attempts = 0;
        
        while (current && attempts < 20) {
            const allTexts = current.querySelectorAll('div, span, time');
            for (const node of allTexts) {
                const text = node.innerText?.trim() || node.textContent?.trim();
                if (text) {
                    const timeInfo = parseTimeText(text);
                    if (timeInfo) {
                        return timeInfo;
                    }
                }
            }
            
            if (current.previousElementSibling) {
                const prevText = current.previousElementSibling.innerText?.trim() || current.previousElementSibling.textContent?.trim();
                if (prevText) {
                    const timeInfo = parseTimeText(prevText);
                    if (timeInfo) {
                        return timeInfo;
                    }
                }
            }
            
            current = current.parentElement;
            attempts++;
        }
        
        current = element;
        attempts = 0;
        while (current && attempts < 20) {
            if (current.nextElementSibling) {
                const nextText = current.nextElementSibling.innerText?.trim() || current.nextElementSibling.textContent?.trim();
                if (nextText) {
                    const timeInfo = parseTimeText(nextText);
                    if (timeInfo) {
                        return timeInfo;
                    }
                }
            }
            
            current = current.parentElement;
            attempts++;
        }
        
        return null;
    }
    
    function shouldFilterOut(text) {
        if (!text || !text.trim()) return true;
        
        const trimmed = text.trim();
        
        if (recipientUsername && trimmed === recipientUsername) return true;
        if (myUsername && trimmed === myUsername) return true;
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
    }

    function identifySpeaker(element, containerRect) {
        const rect = element.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const elementCenterX = rect.left + (rect.width / 2);
        
        if (rect.left > viewportWidth * 0.6) {
            return "나 (Me)";
        } else if (rect.left + rect.width < viewportWidth * 0.4) {
            return "상대방 (Other)";
        }
        
        if (elementCenterX > viewportWidth / 2) {
            return "나 (Me)";
        }
        
        if (element.parentElement) {
            const siblings = Array.from(element.parentElement.children);
            const rightCount = siblings.filter(sib => {
                const sibRect = sib.getBoundingClientRect();
                return sibRect.left + sibRect.width / 2 > viewportWidth / 2;
            }).length;
            const leftCount = siblings.length - rightCount;
            
            // 형제 중 현재 요소가 어느 쪽에 더 많이 몰려있는지 확인
            if (rightCount > leftCount * 1.5 && elementCenterX > viewportWidth * 0.4) {
                return "나 (Me)";
            }
            if (leftCount > rightCount * 1.5 && elementCenterX < viewportWidth * 0.6) {
                return "상대방 (Other)";
            }
        }
        
        // ========== 최종 폴백 ==========
        return elementCenterX > viewportWidth / 2 ? "나 (Me)" : "상대방 (Other)";
    }

    // ============================================================
    // 2. 화면 스캔 함수 (0.5초마다 실행될 녀석)
    // ============================================================
    function scanScreen() {
        try {
        // 상대방 닉네임이 없으면 추출 시도
        if (!recipientUsername) {
            recipientUsername = extractRecipientUsername();
        }
        
        // 내 username 추출 시도 (프로필 영역에서)
        if (!myUsername) {
            const profileLinks = document.querySelectorAll('a[href*="/"]');
            for (const link of profileLinks) {
                const href = link.getAttribute('href');
                if (href && href.startsWith('/') && !href.includes('explore') && !href.includes('direct')) {
                    const username = href.replace('/', '').trim();
                    if (username && username.length > 0 && username.length < 30) {
                        myUsername = username;
                        break;
                    }
                }
            }
        }
        
        // 채팅창 영역 찾기
        const chatContainer = document.querySelector('[role="grid"]') || document.body;
        const containerRect = chatContainer.getBoundingClientRect();

        // 가. 텍스트 수집 (div[dir="auto"])
        const textNodes = chatContainer.querySelectorAll('div[dir="auto"], span[dir="auto"]');
        
        textNodes.forEach(node => {
            const text = node.innerText?.trim() || node.textContent?.trim();
            if (!text || text === '') return;

            // ===== 화면에 보이는지 확인 (스크롤 전 요소는 무시) =====
            if (!isElementInViewport(node)) {
                return;
            }

            // 너무 큰 덩어리 제외 (메시지 내용이 아니라 컨테이너일 수 있음)
            const rect = node.getBoundingClientRect();
            if (rect.width > containerRect.width * 0.9) return;

            // 필터링 먼저 체크
            if (shouldFilterOut(text)) {
                return;
            }

            const speaker = identifySpeaker(node, containerRect);
            
            // 가장 가까운 시간 찾기
            const timeInfo = findNearestTime(node);
            const timestamp = timeInfo ? timeInfo.timestamp : null;
            const timestampText = timeInfo ? timeInfo.text : null;
            
            // 고유키: content만 사용 (정규화)
            // 공백 정리 + normalize로 일관성 보장
            const normalizedContent = text.trim().replace(/\s+/g, ' ').normalize('NFC');
            const contentKey = `TEXT_${normalizedContent}`;
            
            // 이미 처리된 content면 스킵 (첫 발견 시만 저장)
            if (window.PROCESSED_CONTENTS.has(contentKey)) {
                return;
            }

            const counter = messageCounter++;
            window.COLLECTED_DB.set(contentKey, {
                id: `msg_${counter}`,
                type: 'text',
                sender: speaker,
                content: text,
                timestamp: timestamp,
                timestampText: timestampText,
                sequence: counter,
                collectedAt: Date.now()
            });
            
            // 처리 완료 표시 (절대 중복 저장 방지)
            window.PROCESSED_CONTENTS.add(contentKey);
        });

        const images = chatContainer.querySelectorAll('img');
        images.forEach(img => {
            const rect = img.getBoundingClientRect();
            
            if (!isElementInViewport(img)) {
                return;
            }
            
            if (rect.width < 50 || rect.height < 50) return;
            if (img.alt && (img.alt.toLowerCase().includes('profile') || img.alt.includes('프로필'))) return;

            let src = img.src;
            if (img.srcset) {
                let parts = img.srcset.split(',');
                src = parts[parts.length - 1].trim().split(' ')[0];
            }
            
            if (src && src.includes('scontent') && src.includes('cdninstagram.com')) {
                return;
            }
            
            if (src && (src.includes('video') || src.includes('reel') || src.includes('.mp4') || src.includes('.webm'))) {
                return;
            }

            const speaker = identifySpeaker(img, containerRect);
            const timeInfo = findNearestTime(img);
            const timestamp = timeInfo ? timeInfo.timestamp : null;
            const timestampText = timeInfo ? timeInfo.text : null;
            
            const contentKey = `IMG_${src}`;
            
            if (window.PROCESSED_CONTENTS.has(contentKey)) {
                return;
            }

            const counter = messageCounter++;
            window.COLLECTED_DB.set(contentKey, {
                id: `msg_${counter}`,
                type: 'image',
                sender: speaker,
                content: src,
                timestamp: timestamp,
                timestampText: timestampText,
                sequence: counter,
                collectedAt: Date.now()
            });
            
            window.PROCESSED_CONTENTS.add(contentKey);
        });

        statusBox.innerText = `📥 ${window.COLLECTED_DB.size} messages`;
        
        const now = Date.now();
        if (now - lastTablePrint > 3000) {
            lastTablePrint = now;
            const data = Array.from(window.COLLECTED_DB.values());
            if (data.length > 0) {
                console.table(data);
            }
        }
        } catch (scanError) {
            console.error("[SCAN ERROR]", scanError);
        }
    }

    let scannerInterval = setInterval(scanScreen, 500);
    
    window.showData = function() {
        let data = Array.from(window.COLLECTED_DB.values());
        
        data.sort((a, b) => {
            if (a.timestamp && b.timestamp) {
                if (a.timestamp !== b.timestamp) {
                    return b.timestamp - a.timestamp;
                }
                return b.sequence - a.sequence;
            }
            if (a.timestamp) return -1;
            if (b.timestamp) return 1;
            return b.sequence - a.sequence;
        });
        
        console.log(`[Collected] ${data.length} messages`);
        if (data.length > 0) {
            console.table(data);
        } else {
            console.log("[Data] No messages collected yet");
        }
        return data;
    };

    window.stopAndExport = function() {
        clearInterval(scannerInterval);
        statusBox.style.backgroundColor = '#2ecc71';
        statusBox.innerText = `✅ Done! (${window.COLLECTED_DB.size} messages)`;
        
        let data = Array.from(window.COLLECTED_DB.values());
        
        data.sort((a, b) => {
            if (a.timestamp && b.timestamp) {
                if (a.timestamp !== b.timestamp) {
                    return b.timestamp - a.timestamp;
                }
                return b.sequence - a.sequence;
            }
            if (a.timestamp) return -1;
            if (b.timestamp) return 1;
            return b.sequence - a.sequence;
        });
        
        const stats = {
            total: data.length,
            myMessages: data.filter(m => m.sender === "나 (Me)").length,
            otherMessages: data.filter(m => m.sender === "상대방 (Other)").length,
            textMessages: data.filter(m => m.type === "text").length,
            imageMessages: data.filter(m => m.type === "image").length,
            withTimestamp: data.filter(m => m.timestamp).length,
            withoutTimestamp: data.filter(m => !m.timestamp).length
        };

        console.log("\n=== Collection Complete ===\n");
        if (recipientUsername) {
            console.log(`Recipient: ${recipientUsername}`);
        }
        if (myUsername) {
            console.log(`Me: ${myUsername}`);
        }
        
        console.log("\nStatistics:");
        console.log(`Total: ${stats.total}`);
        console.log(`My messages: ${stats.myMessages} (${(stats.myMessages/stats.total*100).toFixed(1)}%)`);
        console.log(`Other messages: ${stats.otherMessages} (${(stats.otherMessages/stats.total*100).toFixed(1)}%)`);
        console.log(`Text: ${stats.textMessages}`);
        console.log(`Images: ${stats.imageMessages}`);
        console.log(`With timestamp: ${stats.withTimestamp}`);
        console.log(`Without timestamp: ${stats.withoutTimestamp}`);
        console.log("\nAll Messages (Latest First):");
        console.table(data);
        
        return data;
    };

})();