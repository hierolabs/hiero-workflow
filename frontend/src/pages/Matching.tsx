import { Link } from "react-router-dom";

const CHANNELS = [
  { name: "Airbnb", desc: "전 세계 여행자 대상, 체험형 숙소에 강점", color: "bg-red-50 text-red-700 border-red-200" },
  { name: "Booking.com", desc: "유럽/비즈니스 고객 비율 높음, 즉시 확정 예약", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { name: "Agoda", desc: "동남아/아시아 여행자 유입, 프로모션 중심", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { name: "삼삼엠투", desc: "국내 미드텀 고객 특화, 한 달 이상 장기 투숙", color: "bg-green-50 text-green-700 border-green-200" },
  { name: "리브애니웨어", desc: "국내 워케이션/한달살기 수요 플랫폼", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
];

export default function Matching() {
  return (
    <div>
      <section className="bg-slate-950 px-6 py-20 text-center">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-widest text-blue-400">Matching Platform</p>
          <h1 className="text-4xl font-bold text-white md:text-5xl">숙소노출 매칭플랫폼</h1>
          <p className="mt-4 text-lg text-gray-400">
            하나의 숙소를 5개 이상 OTA에 동시 노출하여 예약률을 극대화합니다.
          </p>
        </div>
      </section>

      {/* Channels */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-bold text-gray-900">운영 채널</h2>
          <p className="mt-3 text-center text-base text-gray-500">
            플랫폼별 고객 특성에 맞게 문구, 가격, 사진을 최적화합니다
          </p>
          <div className="mt-12 space-y-4">
            {CHANNELS.map((ch) => (
              <div key={ch.name} className={`rounded-xl border p-6 ${ch.color}`}>
                <h3 className="text-lg font-semibold">{ch.name}</h3>
                <p className="mt-1 text-sm opacity-80">{ch.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-slate-50 px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-bold text-gray-900">매칭 프로세스</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              { title: "채널별 문구 최적화", desc: "같은 숙소라도 플랫폼별 고객 의도가 다릅니다. 채널에 맞는 제목, 설명, 어필 포인트를 작성합니다." },
              { title: "통합 캘린더 관리", desc: "Hostex를 통해 모든 채널의 예약을 하나의 캘린더로 관리하여 중복 예약을 방지합니다." },
              { title: "채널별 성과 분석", desc: "어떤 채널에서 매출이 나오는지, 어디를 강화해야 하는지 데이터로 보여드립니다." },
            ].map((item, i) => (
              <div key={i} className="rounded-xl bg-white p-6 shadow-sm">
                <h3 className="text-base font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 text-center">
        <h2 className="text-2xl font-bold text-gray-900">내 숙소를 5개 채널에 동시 노출하세요</h2>
        <Link to="/#cta" className="mt-6 inline-flex rounded-lg bg-blue-600 px-8 py-4 text-base font-semibold text-white hover:bg-blue-700">
          무료 진단 신청하기
        </Link>
      </section>
    </div>
  );
}
