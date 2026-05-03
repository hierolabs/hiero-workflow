import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  CUSTOMER_TYPES,
  FOLLOW_UP_QUESTIONS,
  SALES_SCRIPT,
  CONVERSATION_FLOW,
  PRODUCT_OFFER,
  SALES_PRINCIPLES,
  REJECTION_RESPONSES,
} from "../features/leads/marketingData";
import MarketingManual from "../features/leads/MarketingManual";

interface Lead {
  id: number;
  name: string;
  phone: string;
  email: string;
  area: string;
  property_type: string;
  current_status: string;
  pain_point: string;
  expected_revenue: number;
  contact_channel: string;
  status: string;
  has_vacancy: boolean;
  has_operation_pain: boolean;
  has_revenue_pain: boolean;
  has_photos: boolean;
  ready_to_operate: boolean;
  lead_score: number;
  lead_grade: string;
  next_action: string;
  memo: string;
}

interface ActivityLog {
  id: number;
  action: string;
  content: string;
  created_at: string;
}

const STATUS_FLOW: string[] = [
  "new", "contacted", "replied", "diagnosed", "proposal_sent", "contract_pending", "contracted",
];

const STATUS_LABELS: Record<string, string> = {
  new: "신규",
  contacted: "연락완료",
  replied: "답장받음",
  diagnosed: "진단완료",
  proposal_sent: "제안서발송",
  contract_pending: "계약대기",
  contracted: "계약완료",
  rejected: "거절",
};

