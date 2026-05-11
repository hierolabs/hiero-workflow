/**
 * 삼삼엠투(33m2) 전체 데이터 수집 스크립트
 *
 * 사용법:
 *   1. 삼삼엠투 호스트 페이지에 로그인 (https://33m2.co.kr/host)
 *   2. 브라우저 개발자도구 콘솔(F12 → Console)에 이 스크립트를 붙여넣고 실행
 *   3. 수집 완료 후 JSON 파일이 자동 다운로드됨
 *
 * 수집 항목:
 *   - Step 1: 숙소 목록 (전체 페이지)
 *   - Step 2: 숙소 상세 (가격/관리비/청소비/보증금/할인/환불)
 *   - Step 3: 계약 목록 (전체 페이지)
 *
 * 주의:
 *   - 읽기 전용 수집. 가격/계약/메시지 변경 없음.
 *   - 페이지당 1초 대기 (서버 부하 방지)
 *   - 전체 수집 약 5~10분 소요
 */

(async function samsam_collect() {
  const DELAY = 1000; // 페이지 간 대기 (ms)
  const BASE = 'https://33m2.co.kr';
  const log = (msg) => console.log(`[삼삼엠투 수집] ${msg}`);
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // ============================================================
  // 유틸리티
  // ============================================================
  function parseNumber(str) {
    if (!str) return 0;
    return parseInt(String(str).replace(/[^0-9]/g, '')) || 0;
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

  function todayStr() {
    return new Date().toISOString().split('T')[0];
  }

  // ============================================================
  // Step 1: 숙소 목록 수집
  // ============================================================
  async function collectRoomList() {
    log('Step 1: 숙소 목록 수집 시작');
    const rooms = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      log(`  숙소 목록 페이지 ${page} 수집 중...`);

      const res = await fetch(`${BASE}/host/room?page=${page}`, {
        credentials: 'include'
      });
      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // 숙소 카드에서 정보 추출
      const roomCards = doc.querySelectorAll('[class*="room"], .card, tr, [data-room-id]');

      // 범용 추출: 페이지 내 모든 링크에서 /host/room/{id} 패턴 찾기
      const roomLinks = doc.querySelectorAll('a[href*="/host/room/"]');
      const pageRooms = [];

      roomLinks.forEach(link => {
        const href = link.getAttribute('href') || '';
        const match = href.match(/\/host\/room\/(\d+)/);
        if (!match) return;

        const roomId = match[1];
        // 중복 방지
        if (pageRooms.find(r => r.room_id === roomId)) return;

        // 카드/행에서 텍스트 추출 (상위 요소에서)
        const card = link.closest('tr, [class*="card"], [class*="room"], li, div') || link;
        const text = card.textContent || '';

        // 이름: 링크 텍스트 또는 첫 번째 의미있는 텍스트
        const name = link.textContent?.trim() || '';

        // 주소: 텍스트에서 "서울" 또는 "경기" 로 시작하는 부분
        const addrMatch = text.match(/(서울특별시|경기도|인천광역시)[^\n,]*/);
        const address = addrMatch ? addrMatch[0].trim() : '';

        // 가격: "000,000원" 패턴
        const priceMatch = text.match(/(\d{1,3}(,\d{3})+)원/);
        const weeklyPrice = priceMatch ? priceMatch[0] : '';

        // 공개/비공개
        const visibility = text.includes('비공개') ? '비공개' : '공개';

        pageRooms.push({
          page,
          room_id: roomId,
          name,
          address,
          weekly_price: weeklyPrice,
          weekly_price_number: parseNumber(weeklyPrice),
          visibility,
          admin_url: `${BASE}/host/room/${roomId}`
        });
      });

      if (pageRooms.length === 0) {
        hasMore = false;
      } else {
        rooms.push(...pageRooms);
        page++;
        await sleep(DELAY);
      }
    }

    log(`  숙소 목록 수집 완료: ${rooms.length}개`);
    return rooms;
  }

  // ============================================================
  // Step 2: 숙소 상세 수집 (가격/관리비/청소비/보증금/할인/환불)
  // ============================================================
  async function collectRoomDetails(rooms) {
    log(`Step 2: 숙소 상세 수집 시작 (${rooms.length}개)`);
    const details = [];

    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i];
      log(`  [${i + 1}/${rooms.length}] ${room.name} (${room.room_id})`);

      try {
        const res = await fetch(`${BASE}/host/room/${room.room_id}`, {
          credentials: 'include'
        });
        const html = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const text = doc.body?.textContent || '';

        // 1주 임대료
        const rentMatch = text.match(/1주\s*임대료[^\d]*(\d{1,3}(,\d{3})*)/);
        const rentWeekly = rentMatch ? rentMatch[1] : '';

        // 보증금
        const depositMatch = text.match(/보증금[^\d]*(\d{1,3}(,\d{3})*원?)/);
        const deposit = depositMatch ? depositMatch[1] : '';

        // 관리비
        const maintMatch = text.match(/1주\s*관리비[^\d]*(\d{1,3}(,\d{3})*)/);
        const maintenanceWeekly = maintMatch ? maintMatch[1] : '';

        // 관리비 포함 항목
        const maintenanceIncluded = {};
        ['가스', '수도', '전기', '인터넷', '난방'].forEach(item => {
          if (text.includes(item)) {
            maintenanceIncluded[item] = text.includes(`${item}`) ? '포함' : '미포함';
          }
        });

        // 관리비 설명
        const maintDescMatch = text.match(/관리비[^.]*\./);
        const maintenanceDescription = maintDescMatch ? maintDescMatch[0].trim() : '';

        // 퇴실 청소비
        const cleanMatch = text.match(/퇴실\s*청소비[^\d]*(\d{1,3}(,\d{3})*)/);
        const cleaningFee = cleanMatch ? cleanMatch[1] : '';

        // 환불 규정
        let refundPolicy = '';
        if (text.includes('약한')) refundPolicy = '약한';
        else if (text.includes('강한')) refundPolicy = '강한';
        else if (text.includes('보통')) refundPolicy = '보통';

        // 장기 계약 할인 (원문 그대로)
        const longTermSection = text.match(/장기\s*계약\s*할인[^]*?(?=즉시\s*입주|1주\s*관리비|$)/);
        const longTermDiscountRaw = longTermSection ? longTermSection[0].trim().slice(0, 500) : '';

        // 즉시 입주 할인 (원문 그대로)
        const immediateSection = text.match(/즉시\s*입주\s*할인[^]*?(?=1주\s*관리비|관리비\s*포함|$)/);
        const immediateDiscountRaw = immediateSection ? immediateSection[0].trim().slice(0, 500) : '';

        details.push({
          ...room,
          rent_weekly: rentWeekly,
          rent_weekly_number: parseNumber(rentWeekly),
          deposit,
          deposit_number: parseNumber(deposit),
          maintenance_weekly: maintenanceWeekly,
          maintenance_weekly_number: parseNumber(maintenanceWeekly),
          maintenance_included: maintenanceIncluded,
          maintenance_description: maintenanceDescription,
          cleaning_fee: cleaningFee,
          cleaning_fee_number: parseNumber(cleaningFee),
          refund_policy: refundPolicy,
          long_term_discount_raw: longTermDiscountRaw,
          immediate_move_in_discount_raw: immediateDiscountRaw,
        });
      } catch (err) {
        log(`  ⚠ ${room.room_id} 상세 수집 실패: ${err.message}`);
        details.push({ ...room, error: err.message });
      }

      await sleep(DELAY);
    }

    log(`  숙소 상세 수집 완료: ${details.length}개`);
    return details;
  }

  // ============================================================
  // Step 3: 계약 목록 수집
  // ============================================================
  async function collectContracts() {
    log('Step 3: 계약 목록 수집 시작');
    const contracts = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      if (page % 20 === 1) log(`  계약 페이지 ${page} 수집 중...`);

      try {
        const res = await fetch(`${BASE}/host/contract?page=${page}`, {
          credentials: 'include'
        });
        const html = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // 테이블 행에서 계약 정보 추출
        const rows = doc.querySelectorAll('tr, [class*="contract"], [class*="card"]');
        let pageContracts = 0;

        rows.forEach(row => {
          const text = row.textContent || '';
          const links = row.querySelectorAll('a');

          // 계약 ID 찾기
          let contractId = '';
          let chatId = '';
          links.forEach(a => {
            const href = a.getAttribute('href') || '';
            const contractMatch = href.match(/\/host\/contract\/(\d+)/);
            const chatMatch = href.match(/\/host\/chat\/(\d+)/);
            if (contractMatch) contractId = contractMatch[1];
            if (chatMatch) chatId = chatMatch[1];
          });

          if (!contractId) return;

          // 상태 추출
          const statusKeywords = ['계약대기', '결제취소', '입주대기', '거주중', '취소', '계약종료', '퇴실중'];
          let status = '';
          statusKeywords.forEach(kw => {
            if (text.includes(kw) && !status) status = kw;
          });

          // 결제 상태
          const paymentKeywords = ['결제완료', '결제대기', '결제취소'];
          let paymentStatus = '';
          paymentKeywords.forEach(kw => {
            if (text.includes(kw) && !paymentStatus) paymentStatus = kw;
          });

          // 금액
          const amountMatch = text.match(/(\d{1,3}(,\d{3})+)원/g);
          const amount = amountMatch ? amountMatch[amountMatch.length - 1] : '';

          // 기간 "2026.05.11(월) ~ 2026.05.24(일)"
          const periodMatch = text.match(/\d{4}\.\d{2}\.\d{2}\([가-힣]\)\s*~\s*\d{4}\.\d{2}\.\d{2}\([가-힣]\)/);
          const period = periodMatch ? periodMatch[0] : '';

          // 숙소명 (링크 텍스트에서)
          let roomName = '';
          links.forEach(a => {
            const href = a.getAttribute('href') || '';
            if (href.includes('/host/room/')) {
              roomName = a.textContent?.trim() || '';
            }
          });

          // 세입자
          const tenantMatch = text.match(/([가-힣]{2,4})\s*(계약|결제|입주|거주|취소)/);
          const tenant = tenantMatch ? tenantMatch[1] : '';

          contracts.push({
            page,
            contract_id: contractId,
            chat_id: chatId,
            status,
            payment_status: paymentStatus,
            room_name: roomName,
            tenant,
            period,
            amount,
            amount_number: parseNumber(amount),
          });
          pageContracts++;
        });

        if (pageContracts === 0) {
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

    log(`  계약 수집 완료: ${contracts.length}건`);
    return contracts;
  }

  // ============================================================
  // 실행
  // ============================================================
  const startTime = new Date();
  log('=== 삼삼엠투 전체 수집 시작 ===');
  log(`시작 시각: ${startTime.toISOString()}`);

  // Step 1: 숙소 목록
  const roomList = await collectRoomList();

  // Step 2: 숙소 상세
  const roomDetails = await collectRoomDetails(roomList);

  // Step 3: 계약
  const contracts = await collectContracts();

  const endTime = new Date();
  const elapsed = Math.round((endTime - startTime) / 1000);
  log(`=== 수집 완료 (${elapsed}초) ===`);

  // 결과 합치기
  const result = {
    source: '33m2 host web',
    collected_at: startTime.toISOString(),
    collection_note: '읽기 전용 수집. 쓰기 작업 없음.',
    elapsed_seconds: elapsed,
    summary: {
      rooms_count: roomDetails.length,
      contracts_count: contracts.length,
      room_weekly_price_min: Math.min(...roomDetails.map(r => r.rent_weekly_number).filter(n => n > 0)),
      room_weekly_price_max: Math.max(...roomDetails.map(r => r.rent_weekly_number)),
      room_weekly_price_avg: Math.round(
        roomDetails.reduce((s, r) => s + r.rent_weekly_number, 0) / roomDetails.length
      ),
    },
    rooms: roomDetails,
    contracts,
  };

  // 다운로드
  const filename = `33m2_export_all_${todayStr()}.json`;
  downloadJSON(result, filename);
  log(`파일 다운로드: ${filename}`);

  // 숙소 상세만 별도 저장
  const detailsResult = {
    collected_at: startTime.toISOString(),
    summary: {
      rooms_count: roomDetails.length,
      rent_weekly_min: Math.min(...roomDetails.map(r => r.rent_weekly_number).filter(n => n > 0)),
      rent_weekly_max: Math.max(...roomDetails.map(r => r.rent_weekly_number)),
    },
    rooms: roomDetails,
  };
  downloadJSON(detailsResult, `33m2_room_details_all_${todayStr()}.json`);

  log('완료! 다운로드된 파일을 docs/samsam/ 폴더에 저장하세요.');
  log('그 후 HIERO 가격 캘린더 → 시장 데이터 → 자동 임포트 클릭');

  return result;
})();
