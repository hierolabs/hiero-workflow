/**
 * 삼삼엠투(33m2) 채팅 메시지 수집 스크립트
 *
 * 사용법:
 *   1. 삼삼엠투 호스트 페이지에 로그인 (https://33m2.co.kr/host)
 *   2. 브라우저 개발자도구 콘솔(F12 → Console)에 이 스크립트를 붙여넣고 실행
 *   3. 수집 완료 후 JSON 파일이 자동 다운로드됨
 *
 * 수집 대상:
 *   - 기존 계약 데이터의 chat_id 1,684개 (고유)
 *   - 각 채팅방의 전체 메시지 (발신자, 시각, 내용)
 *
 * 목적:
 *   - TTFR(Time to First Reply) 가설 검증
 *   - 게스트 첫 메시지 → 호스트 첫 응답 시간 계산
 *
 * 주의:
 *   - 읽기 전용 수집. 메시지 전송/변경 없음.
 *   - 페이지당 800ms 대기 (서버 부하 방지)
 *   - 1,684개 채팅방 × ~800ms = 약 22분 소요
 *   - 중간 저장: 200건마다 배치 파일 자동 다운로드
 */

(async function samsam_collect_chats() {
  const DELAY = 800;
  const BATCH_SIZE = 200;
  const BASE = 'https://33m2.co.kr';
  const log = (msg) => console.log(`[삼삼엠투 채팅수집] ${msg}`);
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function todayStr() {
    return new Date().toISOString().split('T')[0];
  }

  function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ============================================================
  // Step 1: 기존 계약 데이터에서 chat_id 목록 추출
  // (직접 계약 페이지를 다시 순회해서 chat_id 수집)
  // ============================================================
  async function collectChatIds() {
    log('Step 1: 계약 페이지에서 chat_id 수집');
    const chatMap = new Map(); // chat_id → { contract_id, status, room_name, tenant, ... }
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      if (page % 20 === 1) log(`  계약 페이지 ${page} 스캔 중...`);

      try {
        const res = await fetch(`${BASE}/host/contract?page=${page}`, {
          credentials: 'include'
        });
        const html = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const rows = doc.querySelectorAll('tr, [class*="contract"], [class*="card"]');
        let found = 0;

        rows.forEach(row => {
          const links = row.querySelectorAll('a');
          let contractId = '';
          let chatId = '';
          let roomName = '';

          links.forEach(a => {
            const href = a.getAttribute('href') || '';
            const contractMatch = href.match(/\/host\/contract\/(\d+)/);
            const chatMatch = href.match(/\/host\/chat\/(\d+)/);
            if (contractMatch) contractId = contractMatch[1];
            if (chatMatch) chatId = chatMatch[1];
            if (href.includes('/host/room/')) roomName = a.textContent?.trim() || '';
          });

          if (!chatId) return;

          const text = row.textContent || '';
          const statusKeywords = ['계약대기', '결제취소', '입주대기', '거주중', '취소', '계약종료', '퇴실중'];
          let status = '';
          statusKeywords.forEach(kw => {
            if (text.includes(kw) && !status) status = kw;
          });

          const paymentKeywords = ['결제완료', '결제대기', '결제취소'];
          let paymentStatus = '';
          paymentKeywords.forEach(kw => {
            if (text.includes(kw) && !paymentStatus) paymentStatus = kw;
          });

          const amountMatch = text.match(/(\d{1,3}(,\d{3})+)원/g);
          const amount = amountMatch ? amountMatch[amountMatch.length - 1] : '';

          // 같은 chat_id에 여러 계약이 있으면 최신(마지막) 기준
          chatMap.set(chatId, {
            chat_id: chatId,
            contract_id: contractId,
            status,
            payment_status: paymentStatus,
            room_name: roomName,
            amount,
          });
          found++;
        });

        if (found === 0) {
          hasMore = false;
        } else {
          page++;
          await sleep(DELAY);
        }
      } catch (err) {
        log(`  ⚠ 계약 페이지 ${page} 실패: ${err.message}`);
        hasMore = false;
      }
    }

    log(`  고유 chat_id: ${chatMap.size}개`);
    return chatMap;
  }

  // ============================================================
  // Step 2: 각 chat_id로 채팅 메시지 수집
  // ============================================================
  async function collectMessages(chatId) {
    try {
      const res = await fetch(`${BASE}/host/chat/${chatId}`, {
        credentials: 'include'
      });
      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const messages = [];

      // 33m2 채팅 페이지의 메시지 파싱
      // 패턴 1: 메시지 버블/카드에서 추출
      const msgElements = doc.querySelectorAll(
        '[class*="message"], [class*="chat"], [class*="bubble"], [class*="msg"]'
      );

      msgElements.forEach(el => {
        const text = el.textContent?.trim() || '';
        if (!text || text.length < 2) return;

        // 발신자 유형 판별
        const classList = Array.from(el.classList || []).join(' ').toLowerCase();
        const parentClass = Array.from(el.parentElement?.classList || []).join(' ').toLowerCase();
        const allClass = classList + ' ' + parentClass;

        let senderType = 'unknown';
        if (allClass.includes('host') || allClass.includes('mine') || allClass.includes('self') || allClass.includes('right') || allClass.includes('send')) {
          senderType = 'host';
        } else if (allClass.includes('guest') || allClass.includes('other') || allClass.includes('left') || allClass.includes('receive') || allClass.includes('partner')) {
          senderType = 'guest';
        } else if (allClass.includes('system') || allClass.includes('notice') || allClass.includes('info')) {
          senderType = 'system';
        }

        // 시간 추출 — 메시지 내부 또는 인접 요소에서
        let sentAt = '';
        const timeEl = el.querySelector('[class*="time"], [class*="date"], time, small');
        if (timeEl) {
          sentAt = timeEl.textContent?.trim() || '';
        }
        // 텍스트에서 시간 패턴 매칭
        if (!sentAt) {
          const timeMatch = text.match(/(\d{4}[-.\/]\d{2}[-.\/]\d{2}\s+\d{1,2}:\d{2})/);
          if (timeMatch) sentAt = timeMatch[1];
        }
        if (!sentAt) {
          const timeMatch = text.match(/(\d{1,2}:\d{2})/);
          if (timeMatch) sentAt = timeMatch[1];
        }

        // 메시지 내용 (시간 제거)
        let content = text;
        if (sentAt) {
          content = text.replace(sentAt, '').trim();
        }

        if (content.length > 0) {
          messages.push({
            sender_type: senderType,
            content: content.slice(0, 2000),
            sent_at: sentAt,
            raw_classes: classList.slice(0, 200),
          });
        }
      });

      // 패턴 2: 메시지가 잡히지 않았으면 페이지 전체 텍스트에서 추출 시도
      if (messages.length === 0) {
        const bodyText = doc.body?.textContent || '';
        // 대화 패턴: 날짜/시간 + 이름 + 메시지
        const chatPattern = /(\d{4}[.-]\d{2}[.-]\d{2}\s+\d{1,2}:\d{2})\s*([^\n]{2,50}?)\s*:\s*([^\n]+)/g;
        let match;
        while ((match = chatPattern.exec(bodyText)) !== null) {
          messages.push({
            sender_type: 'unknown',
            content: match[3].trim().slice(0, 2000),
            sent_at: match[1].trim(),
            sender_name: match[2].trim(),
            raw_classes: 'fallback_pattern',
          });
        }
      }

      // 패턴 3: JSON 데이터가 페이지에 포함되어 있을 수 있음 (SPA)
      if (messages.length === 0) {
        const scripts = doc.querySelectorAll('script');
        for (const script of scripts) {
          const src = script.textContent || '';
          // __NEXT_DATA__ 또는 window.__data 패턴
          const jsonMatch = src.match(/(?:__NEXT_DATA__|__data__|messages\s*[=:])\s*({[\s\S]*?});?\s*<?\/?/);
          if (jsonMatch) {
            try {
              const data = JSON.parse(jsonMatch[1]);
              // 메시지 배열 찾기
              const findMessages = (obj, depth = 0) => {
                if (depth > 5 || !obj) return null;
                if (Array.isArray(obj) && obj.length > 0 && obj[0]?.content) return obj;
                if (typeof obj === 'object') {
                  for (const key of Object.keys(obj)) {
                    if (['messages', 'chatMessages', 'items', 'data'].includes(key)) {
                      const found = findMessages(obj[key], depth + 1);
                      if (found) return found;
                    }
                  }
                }
                return null;
              };
              const found = findMessages(data);
              if (found) {
                found.forEach(m => {
                  messages.push({
                    sender_type: m.sender_type || m.senderType || m.type || 'unknown',
                    content: (m.content || m.message || m.text || '').slice(0, 2000),
                    sent_at: m.sent_at || m.sentAt || m.created_at || m.createdAt || m.timestamp || '',
                    sender_name: m.sender_name || m.senderName || m.name || '',
                    raw_classes: 'json_extract',
                  });
                });
              }
            } catch (e) { /* ignore parse errors */ }
          }
        }
      }

      return {
        message_count: messages.length,
        messages,
        page_length: html.length,
      };
    } catch (err) {
      return {
        message_count: 0,
        messages: [],
        error: err.message,
      };
    }
  }

  // ============================================================
  // 실행
  // ============================================================
  const startTime = new Date();
  log('=== 삼삼엠투 채팅 메시지 수집 시작 ===');
  log(`시작 시각: ${startTime.toISOString()}`);

  // Step 1: chat_id 수집
  const chatMap = await collectChatIds();
  const chatEntries = Array.from(chatMap.values());
  log(`총 ${chatEntries.length}개 채팅방 수집 예정`);

  // Step 2: 메시지 수집
  const results = [];
  let successCount = 0;
  let emptyCount = 0;
  let errorCount = 0;

  for (let i = 0; i < chatEntries.length; i++) {
    const entry = chatEntries[i];

    if (i % 50 === 0) {
      const pct = Math.round(i / chatEntries.length * 100);
      const elapsed = Math.round((Date.now() - startTime.getTime()) / 1000);
      const remaining = i > 0 ? Math.round(elapsed / i * (chatEntries.length - i)) : 0;
      log(`  [${i}/${chatEntries.length}] ${pct}% | 성공:${successCount} 빈방:${emptyCount} 오류:${errorCount} | 경과:${elapsed}초 | 잔여:~${remaining}초`);
    }

    const chatResult = await collectMessages(entry.chat_id);

    results.push({
      ...entry,
      ...chatResult,
    });

    if (chatResult.error) {
      errorCount++;
    } else if (chatResult.message_count === 0) {
      emptyCount++;
    } else {
      successCount++;
    }

    // 중간 저장 (배치)
    if (results.length % BATCH_SIZE === 0) {
      const batchNum = Math.floor(results.length / BATCH_SIZE);
      const batchStart = (batchNum - 1) * BATCH_SIZE + 1;
      const batchEnd = batchNum * BATCH_SIZE;
      const batchData = results.slice(batchStart - 1, batchEnd);
      const filename = `33m2_chats_batch_${String(batchStart).padStart(4,'0')}_${String(batchEnd).padStart(4,'0')}_${todayStr()}.json`;
      downloadJSON(batchData, filename);
      log(`  💾 배치 저장: ${filename}`);
    }

    await sleep(DELAY);
  }

  // 최종 결과
  const endTime = new Date();
  const elapsed = Math.round((endTime - startTime) / 1000);
  log(`=== 수집 완료 (${elapsed}초) ===`);
  log(`  성공: ${successCount}, 빈 채팅: ${emptyCount}, 오류: ${errorCount}`);

  const totalMessages = results.reduce((s, r) => s + r.message_count, 0);
  log(`  총 메시지: ${totalMessages}건`);

  // 전체 다운로드
  const summary = {
    source: '33m2 host chat',
    collected_at: startTime.toISOString(),
    collection_note: '읽기 전용 수집. 메시지 전송/변경 없음.',
    elapsed_seconds: elapsed,
    stats: {
      total_chats: results.length,
      with_messages: successCount,
      empty: emptyCount,
      errors: errorCount,
      total_messages: totalMessages,
    },
    chats: results,
  };

  downloadJSON(summary, `33m2_chats_all_${todayStr()}.json`);
  log(`✅ 전체 파일 다운로드: 33m2_chats_all_${todayStr()}.json`);
  log('다운로드된 파일을 docs/samsam/ 폴더에 저장하세요.');

  // 간단 리포트
  const withMsgs = results.filter(r => r.message_count > 0);
  if (withMsgs.length > 0) {
    const avgMsgs = Math.round(totalMessages / withMsgs.length * 10) / 10;
    const maxMsgs = Math.max(...withMsgs.map(r => r.message_count));
    log(`  평균 메시지/채팅: ${avgMsgs}건, 최다: ${maxMsgs}건`);

    // sender_type 분포
    const types = {};
    withMsgs.forEach(r => r.messages.forEach(m => {
      types[m.sender_type] = (types[m.sender_type] || 0) + 1;
    }));
    log(`  sender_type 분포: ${JSON.stringify(types)}`);
  }

  return summary;
})();
