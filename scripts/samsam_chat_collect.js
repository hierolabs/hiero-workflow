/**
 * 삼삼엠투(33m2) 채팅 메시지 수집 스크립트
 *
 * 목적:
 *   계약 1,915건의 chat_id별로 채팅방 페이지에 들어가 메시지(발신자/시각/내용) 수집.
 *   TTFR(첫 응답 시간) 분석의 핵심 입력 데이터.
 *
 * 사용 절차:
 *   1) 33m2 호스트에 로그인 (https://33m2.co.kr/host)
 *   2) ⚠ STEP A: 먼저 INSPECT_MODE = true 로 1개만 돌려서 DOM 구조 확인
 *   3) 콘솔에 출력된 HTML 샘플을 보고, 필요하면 PARSER 부분 조정
 *   4) STEP B: INSPECT_MODE = false 로 전체 수집
 *
 * 입력:
 *   기존에 다운로드한 33m2_contracts_all_*.json 또는
 *   33m2_contracts_all_*.csv 에서 추출한 chat_id 배열.
 *   콘솔에서 다음과 같이 주입:
 *     window.SAMSAM_CHAT_IDS = ['854690', '854691', ...];  // 1,915개
 *
 * 출력:
 *   33m2_chats_YYYY-MM-DD.json (자동 다운로드)
 *   50건마다 checkpoint도 자동 저장
 *
 * 주의:
 *   - 읽기 전용 (메시지 발송 / 가격 변경 없음)
 *   - 페이지당 1.5초 대기 (서버 부하 방지). 1,915건 × 1.5초 ≈ 48분 예상.
 *   - 중간에 끊겨도 checkpoint에서 재개 가능 (RESUME_FROM 사용)
 */

