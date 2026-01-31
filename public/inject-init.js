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
        var textNodes = chatContainer.querySelectorAll(extractor.config.textNodes);

        textNodes.forEach(function (node) {
          var element = node;
          var text = (element.innerText || '').trim() || (element.textContent || '').trim();
          if (!text || !window.MessageExtractor.isElementInViewport(node)) return;
          if (extractor.shouldFilterOut(text)) return;

          var normalized = window.MessageExtractor.normalizeContent(text);
          var contentKey = 'TEXT_' + normalized;

          if (window.PROCESSED_CONTENTS.has(contentKey)) return;

          var timeInfo = extractor.findNearestTime(node);
          var counter = messageCounter++;

          window.COLLECTED_DB.set(contentKey, {
            id: 'msg_' + counter,
            type: 'text',
            sender: extractor.identifySpeaker(node),
            content: text,
            timestamp: (timeInfo && timeInfo.timestamp) || null,
            timestampText: (timeInfo && timeInfo.text) || null,
            sequence: counter,
            collectedAt: Date.now()
          });

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

          window.COLLECTED_DB.set(contentKey, {
            id: 'msg_' + counter,
            type: 'image',
            sender: extractor.identifySpeaker(img),
            content: src,
            timestamp: (timeInfo && timeInfo.timestamp) || null,
            timestampText: (timeInfo && timeInfo.text) || null,
            sequence: counter,
            collectedAt: Date.now()
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
