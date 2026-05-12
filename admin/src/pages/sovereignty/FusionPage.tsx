import { useState, useMemo } from "react";
import { PLACES, SEOUL_DATA } from "./data";

/* ━━━ Naming Engine Types ━━━ */
interface CategoryDef {
  key: string;
  label: string;
  icon: string;
  color: string;
  tiers: { min: number; word: string; en: string; desc: string }[];
}

interface SuffixRule {
  combo: [string, string];
  label: string;
  tiers: { min: number; name: string; kr: string }[];
}

type Grade = "normal" | "magic" | "rare" | "hero" | "legend";

interface GradeDef {
  key: Grade;
  label: string;
  icon: string;
  range: string;
  min: number;
  max: number;
  color: string;
  bg: string;
  border: string;
  desc: string;
  affixRule: string;
}

interface GeneratedName {
  prefixes: string[];
  baseName: string;
  suffixes: string[];
  grade: GradeDef;
  totalScore: number;
  topCategories: { key: string; score: number; prefix: string }[];
  scores: Record<string, number>;
}

/* ━━━ 8 Category Definitions with Tier Words ━━━ */
const CATEGORIES: CategoryDef[] = [
  {
    key: "transport", label: "교통편의성", icon: "🚇", color: "#2563EB",
    tiers: [
      { min: 60, word: "편리한", en: "Handy", desc: "어디든 그럭저럭" },
      { min: 70, word: "신속한", en: "Swift", desc: "빠른 도심 연결" },
      { min: 80, word: "쾌속의", en: "Express", desc: "도보 3분 이내" },
      { min: 90, word: "허브의", en: "Hub", desc: "사통팔달 교통 요지" },
      { min: 95, word: "넥서스의", en: "Nexus", desc: "서울 어디든 20분" },
    ],
  },
  {
    key: "food", label: "맛집 & 카페", icon: "🍜", color: "#DC2626",
    tiers: [
      { min: 60, word: "풍성한", en: "Savory", desc: "동네 맛집 있음" },
      { min: 70, word: "미식의", en: "Gourmet", desc: "다양한 로컬 식당" },
      { min: 80, word: "진미의", en: "Epicure", desc: "숨은 맛집 다수" },
      { min: 90, word: "성지의", en: "Mecca", desc: "SNS 핫플레이스급" },
      { min: 95, word: "전설적인", en: "Legendary", desc: "방문 자체가 목적" },
    ],
  },
  {
    key: "nature", label: "자연 & 힐링", icon: "🌿", color: "#16A34A",
    tiers: [
      { min: 60, word: "초록빛", en: "Verdant", desc: "가까운 공원 있음" },
      { min: 70, word: "산책자의", en: "Walker's", desc: "매일 산책 가능" },
      { min: 80, word: "숲의", en: "Forest", desc: "자연과 함께하는 일상" },
      { min: 90, word: "치유의", en: "Serene", desc: "도심 속 자연 안식처" },
      { min: 95, word: "낙원의", en: "Eden", desc: "도시 에덴가든" },
    ],
  },
  {
    key: "safety", label: "안전 & 조용함", icon: "🛡️", color: "#7C3AED",
    tiers: [
      { min: 60, word: "안온한", en: "Tranquil", desc: "평균적 안전 수준" },
      { min: 70, word: "평온한", en: "Peaceful", desc: "낮밤 모두 조용함" },
      { min: 80, word: "수호받는", en: "Guarded", desc: "CCTV·순찰 충분" },
      { min: 90, word: "성역의", en: "Sanctified", desc: "가장 안전한 동네" },
      { min: 95, word: "성소의", en: "Sanctuary", desc: "혼자도 완벽히 안전" },
    ],
  },
  {
    key: "convenience", label: "생활 편의", icon: "🏪", color: "#D97706",
    tiers: [
      { min: 60, word: "알찬", en: "Compact", desc: "기본 인프라 충족" },
      { min: 70, word: "풍족한", en: "Abundant", desc: "생활시설 풍부" },
      { min: 80, word: "완비된", en: "Equipped", desc: "모든 게 근처에" },
      { min: 90, word: "자급자족의", en: "Sovereign", desc: "동네 밖 불필요" },
      { min: 95, word: "완전한", en: "Supreme", desc: "완벽한 인프라" },
    ],
  },
  {
    key: "vibe", label: "로컬 바이브", icon: "🎨", color: "#E11D48",
    tiers: [
      { min: 60, word: "정겨운", en: "Cozy", desc: "따뜻한 동네 분위기" },
      { min: 70, word: "활기찬", en: "Vivid", desc: "개성 있는 골목문화" },
      { min: 80, word: "힙한", en: "Iconic", desc: "트렌드 선도 동네" },
      { min: 90, word: "전설의", en: "Legendary", desc: "꼭 와봐야 하는 동네" },
      { min: 95, word: "신화적인", en: "Mythic", desc: "시대를 대표하는 곳" },
    ],
  },
  {
    key: "host", label: "호스트 매력", icon: "🙋", color: "#0891B2",
    tiers: [
      { min: 60, word: "다정한", en: "Warm", desc: "친절한 인사" },
      { min: 70, word: "안내자의", en: "Guide's", desc: "동네 정보 잘 알려줌" },
      { min: 80, word: "큐레이터의", en: "Curator's", desc: "동네 전문 큐레이터" },
      { min: 90, word: "마에스트로의", en: "Maestro's", desc: "숙소계의 거장" },
      { min: 95, word: "전설 호스트의", en: "Legend Host", desc: "모두가 찾는 히어로" },
    ],
  },
  {
    key: "clean", label: "청결 & 관리", icon: "✨", color: "#0D9488",
    tiers: [
      { min: 60, word: "깨끗한", en: "Clean", desc: "기본 청결 유지" },
      { min: 70, word: "말끔한", en: "Pristine", desc: "세심하게 청소됨" },
      { min: 80, word: "빛나는", en: "Gleaming", desc: "새것처럼 유지" },
      { min: 90, word: "순결한", en: "Immaculate", desc: "호텔보다 깨끗" },
      { min: 95, word: "신성한", en: "Sacred", desc: "흠잡을 곳 없음" },
    ],
  },
];