(async function samsam_chat_collect() {
  // ============================================================
  // CONFIG — 여기를 먼저 보세요
  // ============================================================
  const INSPECT_MODE = true;   // ← STEP A: 첫 1개 채팅 DOM 구조만 출력하고 종료
  const INSPECT_CHAT_ID = '';   // INSPECT_MODE에서 특정 chat_id를 검사하려면 여기에 입력 (비우면 첫 번째 사용)
  const RESUME_FROM = 0;        // 중간 재개 시 인덱스 (예: 300번부터 재개)
  const DELAY_MS = 1500;        // 요청 간격
  const CHECKPOINT_EVERY = 50;  // N건마다 checkpoint 저장
  const BASE = 'https://33m2.co.kr';

  const log = (msg) => console.log(`[삼삼엠투 채팅] ${msg}`);
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // ============================================================
  // 메시지 파서 — DOM 구조 모름 → 다중 전략
  // ============================================================
  /**
   * 채팅 페이지 HTML에서 메시지 배열을 추출.
   * 33m2 채팅 페이지가 SPA일 가능성이 높아 fetch만으로는 message가 안 보일 수 있음.
   * 이 경우 iframe으로 띄워서 DOM 렌더링 후 추출하는 fallback 필요.
   *
   * 반환: [{sender, sent_at_text, content, raw_html?}, ...]
   */
  function parseMessagesFromHTML(html, chat_id) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 전략 1: 명시적 메시지 요소 찾기
    const selectors = [
      '[class*="message"]',
      '[class*="chat-item"]',
      '[class*="chat_item"]',
      '[class*="msg"]',
      '[class*="Message"]',
      '[data-message-id]',
      'li[class*="chat"]',
      'div[class*="bubble"]',
    ];

    let elements = [];
    let usedSelector = '';
    for (const sel of selectors) {
      const found = doc.querySelectorAll(sel);
      if (found.length > 2) {  // 의미있는 개수가 나오는 셀렉터 선택
        elements = Array.from(found);
        usedSelector = sel;
        break;
      }
    }

    if (elements.length === 0) {
      return { messages: [], strategy: 'none', sample_html: html.slice(0, 3000) };
    }

    // 메시지 요소에서 발신자/시각/내용 추출
    const messages = [];
    elements.forEach((el, idx) => {
      const text = (el.textContent || '').trim();
      if (!text) return;

      // 발신자 추정: class에 'mine'/'sent'/'host' 있으면 host, 'received'/'guest'/'tenant' 있으면 guest
      const className = (el.className || '').toLowerCase();
      let sender = 'unknown';
      if (className.match(/mine|sent|host|right|out/)) sender = 'host';
      else if (className.match(/received|guest|tenant|other|left|in/)) sender = 'guest';

      // 시각 추정: "오전 10:30", "2024.08.15 15:30" 등 패턴
      const timeMatch = text.match(/(\d{4}[.-]\d{1,2}[.-]\d{1,2}\s*\d{1,2}:\d{2})|((오전|오후)\s*\d{1,2}:\d{2})|(\d{1,2}:\d{2})/);
      const sent_at_text = timeMatch ? timeMatch[0] : '';

      // 내용: 시각 텍스트를 제거한 나머지
      let content = text;
      if (sent_at_text) content = content.replace(sent_at_text, '').trim();

      // data-* 속성에서 추가 정보
      const dataAttrs = {};
      for (const attr of el.attributes) {
        if (attr.name.startsWith('data-')) dataAttrs[attr.name] = attr.value;
      }

      messages.push({
        chat_id,
        idx,
        sender,
        sent_at_text,
        content: content.slice(0, 2000),
        class_name: el.className?.slice(0, 100) || '',
        data_attrs: dataAttrs,
      });
    });

    return { messages, strategy: usedSelector };
  }

  // ============================================================
  // SPA 대응: iframe 렌더링으로 fallback
  // ============================================================
  async function fetchChatViaIframe(chat_id) {
    return new Promise((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1024px;height:768px;';
      iframe.src = `${BASE}/host/chat/${chat_id}`;
      let resolved = false;
      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          try { document.body.removeChild(iframe); } catch (e) {}
        }
      };
      iframe.onload = async () => {
        // 페이지 렌더링 대기 (SPA가 메시지 fetch 완료할 시간)
        await sleep(2500);
        try {
          const html = iframe.contentDocument?.documentElement?.outerHTML || '';
          resolve(html);
        } catch (e) {
          // CORS 차단 시 빈 문자열
          resolve('');
        }
        cleanup();
      };
      iframe.onerror = () => { resolve(''); cleanup(); };
      document.body.appendChild(iframe);
      // 타임아웃 10초
      setTimeout(() => { resolve(''); cleanup(); }, 10000);
    });
  }

  // ============================================================
  // 채팅 1건 수집 (fetch 우선 → iframe fallback)
  // ============================================================
  async function collectOneChat(chat_id) {
    // 1차: fetch
    let html = '';
    try {
      const res = await fetch(`${BASE}/host/chat/${chat_id}`, { credentials: 'include' });
      html = await res.text();
    } catch (e) {
      log(`  fetch 실패 (${chat_id}): ${e.message}`);
    }

    let result = parseMessagesFromHTML(html, chat_id);

    // 2차: 메시지가 안 나오면 iframe으로 재시도 (SPA 렌더링)
    if (result.messages.length === 0) {
      const iframeHtml = await fetchChatViaIframe(chat_id);
      if (iframeHtml) {
        result = parseMessagesFromHTML(iframeHtml, chat_id);
        result.via_iframe = true;
      }
    }

    return result;
  }

  // ============================================================
  // 다운로드
  // ============================================================
  function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function todayStr() {
    return new Date().toISOString().split('T')[0];
  }

  // ============================================================
  // 실행
  // ============================================================
  if (typeof window.SAMSAM_CHAT_IDS === 'undefined' || !Array.isArray(window.SAMSAM_CHAT_IDS)) {
    log('⚠ window.SAMSAM_CHAT_IDS 가 없습니다. 다음과 같이 먼저 주입하세요:');
    log('   window.SAMSAM_CHAT_IDS = ["854690", "854691", ...];');
    log('');
    log('  ※ 33m2_contracts_all_*.json 의 contracts[].chat_id 를 추출해서 넣으면 됩니다.');
    return;
  }

  const allChatIds = window.SAMSAM_CHAT_IDS.filter(Boolean);
  log(`총 chat_id: ${allChatIds.length}개`);

  // ============================================================
  // STEP A: INSPECT MODE — 1개만 돌려서 DOM 구조 보기
  // ============================================================
  if (INSPECT_MODE) {
    const targetId = INSPECT_CHAT_ID || allChatIds[0];
    log(`=== INSPECT_MODE: chat_id=${targetId} ===`);

    // 직접 fetch HTML
    let html = '';
    try {
      const res = await fetch(`${BASE}/host/chat/${targetId}`, { credentials: 'include' });
      html = await res.text();
      log(`  fetch HTML 길이: ${html.length}`);
    } catch (e) {
      log(`  fetch 실패: ${e.message}`);
    }

    // iframe 렌더링
    log('  iframe으로 SPA 렌더링 시도...');
    const iframeHtml = await fetchChatViaIframe(targetId);
    log(`  iframe HTML 길이: ${iframeHtml.length}`);

    // 두 가지로 파싱 시도
    const fetchResult = parseMessagesFromHTML(html, targetId);
    const iframeResult = iframeHtml ? parseMessagesFromHTML(iframeHtml, targetId) : { messages: [] };

    log(`\n  [fetch] strategy=${fetchResult.strategy}, messages=${fetchResult.messages.length}`);
    log(`  [iframe] strategy=${iframeResult.strategy}, messages=${iframeResult.messages.length}`);

    const better = iframeResult.messages.length > fetchResult.messages.length ? iframeResult : fetchResult;

    if (better.messages.length === 0) {
      log('\n⚠ 메시지를 찾지 못했습니다. 아래 HTML 샘플을 확인하세요:');
      console.log('=== HTML 샘플 (앞부분 3000자) ===');
      console.log((iframeHtml || html).slice(0, 3000));
      console.log('=== HTML 샘플 끝 ===');
      log('이 HTML을 보고 메시지 element가 어떤 class/태그인지 알려주세요.');
    } else {
      log(`\n✓ 메시지 추출 성공! 샘플 5개:`);
      better.messages.slice(0, 5).forEach((m, i) => {
        console.log(`  [${i+1}] sender=${m.sender}, time=${m.sent_at_text}, class=${m.class_name}`);
        console.log(`      content: ${m.content.slice(0, 100)}`);
      });
      log(`\n📋 사용된 selector: "${better.strategy}"`);
      log('이대로 전체 수집해도 될까요? 그러면 INSPECT_MODE = false 로 바꾸고 다시 실행하세요.');
    }

    // INSPECT 결과 저장
    downloadJSON({
      chat_id: targetId,
      fetch_html_len: html.length,
      iframe_html_len: iframeHtml.length,
      fetch_result: fetchResult,
      iframe_result: iframeResult,
      html_sample: (iframeHtml || html).slice(0, 10000),
    }, `33m2_chat_inspect_${targetId}_${todayStr()}.json`);

    return;
  }

  // ============================================================
  // STEP B: 전체 수집
  // ============================================================
  log(`=== 전체 수집 시작 (${allChatIds.length}건, RESUME_FROM=${RESUME_FROM}) ===`);
  log(`예상 소요: ${Math.ceil(allChatIds.length * DELAY_MS / 1000 / 60)}분`);

  const startTime = new Date();
  const results = [];
  let errors = 0;

  for (let i = RESUME_FROM; i < allChatIds.length; i++) {
    const chat_id = allChatIds[i];

    if (i % 20 === 0) {
      const elapsed = Math.round((new Date() - startTime) / 1000);
      const remain = Math.round(elapsed / Math.max(i - RESUME_FROM, 1) * (allChatIds.length - i));
      log(`[${i+1}/${allChatIds.length}] 진행 중... (경과 ${elapsed}초, 남은 ${remain}초)`);
    }

    try {
      const result = await collectOneChat(chat_id);
      results.push({
        chat_id,
        message_count: result.messages.length,
        strategy: result.strategy,
        via_iframe: result.via_iframe || false,
        messages: result.messages,
      });
    } catch (e) {
      errors++;
      results.push({ chat_id, error: e.message });
    }

    // Checkpoint 저장
    if ((i + 1) % CHECKPOINT_EVERY === 0) {
      downloadJSON({
        checkpoint: i + 1,
        total: allChatIds.length,
        collected_at: new Date().toISOString(),
        results,
      }, `33m2_chats_checkpoint_${i+1}_${todayStr()}.json`);
      log(`  💾 checkpoint 저장: ${i+1}건`);
    }

    await sleep(DELAY_MS);
  }

  const endTime = new Date();
  const elapsed = Math.round((endTime - startTime) / 1000);
  log(`=== 수집 완료 (${elapsed}초 = ${Math.round(elapsed/60)}분) ===`);
  log(`  성공: ${results.length - errors}`);
  log(`  실패: ${errors}`);
  log(`  메시지 총 수: ${results.reduce((s, r) => s + (r.message_count || 0), 0)}`);

  // 최종 저장
  downloadJSON({
    source: '33m2 host chat',
    collected_at: startTime.toISOString(),
    elapsed_seconds: elapsed,
    chat_count: results.length,
    error_count: errors,
    total_messages: results.reduce((s, r) => s + (r.message_count || 0), 0),
    results,
  }, `33m2_chats_all_${todayStr()}.json`);

  log('✓ 파일 다운로드 완료. docs/samsam/ 폴더에 옮겨주세요.');
  return results;
})();
