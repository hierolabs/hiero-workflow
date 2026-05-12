import { useState, useEffect, useRef } from "react";

declare global {
  interface Window { L: any; }
}

interface Place {
  name: string; category: string; address: string;
  lat: number; lng: number; phone: string; hours: string; web: string;
  established: string; description: string;
  gaps: string[]; gapLabels: string[]; tags: string[];
  digitalStatus: string;
}

interface FrozenPlace {
  name: string; address: string; district: string;
  phone: string; hours: string; web: string;
  subway: string; tag: string; gaps: string[]; gapCount: number;
}

interface TestData {
  center: { name: string; lat: number; lng: number };
  places: Place[];
  seoulData: any;
}

interface StreetData {
  name: string; road: string; district: string; vibe: string;
  lat: number; lng: number; places?: any[];
}

function LeafletMap({ center, places, active, onSelect, streets, activeStreet, onStreetSelect, viewMode }: {
  center: { lat: number; lng: number };
  places: Place[];
  active: number;
  onSelect: (i: number) => void;
  streets?: StreetData[];
  activeStreet?: number;
  onStreetSelect?: (i: number) => void;
  viewMode: "cityhall" | "streets";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const streetMarkers = useRef<any[]>([]);

  useEffect(() => {
    if (!ref.current || !window.L) return;
    const L = window.L;
    const zoom = viewMode === "streets" ? 12 : 15;
    const mapCenter = viewMode === "streets" ? [37.5650, 126.9800] : [center.lat, center.lng];
    const m = L.map(ref.current, { zoomControl: false }).setView(mapCenter as [number, number], zoom);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; OpenStreetMap',
    }).addTo(m);
    L.control.zoom({ position: "bottomright" }).addTo(m);

    if (viewMode === "cityhall") {
      // Center marker
      L.circleMarker([center.lat, center.lng], {
        radius: 10, color: "#6366f1", fillColor: "#6366f1", fillOpacity: 0.3, weight: 2,
      }).addTo(m).bindTooltip("서울시청", { permanent: true, direction: "top", className: "font-bold" });

      // 500m radius
      L.circle([center.lat, center.lng], {
        radius: 500, color: "#6366f1", fillColor: "#6366f1", fillOpacity: 0.04, weight: 1, dashArray: "5,5",
      }).addTo(m);

      // Place markers
      places.forEach((p, i) => {
        const color = p.gaps.length >= 2 ? "#ef4444" : p.gaps.length === 1 ? "#f59e0b" : "#10b981";
        const mk = L.circleMarker([p.lat, p.lng], {
          radius: i === active ? 12 : 8,
          color, fillColor: color,
          fillOpacity: i === active ? 0.8 : 0.5,
          weight: i === active ? 3 : 2,
        }).addTo(m);
        mk.bindTooltip(p.name, { direction: "top" });
        mk.on("click", () => onSelect(i));
        markers.current.push(mk);
      });
    }

    // 핫스팟 마커 (거리 모드에서만)
    if (viewMode === "streets" && (window as any).__hotspots) {
      const hotspots = (window as any).__hotspots as any[];
      hotspots.forEach(h => {
        if (!h.lat || !h.lng) return;
        const congColor: Record<string, string> = {
          "붐빔": "#ef4444", "약간 붐빔": "#f59e0b", "보통": "#3b82f6", "여유": "#10b981",
        };
        const clr = congColor[h.congestion] || "#94a3b8";
        const popK = Math.round(h.popMax / 1000);
        const size = Math.max(16, Math.min(40, popK * 0.4));

        L.circleMarker([h.lat, h.lng], {
          radius: size / 3,
          color: clr,
          fillColor: clr,
          fillOpacity: 0.25,
          weight: 1.5,
        }).addTo(m).bindTooltip(
          `<strong>${h.name}</strong><br>${h.congestion} · ${h.popMin?.toLocaleString()}~${h.popMax?.toLocaleString()}명<br>비거주 ${h.nonResident}%`,
          { direction: "top" }
        );
      });
    }

    // 문화공간 마커
    if (viewMode === "streets" && (window as any).__culture) {
      ((window as any).__culture as any[]).forEach(c => {
        const typeColor: Record<string, string> = {
          "미술관/갤러리": "#8b5cf6", "공연장": "#ec4899", "박물관/기념관": "#f59e0b",
          "도서관": "#06b6d4", "문화원": "#6366f1", "문화예술회관": "#14b8a6",
        };
        const clr = typeColor[c.type] || "#94a3b8";
        L.circleMarker([c.lat, c.lng], {
          radius: 5, color: clr, fillColor: clr, fillOpacity: 0.6, weight: 1,
        }).addTo(m).bindTooltip(`🏛 ${c.name}<br><span style="font-size:10px;color:#888">${c.type}</span>`, { direction: "top" });
      });
    }

    // 전통시장 마커 (주소에서 구 매칭으로 대략적 위치)
    // 좌표 없으므로 표시 불가 — 우측 패널에서만 활용

    // 따릉이 마커
    if (viewMode === "streets" && (window as any).__bikes) {
      ((window as any).__bikes as any[]).forEach(b => {
        L.circleMarker([b.lat, b.lng], {
          radius: 3, color: "#22c55e", fillColor: "#22c55e", fillOpacity: 0.5, weight: 0.5,
        }).addTo(m).bindTooltip(`🚲 ${b.name}<br>${b.available}/${b.totalRack}대`, { direction: "top" });
      });
    }

    // 반려동물 시설 마커
    if (viewMode === "streets" && (window as any).__pets) {
      ((window as any).__pets as any[]).forEach(p => {
        L.circleMarker([p.lat, p.lng], {
          radius: 4, color: "#f472b6", fillColor: "#f472b6", fillOpacity: 0.6, weight: 1,
        }).addTo(m).bindTooltip(`🐾 ${p.name}<br>${p.type}`, { direction: "top" });
      });
    }

    if (viewMode === "streets" && streets) {
      const palette = [
        { line: "#6366f1", bg: "#6366f1", label: "#4f46e5" },  // 인디고
        { line: "#ec4899", bg: "#ec4899", label: "#db2777" },  // 핑크
        { line: "#f97316", bg: "#f97316", label: "#ea580c" },  // 오렌지
        { line: "#14b8a6", bg: "#14b8a6", label: "#0d9488" },  // 틸
        { line: "#8b5cf6", bg: "#8b5cf6", label: "#7c3aed" },  // 바이올렛
        { line: "#ef4444", bg: "#ef4444", label: "#dc2626" },  // 레드
        { line: "#06b6d4", bg: "#06b6d4", label: "#0891b2" },  // 시안
        { line: "#84cc16", bg: "#84cc16", label: "#65a30d" },  // 라임
        { line: "#f59e0b", bg: "#f59e0b", label: "#d97706" },  // 앰버
        { line: "#e879f9", bg: "#e879f9", label: "#c026d3" },  // 푸시아
      ];

      streets.forEach((s, i) => {
        const isActive = i === activeStreet;
        const c = palette[i % palette.length];

        // 도로 라인
        if ((s as any).roadLine) {
          if (isActive && (window as any).L?.polyline?.antPath) {
            // 활성 거리 — 애니메이션 라인
            (window as any).L.polyline.antPath((s as any).roadLine, {
              color: c.line,
              weight: 8,
              opacity: 0.9,
              pulseColor: "#fff",
              delay: 800,
              dashArray: [15, 30],
              paused: false,
              hardwareAccelerated: true,
            }).addTo(m);
            // 글로우
            L.polyline((s as any).roadLine, {
              color: c.line, weight: 18, opacity: 0.12,
              lineCap: "round", lineJoin: "round",
            }).addTo(m);
          } else if (isActive) {
            // antPath 없으면 일반 두꺼운 라인
            L.polyline((s as any).roadLine, {
              color: c.line, weight: 8, opacity: 0.9,
              lineCap: "round", lineJoin: "round",
            }).addTo(m);
            L.polyline((s as any).roadLine, {
              color: c.line, weight: 18, opacity: 0.12,
              lineCap: "round", lineJoin: "round",
            }).addTo(m);
          } else {
            // 비활성 — 점선
            L.polyline((s as any).roadLine, {
              color: c.line, weight: 3, opacity: 0.35,
              lineCap: "round", lineJoin: "round",
              dashArray: "6,8",
            }).addTo(m);
          }
        }

        // 200m radius
        L.circle([s.lat, s.lng], {
          radius: 200,
          color: c.bg,
          fillColor: c.bg,
          fillOpacity: isActive ? 0.1 : 0.03,
          weight: isActive ? 2 : 1,
          dashArray: isActive ? "" : "4,4",
        }).addTo(m);

        // 라벨 마커
        const vibeShort = s.vibe.split("+").slice(0, 2).join(" · ");
        const icon = L.divIcon({
          className: "",
          html: `<div style="
            background:${isActive ? c.bg : "#fff"};
            color:${isActive ? "#fff" : c.label};
            border:2.5px solid ${isActive ? c.line : c.bg + "60"};
            border-radius:16px;
            padding:7px 14px;
            font-size:13px;
            font-weight:700;
            white-space:nowrap;
            box-shadow:0 3px 14px ${c.bg}${isActive ? "50" : "20"};
            cursor:pointer;
            backdrop-filter:blur(8px);
          ">
            <div style="display:flex;align-items:center;gap:6px">
              <span style="width:8px;height:8px;border-radius:50%;background:${isActive ? "#fff" : c.bg};display:inline-block"></span>
              ${s.name}
            </div>
            <div style="font-size:10px;font-weight:500;opacity:0.7;margin-top:3px;margin-left:14px">${s.road} · ${vibeShort}</div>
          </div>`,
          iconAnchor: [70, 22],
        });
        const mk = L.marker([s.lat, s.lng], { icon }).addTo(m);
        mk.on("click", () => onStreetSelect?.(i));
        streetMarkers.current.push(mk);

        // 소상공인 상가 마커
        if (isActive && (s as any).sbizShops) {
          (s as any).sbizShops.forEach((shop: any) => {
            if (!shop.lat || !shop.lng) return;
            const isFood = shop.category?.includes("음식");
            const isRetail = shop.category?.includes("소매");
            const shopColor = isFood ? "#ef4444" : isRetail ? "#f59e0b" : "#94a3b8";
            L.circleMarker([shop.lat, shop.lng], {
              radius: 4,
              color: shopColor,
              fillColor: shopColor,
              fillOpacity: 0.6,
              weight: 1,
            }).addTo(m).bindTooltip(`${shop.name}<br><span style="font-size:10px;color:#888">${shop.category?.split("/").slice(1).join("/")}</span>`, { direction: "top" });
          });
        }

        // 구글 Places 장소 마커 (있을 경우)
        if (s.places) {
          s.places.forEach((pl: any) => {
            if (!pl.lat || !pl.lng) return;
            L.circleMarker([pl.lat, pl.lng], {
              radius: isActive ? 8 : 5,
              color: "#fff",
              fillColor: c.bg,
              fillOpacity: isActive ? 0.9 : 0.5,
              weight: 2,
            }).addTo(m).bindTooltip(`${pl.name} ★${pl.rating}`, { direction: "top" });
          });
        }
      });
    }

    map.current = m;
    return () => { m.remove(); markers.current = []; streetMarkers.current = []; };
  }, [viewMode, activeStreet, JSON.stringify(streets?.map(s => s.name))]);

  useEffect(() => {
    if (!map.current || !window.L) return;
    if (viewMode === "cityhall") {
      markers.current.forEach((mk, i) => {
        const p = places[i];
        const color = p.gaps.length >= 2 ? "#ef4444" : p.gaps.length === 1 ? "#f59e0b" : "#10b981";
        mk.setRadius(i === active ? 14 : 8);
        mk.setStyle({ fillOpacity: i === active ? 0.9 : 0.5, weight: i === active ? 3 : 2 });
      });
      map.current.panTo([places[active].lat, places[active].lng]);
    }
    if (viewMode === "streets" && streets && activeStreet !== undefined) {
      const s = streets[activeStreet];
      if (s) map.current.setView([s.lat, s.lng], 15);
    }
  }, [active, activeStreet]);

  return <div ref={ref} className="w-full h-full" />;
}

