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
  property_address: string;
  property_size: string;
  photo_urls: string;
  monthly_revenue_estimate: number;
  breakeven_occupancy: string;
  estimated_adr: number;
  proposal_content: string;
  proposal_sent_at: string | null;
  contacted_at: string | null;
  replied_at: string | null;
  diagnosed_at: string | null;
  contracted_at: string | null;
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

type TabType = "overview" | "pipeline" | "script" | "flow" | "offer" | "rejection";

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
          ["pipeline", "진행 기록"],
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

      {activeTab === "pipeline" && (
        <PipelineTab lead={lead} logs={logs} headers={headers} id={id!} onRefresh={fetchLead} />
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

const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(n);

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  status_change: { label: "상태 변경", color: "bg-gray-100 text-gray-700" },
  message_sent: { label: "메시지 발송", color: "bg-blue-100 text-blue-700" },
  reply_received: { label: "답장 수신", color: "bg-green-100 text-green-700" },
  diagnosis_note: { label: "진단 메모", color: "bg-purple-100 text-purple-700" },
  photos_collected: { label: "사진 수집", color: "bg-indigo-100 text-indigo-700" },
  revenue_calculated: { label: "매출 계산", color: "bg-yellow-100 text-yellow-700" },
  proposal_generated: { label: "제안서", color: "bg-orange-100 text-orange-700" },
  contract_signed: { label: "계약", color: "bg-red-100 text-red-700" },
};

function PipelineTab({
  lead,
  logs,
  headers,
  id,
  onRefresh,
}: {
  lead: Lead;
  logs: ActivityLog[];
  headers: Record<string, string>;
  id: string;
  onRefresh: () => void;
}) {
  const [msgText, setMsgText] = useState("");
  const [replyText, setReplyText] = useState("");
  const [diagNotes, setDiagNotes] = useState("");
  const [address, setAddress] = useState(lead.property_address || "");
  const [size, setSize] = useState(lead.property_size || "");
  const [photoURLs, setPhotoURLs] = useState(lead.photo_urls || "");
  const [adr, setAdr] = useState(lead.estimated_adr || 0);
  const [occRate, setOccRate] = useState(70);
  const [fixedCost, setFixedCost] = useState(0);
  const [revenueResult, setRevenueResult] = useState<Record<string, number | string> | null>(null);
  const [proposal, setProposal] = useState(lead.proposal_content || "");
  const [saving, setSaving] = useState("");

  const postAPI = async (endpoint: string, body: Record<string, unknown>) => {
    const res = await fetch(`/admin/marketing/leads/${id}/${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    return res;
  };

  const handleSave = async (step: string, fn: () => Promise<void>) => {
    setSaving(step);
    await fn();
    onRefresh();
    setSaving("");
  };

  const statusOrder = ["new", "contacted", "replied", "diagnosed", "proposal_sent", "contract_pending", "contracted"];
  const currentIdx = statusOrder.indexOf(lead.status);

  const isStepDone = (minIdx: number) => currentIdx >= minIdx;

  const stepLogs = (actions: string[]) => logs.filter((l) => actions.includes(l.action));

  return (
    <div className="space-y-4">
      {/* Step 5: 메시지 발송 */}
      <PipelineStep
        num={5}
        title="메시지 발송"
        done={isStepDone(1)}
        saving={saving === "msg"}
      >
        <textarea
          value={msgText}
          onChange={(e) => setMsgText(e.target.value)}
          placeholder="발송한 메시지 내용을 붙여넣으세요"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          rows={4}
        />
        <button
          onClick={() =>
            handleSave("msg", async () => {
              await postAPI("activity", { action: "message_sent", content: msgText });
              setMsgText("");
            })
          }
          disabled={!msgText.trim()}
          className="mt-2 rounded-md bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40"
        >
          발송 기록 저장
        </button>
        <LogList logs={stepLogs(["message_sent"])} />
      </PipelineStep>

      {/* Step 6: 답장/진단 */}
      <PipelineStep
        num={6}
        title="답장 수신 / 진단 상담"
        done={isStepDone(3)}
        saving={saving === "diag"}
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500">답장 내용</label>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="고객 답장 내용"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              rows={3}
            />
            <button
              onClick={() =>
                handleSave("diag", async () => {
                  await postAPI("activity", { action: "reply_received", content: replyText });
                  setReplyText("");
                })
              }
              disabled={!replyText.trim()}
              className="mt-1 rounded-md bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-40"
            >
              답장 기록
            </button>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">진단 메모</label>
            <textarea
              value={diagNotes}
              onChange={(e) => setDiagNotes(e.target.value)}
              placeholder="상담 결과, 고통 분석, 특이사항 등"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              rows={3}
            />
            <button
              onClick={() =>
                handleSave("diag", async () => {
                  await postAPI("diagnosis", { diagnosis_notes: diagNotes });
                  setDiagNotes("");
                })
              }
              disabled={!diagNotes.trim()}
              className="mt-1 rounded-md bg-purple-600 px-3 py-1 text-xs text-white hover:bg-purple-700 disabled:opacity-40"
            >
              진단 메모 저장
            </button>
          </div>
        </div>
        <LogList logs={stepLogs(["reply_received", "diagnosis_note"])} />
      </PipelineStep>

      {/* Step 7: 사진/주소 수집 */}
      <PipelineStep
        num={7}
        title="사진 / 주소 수집"
        done={!!lead.property_address || !!lead.photo_urls}
        saving={saving === "photo"}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500">숙소 주소</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="서울시 강동구..."
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">평수/면적</label>
            <input
              value={size}
              onChange={(e) => setSize(e.target.value)}
              placeholder="15평 / 49.5m²"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="mt-2">
          <label className="text-xs font-medium text-gray-500">사진 URL (줄바꿈으로 구분)</label>
          <textarea
            value={photoURLs}
            onChange={(e) => setPhotoURLs(e.target.value)}
            placeholder="https://..."
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            rows={3}
          />
        </div>
        <button
          onClick={() =>
            handleSave("photo", async () => {
              await postAPI("diagnosis", {
                property_address: address,
                property_size: size,
                photo_urls: photoURLs,
              });
            })
          }
          className="mt-2 rounded-md bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
        >
          수집 정보 저장
        </button>
        {lead.property_address && (
          <div className="mt-3 rounded-md bg-gray-50 p-3 text-xs text-gray-700">
            <p><strong>주소:</strong> {lead.property_address}</p>
            {lead.property_size && <p><strong>면적:</strong> {lead.property_size}</p>}
          </div>
        )}
        <LogList logs={stepLogs(["photos_collected"])} />
      </PipelineStep>

      {/* Step 8: 매출 계산 */}
      <PipelineStep
        num={8}
        title="예상 매출 / 손익분기 계산"
        done={lead.monthly_revenue_estimate > 0}
        saving={saving === "rev"}
      >
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500">일 평균 단가 (ADR)</label>
            <div className="mt-1 flex items-center gap-1">
              <span className="text-xs text-gray-400">₩</span>
              <input
                type="number"
                value={adr || ""}
                onChange={(e) => setAdr(Number(e.target.value))}
                placeholder="80000"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">목표 가동률 (%)</label>
            <input
              type="number"
              value={occRate || ""}
              onChange={(e) => setOccRate(Number(e.target.value))}
              placeholder="70"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">월 고정비</label>
            <div className="mt-1 flex items-center gap-1">
              <span className="text-xs text-gray-400">₩</span>
              <input
                type="number"
                value={fixedCost || ""}
                onChange={(e) => setFixedCost(Number(e.target.value))}
                placeholder="500000"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
        <button
          onClick={() =>
            handleSave("rev", async () => {
              const res = await postAPI("revenue", {
                adr,
                occupancy_rate: occRate,
                monthly_fixed_cost: fixedCost,
              });
              if (res.ok) setRevenueResult(await res.json());
            })
          }
          disabled={!adr || !occRate}
          className="mt-2 rounded-md bg-yellow-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-yellow-700 disabled:opacity-40"
        >
          계산하기
        </button>
        {(revenueResult || lead.monthly_revenue_estimate > 0) && (
          <div className="mt-3 grid grid-cols-2 gap-3 rounded-md bg-yellow-50 p-4">
            <div>
              <p className="text-xs text-gray-500">예상 월매출</p>
              <p className="text-lg font-bold text-gray-900">
                ₩{fmt(revenueResult?.monthly_revenue as number || lead.monthly_revenue_estimate)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">월 순수익</p>
              <p className="text-lg font-bold text-green-700">
                ₩{fmt(revenueResult?.monthly_net as number || (lead.monthly_revenue_estimate - fixedCost))}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">손익분기 가동률</p>
              <p className="text-sm font-bold text-gray-900">
                {(revenueResult?.breakeven_occupancy as string) || lead.breakeven_occupancy || "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">연간 예상 매출</p>
              <p className="text-sm font-bold text-gray-900">
                ₩{fmt(revenueResult?.annual_projection as number || lead.expected_revenue)}
              </p>
            </div>
          </div>
        )}
        <LogList logs={stepLogs(["revenue_calculated"])} />
      </PipelineStep>

      {/* Step 9: 제안서 */}
      <PipelineStep
        num={9}
        title="위탁운영 제안서 발송"
        done={!!lead.proposal_sent_at}
        saving={saving === "prop"}
      >
        <textarea
          value={proposal}
          onChange={(e) => setProposal(e.target.value)}
          placeholder={`${lead.name}님 숙소 위탁운영 제안서\n\n1. 숙소 현황 분석\n2. 예상 매출 및 손익분기\n3. 위탁운영 서비스 범위\n4. 수수료 구조\n5. 운영 시작 일정`}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          rows={8}
        />
        <button
          onClick={() =>
            handleSave("prop", async () => {
              await postAPI("proposal", { proposal_content: proposal });
            })
          }
          disabled={!proposal.trim()}
          className="mt-2 rounded-md bg-orange-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-orange-700 disabled:opacity-40"
        >
          제안서 발송 기록
        </button>
        {lead.proposal_sent_at && (
          <div className="mt-3 rounded-md bg-orange-50 p-3">
            <p className="text-xs text-orange-700">
              발송일: {new Date(lead.proposal_sent_at).toLocaleString("ko-KR")}
            </p>
            {lead.proposal_content && (
              <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-700">{lead.proposal_content}</pre>
            )}
          </div>
        )}
        <LogList logs={stepLogs(["proposal_generated"])} />
      </PipelineStep>

      {/* Step 10: 계약 */}
      <PipelineStep
        num={10}
        title="계약 완료 / 온보딩"
        done={lead.status === "contracted"}
        saving={saving === "contract"}
      >
        {lead.status === "contracted" ? (
          <div className="rounded-md bg-green-50 p-4 text-center">
            <p className="text-sm font-bold text-green-800">계약 완료</p>
            {lead.contracted_at && (
              <p className="mt-1 text-xs text-green-600">
                {new Date(lead.contracted_at).toLocaleString("ko-KR")}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            제안서 발송 후 계약이 확정되면, 상단 파이프라인에서 "계약완료"로 변경하세요.
          </p>
        )}
        <LogList logs={stepLogs(["contract_signed"])} />
      </PipelineStep>

      {/* 전체 활동 타임라인 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-800">전체 활동 타임라인</h3>
        {logs.length === 0 ? (
          <p className="text-sm text-gray-400">아직 활동 기록이 없습니다</p>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-2">
            {logs.map((log) => {
              const meta = ACTION_LABELS[log.action] || { label: log.action, color: "bg-gray-100 text-gray-700" };
              return (
                <div key={log.id} className="flex items-start gap-2 border-l-2 border-gray-200 pl-3 py-1">
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${meta.color}`}>
                    {meta.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-700 break-words">{log.content}</p>
                    <p className="text-[10px] text-gray-400">{new Date(log.created_at).toLocaleString("ko-KR")}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function PipelineStep({
  num,
  title,
  done,
  saving,
  children,
}: {
  num: number;
  title: string;
  done: boolean;
  saving: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            done ? "bg-green-600 text-white" : "border-2 border-gray-300 text-gray-400"
          }`}
        >
          {done ? "✓" : num}
        </span>
        <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
        {saving && <span className="text-xs text-gray-400">저장 중...</span>}
      </div>
      {children}
    </div>
  );
}

function LogList({ logs }: { logs: ActivityLog[] }) {
  if (logs.length === 0) return null;
  return (
    <div className="mt-3 border-t border-gray-100 pt-2">
      <p className="text-[10px] font-medium text-gray-400 uppercase mb-1">기록</p>
      <div className="space-y-1">
        {logs.slice(0, 5).map((log) => (
          <div key={log.id} className="text-xs text-gray-600">
            <span className="text-gray-400">{new Date(log.created_at).toLocaleString("ko-KR")}</span>
            {" — "}
            {log.content}
          </div>
        ))}
      </div>
    </div>
  );
}
