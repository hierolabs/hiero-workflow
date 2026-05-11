import { useMemo, useState } from "react";

type PlatformId = "hiero" | "airbnb" | "samsam" | "live";
type PhotoStatus = "ready" | "edit" | "missing";
type ExternalStatus = "ready" | "needs_info" | "manual" | "review";

interface PhotoAsset {
  label: string;
  tag: string;
  status: PhotoStatus;
}

interface ListingProperty {
  code: string;
  name: string;
  region: string;
  address: string;
  type: string;
  guests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  checkIn: string;
  checkOut: string;
  license: string;
  title: string;
  description: string;
  transport: string;
  nearby: string;
  amenities: string[];
  rules: string[];
  prices: {
    nightly: number;
    weekend: number;
    weekly: number;
    biweekly: number;
    monthly: number;
    managementWeekly: number;
    managementMonthly: number;
    cleaning: number;
    deposit: number;
  };
  photos: PhotoAsset[];
  platforms: Record<Exclude<PlatformId, "hiero">, {
    status: ExternalStatus;
    url: string;
    missing: string[];
  }>;
}

const platformLabels: Record<PlatformId, string> = {
  hiero: "HIERO 홈페이지",
  airbnb: "Airbnb",
  samsam: "삼삼엠투",
  live: "리브애니웨어",
};

const platformTone: Record<ExternalStatus, string> = {
  ready: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  needs_info: "bg-amber-50 text-amber-700 ring-amber-200",
  manual: "bg-sky-50 text-sky-700 ring-sky-200",
  review: "bg-violet-50 text-violet-700 ring-violet-200",
};

const platformStatusLabel: Record<ExternalStatus, string> = {
  ready: "등록 가능",
  needs_info: "정보 보강",
  manual: "수동 입력",
  review: "심사 대기",
};

const sampleProperties: ListingProperty[] = [
  {
    code: "B76",
    name: "강동역 1.5룸 B76",
    region: "강동",
    address: "서울특별시 강동구 천호동 더하임",
    type: "오피스텔, 집 전체",
    guests: 2,
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    checkIn: "16:00",
    checkOut: "11:00",
    license: "준비 필요",
    title: "강동역 도보권, 깔끔한 1.5룸 스테이",
    description: "화이트 톤으로 정돈된 강동 생활권 숙소입니다. 단기 일정과 장기 체류 모두 편하게 머물 수 있도록 침실, 주방, 세탁 동선을 갖췄습니다.",
    transport: "강동역, 천호역 생활권. 공항버스 천호역 하차 후 이동 가능",
    nearby: "편의점, 카페, 강동역 상권, 서울아산병원, 올림픽공원 이동권",
    amenities: ["Wifi", "TV", "주방", "세탁기", "에어컨", "난방", "전자레인지"],
    rules: ["실내 금연", "22시 이후 정숙", "예약 인원만 이용", "파티 불가"],
    prices: {
      nightly: 79000,
      weekend: 92000,
      weekly: 380000,
      biweekly: 720000,
      monthly: 1290000,
      managementWeekly: 50000,
      managementMonthly: 120000,
      cleaning: 50000,
      deposit: 330000,
    },
    photos: [
      { label: "거실 와이드", tag: "대표", status: "ready" },
      { label: "침실", tag: "방", status: "ready" },
      { label: "욕실", tag: "화장실", status: "ready" },
      { label: "주방", tag: "주방", status: "ready" },
      { label: "창가/채광", tag: "뷰", status: "edit" },
    ],
    platforms: {
      airbnb: { status: "needs_info", url: "", missing: ["영업신고번호", "사진 15장 이상 권장"] },
      samsam: { status: "manual", url: "https://33m2.co.kr", missing: ["주간가 반영 확인"] },
      live: { status: "ready", url: "https://host.liveanywhere.me", missing: [] },
    },
  },
  {
    code: "V11",
    name: "대치 학원스터디 투룸",
    region: "대치",
    address: "서울특별시 강남구 대치동",
    type: "주택, 집 전체",
    guests: 4,
    bedrooms: 2,
    beds: 2,
    bathrooms: 1,
    checkIn: "16:00",
    checkOut: "11:00",
    license: "검토 필요",
    title: "대치 학원가 투룸, 공부와 휴식 분리",
    description: "대치동 학원가 일정에 맞춘 투룸형 숙소입니다. 침실과 학습 공간이 분리되어 가족 동반, 장기 체류, 시험 준비 일정에 적합합니다.",
    transport: "한티역, 대치역, 선릉역 이동권. 대치동 학원가 버스 노선 이용",
    nearby: "학원가, 편의점, 카페, 식당, 강남권 주요 업무지역 이동 가능",
    amenities: ["Wifi", "책상", "주방", "세탁기", "TV", "에어컨", "난방"],
    rules: ["실내 금연", "소음 주의", "반려동물 사전 문의", "기물 파손 비용 청구"],
    prices: {
      nightly: 132000,
      weekend: 158000,
      weekly: 680000,
      biweekly: 1280000,
      monthly: 2350000,
      managementWeekly: 80000,
      managementMonthly: 180000,
      cleaning: 70000,
      deposit: 330000,
    },
    photos: [
      { label: "거실/책상", tag: "대표", status: "ready" },
      { label: "침실 1", tag: "방", status: "ready" },
      { label: "침실 2", tag: "방", status: "ready" },
      { label: "욕실", tag: "화장실", status: "ready" },
      { label: "주방", tag: "주방", status: "ready" },
    ],
    platforms: {
      airbnb: { status: "ready", url: "", missing: [] },
      samsam: { status: "manual", url: "https://33m2.co.kr", missing: ["주간가 변경 필요"] },
      live: { status: "review", url: "https://host.liveanywhere.me", missing: ["검수 대기"] },
    },
  },
];

