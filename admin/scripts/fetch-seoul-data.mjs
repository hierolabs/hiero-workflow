/**
 * 서울시 열린데이터광장 API → 대규모 소상공인 디지털 자산 데이터
 *
 * 수집 대상:
 * 1. 일반음식점 인허가 (LOCALDATA_072405) — 14만→영업중 ~2.5만건, 개별 업소 디지털자산
 * 2. 구별 점포 통계 (VwsmSignguStorW) — 6.9만건, 구/업종별 전체 현황
 * 3. 관광명소 (TbVwAttractions) — 한국어 422건, 명소 디지털자산
 * 4. 문화행사 (culturalEventInfo) — 3,907건
 *
 * 실행: node scripts/fetch-seoul-data.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";

const API_KEY = "4c434d4a666575303938676b486346";
const OUT_DIR = path.resolve("public/data");

async function fetchSeoul(service, start, end) {
  const url = `http://openapi.seoul.go.kr:8088/${API_KEY}/json/${service}/${start}/${end}/`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data[service]?.row || [];
}

async function fetchAll(service, total, label) {
  const all = [];
  for (let s = 1; s <= total; s += 1000) {
    const e = Math.min(s + 999, total);
    const rows = await fetchSeoul(service, s, e);
    all.push(...rows);
    if (all.length % 5000 === 0 || s + 999 >= total) {
      console.log(`  ${label}: ${all.length.toLocaleString()}건`);
    }
  }
  return all;
}

// ─── 구 코드 → 구 이름 매핑 ───
const GU_CODES = {
  "3000000": "종로구", "3010000": "중구", "3020000": "용산구", "3030000": "성동구",
  "3040000": "광진구", "3050000": "동대문구", "3060000": "중랑구", "3070000": "성북구",
  "3080000": "강북구", "3090000": "도봉구", "3100000": "노원구", "3110000": "은평구",
  "3120000": "서대문구", "3130000": "마포구", "3140000": "양천구", "3150000": "강서구",
  "3160000": "구로구", "3170000": "금천구", "3180000": "영등포구", "3190000": "동작구",
  "3200000": "관악구", "3210000": "서초구", "3220000": "강남구", "3230000": "송파구",
  "3240000": "강동구",
};

function extractGu(code) {
  const suffix = code?.slice(-7);
  return GU_CODES[suffix] || null;
}

function extractGuFromAddr(addr) {
  const m = addr?.match(/(\S+구)/);
  return m ? m[1] : "미분류";
}

function extractDong(addr) {
  // 도로명주소에서 동 추출: "서울특별시 종로구 XX동" or "서울특별시 종로구 XX로"
  const m = addr?.match(/구\s+(\S+[동면읍])/);
  if (m) return m[1];
  // 도로명에서 동 추출 시도
  const m2 = addr?.match(/\(([^,)]+동)/);
  return m2 ? m2[1] : null;
}

// ─── 업태 → 카테고리 매핑 ───
function classifyIndustry(uptae) {
  if (!uptae) return "기타";
  if (uptae.includes("커피") || uptae.includes("다방") || uptae.includes("찻집") || uptae.includes("떡카페")) return "카페·커피";
  if (uptae.includes("편의점")) return "편의점";
  if (uptae.includes("일반조리") || uptae.includes("한식") || uptae.includes("중식") || uptae.includes("일식") || uptae.includes("양식")) return "일반음식점";
  if (uptae.includes("패스트") || uptae.includes("햄버거")) return "패스트푸드";
  if (uptae.includes("아이스크림") || uptae.includes("과자") || uptae.includes("제과") || uptae.includes("빵") || uptae.includes("베이커리")) return "디저트·베이커리";
  if (uptae.includes("백화점") || uptae.includes("대형마트")) return "백화점·대형마트";
  if (uptae.includes("푸드트럭")) return "푸드트럭";
  if (uptae.includes("키즈")) return "키즈카페";
  if (uptae.includes("호프") || uptae.includes("통닭") || uptae.includes("주점")) return "주점";
  if (uptae.includes("철도") || uptae.includes("고속도로") || uptae.includes("극장") || uptae.includes("유원지") || uptae.includes("관광호텔")) return "교통·시설 내";
  if (uptae.includes("미용") || uptae.includes("이용") || uptae.includes("네일") || uptae.includes("피부")) return "미용·뷰티";
  if (uptae.includes("안경") || uptae.includes("렌즈")) return "안경·광학";
  if (uptae.includes("세탁") || uptae.includes("클리닝")) return "세탁";
  if (uptae.includes("한식")) return "한식";
  if (uptae.includes("중국") || uptae.includes("중식")) return "중식";
  if (uptae.includes("일식") || uptae.includes("일본")) return "일식";
  if (uptae.includes("양식") || uptae.includes("경양식") || uptae.includes("서양")) return "양식";
  if (uptae.includes("분식") || uptae.includes("떡볶이") || uptae.includes("김밥")) return "분식";
  if (uptae.includes("치킨") || uptae.includes("통닭") || uptae.includes("닭")) return "치킨";
  if (uptae.includes("피자")) return "피자";
  if (uptae.includes("고기") || uptae.includes("구이") || uptae.includes("삼겹") || uptae.includes("갈비") || uptae.includes("육")) return "고기·구이";
  if (uptae.includes("횟") || uptae.includes("해산물") || uptae.includes("수산") || uptae.includes("생선")) return "해산물";
  if (uptae.includes("국") || uptae.includes("탕") || uptae.includes("찌개") || uptae.includes("전골")) return "국·탕·찌개";
  if (uptae.includes("면") || uptae.includes("냉면") || uptae.includes("국수") || uptae.includes("칼국")) return "면류";
  if (uptae.includes("뷔페") || uptae.includes("부페")) return "뷔페";
  if (uptae.includes("족발") || uptae.includes("보쌈")) return "족발·보쌈";
  return "기타음식";
}

// ─── 1. 음식점 인허가 (일반 + 휴게) ───
async function fetchRestaurants() {
  console.log("▶ 일반음식점(072404) 수집 중... (532,915건)");
  const rows1 = await fetchAll("LOCALDATA_072404", 532915, "일반음식점");
  console.log("▶ 휴게음식점(072405) 수집 중... (144,895건)");
  const rows2 = await fetchAll("LOCALDATA_072405", 144895, "휴게음식점");
  console.log("▶ 이미용업(072201) 수집 중...");
  const rows3 = await fetchAll("LOCALDATA_072201", 2479, "이미용업");
  console.log("▶ 안경업(072302) 수집 중...");
  const rows4 = await fetchAll("LOCALDATA_072302", 4984, "안경업");
  console.log("▶ 세탁업(072101) 수집 중...");
  const rows5 = await fetchAll("LOCALDATA_072101", 5729, "세탁업");
  const rows = [...rows1, ...rows2, ...rows3, ...rows4, ...rows5];
  console.log(`  → 원시 합계: ${rows.length.toLocaleString()}건`);

  const places = [];
  const seen = new Set();

  for (const r of rows) {
    // 영업중만 ("영업/정상" or "영업")
    if (!r.TRDSTATENM?.includes("영업")) continue;

    const name = (r.BPLCNM || "").trim();
    if (!name) continue;

    const addr = (r.RDNWHLADDR || r.SITEWHLADDR || "").trim();
    const key = name + "|" + addr.slice(0, 30);
    if (seen.has(key)) continue;
    seen.add(key);

    const gu = extractGu(r.OPNSFTEAMCODE) || extractGuFromAddr(addr);
    if (!gu || gu === "미분류") continue;

    const dong = extractDong(addr);
    const phone = (r.SITETEL || "").trim();
    const homepage = (r.HOMEPAGE || "").trim();
    const industry = classifyIndustry(r.UPTAENM);

    const gaps = [];
    if (!phone) gaps.push("phone");
    if (!homepage) gaps.push("web");

    places.push({
      name,
      address: addr,
      district: gu,
      dong: dong || "",
      phone,
      web: homepage,
      industry,
      industryRaw: (r.UPTAENM || "").trim(),
      type: "restaurant",
      gaps,
      gapCount: gaps.length,
    });
  }

  console.log(`  → 영업중 음식점: ${places.length.toLocaleString()}건`);
  return places;
}

// ─── 2. 관광명소 ───
async function fetchAttractions() {
  console.log("▶ 관광명소 수집 중...");
  const rows = await fetchAll("TbVwAttractions", 2358, "관광명소");

  const CATEGORY_RULES = [
    { category: "오래가게", keywords: ["오래가게"] },
    { category: "박물관·전시", keywords: ["박물관", "전시", "미술관", "갤러리"] },
    { category: "역사·유적", keywords: ["역사", "유적지", "서울미래유산", "궁", "전통", "한옥"] },
    { category: "카페·맛집", keywords: ["카페", "맛집", "레스토랑"] },
    { category: "공연·문화", keywords: ["공연", "문화", "예술", "극장"] },
    { category: "자연·공원", keywords: ["공원", "산", "산책", "자연", "숲"] },
    { category: "쇼핑·거리", keywords: ["쇼핑", "시장", "거리", "골목"] },
    { category: "관광안내", keywords: ["관광안내소", "안내센터", "투어"] },
  ];

  function classify(tags) {
    const t = tags.toLowerCase();
    for (const r of CATEGORY_RULES) {
      if (r.keywords.some(k => t.includes(k))) return r.category;
    }
    return "기타";
  }

  const seen = new Set();
  const places = [];

  for (const r of rows) {
    if (r.LANG_CODE_ID !== "ko") continue;
    const name = (r.POST_SJ || "").trim();
    const addr = (r.NEW_ADDRESS || r.ADDRESS || "").trim();
    const key = addr.slice(0, 30) || name;
    if (seen.has(key)) continue;
    seen.add(key);

    const gu = extractGuFromAddr(addr);
    const dong = extractDong(addr);
    const phone = (r.CMMN_TELNO || "").trim();
    const hours = (r.CMMN_USE_TIME || "").trim();
    const web = (r.CMMN_HMPG_URL || "").trim();
    const tag = (r.TAG || "").trim();

    const gaps = [];
    if (!phone) gaps.push("phone");
    if (!hours) gaps.push("hours");
    if (!web) gaps.push("web");

    places.push({
      id: r.POST_SN,
      name,
      address: addr,
      district: gu,
      dong: dong || "",
      phone,
      hours,
      web,
      url: (r.POST_URL || "").trim(),
      subway: (r.SUBWAY_INFO || "").trim(),
      tag,
      category: classify(tag + "," + name),
      type: "attraction",
      gaps,
      gapCount: gaps.length,
    });
  }

  console.log(`  → 한국어 관광명소: ${places.length}건`);
  return places;
}

// ─── 3. 구별 점포 통계 ───
async function fetchStoreStats() {
  console.log("▶ 구별 점포 통계 수집 중...");
  const rows = await fetchAll("VwsmSignguStorW", 69704, "구별점포");

  // 최신 분기만
  const quarters = [...new Set(rows.map(r => r.STDR_YYQU_CD))].sort().reverse();
  const latestQ = quarters[0];
  const latest = rows.filter(r => r.STDR_YYQU_CD === latestQ);

  // 구별 합산
  const byGu = {};
  const byIndustry = {};
  let totalStores = 0;

  for (const r of latest) {
    const gu = r.SIGNGU_CD_NM;
    const ind = r.SVC_INDUTY_CD_NM;
    const count = parseInt(r.STOR_CO) || 0;
    totalStores += count;

    if (!byGu[gu]) byGu[gu] = { total: 0, industries: {} };
    byGu[gu].total += count;
    byGu[gu].industries[ind] = (byGu[gu].industries[ind] || 0) + count;

    byIndustry[ind] = (byIndustry[ind] || 0) + count;
  }

  console.log(`  → 최신분기(${latestQ}): ${Object.keys(byGu).length}개 구, 총 ${totalStores.toLocaleString()}개 점포`);
  return { quarter: latestQ, totalStores, byGu, byIndustry };
}

// ─── 4. 문화행사 ───
async function fetchCulture() {
  console.log("▶ 문화행사 수집 중...");
  const rows = await fetchAll("culturalEventInfo", 3907, "문화행사");
  return rows.map(r => ({
    title: r.TITLE,
    category: r.CODENAME,
    district: r.GUNAME,
    place: r.PLACE,
    date: r.DATE,
    fee: r.USE_FEE,
    lat: parseFloat(r.LAT) || null,
    lng: parseFloat(r.LOT) || null,
  }));
}

// ─── Main ───
async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  console.log("━━━ 서울시 소상공인 디지털 자산 데이터 수집 시작 ━━━\n");

  const restaurants = await fetchRestaurants();
  const attractions = await fetchAttractions();
  const storeStats = await fetchStoreStats();
  const culture = await fetchCulture();

  // ── 통합 통계 계산 ──
  const allPlaces = [...restaurants, ...attractions];

  // 자치구별
  const districtStats = {};
  for (const p of allPlaces) {
    if (!districtStats[p.district]) districtStats[p.district] = { total: 0, noPhone: 0, noWeb: 0, blind: 0, partial: 0, ok: 0, restaurants: 0, attractions: 0, dongs: {} };
    const ds = districtStats[p.district];
    ds.total++;
    if (p.type === "restaurant") ds.restaurants++;
    else ds.attractions++;
    if (!p.phone) ds.noPhone++;
    if (!p.web) ds.noWeb++;
    if (p.gapCount >= 2) ds.blind++;
    else if (p.gapCount === 1) ds.partial++;
    else ds.ok++;

    // 행정동별
    if (p.dong) {
      if (!ds.dongs[p.dong]) ds.dongs[p.dong] = { total: 0, noPhone: 0, noWeb: 0 };
      ds.dongs[p.dong].total++;
      if (!p.phone) ds.dongs[p.dong].noPhone++;
      if (!p.web) ds.dongs[p.dong].noWeb++;
    }
  }

  // 업종별 (음식점)
  const industryStats = {};
  for (const p of restaurants) {
    if (!industryStats[p.industry]) industryStats[p.industry] = { total: 0, noPhone: 0, noWeb: 0 };
    industryStats[p.industry].total++;
    if (!p.phone) industryStats[p.industry].noPhone++;
    if (!p.web) industryStats[p.industry].noWeb++;
  }

  // 카테고리별 (관광명소)
  const categoryStats = {};
  for (const p of attractions) {
    if (!categoryStats[p.category]) categoryStats[p.category] = { total: 0, blind: 0, partial: 0, ok: 0 };
    categoryStats[p.category].total++;
    if (p.gapCount >= 2) categoryStats[p.category].blind++;
    else if (p.gapCount === 1) categoryStats[p.category].partial++;
    else categoryStats[p.category].ok++;
  }

  const totalStats = {
    totalPlaces: allPlaces.length,
    totalRestaurants: restaurants.length,
    totalAttractions: attractions.length,
    noPhone: allPlaces.filter(p => !p.phone).length,
    noWeb: allPlaces.filter(p => !p.web).length,
    blind: allPlaces.filter(p => p.gapCount >= 2).length,
    partial: allPlaces.filter(p => p.gapCount === 1).length,
    ok: allPlaces.filter(p => p.gapCount === 0).length,
    storeStatsTotal: storeStats.totalStores,
    storeStatsQuarter: storeStats.quarter,
    cultureTotal: culture.length,
  };

  const output = {
    generatedAt: new Date().toISOString(),
    area: "서울특별시 전역",
    stats: totalStats,
    districtStats,
    industryStats,
    categoryStats,
    storeStats: {
      quarter: storeStats.quarter,
      totalStores: storeStats.totalStores,
      byGu: storeStats.byGu,
      topIndustries: Object.entries(storeStats.byIndustry)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([name, count]) => ({ name, count })),
    },
    restaurants: restaurants.slice(0, 500), // 개별 데이터 샘플 (파일 크기 제한)
    attractions,
    culture: culture.slice(0, 200),
  };

  // 전체 음식점은 별도 파일
  const restaurantFile = path.join(OUT_DIR, "restaurants.json");
  await fs.writeFile(restaurantFile, JSON.stringify({
    generatedAt: new Date().toISOString(),
    total: restaurants.length,
    data: restaurants,
  }, null, 2), "utf8");

  const outPath = path.join(OUT_DIR, "seoul-data.json");
  await fs.writeFile(outPath, JSON.stringify(output, null, 2), "utf8");

  console.log(`\n━━━ 수집 완료 ━━━`);
  console.log(`📁 ${outPath}`);
  console.log(`📁 ${restaurantFile}`);
  console.log(`   음식점(영업중): ${restaurants.length.toLocaleString()}건`);
  console.log(`   관광명소(한국어): ${attractions.length}건`);
  console.log(`   구별 점포 통계: ${storeStats.totalStores.toLocaleString()}개 (${storeStats.quarter}분기)`);
  console.log(`   문화행사: ${culture.length}건`);
  console.log(`   총 분석 장소: ${allPlaces.length.toLocaleString()}건`);
  console.log(`   자치구: ${Object.keys(districtStats).length}개`);
  console.log(`   업종: ${Object.keys(industryStats).length}개`);
}

main().catch(console.error);
