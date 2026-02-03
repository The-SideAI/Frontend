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
        
        console.log('[Scan] Chat container found:', !!chatContainer, 'className:', chatContainer.className);
        console.log('[Scan] Extractor methods available:', {
          getMessageNodes: !!extractor.getMessageNodes,
          getMessageText: !!extractor.getMessageText,
          preScan: !!extractor.preScan,
          config: !!extractor.config
        });
        
        // 플랫폼별 사전 스캔 (있으면 실행)
        if (extractor.preScan) {
          extractor.preScan(chatContainer);
        }
        
        var textNodes = extractor.getMessageNodes
          ? extractor.getMessageNodes(chatContainer)
          : chatContainer.querySelectorAll(extractor.config.textNodes);

        console.log('[Scan] Found ' + textNodes.length + ' text nodes');
        
        // 선택자 디버그 - 항상 실행
        console.log('[Scan] DEBUG - Testing selectors on chatContainer:');
        var alt1 = chatContainer.querySelectorAll('[class*="bubble"]');
        console.log('  [class*="bubble"]: ' + alt1.length);
        var alt2 = chatContainer.querySelectorAll('[class*="message"]');
        console.log('  [class*="message"]: ' + alt2.length);
        var alt3 = chatContainer.querySelectorAll('div[role="article"]');
        console.log('  div[role="article"]: ' + alt3.length);
        var alt4 = chatContainer.querySelectorAll('[dir="auto"]');
        console.log('  [dir="auto"]: ' + alt4.length);
        var alt5 = chatContainer.querySelectorAll('[class*="group"]');
        console.log('  [class*="group"]: ' + alt5.length);
        var alt6 = chatContainer.querySelectorAll('[data-test-id]');
        console.log('  [data-test-id]: ' + alt6.length);
        var alt7 = chatContainer.querySelectorAll('div[class]');
        console.log('  div[class] (all divs with class): ' + alt7.length);

        textNodes.forEach(function (node) {
          var element = node;
          var text = extractor.getMessageText
            ? extractor.getMessageText(element)
            : (element.innerText || '').trim() || (element.textContent || '').trim();
          var viewportTarget = extractor.getMessageTextElement
            ? extractor.getMessageTextElement(element)
            : element;
          
          if (!text) {
            console.log('[Scan] Skipped: empty text');
            return;
          }
          
          if (!window.MessageExtractor.isElementInViewport(viewportTarget)) {
            console.log('[Scan] Skipped: not in viewport');
            return;
          }
          
          if (extractor.shouldFilterOut(text)) {
            console.log('[Scan] Skipped: filtered out - ' + text.substring(0, 30));
            return;
          }

          var normalized = window.MessageExtractor.normalizeContent(text);
          var contentKey = 'TEXT_' + normalized;

          if (window.PROCESSED_CONTENTS.has(contentKey)) {
            console.log('[Scan] Skipped: already processed');
            return;
          }

          // 플랫폼별 content 처리 (있으면 사용, 없으면 원본)
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

          // 플랫폼별 필드 필터링 (있으면 사용)
          if (extractor.filterMessageData) {
            messageData = extractor.filterMessageData(messageData);
          }

          window.COLLECTED_DB.set(contentKey, messageData);

          console.log('[Scan] ADDED text message:', {
            type: messageData.type,
            sender: messageData.sender,
            content: messageData.content.substring(0, 50)
          });

          window.PROCESSED_CONTENTS.add(contentKey);
        });

        var images = chatContainer.querySelectorAll(extractor.config.images);
        
        console.log('[Scan] Found ' + images.length + ' images');

        images.forEach(function (img) {
          var rect = img.getBoundingClientRect();
          if (!window.MessageExtractor.isElementInViewport(img)) {
            console.log('[Scan] Image skipped: not in viewport');
            return;
          }
          if (rect.width < 50 || rect.height < 50) {
            console.log('[Scan] Image skipped: too small (' + rect.width + 'x' + rect.height + ')');
            return;
          }

          var src = img.src;
          if (img.srcset) {
            var parts = img.srcset.split(',');
            src = parts[parts.length - 1].trim().split(' ')[0];
          }

          var contentKey = 'IMG_' + src;
          if (window.PROCESSED_CONTENTS.has(contentKey)) {
            console.log('[Scan] Image skipped: already processed');
            return;
          }

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

          // 플랫폼별 필드 필터링 (있으면 사용)
          if (extractor.filterMessageData) {
            imageData = extractor.filterMessageData(imageData);
          }

          window.COLLECTED_DB.set(contentKey, imageData);

          console.log('[Scan] ADDED image message:', {
            type: imageData.type,
            sender: imageData.sender,
            content: imageData.content.substring(0, 50)
          });

          window.PROCESSED_CONTENTS.add(contentKey);
        });

        statusBox.innerText = '📥 ' + window.COLLECTED_DB.size + ' messages';

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

      // 1단계: 클릭한 요소 자체가 텍스트/이미지인지 확인
      if (target.closest) {
        var directText = target.closest(extractor.config.textNodes);
        if (directText && directText.innerText?.trim()) {
          return { node: directText, type: 'text' };
        }

        var directImage = target.closest(extractor.config.images);
        if (directImage) {
          return { node: directImage, type: 'image' };
        }
      }

      // 2단계: 부모 요소들을 순회하면서 메시지 버블 찾기
      var current = target;
      var attempts = 0;
      var maxAttempts = 15;

      while (current && attempts < maxAttempts) {
        // 텍스트 먼저 찾기 (텍스트 우선)
        if (current.querySelector) {
          var nestedText = current.querySelector(extractor.config.textNodes);
          if (nestedText && (nestedText.innerText?.trim() || nestedText.textContent?.trim())) {
            return { node: nestedText, type: 'text' };
          }
        }

        current = current.parentElement;
        attempts++;
      }

      // 3단계: 이미지 찾기 (최후의 수단)
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
        
        // 플랫폼별 content 처리 (텔레그램: 시간 제거)
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

    var scannerInterval = setInterval(scanScreen, 500);

    window.showData = function () {
      var data = Array.from(window.COLLECTED_DB.values());
      data = window.MessageExtractor.sortMessages(data);

      console.log('\n========== 📊 COLLECTED MESSAGES ==========');
      console.log('Total: ' + data.length + ' messages');
      data.forEach(function(msg, index) {
        console.log('\n[Message ' + (index + 1) + ']');
        console.log('  Type: ' + msg.type);
        console.log('  Sender: ' + msg.sender);
        console.log('  Content: ' + (msg.content.substring(0, 100) || '(empty)'));
        console.log('  Timestamp: ' + (msg.timestampText || 'N/A'));
      });
      console.log('\n========== END ==========\n');
      
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
      console.log('My messages: ' + stats.myMessages + ' (' + (stats.myMessages / stats.total * 100).toFixed(1) + '%)');
      console.log('Other messages: ' + stats.otherMessages + ' (' + (stats.otherMessages / stats.total * 100).toFixed(1) + '%)');
      console.log('Text: ' + stats.textMessages);
      console.log('Images: ' + stats.imageMessages);
      console.log('With timestamp: ' + stats.withTimestamp);
      console.log('Without timestamp: ' + stats.withoutTimestamp);
      console.log('\nAll Messages (Latest First):');
      console.table(data);

      return data;
    };

    console.log('[Extractor] Initialized successfully');
  } catch (error) {
    console.error('[Extractor Init Error]', error);
  }
})();
