import { useState } from "react";
import {
  CUSTOMER_TYPES,
  FOLLOW_UP_QUESTIONS,
  SALES_SCRIPT,
  CONVERSATION_FLOW,
  PRODUCT_OFFER,
  SALES_PRINCIPLES,
  REJECTION_RESPONSES,
} from "./marketingData";

type ManualSection =
  | "overview"
  | "customers"
  | "pains"
  | "messages"
  | "script"
  | "flow"
  | "offer"
  | "rejection"
  | "process"
  | "scoring";

const SECTIONS: { key: ManualSection; label: string }[] = [
  { key: "overview", label: "전체 전략" },
  { key: "customers", label: "고객 유형 10가지" },
  { key: "pains", label: "고통 → 구매이유" },
  { key: "messages", label: "첫 연락 메시지" },
  { key: "script", label: "판매 스크립트" },
  { key: "flow", label: "대화 흐름" },
  { key: "offer", label: "상품 구조" },
  { key: "rejection", label: "거절 대응" },
  { key: "process", label: "영업 프로세스" },
  { key: "scoring", label: "리드 스코어링" },
];

export default function MarketingManual({ onClose }: { onClose: () => void }) {
  const [section, setSection] = useState<ManualSection>("overview");

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative m-auto flex h-[90vh] w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* Sidebar */}
        <div className="w-52 shrink-0 border-r border-gray-200 bg-gray-50 p-3 overflow-y-auto">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-800">마케팅 매뉴얼</h2>
            <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <nav className="space-y-0.5">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={`w-full rounded-md px-3 py-2 text-left text-xs font-medium transition ${
                  section === s.key
                    ? "bg-slate-900 text-white"
                    : "text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {section === "overview" && <OverviewSection />}
          {section === "customers" && <CustomersSection />}
          {section === "pains" && <PainsSection />}
          {section === "messages" && <MessagesSection />}
          {section === "script" && <ScriptSection />}
          {section === "flow" && <FlowSection />}
          {section === "offer" && <OfferSection />}
          {section === "rejection" && <RejectionSection />}
          {section === "process" && <ProcessSection />}
          {section === "scoring" && <ScoringSection />}
        </div>
      </div>
    </div>
  );
}

/* ========== Sections ========== */

function OverviewSection() {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-gray-900">HIERO 위탁운영 마케팅 전략</h3>

      <div className="rounded-lg bg-slate-50 p-4">
        <h4 className="text-sm font-semibold text-slate-800 mb-2">핵심 메시지</h4>
        <p className="text-sm text-slate-700 font-medium">
          "비어 있는 집을 자동으로 돈 버는 숙소로 바꿔준다."
        </p>
        <p className="mt-2 text-xs text-slate-600">
          우리는 집주인/호스트의 빈 공간을 사진·가격·채널·청소·CS·정산까지 운영해서
          매월 수익이 나는 숙소 상품으로 바꿔드립니다.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 p-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-3">6단계 마케팅 프레임워크</h4>
        <div className="space-y-3">
          {[
            { step: "1", title: "무엇을 만들지 찾는다", desc: "열정 말고, 돈을 내고 해결할 고통을 찾는다." },
            { step: "2", title: "강한 상품 제안을 만든다", desc: "기능이 아니라 변화를 판다." },
            { step: "3", title: "가격을 설계한다", desc: "싼 가격이 아니라, 고객이 진지해지는 가격을 잡는다." },
            { step: "4", title: "고객을 직접 찾는다", desc: "기다리지 말고, AI로 리드 리스트를 만들고 개인화 메시지를 보낸다." },
            { step: "5", title: "판매 대화를 한다", desc: "설명하지 말고, 질문해서 고객 스스로 문제와 필요를 말하게 한다." },
            { step: "6", title: "결제 직후 빠르게 가치를 준다", desc: "Time To First Value, 즉 첫 가치 도달 시간을 줄인다." },
          ].map((item) => (
            <div key={item.step} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs text-white">{item.step}</span>
              <div>
                <p className="text-sm font-medium text-gray-800">{item.title}</p>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 p-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-3">영업 원칙 4가지</h4>
        <ul className="space-y-2">
          {SALES_PRINCIPLES.map((p, i) => (
            <li key={i} className="flex gap-2 text-sm text-gray-700">
              <span className="text-slate-900 font-bold">•</span> {p}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-gray-200 p-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-3">호스트의 고통 요약</h4>
        <div className="grid grid-cols-2 gap-2">
          {[
            "공실이 난다",
            "사진을 못 찍는다",
            "가격을 못 잡는다",
            "청소 배정이 귀찮다",
            "CS가 스트레스다",
            "정산이 불투명하다",
            "OTA 운영법을 모른다",
            "숙소는 있는데 매출화가 안 된다",
          ].map((pain, i) => (
            <div key={i} className="rounded bg-red-50 px-3 py-1.5 text-xs text-red-700">
              {pain}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CustomersSection() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-gray-900">고객 유형 10가지</h3>
      <p className="text-xs text-gray-500">각 유형별 특성을 파악하고 맞춤 접근한다.</p>
      <div className="space-y-3">
        {CUSTOMER_TYPES.map((type) => (
          <div key={type.id} className="rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs text-white">{type.id}</span>
              <h4 className="text-sm font-semibold text-gray-800">{type.name}</h4>
            </div>
            <p className="text-xs text-gray-600 mb-2">{type.description}</p>
            <div className="rounded bg-gray-50 p-2">
              <p className="text-xs font-medium text-gray-500 mb-1">주요 고통:</p>
              <ul className="space-y-0.5">
                {type.pains.map((p, i) => (
                  <li key={i} className="text-xs text-gray-700">• {p}</li>
                ))}
              </ul>
            </div>
            <p className="mt-2 text-xs text-blue-700 font-medium">구매 이유: {type.buyReason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PainsSection() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-gray-900">고통 → 구매 이유 변환</h3>
      <p className="text-xs text-gray-500">고객이 말하는 표면 문제를 실제 구매 이유로 바꾼다.</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="pb-2 text-left text-xs font-semibold text-gray-500">표면 문제</th>
            <th className="pb-2 text-left text-xs font-semibold text-gray-500">진짜 고통</th>
            <th className="pb-2 text-left text-xs font-semibold text-gray-500">돈을 내는 이유</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {[
            { surface: "공실이 있어요", real: "매월 고정비 손실", pay: "손실을 수익으로 바꾸고 싶다" },
            { surface: "청소가 힘들어요", real: "운영 지속 불가능", pay: "내가 빠져도 돌아가는 구조" },
            { surface: "예약이 안 나요", real: "사진/가격/채널/후기 문제", pay: "전문가가 고쳐주면 된다" },
            { surface: "정산이 복잡해요", real: "신뢰와 투명성 문제", pay: "매월 깔끔한 리포트" },
            { surface: "시작을 못 하겠어요", real: "시행착오 두려움", pay: "검증된 시스템으로 시작" },
            { surface: "여러 채 관리가 안 돼요", real: "관리 시간 부족", pay: "하나의 시스템으로 통합 관리" },
            { surface: "수익이 불안정해요", real: "가격/채널 전략 부재", pay: "데이터 기반 최적화" },
            { surface: "다른 업체가 불투명했어요", real: "신뢰 깨짐", pay: "투명한 정산 + 빠른 소통" },
          ].map((row, i) => (
            <tr key={i}>
              <td className="py-2 text-xs text-red-700">{row.surface}</td>
              <td className="py-2 text-xs text-gray-700">{row.real}</td>
              <td className="py-2 text-xs text-blue-700 font-medium">{row.pay}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MessagesSection() {
  const [selected, setSelected] = useState(0);
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-gray-900">유형별 첫 연락 메시지</h3>
      <p className="text-xs text-gray-500">고객 유형을 선택하면 해당 메시지를 볼 수 있습니다.</p>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {CUSTOMER_TYPES.map((t, i) => (
          <button
            key={t.id}
            onClick={() => setSelected(i)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              selected === i ? "bg-slate-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>
      <div className="rounded-lg border border-gray-200 p-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-1">{CUSTOMER_TYPES[selected].name}</h4>
        <p className="text-xs text-gray-500 mb-3">{CUSTOMER_TYPES[selected].description}</p>
        <pre className="whitespace-pre-wrap rounded-md bg-blue-50 p-4 text-sm text-blue-900">
          {CUSTOMER_TYPES[selected].firstMessage}
        </pre>
        <button
          onClick={() => navigator.clipboard.writeText(CUSTOMER_TYPES[selected].firstMessage)}
          className="mt-3 rounded bg-gray-200 px-3 py-1 text-xs text-gray-700 hover:bg-gray-300"
        >
          메시지 복사
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 p-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-3">답장 후 이어갈 질문 5개</h4>
        <div className="space-y-2">
          {FOLLOW_UP_QUESTIONS.map((q, i) => (
            <div key={i} className="flex gap-3 rounded bg-gray-50 p-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] text-white">{i + 1}</span>
              <div>
                <p className="text-xs font-medium text-gray-800">{q.question}</p>
                <p className="text-[10px] text-gray-500">목적: {q.purpose}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScriptSection() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-gray-900">판매 대화 스크립트</h3>
      <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 mb-4">
        <p className="text-xs font-medium text-yellow-800">핵심 원칙: 설명하지 말고 질문한다. 고객이 자기 문제를 말하게 한다.</p>
      </div>
      <div className="space-y-4">
        {SALES_SCRIPT.map((item, i) => (
          <div key={i} className="rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs text-white">{i + 1}</span>
              <span className="text-sm font-semibold text-gray-800">{item.stage}</span>
              <span className="ml-auto rounded bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">{item.note}</span>
            </div>
            <pre className="whitespace-pre-wrap rounded-md bg-blue-50 p-3 text-sm text-blue-900">{item.question}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}

function FlowSection() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-gray-900">상담 예약까지의 대화 흐름</h3>
      <div className="relative">
        {CONVERSATION_FLOW.map((step, i) => (
          <div key={i} className="relative pl-8 pb-6">
            {i < CONVERSATION_FLOW.length - 1 && (
              <div className="absolute left-3 top-6 h-full w-0.5 bg-gray-300" />
            )}
            <div className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs text-white">
              {step.step}
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <h4 className="text-sm font-semibold text-gray-800">{step.name}</h4>
              <p className="mt-1 text-sm text-gray-700">{step.action}</p>
              <p className="mt-1 text-xs text-blue-700">{step.tip}</p>
              {step.trigger !== "완료" && (
                <p className="mt-2 text-xs text-gray-400">→ 다음 트리거: {step.trigger}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OfferSection() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-gray-900">{PRODUCT_OFFER.name}</h3>
      <div className="space-y-4">
        <Block title="대상" content={PRODUCT_OFFER.target} />
        <Block title="핵심 약속" content={PRODUCT_OFFER.promise} highlight />
        <Block title="보증" content={PRODUCT_OFFER.guarantee} />
        <div className="rounded-lg border border-gray-200 p-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">제공 서비스</h4>
          <ul className="grid grid-cols-2 gap-1.5">
            {PRODUCT_OFFER.services.map((s, i) => (
              <li key={i} className="text-sm text-gray-700">• {s}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">보너스</h4>
          <ul className="space-y-1">
            {PRODUCT_OFFER.bonuses.map((b, i) => (
              <li key={i} className="text-sm text-green-700">+ {b}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <h4 className="text-xs font-semibold text-red-600 uppercase mb-1">희소성</h4>
          <p className="text-sm text-red-800">{PRODUCT_OFFER.scarcity}</p>
        </div>
        <div className="rounded-lg bg-slate-900 p-4 text-center">
          <p className="text-sm font-bold text-white">CTA: {PRODUCT_OFFER.cta}</p>
        </div>
      </div>
    </div>
  );
}

function RejectionSection() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-gray-900">거절 대응 스크립트</h3>
      <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 mb-4">
        <p className="text-xs font-medium text-yellow-800">원칙: 무리하게 설득하지 않고, 작은 다음 단계를 제안한다.</p>
      </div>
      <div className="space-y-3">
        {Object.entries(REJECTION_RESPONSES).map(([objection, response], i) => (
          <div key={i} className="rounded-lg border border-gray-200 p-4">
            <p className="text-sm font-medium text-red-700">고객: "{objection}"</p>
            <p className="mt-2 text-sm text-gray-700">→ {response}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProcessSection() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-gray-900">영업 실행 프로세스 10단계</h3>
      <div className="space-y-3">
        {[
          { step: 1, title: "위탁운영 상품 문장 확정", desc: "핵심 약속과 변화를 한 문장으로 정리" },
          { step: 2, title: "타겟 고객 5개 유형 정리", desc: "우선순위 높은 유형부터 공략" },
          { step: 3, title: "고객별 첫 연락 메시지 작성", desc: "유형별 개인화 메시지 템플릿" },
          { step: 4, title: "50명 리스트 만들기", desc: "네이버 카페, 에어비앤비, 부동산 커뮤니티에서 수집" },
          { step: 5, title: "하루 20명씩 개인화 메시지 발송", desc: "복사 붙여넣기가 아닌 맞춤 메시지" },
          { step: 6, title: "답장 온 사람만 진단 상담", desc: "질문으로 고통을 끌어낸다" },
          { step: 7, title: "상담 후 숙소 사진/주소 받기", desc: "다음 단계를 작게 만든다" },
          { step: 8, title: "예상 매출/손익분기 계산", desc: "숫자로 가치를 보여준다" },
          { step: 9, title: "위탁운영 제안서 발송", desc: "진단 결과 + 운영안 + 예상 수익" },
          { step: 10, title: "계약되면 HIERO 온보딩 Task 생성", desc: "사진촬영→채널등록→가격설정→첫 예약" },
        ].map((item) => (
          <div key={item.step} className="flex gap-3 rounded-lg border border-gray-200 p-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs text-white font-bold">{item.step}</span>
            <div>
              <p className="text-sm font-medium text-gray-800">{item.title}</p>
              <p className="text-xs text-gray-500">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoringSection() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-gray-900">리드 스코어링 기준</h3>
      <div className="rounded-lg border border-gray-200 p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="pb-2 text-left text-xs font-semibold text-gray-500">조건</th>
              <th className="pb-2 text-right text-xs font-semibold text-gray-500">점수</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {[
              { condition: "공실 문제 있음", score: "+30" },
              { condition: "운영 부담 있음", score: "+25" },
              { condition: "매출 문제 있음", score: "+25" },
              { condition: "서울/수도권 지역", score: "+10" },
              { condition: "오피스텔/다가구/빌라/도생/단독주택", score: "+10" },
              { condition: "사진 보유", score: "+5" },
              { condition: "즉시 운영 가능", score: "+15" },
            ].map((row, i) => (
              <tr key={i}>
                <td className="py-2 text-sm text-gray-700">{row.condition}</td>
                <td className="py-2 text-right text-sm font-bold text-slate-900">{row.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-gray-200 p-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-3">등급별 액션</h4>
        <div className="space-y-2">
          {[
            { grade: "A", range: "90점 이상", action: "즉시 전화 상담 → 사진/주소 수집", color: "bg-red-100 text-red-800" },
            { grade: "B", range: "70~89점", action: "개인화 메시지 발송 → 답장 시 진단 상담", color: "bg-orange-100 text-orange-800" },
            { grade: "C", range: "50~69점", action: "위탁운영 사례 콘텐츠 발송 → 3일 후 후속 연락", color: "bg-yellow-100 text-yellow-800" },
            { grade: "D", range: "50점 미만", action: "DB 저장 → 추후 육성", color: "bg-gray-100 text-gray-800" },
          ].map((item) => (
            <div key={item.grade} className="flex items-center gap-3">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${item.color}`}>{item.grade}</span>
              <span className="text-xs text-gray-500 w-16">{item.range}</span>
              <span className="text-sm text-gray-700">{item.action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ========== Helpers ========== */

function Block({ title, content, highlight }: { title: string; content: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">{title}</h4>
      <p className={`text-sm ${highlight ? "font-medium text-slate-900" : "text-gray-800"}`}>{content}</p>
    </div>
  );
}
