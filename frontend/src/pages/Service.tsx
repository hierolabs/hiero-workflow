import { Link } from "react-router-dom";

export default function Service() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-slate-950 px-6 py-20 text-center">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-widest text-blue-400">Service</p>
          <h1 className="text-4xl font-bold text-white md:text-5xl">위탁운영 서비스</h1>
          <p className="mt-4 text-lg text-gray-400">
            숙소의 모든 운영을 맡기고, 매월 정산 리포트만 받으세요.
          </p>
        </div>
      </section>

      {/* What We Do */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-bold text-gray-900">우리가 하는 일</h2>
          <p className="mt-3 text-center text-base text-gray-500">
            빈집이나 공실을 단순히 플랫폼에 올리는 것이 아닙니다.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {[
              { title: "숙소 수익성 진단", desc: "위치, 구조, 주변 경쟁 데이터를 분석해 운영 가능성과 예상 매출을 산출합니다." },
              { title: "사진/대표 이미지 개선", desc: "예약 전환에 직접 영향을 주는 대표 사진과 상세 이미지를 개선합니다." },
              { title: "OTA 채널 등록 및 운영", desc: "에어비앤비, 부킹, 아고다, 삼삼엠투에 최적화된 문구와 가격으로 등록합니다." },
              { title: "가격 전략", desc: "시즌, 요일, 경쟁 숙소 가격을 분석해 가동률과 매출을 최적화합니다." },
              { title: "예약 및 게스트 관리", desc: "예약 확인, 체크인 안내, 게스트 문의 응대, 리뷰 관리를 24시간 처리합니다." },
              { title: "청소 배정 및 비품 관리", desc: "체크아웃 기반 자동 청소 배정, 비품 재고 관리, 품질 검수를 운영합니다." },
              { title: "이슈 대응", desc: "게스트 클레임, 시설 고장, 긴급 상황에 즉각 대응합니다." },
              { title: "월간 정산 리포트", desc: "채널별 매출, 가동률, 비용, 순수익을 투명하게 리포트합니다." },
            ].map((item, i) => (
              <div key={i} className="rounded-xl border border-gray-200 p-6">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-sm font-bold text-blue-600">
                  {i + 1}
                </div>
                <h3 className="text-base font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="bg-slate-50 px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-bold text-gray-900">운영 프로세스</h2>
          <div className="mt-12 space-y-6">
            {[
              { step: "1", title: "무료 진단", desc: "숙소 위치와 사진을 보내주시면 운영 가능성을 진단합니다." },
              { step: "2", title: "운영안 제안", desc: "예상 매출, 손익분기, 채널 전략을 포함한 제안서를 드립니다." },
              { step: "3", title: "숙소 세팅", desc: "사진 촬영, 채널 등록, 가격 설정, 청소팀 배정을 완료합니다." },
              { step: "4", title: "운영 시작", desc: "첫 예약부터 정산까지, 모든 운영을 HIERO가 관리합니다." },
            ].map((item) => (
              <div key={item.step} className="flex gap-4 rounded-xl bg-white p-6 shadow-sm">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                  {item.step}
                </span>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{item.title}</h3>
                  <p className="mt-1 text-sm text-gray-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 text-center">
        <h2 className="text-2xl font-bold text-gray-900">지금 무료 진단을 받아보세요</h2>
        <p className="mt-3 text-base text-gray-500">숙소 운영 가능성을 먼저 확인해 드립니다.</p>
        <Link
          to="/#cta"
          className="mt-6 inline-flex rounded-lg bg-blue-600 px-8 py-4 text-base font-semibold text-white hover:bg-blue-700"
        >
          무료 진단 신청하기
        </Link>
      </section>
    </div>
  );
}
