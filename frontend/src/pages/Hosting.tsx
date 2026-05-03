import { Link } from "react-router-dom";

const PAIN_SOLUTIONS = [
  {
    pain: "공실이 계속된다",
    real: "매달 관리비·대출이자만 나가는 손실 구조",
    solution: "단기숙박 전환으로 공실 기간에도 수익을 만듭니다",
  },
  {
    pain: "에어비앤비 시작이 막막하다",
    real: "사진, 가격, 등록 절차의 진입 장벽",
    solution: "세팅부터 첫 예약까지 전문가가 완료합니다",
  },
  {
    pain: "예약이 안 나온다",
    real: "사진/가격/채널 노출 중 하나가 문제",
    solution: "어디가 막히는지 진단하고 직접 고칩니다",
  },
  {
    pain: "청소/CS가 너무 힘들다",
    real: "새벽 체크인, 청소 노쇼, 게스트 클레임",
    solution: "내가 빠져도 돌아가는 운영 구조를 만듭니다",
  },
  {
    pain: "여러 채 관리가 안 된다",
    real: "채수 늘수록 관리 시간 기하급수적 증가",
    solution: "하나의 시스템으로 통합 관리, 리포트만 받으세요",
  },
  {
    pain: "정산이 불투명하다",
    real: "매출은 나오는데 내 손에 남는 게 적다",
    solution: "채널별 매출·비용·순수익을 투명하게 리포트합니다",
  },
];

export default function Hosting() {
  return (
    <div>
      <section className="bg-slate-950 px-6 py-20 text-center">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-widest text-blue-400">Customer Acquisition</p>
          <h1 className="text-4xl font-bold text-white md:text-5xl">숙소 운영자의 문제를 해결합니다</h1>
          <p className="mt-4 text-lg text-gray-400">
            공실, 운영 부담, 매출 문제 — 숙소 운영의 모든 고통에 답합니다.
          </p>
        </div>
      </section>

      {/* Pain → Solution */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-bold text-gray-900">고통에서 해결까지</h2>
          <div className="mt-12 space-y-6">
            {PAIN_SOLUTIONS.map((item, i) => (
              <div key={i} className="grid gap-4 rounded-xl border border-gray-200 p-6 md:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-red-500">고객의 말</p>
                  <p className="mt-1 text-base font-medium text-gray-900">"{item.pain}"</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-400">진짜 고통</p>
                  <p className="mt-1 text-sm text-gray-600">{item.real}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-blue-600">HIERO 해결</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{item.solution}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Target */}
      <section className="bg-slate-50 px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold text-gray-900">이런 분들을 위한 서비스입니다</h2>
          <div className="mt-10 grid gap-4 text-left md:grid-cols-2">
            {[
              "공실을 가진 오피스텔/빌라 임대인",
              "에어비앤비를 해보고 싶은 집주인",
              "매출이 낮은 기존 호스트",
              "청소/CS가 힘든 운영자",
              "여러 채를 관리하는 다주택자",
              "직접 운영 없이 수익을 원하는 투자자",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-white p-4 shadow-sm">
                <svg className="h-5 w-5 shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium text-gray-800">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 text-center">
        <h2 className="text-2xl font-bold text-gray-900">내 숙소 고민, 무료로 진단받으세요</h2>
        <p className="mt-3 text-base text-gray-500">계약을 권유하기 전에, 운영 가능성부터 확인해 드립니다.</p>
        <Link to="/#cta" className="mt-6 inline-flex rounded-lg bg-blue-600 px-8 py-4 text-base font-semibold text-white hover:bg-blue-700">
          무료 진단 신청하기
        </Link>
      </section>
    </div>
  );
}
