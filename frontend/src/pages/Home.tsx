import { useState } from "react";
import { Link } from "react-router-dom";

const SERVICES = [
  {
    to: "/service",
    title: "위탁운영 서비스",
    desc: "사진, 가격, 채널등록, 예약, 청소, CS, 정산까지 숙소 운영의 모든 것을 맡깁니다.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 7.5h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
  {
    to: "/matching",
    title: "숙소노출 매칭플랫폼",
    desc: "에어비앤비, 부킹, 아고다, 삼삼엠투 등 주요 OTA에 최적화된 등록과 노출을 운영합니다.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
  },
  {
    to: "/review",
    title: "거리기반 평가시스템",
    desc: "숙소 위치, 주변 경쟁, 가동률 데이터를 기반으로 운영 가능성을 진단합니다.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    to: "/hosting",
    title: "고객확보 솔루션",
    desc: "공실, 운영 부담, 매출 문제를 가진 숙소 운영자의 고통을 해결합니다.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
  {
    to: "/thingdone",
    title: "띵똥 청소배정 관리",
    desc: "체크아웃 기반 자동 청소 배정, 실시간 완료 확인, 비품 관리 플랫폼입니다.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

const FEATURES = [
  "숙소 수익성 진단",
  "사진/대표 이미지 개선",
  "에어비앤비/부킹/아고다/삼삼엠투 채널 운영",
  "가격 전략",
  "예약 관리",
  "청소 배정",
  "게스트 CS",
  "월간 정산 리포트",
];

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-slate-950 px-6 py-24 text-center md:py-32">
        <div className="mx-auto max-w-3xl">
          <p className="mb-4 text-sm font-medium uppercase tracking-widest text-blue-400">
            숙소 위탁운영 시스템
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-white md:text-5xl lg:text-6xl">
            빈집을 수익형 숙소로 바꾸는
            <br />
            <span className="text-blue-400">위탁운영 시스템</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-gray-400 md:text-xl">
            사진, 가격, 예약, 청소, CS, 정산까지
            <br className="hidden md:block" />
            직접 하지 않아도 운영되는 숙소를 만듭니다.
          </p>
          <a
            href="#cta"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-blue-700"
          >
            내 숙소 진단받기
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </a>
        </div>
      </section>

      {/* Pain */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">
            이런 고민이 있으신가요?
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              { q: "집은 있는데 공실이 걱정되시나요?", detail: "비어 있는 기간만큼 관리비와 대출 이자만 나갑니다." },
              { q: "에어비앤비를 해보고 싶지만 운영이 부담되시나요?", detail: "뭐부터 해야 할지 모르는 시작의 두려움." },
              { q: "예약, 청소, 게스트 응대, 정산이 복잡하신가요?", detail: "시간과 에너지를 숙소에 다 쏟고 있지 않나요?" },
            ].map((item, i) => (
              <div key={i} className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-left">
                <p className="text-base font-semibold text-gray-900">{item.q}</p>
                <p className="mt-2 text-sm text-gray-500">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution */}
      <section className="bg-slate-50 px-6 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-blue-600">HIERO Solution</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
            숙소를 단순 등록하는 것이 아닙니다
          </h2>
          <p className="mt-4 text-base text-gray-500">
            숙소의 수익 가능성을 진단하고, 채널별 판매 전략과 운영 시스템을 설계합니다.
          </p>
        </div>
      </section>

      {/* 5 Service Cards */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">5가지 핵심 서비스</h2>
            <p className="mt-3 text-base text-gray-500">
              위탁운영의 모든 과정을 하나의 시스템으로 관리합니다
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s) => (
              <Link
                key={s.to}
                to={s.to}
                className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-blue-200 hover:shadow-md"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                  {s.icon}
                </div>
                <h3 className="text-base font-semibold text-gray-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{s.desc}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600 opacity-0 transition-opacity group-hover:opacity-100">
                  자세히 보기
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-slate-950 px-6 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold text-white">제공 서비스</h2>
          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
            {FEATURES.map((f, i) => (
              <div key={i} className="rounded-lg border border-gray-700 bg-gray-900/50 px-4 py-4">
                <p className="text-sm font-medium text-gray-300">{f}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Form */}
      <section id="cta" className="px-6 py-20">
        <div className="mx-auto max-w-xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">
              내 숙소 운영 가능성 진단받기
            </h2>
            <p className="mt-3 text-base text-gray-500">
              무료로 숙소 운영 가능성을 확인해 드립니다.
              <br />
              아래 정보를 남겨주시면 전문가가 연락드립니다.
            </p>
          </div>
          <CTAForm />
        </div>
      </section>
    </div>
  );
}

function CTAForm() {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    area: "",
    property_type: "오피스텔",
    pain_point: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/marketing/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          contact_channel: "랜딩페이지",
          has_vacancy: true,
        }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        setError("등록에 실패했습니다. 다시 시도해주세요.");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    }
  };

  if (submitted) {
    return (
      <div className="mt-8 rounded-xl border border-green-200 bg-green-50 p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-green-900">신청이 완료되었습니다</p>
        <p className="mt-2 text-sm text-green-700">
          전문가가 확인 후 빠르게 연락드리겠습니다.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">이름</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="홍길동"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">전화번호</label>
          <input
            required
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="010-0000-0000"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">지역</label>
          <input
            required
            value={form.area}
            onChange={(e) => setForm({ ...form, area: e.target.value })}
            placeholder="서울 강동구"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">숙소 유형</label>
          <select
            value={form.property_type}
            onChange={(e) => setForm({ ...form, property_type: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option>오피스텔</option>
            <option>다가구</option>
            <option>빌라</option>
            <option>도시형생활주택</option>
            <option>단독주택</option>
            <option>아파트</option>
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">현재 가장 큰 고민</label>
        <textarea
          value={form.pain_point}
          onChange={(e) => setForm({ ...form, pain_point: e.target.value })}
          placeholder="공실이 걱정됩니다 / 운영이 힘듭니다 / 매출이 낮습니다..."
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        className="w-full rounded-lg bg-blue-600 py-4 text-base font-semibold text-white transition-colors hover:bg-blue-700"
      >
        무료 진단 신청하기
      </button>
      <p className="text-center text-xs text-gray-400">
        신청 후 전문가가 24시간 내에 연락드립니다.
      </p>
    </form>
  );
}
