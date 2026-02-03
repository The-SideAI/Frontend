// 페이지 컨텍스트 메시지 추출기 초기화 스크립트
(function () {
  try {
    var script = document.currentScript;
    var platformName = script && script.dataset ? script.dataset.platform : null;
    if (!platformName) {
      console.error('[Extractor] Platform not provided');
      return;
    }

    var extractor = platformName === 'instagram'
      ? window.MessageExtractor && window.MessageExtractor.Instagram
      : window.MessageExtractor && window.MessageExtractor.Telegram;

    if (!extractor) {
      console.error('[Extractor] Platform extractor not found:', platformName);
      return;
    }

    if (extractor.init) {
      extractor.init();
    }

    var statusBox = window.MessageExtractor.createStatusBox(platformName);
    window.COLLECTED_DB = new Map();
    window.PROCESSED_CONTENTS = new Set();

    var lastTablePrint = 0;
    var messageCounter = 0;

    function scanScreen() {
      try {
        extractor.extractUsername();

        var chatContainer = document.querySelector(extractor.config.chatContainer) || document.body;
        
        if (extractor.preScan) {
          extractor.preScan(chatContainer);
        }
        
        var textNodes = extractor.getMessageNodes
          ? extractor.getMessageNodes(chatContainer)
          : chatContainer.querySelectorAll(extractor.config.textNodes);

        textNodes.forEach(function (node) {
          var element = node;
          var text = extractor.getMessageText
            ? extractor.getMessageText(element)
            : (element.innerText || '').trim() || (element.textContent || '').trim();
          var viewportTarget = extractor.getMessageTextElement
            ? extractor.getMessageTextElement(element)
            : element;
          
          if (!text) return;
          if (!window.MessageExtractor.isElementInViewport(viewportTarget)) return;
          if (extractor.shouldFilterOut(text)) return;

          var normalized = window.MessageExtractor.normalizeContent(text);
          var contentKey = 'TEXT_' + normalized;

          if (window.PROCESSED_CONTENTS.has(contentKey)) return;

          var processed = extractor.processContent ? extractor.processContent(text, node) : {
            content: text,
            timestamp: null,
            timestampText: null
          };
          
          var timeInfo = extractor.findNearestTime(node);
          var counter = messageCounter++;

          var messageData = {
            id: 'msg_' + counter,
            type: 'text',
            sender: extractor.identifySpeaker(node),
            content: processed.content,
            timestamp: processed.timestamp || (timeInfo && timeInfo.timestamp) || null,
            timestampText: processed.timestampText || (timeInfo && timeInfo.text) || null,
            sequence: counter,
            collectedAt: Date.now()
          };

          if (extractor.filterMessageData) {
            messageData = extractor.filterMessageData(messageData);
          }

          window.COLLECTED_DB.set(contentKey, messageData);
          window.PROCESSED_CONTENTS.add(contentKey);
        });

        var images = chatContainer.querySelectorAll(extractor.config.images);

        images.forEach(function (img) {
          var rect = img.getBoundingClientRect();
          if (!window.MessageExtractor.isElementInViewport(img)) return;
          if (rect.width < 50 || rect.height < 50) return;

          var src = img.src;
          if (img.srcset) {
            var parts = img.srcset.split(',');
            src = parts[parts.length - 1].trim().split(' ')[0];
          }

          var contentKey = 'IMG_' + src;
          if (window.PROCESSED_CONTENTS.has(contentKey)) return;

          var timeInfo = extractor.findNearestTime(img);
          var counter = messageCounter++;

          var imageData = {
            id: 'msg_' + counter,
            type: 'image',
            sender: extractor.identifySpeaker(img),
            content: src,
            timestamp: (timeInfo && timeInfo.timestamp) || null,
            timestampText: (timeInfo && timeInfo.text) || null,
            sequence: counter,
            collectedAt: Date.now()
          };

          if (extractor.filterMessageData) {
            imageData = extractor.filterMessageData(imageData);
          }

          window.COLLECTED_DB.set(contentKey, imageData);
          window.PROCESSED_CONTENTS.add(contentKey);
        });

        statusBox.innerText = '🔥 ' + window.COLLECTED_DB.size + ' messages';

        var now = Date.now();
        if (now - lastTablePrint > 3000) {
          lastTablePrint = now;
          var data = Array.from(window.COLLECTED_DB.values());
          if (data.length > 0) {
            console.table(data);
          }
        }
      } catch (error) {
        console.error('[Scan Error]', error);
      }
    }

    function getImageSrc(img) {
      var src = img.src;
      if (img.srcset) {
        var parts = img.srcset.split(',');
        src = parts[parts.length - 1].trim().split(' ')[0];
      }
      return src;
    }

    function findSelectableNode(target) {
      if (!target) return { node: null, type: null };

      // 1단계: closest로 직접 텍스트 노드 찾기 (이미지 체크 제외)
      if (target.closest && !target.closest('img')) {
        var directText = target.closest(extractor.config.textNodes);
        if (directText && directText.innerText && directText.innerText.trim()) {
          return { node: directText, type: 'text' };
        }
      }

      // 2단계: 부모 요소들을 순회하면서 메시지 버블 찾기
      var current = target;
      var attempts = 0;
      var maxAttempts = 15;

      while (current && attempts < maxAttempts) {
        // 텔레그램 전용: 메시지 노드를 먼저 찾기
        if (extractor.platform === 'telegram') {
          // data-message-id를 가진 부모 찾기
          if (current.hasAttribute && current.hasAttribute('data-message-id')) {
            var text = extractor.getMessageText ? extractor.getMessageText(current) : '';
            if (text && text.trim()) {
              return { node: current, type: 'text' };
            }
          }
          
          // 또는 Message 클래스를 가진 부모
          var className = typeof current.className === 'string' ? current.className : '';
          if (/message/i.test(className)) {
            var text = extractor.getMessageText ? extractor.getMessageText(current) : '';
            if (text && text.trim()) {
              return { node: current, type: 'text' };
            }
          }
        }
        
        // 기존 방식: querySelector로 텍스트 찾기
        if (current.querySelector) {
          var nestedText = current.querySelector(extractor.config.textNodes);
          if (nestedText) {
            var text = extractor.getMessageText
              ? extractor.getMessageText(nestedText)
              : (nestedText.innerText && nestedText.innerText.trim() || nestedText.textContent && nestedText.textContent.trim());
            
            if (text) {
              return { node: nestedText, type: 'text' };
            }
          }
        }

        current = current.parentElement;
        attempts++;
      }

      // 3단계: 이미지 찾기 (최후의 수단) - 직접 이미지를 클릭한 경우만
      if (target.tagName === 'IMG') {
        return { node: target, type: 'image' };
      }
      
      var directImage = target.closest ? target.closest(extractor.config.images) : null;
      if (directImage) {
        return { node: directImage, type: 'image' };
      }

      current = target;
      attempts = 0;
      while (current && attempts < maxAttempts) {
        if (current.querySelector) {
          var nestedImage = current.querySelector(extractor.config.images);
          if (nestedImage) {
            return { node: nestedImage, type: 'image' };
          }
        }
        current = current.parentElement;
        attempts++;
      }

      return { node: null, type: null };
    }

    function buildSelectionPayload(node, type) {
      var timeInfo = extractor.findNearestTime(node);
      var content = '';

      if (type === 'text') {
        content = (node.innerText || '').trim() || (node.textContent || '').trim();
        if (!content) return null;
        
        if (extractor.processContent) {
          var processed = extractor.processContent(content, node);
          content = processed.content;
        }
      } else if (type === 'image') {
        content = getImageSrc(node);
        if (!content) return null;
      } else {
        return null;
      }

      return {
        type: type,
        content: content,
        sender: extractor.identifySpeaker(node),
        timestamp: (timeInfo && timeInfo.timestamp) || null,
        timestampText: (timeInfo && timeInfo.text) || null
      };
    }

    function handleBubbleClick(target) {
      if (!target || !extractor || !extractor.config) return;

      var found = findSelectableNode(target);
      if (!found.node || !found.type) return;

      var node = found.node;
      var type = found.type;
      var payload = buildSelectionPayload(node, type);
      if (!payload) return;

      window.postMessage({
        source: 'dm-collector',
        type: 'MESSAGE_BUBBLE_SELECTED',
        payload: payload
      }, '*');
    }

    document.addEventListener('click', function (event) {
      try {
        handleBubbleClick(event.target);
      } catch (error) {
        console.error('[Bubble Click Error]', error);
      }
    }, true);

    var scannerInterval = setInterval(scanScreen, 5000);

    window.showData = function () {
      var data = Array.from(window.COLLECTED_DB.values());
      data = window.MessageExtractor.sortMessages(data);

      console.log('\n========== 📊 COLLECTED MESSAGES ==========');
      console.log('Total: ' + data.length + ' messages');
      if (data.length > 0) {
        console.table(data);
      } else {
        console.log('[Data] No messages collected yet');
      }
      return data;
    };

    window.stopAndExport = function () {
      clearInterval(scannerInterval);
      statusBox.style.backgroundColor = '#2ecc71';

      var data = Array.from(window.COLLECTED_DB.values());
      data = window.MessageExtractor.sortMessages(data);

      var stats = window.MessageExtractor.getStatistics(data);
      var usernames = extractor.extractUsername();

      statusBox.innerText = '✅ Done! (' + data.length + ' messages)';

      console.log('\n=== Collection Complete ===\n');
      if (usernames.recipient) console.log('Recipient: ' + usernames.recipient);
      if (usernames.me) console.log('Me: ' + usernames.me);

      console.log('\nStatistics:');
      console.log('Total: ' + stats.total);
      console.log('My messages: ' + stats.myMessages);
      console.log('Other messages: ' + stats.otherMessages);
      console.log('Text: ' + stats.textMessages);
      console.log('Images: ' + stats.imageMessages);
      console.table(data);

      return data;
    };

    // API로 분석 요청
    window.analyzeMessages = function() {
      var data = Array.from(window.COLLECTED_DB.values());
      data = window.MessageExtractor.sortMessages(data);

      if (data.length === 0) {
        console.error('[API] No messages to analyze');
        return;
      }

      console.log('[API] Sending ' + data.length + ' messages for analysis...');

      window.postMessage({
        source: 'dm-collector',
        type: 'ANALYZE_MESSAGES',
        payload: {
          messages: data,
          sourceUrl: window.location.href
        }
      }, '*');

      statusBox.innerText = '🔄 Analyzing...';
      statusBox.style.backgroundColor = '#f39c12';
    };

    // API 헬스 체크
    window.checkApiHealth = function() {
      console.log('[API] Checking API health...');
      
      window.postMessage({
        source: 'dm-collector',
        type: 'CHECK_API_HEALTH'
      }, '*');
    };

    console.log('[Extractor] Initialized successfully');
    console.log('[Commands] window.showData() | window.stopAndExport() | window.analyzeMessages() | window.checkApiHealth()');
  } catch (error) {
    console.error('[Extractor Init Error]', error);
  }
})();