// 모든 플랫폼 공통 유틸리티

window.MessageExtractor = window.MessageExtractor || {};

window.MessageExtractor.isElementInViewport = function(element) {
    const rect = element.getBoundingClientRect();
    const isVerticalInViewport = rect.top < window.innerHeight && rect.bottom > 0;
    const isHorizontalInViewport = rect.left < window.innerWidth && rect.right > 0;
    const hasMinHeight = rect.height > 5;
    const hasMinWidth = rect.width > 5;
    
    return isVerticalInViewport && isHorizontalInViewport && hasMinHeight && hasMinWidth;
};

window.MessageExtractor.normalizeContent = function(text) {
    return text.trim().replace(/\s+/g, ' ').normalize('NFC');
};

window.MessageExtractor.createStatusBox = function(platform) {
    const statusBox = document.createElement('div');
    statusBox.style.position = 'fixed';
    statusBox.style.bottom = '20px';
    statusBox.style.right = '20px';
    statusBox.style.background = 'rgba(0, 0, 0, 0.8)';
    statusBox.style.color = '#fff';
    statusBox.style.padding = '10px 15px';
    statusBox.style.borderRadius = '8px';
    statusBox.style.zIndex = '99999';
    statusBox.style.fontSize = '14px';
    statusBox.innerText = `🔴 ${platform} scanner`;
    document.body.appendChild(statusBox);
    return statusBox;
};

window.MessageExtractor.sortMessages = function(data) {
    return data.sort((a, b) => {
        if (a.timestamp && b.timestamp) {
            if (a.timestamp !== b.timestamp) return b.timestamp - a.timestamp;
            return b.sequence - a.sequence;
        }
        if (a.timestamp) return -1;
        if (b.timestamp) return 1;
        return b.sequence - a.sequence;
    });
};

window.MessageExtractor.getStatistics = function(data) {
    return {
        total: data.length,
        myMessages: data.filter(m => m.sender === '나 (Me)').length,
        otherMessages: data.filter(m => m.sender === '상대방 (Other)').length,
        textMessages: data.filter(m => m.type === 'text').length,
        imageMessages: data.filter(m => m.type === 'image').length,
        withTimestamp: data.filter(m => m.timestamp).length,
        withoutTimestamp: data.filter(m => !m.timestamp).length
    };
};