function ReviewAnalysis({ place }: { place: any }) {
  const ra = place.reviewAnalysis;
  const g = place.google;
  if (!ra || !g) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <h3 className="text-lg font-bold">📊 리뷰 전략 분석</h3>

      {/* 감성 비율 바 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-600">감성 비율</span>
          <span className="text-sm font-bold">긍정 {ra.sentimentRatio}%</span>
        </div>
        <div className="h-5 bg-gray-100 rounded-full overflow-hidden flex">
          <div className="bg-emerald-500 h-full flex items-center justify-center"
            style={{ width: `${ra.sentimentRatio}%` }}>
            {ra.sentimentRatio >= 30 && <span className="text-[10px] text-white font-bold">긍정</span>}
          </div>
          <div className="bg-red-400 h-full flex items-center justify-center"
            style={{ width: `${100 - ra.sentimentRatio}%` }}>
            {100 - ra.sentimentRatio >= 20 && <span className="text-[10px] text-white font-bold">부정</span>}
          </div>
        </div>
      </div>

      {/* 긍정/부정 키워드 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-50 rounded-lg p-3">
          <div className="text-xs font-bold text-emerald-700 mb-2">긍정 키워드</div>
          <div className="flex flex-wrap gap-1">
            {ra.positiveKeywords.map((kw: string) => (
              <span key={kw} className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs rounded-full">{kw}</span>
            ))}
          </div>
        </div>
        <div className="bg-red-50 rounded-lg p-3">
          <div className="text-xs font-bold text-red-700 mb-2">부정 키워드</div>
          <div className="flex flex-wrap gap-1">
            {ra.negativeKeywords.length > 0
              ? ra.negativeKeywords.map((kw: string) => (
                  <span key={kw} className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">{kw}</span>
                ))
              : <span className="text-xs text-gray-400">없음</span>
            }
          </div>
        </div>
      </div>

      {/* 반복 키워드 */}
      <div>
        <div className="text-sm font-bold text-gray-700 mb-2">반복 키워드 — 시민이 발견한 가치</div>
        <div className="flex flex-wrap gap-2">
          {ra.topKeywords.map((kw: any, i: number) => (
            <span key={kw.word} className={`px-3 py-1 rounded-full text-sm font-medium ${
              i < 3 ? "bg-blue-100 text-blue-800" : i < 6 ? "bg-purple-50 text-purple-700" : "bg-gray-100 text-gray-600"
            }`}>
              {kw.word} <span className="opacity-50">×{kw.count}</span>
            </span>
          ))}
        </div>
      </div>

      {/* AI 요약 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
        <div className="text-xs font-bold text-blue-600 mb-1">AI 가치 요약</div>
        <p className="text-sm text-gray-700 leading-relaxed">{ra.reviewSummary}</p>
      </div>

      {/* 전략 제안 */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="text-xs font-bold text-amber-700 mb-2">전략 제안</div>
        <div className="space-y-1.5 text-sm text-gray-700">
          {ra.sentimentRatio >= 80 ? (
            <>
              <p>• 높은 긍정률({ra.sentimentRatio}%)을 브랜드 자산으로 활용</p>
              <p>• 핵심 키워드 "{ra.positiveKeywords.slice(0,2).join(", ")}"를 홈페이지·SNS 대표 문구로 전환</p>
            </>
          ) : ra.sentimentRatio >= 50 ? (
            <>
              <p>• 부정 키워드 "{ra.negativeKeywords.join(", ")}" 원인 분석 및 개선 필요</p>
              <p>• 강점 "{ra.positiveKeywords.slice(0,2).join(", ")}"를 강화하는 방향으로 운영 조정</p>
            </>
          ) : (
            <>
              <p>• 부정 키워드 우선 개선: {ra.negativeKeywords.join(", ")}</p>
              <p>• 긍정 리뷰 유도를 위한 서비스 개선 필요</p>
            </>
          )}
          {place.gaps.length > 0 && (
            <p>• 리뷰 {g.reviewCount?.toLocaleString()}건의 신뢰 자산이 있지만 {place.gapLabels.join(", ")}으로 디지털 전환 미완</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SovereigntyDemo() {
  const [data, setData] = useState<TestData | null>(null);
  const [frozen100, setFrozen100] = useState<{ total: number; districtBreakdown: Record<string,number>; places: FrozenPlace[] } | null>(null);
  const [streetsData, setStreetsData] = useState<{ streets: StreetData[] } | null>(null);
  const [hotspotsData, setHotspotsData] = useState<{ hotspots: any[] } | null>(null);
  const [layersData, setLayersData] = useState<any>(null);
  const [showHotspots, setShowHotspots] = useState(true);
  const [showBikes, setShowBikes] = useState(false);
  const [showPets, setShowPets] = useState(false);
  const [showCulture, setShowCulture] = useState(false);
  const [showMarkets, setShowMarkets] = useState(false);
  const [active, setActive] = useState(0);
  const [activeStreet, setActiveStreet] = useState(0);
  const [viewMode, setViewMode] = useState<"streets" | "cityhall">("streets");
  const [loading, setLoading] = useState(true);
  const [showFrozenList, setShowFrozenList] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/data/cityhall-test.json").then(r => r.json()),
      fetch("/data/frozen-100.json").then(r => r.json()),
      fetch("/data/streets.json").then(r => r.json()).catch(() => null),
      fetch("/data/hotspots.json").then(r => r.json()).catch(() => null),
      fetch("/data/layers.json").then(r => r.json()).catch(() => null),
    ]).then(([d, f, s, h, l]) => {
      setData(d);
      setFrozen100(f);
      if (s) setStreetsData(s);
      if (h) setHotspotsData(h);
      if (l) setLayersData(l);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="fixed inset-0 z-[9999] bg-white flex items-center justify-center text-gray-400 text-lg">서울시 데이터 로딩 중...</div>;
  if (!data) return <div className="fixed inset-0 z-[9999] bg-white flex items-center justify-center text-red-500">데이터 로드 실패</div>;

  // 데이터를 window에 전달 (지도 컴포넌트에서 접근)
  (window as any).__hotspots = (hotspotsData && showHotspots) ? hotspotsData.hotspots : null;
  (window as any).__bikes = (layersData && showBikes) ? layersData.bikes?.data : null;
  (window as any).__pets = (layersData && showPets) ? layersData.pets?.data : null;
  (window as any).__culture = (layersData && showCulture) ? layersData.cultureSpaces?.data : null;
  (window as any).__markets = (layersData && showMarkets) ? layersData.markets?.data : null;

  const p = data.places[active];
  const commerce = data.seoulData.commerce;
  const culture = data.seoulData.culture;
  const population = data.seoulData.population;

  return (
    <div className="fixed inset-0 z-[9999] bg-gray-50 text-gray-900 overflow-y-auto">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 h-14 flex items-center justify-between px-6 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-base font-bold">MORO</span>
          <span className="text-xs text-gray-400 ml-3">서울 바이브 거리 10선</span>
        </div>
        <button onClick={() => window.history.back()} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-gray-50">
          닫기
        </button>
      </nav>

      <div className="pt-14 flex h-screen">
        {/* 좌측: 지도 */}
        <div className="w-1/2 relative">
          <div className="absolute inset-0">
            <LeafletMap
              key={`${viewMode}-${activeStreet}-${showHotspots}-${showBikes}-${showPets}-${showCulture}`}
              center={data.center} places={data.places} active={active} onSelect={setActive}
              streets={streetsData?.streets} activeStreet={activeStreet} onStreetSelect={setActiveStreet}
              viewMode={viewMode}
            />
          </div>
          {/* 지도 위 범례 */}
          <div className="absolute bottom-4 left-4 bg-white border border-gray-200 rounded-xl p-4 shadow-xl text-sm z-[1000]" style={{ minWidth: 200 }}>
            <div className="font-bold text-gray-900 text-base mb-3">🗺 서울 바이브 거리</div>
            <div className="space-y-2 mb-3">
              <div className="font-medium text-gray-600 text-xs">실시간 혼잡도</div>
              <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-red-500 border border-red-600" /> 붐빔</div>
              <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-amber-400 border border-amber-500" /> 약간 붐빔</div>
              <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-blue-400 border border-blue-500" /> 보통</div>
              <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-emerald-400 border border-emerald-500" /> 여유</div>
            </div>
            <div className="border-t border-gray-100 pt-2 space-y-2">
              <div className="font-medium text-gray-600 text-xs">데이터 레이어</div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showHotspots} onChange={e => setShowHotspots(e.target.checked)} className="rounded w-4 h-4 text-blue-600" />
                <span className="text-gray-700">📍 핫스팟 {hotspotsData?.hotspots.length || 0}곳</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showBikes} onChange={e => setShowBikes(e.target.checked)} className="rounded w-4 h-4 text-green-600" />
                <span className="text-gray-700">🚲 따릉이 {layersData?.bikes?.total || 0}곳</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showPets} onChange={e => setShowPets(e.target.checked)} className="rounded w-4 h-4 text-pink-600" />
                <span className="text-gray-700">🐾 반려동물 {layersData?.pets?.total || 0}곳</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showCulture} onChange={e => setShowCulture(e.target.checked)} className="rounded w-4 h-4 text-purple-600" />
                <span className="text-gray-700">🏛 문화공간 {layersData?.cultureSpaces?.total || 0}곳</span>
              </label>
              <div className="flex items-center gap-2 text-gray-500">
                <span className="w-4 h-0.5 bg-blue-500 rounded" style={{ display: "inline-block" }} />
                🛤 거리 {streetsData?.streets.length || 0}곳
              </div>
              <div className="flex items-center gap-2 text-gray-500">
                <span className="w-2 h-2 rounded-full bg-red-400" style={{ display: "inline-block" }} />
                🏪 상가 (선택 거리)
              </div>
            </div>
          </div>

          {/* 100건 발견 토글 */}
          {frozen100 && (
            <div className="absolute top-4 left-4 z-10">
              <button onClick={() => setShowFrozenList(!showFrozenList)}
                className="bg-white shadow-lg rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 transition border border-gray-200">
                📍 서울 전역 디지털 동결 {frozen100.total}건 {showFrozenList ? "닫기" : "보기"}
              </button>

              {showFrozenList && (
                <div className="mt-2 bg-white shadow-2xl rounded-xl border border-gray-200 w-80 max-h-[60vh] overflow-y-auto">
                  {/* 구별 분포 */}
                  <div className="p-3 border-b border-gray-100">
                    <div className="text-xs font-bold text-gray-500 mb-2">구별 분포</div>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(frozen100.districtBreakdown)
                        .sort((a, b) => (b[1] as number) - (a[1] as number))
                        .map(([gu, cnt]) => (
                          <span key={gu} className="px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded-full">
                            {gu} {cnt as number}
                          </span>
                        ))}
                    </div>
                  </div>
                  {/* 리스트 */}
                  {frozen100.places.map((fp, i) => (
                    <div key={i} className="px-3 py-2.5 border-b border-gray-50 hover:bg-red-50/30">
                      <div className="flex items-center gap-2">
                        <span className={`text-base ${fp.gapCount === 3 ? "" : ""}`}>
                          {fp.gapCount === 3 ? "🔴" : "🟡"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{fp.name}</div>
                          <div className="text-xs text-gray-400 truncate">{fp.district} · {fp.subway || fp.address.slice(0,25)}</div>
                        </div>
                        <span className="text-xs text-red-500 shrink-0">{fp.gapCount}공백</span>
                      </div>
                      <div className="flex gap-1 mt-1 ml-7">
                        {fp.gaps.map(g => (
                          <span key={g} className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded">
                            {g === "phone" ? "📞없음" : g === "hours" ? "🕐없음" : "🌐없음"}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 우측: 분석 */}
        <div className="w-1/2 overflow-y-auto bg-white border-l border-gray-200">
          {/* Selector */}
          <div className="sticky top-0 bg-white border-b border-gray-100 p-4 z-10">
            {viewMode === "cityhall" ? (
              <div className="flex gap-2 overflow-x-auto">
                {data.places.map((pl, i) => (
                  <button key={i} onClick={() => setActive(i)}
                    className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${
                      i === active ? "bg-blue-600 text-white font-semibold shadow" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}>
                    {pl.name}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex gap-2 overflow-x-auto">
                {streetsData?.streets.map((st, i) => (
                  <button key={i} onClick={() => setActiveStreet(i)}
                    className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${
                      i === activeStreet ? "bg-blue-600 text-white font-semibold shadow" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}>
                    📍 {st.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-6 space-y-6">
            {/* ━━━ 거리 모드 ━━━ */}
            {viewMode === "streets" && streetsData?.streets[activeStreet] && (() => {
              const st = streetsData.streets[activeStreet];
              return (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-2xl font-bold">🛤 {st.name}</h2>
                    <p className="text-sm text-gray-500 mt-1">📍 {st.road} · {st.district}</p>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {st.vibe.split("+").map(v => (
                        <span key={v} className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-sm font-medium">{v}</span>
                      ))}
                    </div>
                  </div>

                  {/* 거리 스토리 */}
                  {(st as any).story && (
                    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
                      <p className="text-base text-gray-700 leading-relaxed">{(st as any).story}</p>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-blue-50 rounded-lg p-3">
                          <div className="text-xs font-bold text-blue-600 mb-1">🚶 도보</div>
                          <div className="text-lg font-bold text-gray-900">{(st as any).walkMinutes}분</div>
                          <div className="text-xs text-gray-500">전체 거리 산책</div>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-3">
                          <div className="text-xs font-bold text-amber-600 mb-1">⏰ 최적 방문</div>
                          <div className="text-sm font-bold text-gray-900">{(st as any).bestTime}</div>
                        </div>
                      </div>

                      {/* 키워드 */}
                      <div>
                        <div className="text-xs font-bold text-gray-500 mb-2">🏷 핵심 키워드</div>
                        <div className="flex flex-wrap gap-1.5">
                          {((st as any).keywords || []).map((kw: string) => (
                            <span key={kw} className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">{kw}</span>
                          ))}
                        </div>
                      </div>

                      {/* 대표 명소 */}
                      <div>
                        <div className="text-xs font-bold text-gray-500 mb-2">⭐ 대표 명소</div>
                        <div className="space-y-1">
                          {((st as any).famous || []).map((f: string) => (
                            <div key={f} className="flex items-center gap-2 text-sm text-gray-700">
                              <span className="text-blue-500">•</span> {f}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 거리 성격 */}
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="text-xs font-bold text-gray-500 mb-1">🎭 거리 성격</div>
                        <p className="text-sm text-gray-700">{(st as any).character}</p>
                      </div>

                      {/* 문화유산 */}
                      {(st as any).heritage && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                          <div className="text-xs font-bold text-indigo-600 mb-1">🏛 역사·문화유산</div>
                          <p className="text-sm text-indigo-800">{(st as any).heritage}</p>
                        </div>
                      )}

                      {/* 위험 신호 */}
                      {(st as any).risk && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <div className="text-xs font-bold text-red-600 mb-1">⚠ 위험 신호</div>
                          <p className="text-sm text-red-700">{(st as any).risk}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 소상공인 상가 현황 */}
                  {(st as any).sbizTotal && (
                    <div className="bg-white border border-gray-200 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-bold">🏪 상가 현황 (반경 150m)</h3>
                        <span className="text-sm font-bold text-blue-600">{(st as any).sbizTotal}건</span>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {Object.entries((st as any).sbizCategories || {})
                          .sort((a: any, b: any) => b[1] - a[1])
                          .slice(0, 6)
                          .map(([cat, cnt]: any) => (
                            <span key={cat} className={`px-3 py-1 rounded-full text-sm font-medium ${
                              cat === "음식" ? "bg-red-50 text-red-700" :
                              cat === "소매" ? "bg-amber-50 text-amber-700" :
                              cat === "숙박" ? "bg-purple-50 text-purple-700" :
                              "bg-gray-100 text-gray-600"
                            }`}>
                              {cat === "음식" ? "🍽" : cat === "소매" ? "🛍" : cat === "숙박" ? "🏨" : "📌"} {cat} {cnt}
                            </span>
                          ))}
                      </div>
                      {/* 음식점 리스트 */}
                      <div className="text-xs font-bold text-gray-500 mb-2">주요 음식점</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {((st as any).sbizShops || [])
                          .filter((s: any) => s.category?.includes("음식"))
                          .slice(0, 10)
                          .map((shop: any, i: number) => (
                            <div key={i} className="bg-gray-50 rounded-lg px-3 py-2">
                              <div className="text-sm font-medium text-gray-900 truncate">{shop.name}</div>
                              <div className="text-[10px] text-gray-400 truncate">{shop.category?.split("/").slice(2).join("")}</div>
                            </div>
                          ))}
                      </div>
                      <p className="text-[10px] text-gray-300 mt-3">출처: 소상공인시장진흥공단 상가정보 API</p>
                    </div>
                  )}

                  {st.places && st.places.length > 0 ? (
                    <div className="space-y-3">
                      <h3 className="text-lg font-bold">📍 이 거리의 장소 ({st.places.length}곳)</h3>
                      {st.places.map((sp: any, i: number) => (
                        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-base font-bold">{sp.name}</span>
                              <span className="text-sm text-gray-400 ml-2">★{sp.rating} ({sp.reviewCount}건)</span>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${sp.gapCount >= 2 ? "bg-red-100 text-red-700" : sp.gapCount === 1 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                              {sp.gapCount >= 2 ? "🔴 동결" : sp.gapCount === 1 ? "🟡 부분" : "🟢 활성"}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{sp.address}</p>
                          {sp.gaps.length > 0 && (
                            <div className="flex gap-1 mt-2">
                              {sp.gaps.map((g: string) => (
                                <span key={g} className="text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded-full">
                                  {g === "phone" ? "📞없음" : g === "web" ? "🌐없음" : "🕐없음"}
                                </span>
                              ))}
                            </div>
                          )}
                          {sp.reviews?.[0] && (
                            <div className="bg-gray-50 rounded-lg p-3 mt-2">
                              <p className="text-xs text-gray-500 italic">"{sp.reviews[0].text}"</p>
                              <p className="text-[10px] text-gray-300 mt-1">— {sp.reviews[0].author}, {sp.reviews[0].time}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                      <h3 className="text-base font-bold text-amber-800">🔍 구글 Places API 연동 대기</h3>
                      <p className="text-sm text-amber-700 mt-2">
                        이 거리의 개별 장소 데이터를 수집하려면 Google Cloud Console에서 API 키 제한을 해제해야 합니다.
                      </p>
                      <p className="text-xs text-amber-500 mt-2">
                        도로명: {st.road} · 좌표: {st.lat}, {st.lng}
                      </p>
                    </div>
                  )}

                  {/* 실시간 혼잡도 */}
                  {(st as any).realtimePop && (() => {
                    const pop = (st as any).realtimePop;
                    const levelColor: Record<string, string> = {
                      "여유": "bg-emerald-100 text-emerald-800",
                      "보통": "bg-blue-100 text-blue-800",
                      "약간 붐빔": "bg-amber-100 text-amber-800",
                      "붐빔": "bg-red-100 text-red-800",
                    };
                    return (
                      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-bold">📡 실시간 혼잡도</h3>
                          <span className="text-xs text-gray-400">{pop.time}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`px-4 py-2 rounded-xl text-base font-bold ${levelColor[pop.congestion] || "bg-gray-100 text-gray-700"}`}>
                            {pop.congestion}
                          </span>
                          <div>
                            <div className="text-2xl font-bold text-gray-900">
                              {(pop.popMin / 1000).toFixed(0)}K ~ {(pop.popMax / 1000).toFixed(0)}K
                            </div>
                            <div className="text-xs text-gray-500">현재 추정 인구</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <div className="bg-gray-50 rounded-lg p-2 text-center">
                            <div className="text-sm font-bold">{pop.age20}%</div>
                            <div className="text-[10px] text-gray-400">20대</div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2 text-center">
                            <div className="text-sm font-bold">{pop.age30}%</div>
                            <div className="text-[10px] text-gray-400">30대</div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2 text-center">
                            <div className="text-sm font-bold">{pop.age40}%</div>
                            <div className="text-[10px] text-gray-400">40대</div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2 text-center">
                            <div className="text-sm font-bold">{pop.nonResidentRate}%</div>
                            <div className="text-[10px] text-gray-400">비거주자</div>
                          </div>
                        </div>
                        {pop.forecast?.length > 0 && (
                          <div>
                            <div className="text-xs font-bold text-gray-600 mb-1.5">향후 예측</div>
                            <div className="flex gap-2">
                              {pop.forecast.map((f: any, i: number) => (
                                <div key={i} className="flex-1 bg-gray-50 rounded-lg p-2 text-center">
                                  <div className="text-[10px] text-gray-400">{f.time?.split(" ")[1]}</div>
                                  <div className={`text-xs font-bold mt-0.5 ${
                                    f.level === "여유" ? "text-emerald-600" :
                                    f.level === "보통" ? "text-blue-600" :
                                    f.level === "약간 붐빔" ? "text-amber-600" : "text-red-600"
                                  }`}>{f.level}</div>
                                  <div className="text-[10px] text-gray-500">{(f.min/1000).toFixed(0)}K</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <p className="text-[10px] text-gray-300">출처: 서울시 실시간 도시데이터 API · citydata</p>
                      </div>
                    );
                  })()}

                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="text-xs font-bold text-blue-600 mb-1">🛤 거리 분석 관점</div>
                    <p className="text-sm text-gray-700">
                      <strong>{st.name}</strong>({st.road})은 {st.district}에 위치한 "{st.vibe}" 감성의 거리입니다.
                      도로명주소 기반으로 이 거리에 속한 모든 장소의 디지털 상태를 진단하고,
                      거리 전체의 가치를 구조화할 수 있습니다.
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* ━━━ 시청 모드 — 기본 정보 ━━━ */}
            {viewMode === "cityhall" && <>
            {/* ━━━ 기본 정보 ━━━ */}
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold">🏪 {p.name}</h2>
                  <p className="text-sm text-gray-500 mt-1">🍽 {p.category} · 📅 {p.established}</p>
                  <p className="text-sm text-gray-400">📍 {p.address}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                  p.digitalStatus === "frozen" ? "bg-red-100 text-red-700"
                  : p.digitalStatus === "partial" ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700"
                }`}>
                  {p.digitalStatus === "frozen" ? "디지털 동결" : p.digitalStatus === "partial" ? "부분 동결" : "디지털 활성"}
                </span>
              </div>
              <p className="mt-3 text-base text-gray-700 leading-relaxed">{p.description}</p>
            </div>

            {/* ━━━ 디지털 상태 진단 ━━━ */}
            <div className="bg-gray-50 rounded-xl p-5">
              <h3 className="text-lg font-bold mb-3">🔍 디지털 상태 진단</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "연락처", value: p.phone, has: !!p.phone },
                  { label: "운영시간", value: p.hours, has: !!p.hours },
                  { label: "공식채널", value: p.web ? "있음" : "", has: !!p.web },
                ].map(item => (
                  <div key={item.label} className={`rounded-lg p-3 border-2 ${item.has ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                    <div className={`text-xs font-medium ${item.has ? "text-emerald-600" : "text-red-600"}`}>
                      {item.has ? "✓" : "✗"} {item.label}
                    </div>
                    <div className={`text-sm mt-1 ${item.has ? "text-gray-700" : "text-red-400"}`}>
                      {item.has ? (item.value || "등록됨") : "없음"}
                    </div>
                  </div>
                ))}
              </div>
              {p.gapLabels.length > 0 && (
                <div className="flex gap-2 mt-3">
                  {p.gapLabels.map(g => (
                    <span key={g} className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded-full font-medium">{g}</span>
                  ))}
                </div>
              )}
            </div>

            {/* ━━━ 구글 후기 ━━━ */}
            {(p as any).google && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">⭐ 구글 리뷰</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-yellow-500">★ {(p as any).google.rating}</span>
                    <span className="text-sm text-gray-400">({(p as any).google.reviewCount.toLocaleString()}건)</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {(p as any).google.reviews.map((rv: any, i: number) => (
                    <div key={i} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">{rv.author}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-yellow-500 text-sm">{"★".repeat(rv.rating)}{"☆".repeat(5-rv.rating)}</span>
                          <span className="text-xs text-gray-400">{rv.time}</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{rv.text.slice(0, 200)}{rv.text.length > 200 ? "..." : ""}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-3">출처: Google Places API (New) · 실시간 수집</p>
              </div>
            )}

            {/* ━━━ 📊 리뷰 전략 분석 ━━━ */}
            <ReviewAnalysis place={p} />

            {/* ━━━ 가치 발견 ━━━ */}
            {(p as any).valueDiscovery && (() => {
              const vd = (p as any).valueDiscovery;
              return (
                <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
                  <h3 className="text-lg font-bold">💎 가치 발견</h3>

                  {/* 정체성 */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="text-xs font-bold text-blue-600 mb-1">이 장소의 정체성</div>
                    <p className="text-base font-medium text-gray-900">{vd.identityStatement}</p>
                    <div className="flex gap-2 mt-2">
                      {vd.identity.map((id: any) => (
                        <span key={id.label} className="px-2.5 py-1 bg-blue-100 text-blue-800 text-sm rounded-full font-medium">
                          {id.label} <span className="opacity-50">(강도 {id.strength})</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 사용 패턴 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs font-bold text-gray-600 mb-1">주 방문층</div>
                      <div className="flex gap-1.5 flex-wrap">
                        {vd.who.length > 0 ? vd.who.map((w: string) => (
                          <span key={w} className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-sm rounded-full">{w}</span>
                        )) : <span className="text-sm text-gray-400">미확인</span>}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs font-bold text-gray-600 mb-1">주 방문 시간</div>
                      <div className="flex gap-1.5 flex-wrap">
                        {vd.when.length > 0 ? vd.when.map((w: string) => (
                          <span key={w} className="px-2 py-0.5 bg-amber-100 text-amber-700 text-sm rounded-full">{w}</span>
                        )) : <span className="text-sm text-gray-400">미확인</span>}
                      </div>
                    </div>
                  </div>

                  {/* 브랜드 문장 */}
                  {vd.brandSentences.length > 0 && (
                    <div>
                      <div className="text-xs font-bold text-gray-600 mb-2">브랜드가 될 수 있는 문장 (리뷰 원문)</div>
                      {vd.brandSentences.map((s: string, i: number) => (
                        <div key={i} className="bg-amber-50 border-l-4 border-amber-400 px-4 py-2 mb-2 rounded-r-lg">
                          <p className="text-sm text-gray-700 italic">"{s}"</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 상권 교차 인사이트 */}
                  {vd.crossInsights.length > 0 && (
                    <div>
                      <div className="text-xs font-bold text-gray-600 mb-2">서울시 빅데이터 교차 인사이트</div>
                      {vd.crossInsights.map((ins: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 mb-2">
                          <span className="text-blue-500 shrink-0 mt-0.5">→</span>
                          <p className="text-sm text-gray-700 leading-relaxed">{ins}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 위험 신호 */}
                  {vd.riskSignals.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="text-xs font-bold text-red-600 mb-2">위험 신호</div>
                      {vd.riskSignals.map((rs: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 mb-1.5">
                          <span className="text-red-500 shrink-0">⚠</span>
                          <p className="text-sm text-red-700">{rs}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ━━━ 태그 (가치 키워드) ━━━ */}
            <div>
              <h3 className="text-lg font-bold mb-3">🏷 가치 키워드</h3>
              <div className="flex flex-wrap gap-2">
                {p.tags.map(t => (
                  <span key={t} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">{t}</span>
                ))}
              </div>
            </div>

            {/* ━━━ 회복 과제 ━━━ */}
            {p.gaps.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                <h3 className="text-lg font-bold text-amber-800 mb-3">✅ 회복 과제</h3>
                <div className="space-y-2">
                  {p.gaps.map(g => {
                    const task = g === "phone" ? `${p.name}의 연락처를 표준 데이터로 등록`
                      : g === "hours" ? `${p.name}의 운영시간/휴무일을 등록`
                      : `${p.name}의 공식 홈페이지 또는 SNS 채널 연결`;
                    return (
                      <div key={g} className="flex items-center gap-3 bg-white rounded-lg p-3">
                        <span className="w-5 h-5 rounded border-2 border-amber-300 shrink-0" />
                        <span className="text-sm text-gray-700">{task}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ━━━ 공간 분석 (MORO Score) ━━━ */}
            {(p as any).spatial && (() => {
              const sp = (p as any).spatial;
              const ms = sp.moroScores;
              return (
                <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
                  <h3 className="text-lg font-bold">📐 공간 분석 — 거리 기반 가치 측정</h3>

                  {/* MORO Scores */}
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: "Walk", desc: "도보 연결성", value: ms.walk, color: "bg-blue-500" },
                      { label: "Café", desc: "카페 밀도", value: ms.cafe, color: "bg-amber-500" },
                      { label: "Culture", desc: "문화 접근성", value: ms.culture, color: "bg-purple-500" },
                      { label: "Connect", desc: "중심지 연결", value: ms.connectivity, color: "bg-emerald-500" },
                    ].map(s => (
                      <div key={s.label} className="bg-gray-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-gray-900">{s.value}</div>
                        <div className="text-xs font-medium text-gray-600 mt-0.5">{s.label}</div>
                        <div className="h-2 bg-gray-200 rounded-full mt-2 overflow-hidden">
                          <div className={`h-full rounded-full ${s.color}`} style={{ width: `${s.value}%` }} />
                        </div>
                        <div className="text-[10px] text-gray-400 mt-1">{s.desc}</div>
                      </div>
                    ))}
                  </div>

                  {/* 거리 정보 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="border border-blue-100 bg-blue-50 rounded-lg p-3">
                      <div className="text-xs text-blue-600 font-medium">서울시청까지</div>
                      <div className="text-xl font-bold text-blue-800 mt-1">{sp.distToCityHall}m</div>
                      <div className="text-xs text-blue-500">도보 {Math.ceil(sp.distToCityHall / 67)}분</div>
                    </div>
                    <div className="border border-purple-100 bg-purple-50 rounded-lg p-3">
                      <div className="text-xs text-purple-600 font-medium">500m 내 문화행사</div>
                      <div className="text-xl font-bold text-purple-800 mt-1">{sp.nearbyCultureCount}건</div>
                      <div className="text-xs text-purple-500">서울시 열린데이터광장</div>
                    </div>
                  </div>

                  {/* 500m 내 문화행사 */}
                  {sp.nearbyCulture500m.length > 0 && (
                    <div>
                      <div className="text-sm font-bold text-gray-700 mb-2">반경 500m 문화행사 (가까운 순)</div>
                      <div className="space-y-1.5">
                        {sp.nearbyCulture500m.slice(0, 5).map((c: any, i: number) => (
                          <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                            <span className="text-sm font-bold text-purple-600 w-12">{c.distance}m</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-gray-700 truncate">{c.title}</div>
                              <div className="text-xs text-gray-400">{c.place} · {c.category}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 주변 맛집 거리 */}
                  <div>
                    <div className="text-sm font-bold text-gray-700 mb-2">주변 맛집 거리</div>
                    <div className="flex gap-2 flex-wrap">
                      {sp.nearbyPlaces.map((np: any) => (
                        <span key={np.name} className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                          np.distance < 100 ? "bg-emerald-100 text-emerald-800" :
                          np.distance < 300 ? "bg-blue-100 text-blue-800" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {np.name} <span className="opacity-60">{np.distance}m</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ━━━ 서울시 빅데이터 결합 ━━━ */}
            <div className="border border-blue-200 bg-blue-50 rounded-xl p-5">
              <h3 className="text-lg font-bold text-blue-800 mb-1">🗂 서울시 빅데이터 결합</h3>
              <p className="text-xs text-blue-500 mb-4">서울시 열린데이터광장 · 실시간 API 연동</p>

              {/* 상권 */}
              <div className="bg-white rounded-lg p-4 mb-3">
                <div className="text-sm font-bold text-gray-700 mb-2">📊 주변 상권 매출</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">{commerce.gwanghwamun_korean.area} · {commerce.gwanghwamun_korean.industry}</span>
                    <span className="font-bold">분기 {(commerce.gwanghwamun_korean.quarterlySales / 100000000).toFixed(0)}억원</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">거래 건수</span>
                    <span className="font-bold">{commerce.gwanghwamun_korean.transactions.toLocaleString()}건</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">평일 비율</span>
                    <span className="font-bold">{(commerce.gwanghwamun_korean.weekdayRatio * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">피크 시간</span>
                    <span className="font-bold">{commerce.gwanghwamun_korean.peakTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">주 연령대</span>
                    <span className="font-bold">{commerce.gwanghwamun_korean.topAge}</span>
                  </div>
                </div>
              </div>

              {/* 유동인구 */}
              <div className="bg-white rounded-lg p-4 mb-3">
                <div className="text-sm font-bold text-gray-700 mb-2">👥 중구 생활인구 (2026-05-01)</div>
                <div className="flex gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{(population.junggu_midnight / 10000).toFixed(1)}만</div>
                    <div className="text-gray-400 text-xs">자정</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{(population.junggu_dawn / 10000).toFixed(1)}만</div>
                    <div className="text-gray-400 text-xs">새벽</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{(population.junggu_early / 10000).toFixed(1)}만</div>
                    <div className="text-gray-400 text-xs">오전</div>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">출처: {population.source}</p>
              </div>

              {/* 문화행사 */}
              <div className="bg-white rounded-lg p-4">
                <div className="text-sm font-bold text-gray-700 mb-2">🎭 중구 문화행사 ({culture.junggu_events}건)</div>
                <div className="space-y-2">
                  {culture.samples.map((e: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-blue-500 shrink-0">•</span>
                      <div>
                        <span className="text-gray-700">{e.title}</span>
                        <span className="text-gray-400 ml-2 text-xs">{e.place} · {e.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">출처: {culture.source}</p>
              </div>
            </div>

            {/* ━━━ 결합 인사이트 ━━━ */}
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-5">
              <h3 className="text-lg font-bold text-indigo-800 mb-2">💡 결합 인사이트</h3>
              <p className="text-base text-gray-700 leading-relaxed">
                <strong>{p.name}</strong>은 {p.established} 전통의 {p.category}으로,
                광화문역 한식 상권(분기 매출 {(commerce.gwanghwamun_korean.quarterlySales / 100000000).toFixed(0)}억)의 핵심 구성원이다.
                {p.gaps.length > 0
                  ? ` 그러나 ${p.gapLabels.join(", ")}으로 디지털에서 발견되기 어려운 상태.
                     중구 생활인구 ${(population.junggu_midnight / 10000).toFixed(1)}만명, 주변 문화행사 ${culture.junggu_events}건의 흐름과 연결되지 못하고 있다.`
                  : ` 디지털 정보가 갖춰져 있어 온라인 발견 가능성이 높다. 서울시 미래유산으로 지정된 이 장소는 중구 문화행사 ${culture.junggu_events}건의 흐름과 자연스럽게 연결된다.`
                }
              </p>
            </div>

            <p className="text-xs text-gray-300 text-center pb-8">
              MORO Local Value Discovery · 서울시 열린데이터광장 실데이터 기반
            </p>
            </>}
          </div>
        </div>
      </div>
    </div>
  );
}
