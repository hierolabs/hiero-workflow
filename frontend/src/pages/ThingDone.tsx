import { Link } from "react-router-dom";

export default function ThingDone() {
  return (
    <div>
      <section className="bg-slate-950 px-6 py-20 text-center">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-widest text-blue-400">ThingDone</p>
          <h1 className="text-4xl font-bold text-white md:text-5xl">띵똥 청소배정 관리 플랫폼</h1>
          <p className="mt-4 text-lg text-gray-400">
            체크아웃 기반 자동 청소 배정, 실시간 완료 확인, 비품 관리까지.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-bold text-gray-900">핵심 기능</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {[
              {
                title: "자동 청소 배정",
                desc: "체크아웃 일정에 맞춰 청소팀에 자동으로 배정됩니다. 수동 연락이 필요 없습니다.",
                icon: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
              },
              {
                title: "실시간 완료 확인",
                desc: "청소팀이 완료 보고를 하면 즉시 확인됩니다. 체크인 전 상태를 실시간으로 파악합니다.",
                icon: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
              },
              {
                title: "비품 관리",
                desc: "세탁물, 어메니티, 소모품 재고를 숙소별로 추적합니다. 부족 시 자동 알림.",
                icon: "M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z",
              },
              {
                title: "품질 검수 체크리스트",
                desc: "청소 항목별 체크리스트로 일관된 품질을 유지합니다. 사진 첨부 기능 포함.",
                icon: "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z",
              },
              {
                title: "청소팀 성과 관리",
                desc: "팀별 완료 건수, 평균 소요 시간, 품질 점수를 추적합니다.",
                icon: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z",
              },
              {
                title: "운영자 대시보드",
                desc: "오늘의 청소 일정, 미완료 건, 긴급 상황을 한눈에 파악합니다.",
                icon: "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z",
              },
            ].map((item, i) => (
              <div key={i} className="rounded-xl border border-gray-200 p-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                  <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Flow */}
      <section className="bg-slate-50 px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-bold text-gray-900">청소 배정 흐름</h2>
          <div className="mt-12 flex flex-col items-center gap-4">
            {[
              "예약 체크아웃 감지",
              "청소팀 자동 배정",
              "청소 진행 및 체크리스트 완료",
              "사진 첨부 + 완료 보고",
              "다음 게스트 체크인 준비 완료",
            ].map((step, i) => (
              <div key={i} className="flex w-full max-w-md items-center gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div className="flex-1 rounded-lg bg-white px-5 py-3 shadow-sm">
                  <p className="text-sm font-medium text-gray-800">{step}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 text-center">
        <h2 className="text-2xl font-bold text-gray-900">청소 관리를 자동화하세요</h2>
        <p className="mt-3 text-base text-gray-500">HIERO 위탁운영에 포함된 서비스입니다.</p>
        <Link to="/#cta" className="mt-6 inline-flex rounded-lg bg-blue-600 px-8 py-4 text-base font-semibold text-white hover:bg-blue-700">
          무료 진단 신청하기
        </Link>
      </section>
    </div>
  );
}