type TabType = "overview" | "script" | "flow" | "offer" | "rejection";

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState<Lead | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [showManual, setShowManual] = useState(false);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => {
    fetchLead();
  }, [id]);

  const fetchLead = async () => {
    const res = await fetch(`/admin/marketing/leads/${id}`, { headers });
    if (res.ok) {
      const data = await res.json();
      setLead(data.lead);
      setLogs(data.activity_logs || []);
    }
    setLoading(false);
  };

  const updateStatus = async (status: string) => {
    await fetch(`/admin/marketing/leads/${id}/status`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status }),
    });
    fetchLead();
  };

  const generateMessage = async () => {
    const res = await fetch(`/admin/marketing/leads/${id}/message`, {
      method: "POST",
      headers,
    });
    if (res.ok) {
      const data = await res.json();
      setMessage(data.message);
    }
  };

  if (loading) return <div className="p-6 text-gray-500">로딩 중...</div>;
  if (!lead) return <div className="p-6 text-red-500">리드를 찾을 수 없습니다</div>;

  const currentIdx = STATUS_FLOW.indexOf(lead.status);

  // 리드의 고통에 매칭되는 고객 유형 찾기
  const matchedType = CUSTOMER_TYPES.find((t) =>
    lead.pain_point?.includes(t.pains[0]?.slice(0, 4) || "") ||
    t.description.includes(lead.property_type || "")
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <button onClick={() => navigate("/leads")} className="text-sm text-gray-500 hover:text-gray-700">
            &larr; 리드 목록
          </button>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{lead.name}</h1>
          <p className="text-sm text-gray-500">{lead.area} / {lead.property_type} / {lead.contact_channel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowManual(true)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            매뉴얼
          </button>
          <span className="rounded-full bg-slate-900 px-4 py-1.5 text-sm font-bold text-white">
            {lead.lead_grade}급 · {lead.lead_score}점
          </span>
        </div>
      </div>

      {/* Status Pipeline */}
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1.5">
        {STATUS_FLOW.map((s, i) => (
          <button
            key={s}
            onClick={() => updateStatus(s)}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
              i <= currentIdx ? "bg-slate-900 text-white" : "bg-white text-gray-500 hover:bg-gray-200"
            }`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
        <button
          onClick={() => updateStatus("rejected")}
          className={`rounded-md px-2 py-1.5 text-xs font-medium ${
            lead.status === "rejected" ? "bg-red-600 text-white" : "bg-white text-red-500 hover:bg-red-50"
          }`}
        >
          거절
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        {([
          ["overview", "고객분석"],
          ["script", "판매 스크립트"],
          ["flow", "대화 흐름"],
          ["offer", "상품 제안"],
          ["rejection", "거절 대응"],
        ] as [TabType, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === key
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            {/* 고객 고통 */}
            <Section title="고객 고통 분석">
              <p className="text-sm text-gray-700"><strong>현재 상황:</strong> {lead.current_status}</p>
              <p className="mt-2 text-sm text-gray-700"><strong>핵심 고통:</strong> {lead.pain_point}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {lead.has_vacancy && <Tag text="공실" color="red" />}
                {lead.has_operation_pain && <Tag text="운영부담" color="orange" />}
                {lead.has_revenue_pain && <Tag text="매출문제" color="yellow" />}
                {lead.has_photos && <Tag text="사진보유" color="green" />}
                {lead.ready_to_operate && <Tag text="즉시운영가능" color="blue" />}
              </div>
              {matchedType && (
                <div className="mt-4 rounded-md bg-blue-50 p-3">
                  <p className="text-xs font-semibold text-blue-800">매칭 유형: {matchedType.name}</p>
                  <p className="mt-1 text-xs text-blue-700">{matchedType.description}</p>
                  <ul className="mt-2 space-y-1">
                    {matchedType.pains.map((p, i) => (
                      <li key={i} className="text-xs text-blue-700">• {p}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-blue-900 font-medium">구매 이유: {matchedType.buyReason}</p>
                </div>
              )}
            </Section>

            {/* 다음 액션 */}
            <Section title="다음 액션">
              <p className="text-sm font-medium text-slate-800">{lead.next_action}</p>
            </Section>

            {/* 첫 연락 메시지 */}
            <Section title="첫 연락 메시지">
              {!message ? (
                <div className="space-y-3">
                  <button onClick={generateMessage} className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
                    이 리드에 맞는 메시지 생성
                  </button>
                  {matchedType && (
                    <div className="rounded-md bg-gray-50 p-3">
                      <p className="text-xs text-gray-500 mb-2">유형별 템플릿 미리보기:</p>
                      <pre className="whitespace-pre-wrap text-xs text-gray-600">
                        {matchedType.firstMessage
                          .replace("{name}", lead.name || "OO")
                          .replace("{area}", lead.area || "해당 지역")}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <pre className="whitespace-pre-wrap rounded-md bg-gray-50 p-4 text-sm text-gray-700">{message}</pre>
                  <button
                    onClick={() => navigator.clipboard.writeText(message)}
                    className="mt-2 rounded bg-gray-200 px-3 py-1 text-xs text-gray-700 hover:bg-gray-300"
                  >
                    복사하기
                  </button>
                </div>
              )}
            </Section>

            {/* 후속 질문 */}
            <Section title="답장 후 이어갈 질문 5개">
              <div className="space-y-3">
                {FOLLOW_UP_QUESTIONS.map((q, i) => (
                  <div key={i} className="flex gap-3 rounded-md bg-gray-50 p-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs text-white">{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{q.question}</p>
                      <p className="mt-0.5 text-xs text-gray-500">목적: {q.purpose}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          {/* 사이드바 */}
          <div className="space-y-4">
            <Section title="영업 원칙">
              <ul className="space-y-2">
                {SALES_PRINCIPLES.map((p, i) => (
                  <li key={i} className="text-xs text-gray-700 leading-relaxed">• {p}</li>
                ))}
              </ul>
            </Section>

            <Section title="활동 기록">
              {logs.length === 0 ? (
                <p className="text-sm text-gray-400">아직 활동 기록이 없습니다</p>
              ) : (
                <ul className="space-y-2">
                  {logs.map((log) => (
                    <li key={log.id} className="border-l-2 border-gray-200 pl-3">
                      <p className="text-xs text-gray-400">{new Date(log.created_at).toLocaleString("ko-KR")}</p>
                      <p className="text-xs text-gray-700">{log.action}: {log.content}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="고객 유형 10가지">
              <ul className="space-y-1.5">
                {CUSTOMER_TYPES.map((t) => (
                  <li key={t.id} className="text-xs text-gray-600">
                    <span className="font-medium">{t.id}. {t.name}</span> — {t.description}
                  </li>
                ))}
              </ul>
            </Section>
          </div>
        </div>
      )}

      {activeTab === "script" && (
        <div className="space-y-4">
          <Section title="판매 대화 스크립트 — 질문으로 판다">
            <p className="mb-4 text-xs text-gray-500">설명하지 말고 질문한다. 고객이 자기 문제를 말하게 한다.</p>
            <div className="space-y-4">
              {SALES_SCRIPT.map((item, i) => (
                <div key={i} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs text-white">{i + 1}</span>
                    <span className="text-sm font-semibold text-gray-800">{item.stage}</span>
                    <span className="ml-auto text-xs text-gray-400">{item.note}</span>
                  </div>
                  <pre className="whitespace-pre-wrap rounded-md bg-blue-50 p-3 text-sm text-blue-900">{item.question}</pre>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {activeTab === "flow" && (
        <div className="space-y-4">
          <Section title="상담 예약까지의 대화 흐름">
            <div className="relative">
              {CONVERSATION_FLOW.map((step, i) => (
                <div key={i} className="relative pl-8 pb-6">
                  {i < CONVERSATION_FLOW.length - 1 && (
                    <div className="absolute left-3 top-6 h-full w-0.5 bg-gray-200" />
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
          </Section>
        </div>
      )}

      {activeTab === "offer" && (
        <div className="space-y-4">
          <Section title={PRODUCT_OFFER.name}>
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase">대상</h4>
                <p className="mt-1 text-sm text-gray-800">{PRODUCT_OFFER.target}</p>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase">핵심 약속</h4>
                <p className="mt-1 text-sm font-medium text-slate-900">{PRODUCT_OFFER.promise}</p>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase">보증</h4>
                <p className="mt-1 text-sm text-gray-800">{PRODUCT_OFFER.guarantee}</p>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase">제공 서비스</h4>
                <ul className="mt-1 grid grid-cols-2 gap-1">
                  {PRODUCT_OFFER.services.map((s, i) => (
                    <li key={i} className="text-sm text-gray-700">• {s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase">보너스</h4>
                <ul className="mt-1 space-y-1">
                  {PRODUCT_OFFER.bonuses.map((b, i) => (
                    <li key={i} className="text-sm text-green-700">+ {b}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase">희소성</h4>
                <p className="mt-1 text-sm text-red-700">{PRODUCT_OFFER.scarcity}</p>
              </div>
              <div className="rounded-md bg-slate-900 p-4 text-center">
                <p className="text-sm font-bold text-white">{PRODUCT_OFFER.cta}</p>
              </div>
            </div>
          </Section>
        </div>
      )}

      {activeTab === "rejection" && (
        <div className="space-y-4">
          <Section title="거절 대응 스크립트">
            <p className="mb-4 text-xs text-gray-500">고객이 거절할 때 무리하게 설득하지 않고, 작은 다음 단계를 제안한다.</p>
            <div className="space-y-3">
              {Object.entries(REJECTION_RESPONSES).map(([objection, response], i) => (
                <div key={i} className="rounded-lg border border-gray-200 p-4">
                  <p className="text-sm font-medium text-red-700">고객: "{objection}"</p>
                  <p className="mt-2 text-sm text-gray-700">→ {response}</p>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {showManual && <MarketingManual onClose={() => setShowManual(false)} />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-800">{title}</h3>
      {children}
    </div>
  );
}

function Tag({ text, color }: { text: string; color: string }) {
  const colors: Record<string, string> = {
    red: "bg-red-100 text-red-700",
    orange: "bg-orange-100 text-orange-700",
    yellow: "bg-yellow-100 text-yellow-700",
    green: "bg-green-100 text-green-700",
    blue: "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[color] || ""}`}>
      {text}
    </span>
  );
}
