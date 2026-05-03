import { Link } from "react-router-dom";

export default function Review() {
  return (
    <div>
      <section className="bg-slate-950 px-6 py-20 text-center">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-widest text-blue-400">Review System</p>
          <h1 className="text-4xl font-bold text-white md:text-5xl">거리기반 평가시스템</h1>
          <p className="mt-4 text-lg text-gray-400">
            숙소 위치, 주변 경쟁, 시장 데이터를 분석하여 운영 가능성을 진단합니다.
          </p>
        </div>
      </section>

      {/* 5 Engine */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-bold text-gray-900">5엔진 진단 시스템</h2>
          <p className="mt-3 text-center text-base text-gray-500">
            숙소 사업의 건강 상태를 5가지 관점에서 진단합니다
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-5">
            {[
              { engine: "매출", desc: "가동률, ADR, 채널별 매출 분석", color: "border-t-blue-500" },
              { engine: "운영", desc: "청소 완료율, 이슈 해결 속도", color: "border-t-green-500" },
              { engine: "고객", desc: "리뷰 점수, 재방문율, 불만 비율", color: "border-t-yellow-500" },
              { engine: "채널", desc: "채널 다각화, 노출 점수", color: "border-t-purple-500" },
              { engine: "재무", desc: "수수료율, 순이익률, 비용 구조", color: "border-t-red-500" },
            ].map((item) => (
              <div key={item.engine} className={`rounded-xl border border-gray-200 border-t-4 bg-white p-5 text-center shadow-sm ${item.color}`}>
                <h3 className="text-lg font-bold text-gray-900">{item.engine}</h3>
                <p className="mt-2 text-xs leading-relaxed text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="bg-slate-50 px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-bold text-gray-900">진단 결과로 받을 수 있는 것</h2>
          <div className="mt-10 space-y-4">
            {[
              "이 숙소가 단기/미드텀 운영에 적합한지",
              "예상 월매출과 연매출은 어느 정도인지",
              "손익분기 가동률은 몇 %인지",
              "사진/구성/가격 중 어디가 문제인지",
              "같은 지역 경쟁 숙소 대비 포지션",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-white p-4 shadow-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <p className="text-sm font-medium text-gray-800">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 text-center">
        <h2 className="text-2xl font-bold text-gray-900">내 숙소 진단을 무료로 받아보세요</h2>
        <Link to="/#cta" className="mt-6 inline-flex rounded-lg bg-blue-600 px-8 py-4 text-base font-semibold text-white hover:bg-blue-700">
          무료 진단 신청하기
        </Link>
      </section>
    </div>
  );
}