export default function ListingStudio() {
  const [properties, setProperties] = useState<ListingProperty[]>(sampleProperties);
  const [selectedCode, setSelectedCode] = useState(sampleProperties[0].code);
  const [activePlatform, setActivePlatform] = useState<PlatformId>("hiero");
  const [uploadMessage, setUploadMessage] = useState("CSV 업로드 대기");
  const selected = properties.find((item) => item.code === selectedCode) || properties[0];
  const readiness = useMemo(() => getReadiness(selected), [selected]);
  const packageRows = getPlatformPackage(selected, activePlatform);
  const tasks = getTaskRows(selected);
  const readyPhotoCount = selected.photos.filter((photo) => photo.status === "ready").length;

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const imported = parseListingCsv(text);
      if (imported.length === 0) {
        setUploadMessage("불러올 행이 없습니다");
        return;
      }
      setProperties(imported);
      setSelectedCode(imported[0].code);
      setUploadMessage(`${imported.length}개 숙소 불러옴`);
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : "업로드 실패");
    }
  };

  const exportMaster = () => {
    downloadCsv("hiero_listing_master.csv", toListingCsv(properties));
  };

  const exportPlatform = () => {
    downloadCsv(`hiero_${activePlatform}_package.csv`, toPlatformCsv(properties, activePlatform));
  };

  const exportTemplate = () => {
    downloadCsv("hiero_listing_upload_template.csv", toListingCsv([createBlankTemplate()]));
  };

  return (
    <div className="min-h-full bg-slate-50 px-5 py-6 text-slate-900 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Listing Studio</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">숙소 입력과 플랫폼 등록 콘솔</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            한 번 입력한 숙소 원장을 HIERO 홈페이지에는 자동 반영하고, 외부 플랫폼에는 등록 패키지와 단계별 작업 큐로 넘기는 화면입니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="cursor-pointer rounded-md border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-100">
            CSV 업로드
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => handleUpload(event.target.files?.[0] || null)}
            />
          </label>
          <button
            onClick={exportTemplate}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            양식 다운로드
          </button>
          <button
            onClick={exportMaster}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            원장 Export
          </button>
          <button
            onClick={exportPlatform}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            플랫폼 Export
          </button>
          <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800">
            HIERO 게시
          </button>
          <button className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            외부 등록 큐 생성
          </button>
        </div>
      </header>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <Metric label="등록 준비율" value={`${readiness}%`} tone="teal" />
        <Metric label="숙소 원장" value={`${properties.length}개`} tone="slate" />
        <Metric label="수동 작업" value={`${tasks.length}개`} tone="amber" />
        <Metric label="사진 준비" value={`${readyPhotoCount}/${selected.photos.length}`} tone="rose" />
      </section>

      <section className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
        <span className="font-semibold text-slate-900">업로드/Export 상태: </span>
        {uploadMessage}
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[360px_1fr]">
        <aside className="space-y-4">
          <Panel title="숙소 선택" caption="canonical seed">
            <div className="space-y-2">
              {properties.map((property) => (
                <button
                  key={property.code}
                  onClick={() => setSelectedCode(property.code)}
                  className={`w-full rounded-md border p-3 text-left transition ${
                    property.code === selected.code
                      ? "border-teal-500 bg-teal-50"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-slate-900">{property.code}</span>
                    <span className="text-xs text-slate-500">{property.region}</span>
                  </div>
                  <p className="mt-1 truncate text-sm text-slate-600">{property.display_name || property.name}</p>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="공통 입력 원장" caption="모든 플랫폼의 출발점">
            <div className="space-y-3">
              <Field label="주소" value={selected.address} />
              <Field label="유형" value={selected.type} />
              <Field label="기본 정보" value={`${selected.guests}인, 침실 ${selected.bedrooms}, 침대 ${selected.beds}, 욕실 ${selected.bathrooms}`} />
              <Field label="체크인/아웃" value={`${selected.checkIn} / ${selected.checkOut}`} />
              <Field label="영업신고" value={selected.license} />
            </div>
          </Panel>
        </aside>

        <main className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <PreviewPanel property={selected} />
            <ReadinessPanel property={selected} readiness={readiness} />
          </div>

          <Panel title="플랫폼 등록 패키지" caption="플랫폼별 가격 단위와 입력 순서를 분리">
            <div className="mb-4 flex flex-wrap gap-2">
              {(Object.keys(platformLabels) as PlatformId[]).map((platform) => (
                <button
                  key={platform}
                  onClick={() => setActivePlatform(platform)}
                  className={`rounded-md px-3 py-2 text-xs font-semibold ${
                    activePlatform === platform
                      ? "bg-slate-950 text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {platformLabels[platform]}
                </button>
              ))}
            </div>
            <div className="grid gap-0 overflow-hidden rounded-md border border-slate-200 bg-white">
              {packageRows.map((row) => (
                <div key={row.label} className="grid gap-3 border-b border-slate-100 p-4 last:border-b-0 md:grid-cols-[150px_1fr_auto] md:items-start">
                  <span className="text-sm font-semibold text-slate-600">{row.label}</span>
                  <p className="whitespace-pre-line text-sm leading-6 text-slate-800">{row.value}</p>
                  <button className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                    복사
                  </button>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="외부 플랫폼 작업 큐" caption="매크로 또는 담당자가 처리할 다음 액션">
            <div className="grid gap-3 lg:grid-cols-3">
              {tasks.map((task) => (
                <div key={task.platform} className="rounded-md border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-slate-900">{task.platform}</h3>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${task.tone}`}>{task.status}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{task.action}</p>
                  <button className="mt-4 w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700">
                    단계 열기
                  </button>
                </div>
              ))}
            </div>
          </Panel>
        </main>
      </section>
    </div>
  );
}

function Panel({ title, caption, children }: { title: string; caption?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {caption ? <span className="text-xs text-slate-400">{caption}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "teal" | "slate" | "amber" | "rose" }) {
  const toneClass = {
    teal: "border-teal-200 bg-teal-50 text-teal-700",
    slate: "border-slate-200 bg-white text-slate-900",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
  }[tone];

  return (
    <div className={`rounded-lg border p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <p className="mt-1 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-800">{value}</p>
    </div>
  );
}

function PreviewPanel({ property }: { property: ListingProperty }) {
  return (
    <Panel title="HIERO 홈페이지 미리보기" caption="자동 게시 대상">
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <div className="grid h-52 grid-cols-3 gap-1 bg-slate-100 p-1">
          {property.photos.slice(0, 5).map((photo, index) => (
            <div
              key={`${photo.label}-${index}`}
              className={`flex items-end rounded-md p-3 ${
                index === 0 ? "col-span-2 row-span-2 bg-teal-700" : "bg-slate-300"
              }`}
            >
              <span className={`text-xs font-semibold ${index === 0 ? "text-white" : "text-slate-700"}`}>{photo.tag}</span>
            </div>
          ))}
        </div>
        <div className="bg-white p-5">
          <p className="text-sm font-semibold text-teal-700">{property.region}</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-950">{property.title}</h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">{property.description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {property.amenities.slice(0, 5).map((amenity) => (
              <span key={amenity} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {amenity}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function ReadinessPanel({ property, readiness }: { property: ListingProperty; readiness: number }) {
  const items = [
    { label: "기본 정보", done: Boolean(property.address && property.type && property.guests) },
    { label: "사진", done: property.photos.filter((photo) => photo.status === "ready").length >= 5 },
    { label: "게스트 문구", done: Boolean(property.title && property.description) },
    { label: "가격", done: property.prices.nightly > 0 && property.prices.weekly > 0 && property.prices.monthly > 0 },
    { label: "규칙", done: property.rules.length > 0 },
    { label: "영업신고", done: property.license !== "준비 필요" },
  ];

  return (
    <Panel title="등록 준비 체크" caption={`${readiness}%`}>
      <div className="mb-4 h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-teal-600" style={{ width: `${readiness}%` }} />
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
            <span className="text-sm font-medium text-slate-700">{item.label}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.done ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
              {item.done ? "완료" : "필요"}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function getReadiness(property: ListingProperty) {
  const checks = [
    Boolean(property.address && property.type && property.guests),
    property.photos.filter((photo) => photo.status === "ready").length >= 5,
    Boolean(property.title && property.description),
    property.prices.nightly > 0 && property.prices.weekly > 0 && property.prices.monthly > 0,
    property.rules.length > 0,
    property.license !== "준비 필요",
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function getPlatformPackage(property: ListingProperty, platform: PlatformId) {
  if (platform === "hiero") {
    return [
      { label: "게시 방식", value: "공통 원장 입력 후 홈페이지 상세 페이지와 검색 노출 데이터 자동 생성" },
      { label: "대표 문구", value: `${property.title}\n${property.description}` },
      { label: "가격 표시", value: `1박 ${formatPrice(property.prices.nightly)}부터, 월 ${formatPrice(property.prices.monthly)} 기준` },
      { label: "사진", value: property.photos.map((photo) => `${photo.tag}: ${photo.label}`).join("\n") },
    ];
  }

  if (platform === "airbnb") {
    return [
      { label: "단계", value: "숙소 유형 > 위치 > 기본 정보 > 편의시설 > 사진 > 제목 > 설명 > 가격 > 예약 규칙 > 이용 규칙" },
      { label: "가격", value: `평일 ${formatPrice(property.prices.nightly)} / 주말 ${formatPrice(property.prices.weekend)} / 청소비 ${formatPrice(property.prices.cleaning)}` },
      { label: "필수 확인", value: `영업신고: ${property.license}\n체크인 ${property.checkIn}, 체크아웃 ${property.checkOut}` },
      { label: "복사 문구", value: `${property.title}\n\n${property.description}\n\n교통: ${property.transport}\n주변: ${property.nearby}` },
    ];
  }

  if (platform === "samsam") {
    return [
      { label: "단계", value: "기본 정보 > 요금 > 옵션 > 사진 > 심사 요청" },
      { label: "가격", value: `보증금 ${formatPrice(property.prices.deposit)} / 주 ${formatPrice(property.prices.weekly)} / 관리비 주 ${formatPrice(property.prices.managementWeekly)} / 청소비 ${formatPrice(property.prices.cleaning)}` },
      { label: "옵션", value: property.amenities.join(", ") },
      { label: "주의", value: "가격 변경은 현재 수동 반영 대상입니다. 작업 큐에서 매크로 단계로 분리합니다." },
    ];
  }

  return [
    { label: "단계", value: "기본 정보 > 사진 > 요금/조건 > 검수" },
    { label: "가격", value: `2주 ${formatPrice(property.prices.biweekly)} / 월 ${formatPrice(property.prices.monthly)} / 관리비 월 ${formatPrice(property.prices.managementMonthly)}` },
    { label: "사진", value: "대표사진, 방, 화장실 사진 필수 포함" },
    { label: "검수", value: "등록 후 검수 상태를 플랫폼 상태에 기록합니다." },
  ];
}

function getTaskRows(property: ListingProperty) {
  return (Object.entries(property.platforms) as Array<[Exclude<PlatformId, "hiero">, ListingProperty["platforms"]["airbnb"]]>).map(([id, platform]) => ({
    platform: platformLabels[id],
    status: platformStatusLabel[platform.status],
    tone: platformTone[platform.status],
    action: platform.missing.length > 0 ? platform.missing.join(", ") : `${property.code} 등록 패키지로 바로 진행 가능`,
  }));
}

function formatPrice(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

const listingColumns = [
  "code",
  "name",
  "region",
  "address",
  "type",
  "guests",
  "bedrooms",
  "beds",
  "bathrooms",
  "checkIn",
  "checkOut",
  "license",
  "title",
  "description",
  "transport",
  "nearby",
  "amenities",
  "rules",
  "nightly",
  "weekend",
  "weekly",
  "biweekly",
  "monthly",
  "managementWeekly",
  "managementMonthly",
  "cleaning",
  "deposit",
  "photos",
] as const;

type ListingColumn = typeof listingColumns[number];

function toListingCsv(properties: ListingProperty[]) {
  const rows = properties.map((property) => {
    const row: Record<ListingColumn, string | number> = {
      code: property.code,
      name: property.display_name || property.name,
      region: property.region,
      address: property.address,
      type: property.type,
      guests: property.guests,
      bedrooms: property.bedrooms,
      beds: property.beds,
      bathrooms: property.bathrooms,
      checkIn: property.checkIn,
      checkOut: property.checkOut,
      license: property.license,
      title: property.title,
      description: property.description,
      transport: property.transport,
      nearby: property.nearby,
      amenities: property.amenities.join("|"),
      rules: property.rules.join("|"),
      nightly: property.prices.nightly,
      weekend: property.prices.weekend,
      weekly: property.prices.weekly,
      biweekly: property.prices.biweekly,
      monthly: property.prices.monthly,
      managementWeekly: property.prices.managementWeekly,
      managementMonthly: property.prices.managementMonthly,
      cleaning: property.prices.cleaning,
      deposit: property.prices.deposit,
      photos: property.photos.map((photo) => `${photo.tag}:${photo.label}:${photo.status}`).join("|"),
    };
    return listingColumns.map((column) => row[column]);
  });

  return stringifyCsv([listingColumns, ...rows]);
}

function toPlatformCsv(properties: ListingProperty[], platform: PlatformId) {
  const columns = ["code", "platform", "field", "value"];
  const rows = properties.flatMap((property) =>
    getPlatformPackage(property, platform).map((item) => [
      property.code,
      platformLabels[platform],
      item.label,
      item.value,
    ])
  );
  return stringifyCsv([columns, ...rows]);
}

function parseListingCsv(text: string) {
  const rows = parseCsv(text.trim());
  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => header.trim());
  const requiredHeaders = ["code", "name", "address"];
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    throw new Error(`필수 컬럼 없음: ${missingHeaders.join(", ")}`);
  }

  return rows.slice(1).reduce<ListingProperty[]>((acc, row) => {
    const record = headers.reduce<Record<string, string>>((item, header, index) => {
      item[header] = row[index] || "";
      return item;
    }, {});

    if (!record.code) return acc;
    acc.push(recordToProperty(record));
    return acc;
  }, []);
}

function recordToProperty(record: Record<string, string>): ListingProperty {
  const photos = splitList(record.photos).map((item) => {
    const [tag = "사진", label = item, status = "ready"] = item.split(":");
    return {
      tag,
      label,
      status: isPhotoStatus(status) ? status : "ready",
    };
  });

  return {
    code: record.code,
    name: record.name || record.code,
    region: record.region || "",
    address: record.address || "",
    type: record.type || "집 전체",
    guests: toNumber(record.guests, 2),
    bedrooms: toNumber(record.bedrooms, 1),
    beds: toNumber(record.beds, 1),
    bathrooms: toNumber(record.bathrooms, 1),
    checkIn: record.checkIn || "16:00",
    checkOut: record.checkOut || "11:00",
    license: record.license || "준비 필요",
    title: record.title || record.name || record.code,
    description: record.description || "",
    transport: record.transport || "",
    nearby: record.nearby || "",
    amenities: splitList(record.amenities),
    rules: splitList(record.rules),
    prices: {
      nightly: toNumber(record.nightly, 0),
      weekend: toNumber(record.weekend, 0),
      weekly: toNumber(record.weekly, 0),
      biweekly: toNumber(record.biweekly, 0),
      monthly: toNumber(record.monthly, 0),
      managementWeekly: toNumber(record.managementWeekly, 0),
      managementMonthly: toNumber(record.managementMonthly, 0),
      cleaning: toNumber(record.cleaning, 0),
      deposit: toNumber(record.deposit, 330000),
    },
    photos: photos.length > 0 ? photos : [{ label: "대표사진 필요", tag: "대표", status: "missing" }],
    platforms: {
      airbnb: { status: record.license && record.license !== "준비 필요" ? "ready" : "needs_info", url: "", missing: record.license ? [] : ["영업신고번호"] },
      samsam: { status: "manual", url: "https://33m2.co.kr", missing: ["가격 확인"] },
      live: { status: "manual", url: "https://host.liveanywhere.me", missing: ["검수 요청"] },
    },
  };
}

function createBlankTemplate(): ListingProperty {
  return {
    ...sampleProperties[0],
    code: "ROOM001",
    name: "숙소명",
    region: "지역",
    address: "주소",
    title: "홈페이지/플랫폼 제목",
    description: "숙소 소개",
    transport: "교통 정보",
    nearby: "주변 정보",
    amenities: ["Wifi", "TV", "주방"],
    rules: ["실내 금연", "파티 불가"],
    photos: [
      { label: "대표사진 파일명 또는 URL", tag: "대표", status: "ready" },
      { label: "방 사진 파일명 또는 URL", tag: "방", status: "ready" },
    ],
  };
}

function splitList(value = "") {
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isPhotoStatus(value: string): value is PhotoStatus {
  return value === "ready" || value === "edit" || value === "missing";
}

function stringifyCsv(rows: Array<readonly (string | number)[]>) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? "");
          return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(",")
    )
    .join("\n");
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows.filter((item) => item.some((cellValue) => cellValue.trim()));
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