/* ━━━ Suffix Rules ━━━ */
const SUFFIX_RULES: SuffixRule[] = [
  {
    combo: ["transport", "convenience"], label: "교통+편의",
    tiers: [
      { min: 75, name: "of Ease", kr: "편리함의" },
      { min: 85, name: "of Velocity", kr: "속도의" },
      { min: 95, name: "of the City", kr: "도시의" },
    ],
  },
  {
    combo: ["food", "vibe"], label: "맛집+문화",
    tiers: [
      { min: 75, name: "of the Locals", kr: "로컬들의" },
      { min: 85, name: "of the Village", kr: "마을의" },
      { min: 95, name: "of the Hood", kr: "후드의" },
    ],
  },
  {
    combo: ["nature", "safety"], label: "자연+안전",
    tiers: [
      { min: 75, name: "of Solace", kr: "위안의" },
      { min: 85, name: "of the Grove", kr: "숲속의" },
      { min: 95, name: "of Arcadia", kr: "아르카디아의" },
    ],
  },
  {
    combo: ["host", "clean"], label: "호스트+청결",
    tiers: [
      { min: 75, name: "of Care", kr: "정성의" },
      { min: 85, name: "of Grace", kr: "품격의" },
      { min: 95, name: "of the Master", kr: "장인의" },
    ],
  },
];

