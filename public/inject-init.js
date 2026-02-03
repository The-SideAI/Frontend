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
        
        // 플랫폼별 사전 스캔 (있으면 실행)
        if (extractor.preScan) {
          extractor.preScan(chatContainer);
        }
        
        var textNodes = chatContainer.querySelectorAll(extractor.config.textNodes);

        textNodes.forEach(function (node) {
          var element = node;
          var text = (element.innerText || '').trim() || (element.textContent || '').trim();
          if (!text || !window.MessageExtractor.isElementInViewport(node)) return;
          if (extractor.shouldFilterOut(text)) return;

          var normalized = window.MessageExtractor.normalizeContent(text);
          var contentKey = 'TEXT_' + normalized;

          if (window.PROCESSED_CONTENTS.has(contentKey)) return;

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

          // 플랫폼별 필드 필터링 (있으면 사용)
          if (extractor.filterMessageData) {
            imageData = extractor.filterMessageData(imageData);
          }

          window.COLLECTED_DB.set(contentKey, imageData);

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

      if (target.closest) {
        var directText = target.closest(extractor.config.textNodes);
        if (directText) return { node: directText, type: 'text' };

        var directImage = target.closest(extractor.config.images);
        if (directImage) return { node: directImage, type: 'image' };
      }

      var current = target;
      var attempts = 0;
      while (current && attempts < 10) {
        if (current.querySelector) {
          var nestedText = current.querySelector(extractor.config.textNodes);
          if (nestedText) return { node: nestedText, type: 'text' };

          var nestedImage = current.querySelector(extractor.config.images);
          if (nestedImage) return { node: nestedImage, type: 'image' };
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
      } else {
        content = getImageSrc(node);
        if (!content) return null;
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

      console.log('[Collected] ' + data.length + ' messages');
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
