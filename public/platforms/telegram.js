// 텔레그램 메시지 추출기

window.MessageExtractor = window.MessageExtractor || {};

window.MessageExtractor.Telegram = {
    platform: 'telegram',
    
    config: {
        chatContainer: '.scrollable-y',
        textNodes: '.message-text, .text-content',
        images: 'img[class*="message"], img[class*="photo"]'
    },
    
    state: {
        recipientUsername: null,
        myUsername: null
    },
    
    init: function() {
        // 필요 시 텔레그램 초기화 처리
    },
    
    parseTimeText: function(text) {
        // 할 일: 텔레그램 시간 파싱 구현
        // 텔레그램은 다른 시간 포맷 사용
        return null;
    },
    
    shouldFilterOut: function(text) {
        if (!text || !text.trim()) return true;
        const trimmed = text.trim();
        
        // 기본 필터링
        if (trimmed.length === 1) return true;
        
        return false;
    },
    
    identifySpeaker: function(element) {
        let current = element;
        let depth = 0;
        
        while (current && depth < 10) {
            if (current.classList && (current.classList.contains('message') || current.classList.contains('is-out'))) {
                return current.classList.contains('is-out') ? "나 (Me)" : "상대방 (Other)";
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
    
    extractUsername: function() {
        // 할 일: 텔레그램 사용자명 추출 구현
        return {
            recipient: this.state.recipientUsername,
            me: this.state.myUsername
        };
    }
};