/* ━━━ Grade Definitions ━━━ */
const GRADES: GradeDef[] = [
  { key: "normal", label: "NORMAL", icon: "⬜", range: "0–59", min: 0, max: 59, color: "#6B7280", bg: "#F9FAFB", border: "#E5E7EB", desc: "접사 없음", affixRule: "기본 이름만" },
  { key: "magic", label: "MAGIC", icon: "🔵", range: "60–74", min: 60, max: 74, color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE", desc: "접두어 OR 접미어 1개", affixRule: "1 prefix OR 1 suffix" },
  { key: "rare", label: "RARE", icon: "🟢", range: "75–87", min: 75, max: 87, color: "#059669", bg: "#ECFDF5", border: "#A7F3D0", desc: "접두어 + 접미어", affixRule: "1 prefix + 1 suffix" },
  { key: "hero", label: "HERO", icon: "🔶", range: "88–94", min: 88, max: 94, color: "#EA580C", bg: "#FFF7ED", border: "#FED7AA", desc: "접두어 2개 + 접미어", affixRule: "2 prefix + 1 suffix" },
  { key: "legend", label: "LEGEND", icon: "💜", range: "95+", min: 95, max: 100, color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE", desc: "특수 칭호 + 접사 풀", affixRule: "2 prefix + 2 suffix" },
];

/* ━━━ Place Score Data (from fusion of 5 data sources) ━━━ */
const PLACE_SCORES: Record<string, Record<string, number>> = {
  "익선동 한옥거리": { transport: 91, food: 88, nature: 62, safety: 75, convenience: 82, vibe: 95, host: 72, clean: 70 },
  "을지로 노가리 골목": { transport: 89, food: 92, nature: 48, safety: 58, convenience: 78, vibe: 92, host: 65, clean: 55 },
  "정동길": { transport: 72, food: 68, nature: 88, safety: 90, convenience: 65, vibe: 85, host: 70, clean: 78 },
  "종묘돌담길": { transport: 82, food: 65, nature: 85, safety: 88, convenience: 60, vibe: 78, host: 55, clean: 72 },
  "만리동": { transport: 86, food: 74, nature: 60, safety: 68, convenience: 72, vibe: 82, host: 60, clean: 65 },
  "서촌한옥마을": { transport: 78, food: 82, nature: 72, safety: 85, convenience: 70, vibe: 88, host: 75, clean: 80 },
  "위안부 '기억의 터'": { transport: 80, food: 72, nature: 65, safety: 82, convenience: 68, vibe: 70, host: 50, clean: 60 },
  "북악스카이웨이 팔각정": { transport: 45, food: 35, nature: 96, safety: 92, convenience: 30, vibe: 75, host: 40, clean: 68 },
};

/* ━━━ Naming Engine ━━━ */
function getPrefix(cat: CategoryDef, score: number): string | null {
  if (score < 60) return null;
  let best: string | null = null;
  for (const t of cat.tiers) {
    if (score >= t.min) best = t.word;
  }
  return best;
}

function getSuffix(scores: Record<string, number>): { name: string; kr: string } | null {
  let bestSuffix: { name: string; kr: string } | null = null;
  let bestAvg = 0;
  for (const rule of SUFFIX_RULES) {
    const avg = (scores[rule.combo[0]] + scores[rule.combo[1]]) / 2;
    if (avg >= 75 && avg > bestAvg) {
      let matched: { name: string; kr: string } | null = null;
      for (const t of rule.tiers) {
        if (avg >= t.min) matched = { name: t.name, kr: t.kr };
      }
      if (matched) {
        bestSuffix = matched;
        bestAvg = avg;
      }
    }
  }
  return bestSuffix;
}

function getGrade(total: number): GradeDef {
  for (let i = GRADES.length - 1; i >= 0; i--) {
    if (total >= GRADES[i].min) return GRADES[i];
  }
  return GRADES[0];
}

function generateName(placeName: string, scores: Record<string, number>): GeneratedName {
  const vals = Object.values(scores);
  const total = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  const grade = getGrade(total);

  // Sort categories by score descending
  const sorted = CATEGORIES.map((c) => ({
    key: c.key,
    score: scores[c.key] || 0,
    prefix: getPrefix(c, scores[c.key] || 0),
    cat: c,
  })).sort((a, b) => b.score - a.score);

  // Determine prefixes based on grade
  const prefixes: string[] = [];
  const maxPrefixes = grade.key === "legend" || grade.key === "hero" ? 2 : grade.key === "rare" || grade.key === "magic" ? 1 : 0;
  for (const s of sorted) {
    if (prefixes.length >= maxPrefixes) break;
    if (s.prefix) prefixes.push(s.prefix);
  }

  // Determine suffixes
  const suffixes: string[] = [];
  if (grade.key !== "normal") {
    const suffix = getSuffix(scores);
    if (suffix && grade.key !== "magic") {
      suffixes.push(suffix.kr);
    } else if (suffix && grade.key === "magic" && prefixes.length === 0) {
      suffixes.push(suffix.kr);
    }
    // Legend gets second suffix
    if (grade.key === "legend") {
      // Check for balanced (all > 80)
      const allHigh = vals.every((v) => v >= 80);
      if (allHigh && total >= 85) {
        if (total >= 95) suffixes.push("전설의");
        else suffixes.push("조화의");
      }
    }
  }

  return {
    prefixes,
    baseName: placeName,
    suffixes,
    grade,
    totalScore: total,
    topCategories: sorted.slice(0, 3).map((s) => ({ key: s.key, score: s.score, prefix: s.prefix || "" })),
    scores,
  };
}

/* ━━━ Component ━━━ */
export default function FusionPage() {
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);

  const namedPlaces = useMemo(() => {
    return PLACES.filter((p) => PLACE_SCORES[p.name]).map((p) => ({
      place: p,
      naming: generateName(p.name, PLACE_SCORES[p.name]),
    }));
  }, []);

  const selected = selectedPlace
    ? namedPlaces.find((n) => n.place.name === selectedPlace) || null
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold tracking-[3px] rounded">NAMING ENGINE v1.0</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          평가 기반 <span className="text-slate-900">자동 네이밍</span> 시스템
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          5개 데이터 소스 결합 → 8개 카테고리 점수 산출 → 접두·접미어 자동 생성
        </p>
      </div>

      {/* Formula */}
      <div className="bg-slate-900 rounded-xl p-6 border border-slate-700">
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <div className="px-4 py-2.5 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-300 text-sm font-bold">
            접두어<span className="block text-[10px] font-normal opacity-60">최고 강점 카테고리</span>
          </div>
          <span className="text-slate-600 text-lg font-bold">+</span>
          <div className="px-4 py-2.5 rounded-lg bg-white/8 border border-white/15 text-white text-sm font-bold">
            기본 이름<span className="block text-[10px] font-normal opacity-60">장소명</span>
          </div>
          <span className="text-slate-600 text-lg font-bold">+</span>
          <div className="px-4 py-2.5 rounded-lg bg-slate-500/15 border border-slate-500/30 text-slate-300 text-sm font-bold">
            of 접미어<span className="block text-[10px] font-normal opacity-60">종합 강점 조합</span>
          </div>
        </div>
        <div className="mt-4 text-center bg-white/5 rounded-lg py-3 px-4 border-l-2 border-slate-600">
          <p className="text-[10px] text-slate-500 tracking-widest mb-1">EXAMPLE</p>
          <p className="text-lg font-bold">
            <span className="text-orange-400">신화적인 </span>
            <span className="text-white">익선동 한옥거리</span>
            <span className="text-slate-400"> of 후드의</span>
          </p>
        </div>
      </div>

      {/* Data Sources → Score Pipeline */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">데이터 소스 → 점수 변환 파이프라인</h2>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {SEOUL_DATA.map((src, i) => (
            <div key={src.api} className="flex items-center gap-2 shrink-0">
              <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-center min-w-[80px]">
                <p className="text-lg">{src.icon}</p>
                <p className="text-[11px] font-semibold text-gray-700">{src.label}</p>
                <p className="text-[10px] text-gray-400">{src.count}</p>
              </div>
              {i < SEOUL_DATA.length - 1 && <span className="text-gray-300 text-xs">+</span>}
            </div>
          ))}
          <span className="text-gray-400 mx-2">→</span>
          <div className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-center min-w-[100px]">
            <p className="text-lg">🏷️</p>
            <p className="text-[11px] font-bold text-slate-700">8개 카테고리</p>
            <p className="text-[10px] text-slate-500">점수 자동 산출</p>
          </div>
          <span className="text-gray-400 mx-1">→</span>
          <div className="px-3 py-2 bg-slate-800 rounded-lg border border-slate-700 text-center min-w-[100px]">
            <p className="text-lg">✨</p>
            <p className="text-[11px] font-bold text-white">자동 네이밍</p>
            <p className="text-[10px] text-slate-400">접두+접미+등급</p>
          </div>
        </div>
      </div>

      {/* Grade System */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">등급 시스템</h2>
        <div className="grid grid-cols-5 gap-2">
          {GRADES.map((g) => (
            <div key={g.key} className="text-center rounded-lg p-3" style={{ background: g.bg, border: `1px solid ${g.border}` }}>
              <p className="text-xl mb-1">{g.icon}</p>
              <p className="text-xs font-bold tracking-wider" style={{ color: g.color }}>{g.label}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{g.range}점</p>
              <p className="text-[10px] mt-1" style={{ color: g.color, opacity: 0.7 }}>{g.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Named Places Grid */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">자동 생성된 네이밍 결과</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {namedPlaces.map(({ place, naming }) => {
            const isSelected = selectedPlace === place.name;
            return (
              <div
                key={place.name}
                onClick={() => setSelectedPlace(isSelected ? null : place.name)}
                className="rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-lg"
                style={{
                  background: naming.grade.bg,
                  border: `1.5px solid ${isSelected ? naming.grade.color : naming.grade.border}`,
                  boxShadow: isSelected ? `0 0 20px ${naming.grade.border}` : undefined,
                }}
              >
                {/* Grade badge + generated name */}
                <div className="p-4 pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-bold tracking-widest"
                      style={{ background: naming.grade.border, color: naming.grade.color }}
                    >
                      {naming.grade.icon} {naming.grade.label}
                    </span>
                    <span className="text-xs font-mono" style={{ color: naming.grade.color }}>
                      종합 {naming.totalScore}점
                    </span>
                  </div>

                  {/* The generated name */}
                  <p className="text-base font-bold leading-snug">
                    {naming.prefixes.length > 0 && (
                      <span style={{ color: naming.grade.color }}>{naming.prefixes.join(" ")} </span>
                    )}
                    <span className="text-gray-900">{naming.baseName}</span>
                    {naming.suffixes.length > 0 && (
                      <span className="text-gray-500 font-medium"> of {naming.suffixes.join(" · ")}</span>
                    )}
                  </p>

                  <p className="text-[11px] text-gray-400 mt-1">
                    {place.district} · {place.category}
                  </p>
                </div>

                {/* Top scores */}
                <div className="px-4 pb-3 flex gap-1.5 flex-wrap">
                  {naming.topCategories.map((tc) => {
                    const cat = CATEGORIES.find((c) => c.key === tc.key)!;
                    return (
                      <span
                        key={tc.key}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                        style={{
                          background: `${cat.color}15`,
                          border: `1px solid ${cat.color}30`,
                          color: cat.color,
                        }}
                      >
                        {cat.icon} {cat.label.split(" ")[0]} {tc.score}
                      </span>
                    );
                  })}
                </div>

                {/* Score bars (expanded) */}
                {isSelected && (
                  <div className="px-4 pb-4 pt-1 border-t" style={{ borderColor: naming.grade.border }}>
                    <p className="text-[10px] text-gray-400 tracking-widest mb-2">CATEGORY SCORES</p>
                    <div className="space-y-1.5">
                      {CATEGORIES.map((cat) => {
                        const score = naming.scores[cat.key] || 0;
                        const prefix = getPrefix(cat, score);
                        return (
                          <div key={cat.key} className="flex items-center gap-2">
                            <span className="text-xs w-4 text-center">{cat.icon}</span>
                            <span className="text-[11px] text-gray-500 w-14 shrink-0">{cat.label.split(" ")[0]}</span>
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${score}%`,
                                  background: score >= 90 ? cat.color : score >= 75 ? `${cat.color}99` : score >= 60 ? `${cat.color}55` : "#ddd",
                                }}
                              />
                            </div>
                            <span className="text-[11px] font-mono w-7 text-right" style={{ color: score >= 80 ? cat.color : "#999" }}>
                              {score}
                            </span>
                            {prefix && (
                              <span className="text-[10px] font-medium shrink-0 w-16 text-right" style={{ color: cat.color }}>{prefix}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Suffix explanation */}
                    {naming.suffixes.length > 0 && (
                      <div className="mt-3 p-2 rounded-lg bg-slate-50 border border-slate-200">
                        <p className="text-[10px] text-slate-600">
                          <span className="font-bold">접미어 근거:</span>{" "}
                          {SUFFIX_RULES.map((r) => {
                            const avg = (naming.scores[r.combo[0]] + naming.scores[r.combo[1]]) / 2;
                            if (avg >= 75) return `${r.label} 평균 ${Math.round(avg)}점`;
                            return null;
                          }).filter(Boolean).join(" / ")}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Category Prefix Table */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">접두어 사전 — 8개 카테고리 × 5개 티어</h2>
        <p className="text-xs text-gray-400 mb-4">점수 구간에 따라 접두어 강도가 달라집니다</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {CATEGORIES.map((cat) => (
            <div key={cat.key} className="rounded-lg border border-gray-100 overflow-hidden">
              <div className="flex items-center gap-2 p-2.5 bg-gray-50 border-b border-gray-100">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{ background: `${cat.color}15` }}>
                  {cat.icon}
                </span>
                <div>
                  <p className="text-xs font-semibold text-gray-800">{cat.label}</p>
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {cat.tiers.map((t, i) => (
                  <div key={i} className="flex items-center justify-between px-2.5 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 w-10">{t.min}점+</span>
                      <span className="text-xs font-bold" style={{ color: i >= 3 ? cat.color : i >= 2 ? `${cat.color}cc` : "#78909C" }}>
                        {t.word}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono">{t.en}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Suffix Rules */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">접미어 규칙 — 카테고리 조합별</h2>
        <p className="text-xs text-gray-400 mb-4">"of ___" 형태로 두 카테고리의 평균 점수에 따라 결정</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SUFFIX_RULES.map((rule) => {
            const cat1 = CATEGORIES.find((c) => c.key === rule.combo[0])!;
            const cat2 = CATEGORIES.find((c) => c.key === rule.combo[1])!;
            return (
              <div key={rule.label} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <p className="text-[11px] font-bold text-slate-600 tracking-wider mb-2">
                  {cat1.icon} {cat1.label.split(" ")[0]} + {cat2.icon} {cat2.label.split(" ")[0]}
                </p>
                <div className="space-y-1">
                  {rule.tiers.map((t) => (
                    <div key={t.name} className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">{t.name}</span>
                      <span className="text-[10px] text-gray-400">{t.min}점+ · {t.kr}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail Panel */}
      {selected && (
        <div
          className="rounded-xl p-6 border-2"
          style={{
            background: selected.naming.grade.bg,
            borderColor: selected.naming.grade.color,
            boxShadow: `0 0 40px ${selected.naming.grade.border}`,
          }}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <span
                className="inline-block px-3 py-1 rounded-lg text-xs font-bold tracking-widest mb-2"
                style={{ background: selected.naming.grade.border, color: selected.naming.grade.color }}
              >
                {selected.naming.grade.icon} {selected.naming.grade.label} GRADE
              </span>
              <h2 className="text-xl font-bold">
                {selected.naming.prefixes.length > 0 && (
                  <span style={{ color: selected.naming.grade.color }}>{selected.naming.prefixes.join(" ")} </span>
                )}
                <span className="text-gray-900">{selected.naming.baseName}</span>
                {selected.naming.suffixes.length > 0 && (
                  <span className="text-gray-500"> of {selected.naming.suffixes.join(" · ")}</span>
                )}
              </h2>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold" style={{ color: selected.naming.grade.color }}>
                {selected.naming.totalScore}
              </p>
              <p className="text-[10px] text-gray-400">종합 점수</p>
            </div>
          </div>

          <div className="bg-white/60 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-2 tracking-widest font-semibold">네이밍 해석</p>
            <p className="text-sm text-gray-700 leading-relaxed">
              {selected.naming.prefixes.length > 0 && (
                <>
                  접두어 <span className="font-bold" style={{ color: selected.naming.grade.color }}>"{selected.naming.prefixes.join(", ")}"</span>는{" "}
                  {selected.naming.topCategories
                    .filter((tc) => tc.prefix && selected.naming.prefixes.includes(tc.prefix))
                    .map((tc) => {
                      const cat = CATEGORIES.find((c) => c.key === tc.key)!;
                      return `${cat.icon} ${cat.label} ${tc.score}점`;
                    })
                    .join(", ")}
                  에서 산출.{" "}
                </>
              )}
              {selected.naming.suffixes.length > 0 && (
                <>
                  접미어 <span className="font-bold text-gray-900">"of {selected.naming.suffixes.join(" · ")}"</span>는{" "}
                  {SUFFIX_RULES.map((r) => {
                    const avg = (selected.naming.scores[r.combo[0]] + selected.naming.scores[r.combo[1]]) / 2;
                    if (avg >= 75) return `${r.label} 평균 ${Math.round(avg)}점`;
                    return null;
                  }).filter(Boolean).join(" + ")}
                  에서 도출.{" "}
                </>
              )}
              종합 {selected.naming.totalScore}점으로{" "}
              <span className="font-bold" style={{ color: selected.naming.grade.color }}>
                {selected.naming.grade.label}
              </span>{" "}
              등급.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
