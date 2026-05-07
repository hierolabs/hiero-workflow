import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MarketingManual from "../features/leads/MarketingManual";

interface Lead {
  id: number;
  name: string;
  area: string;
  property_type: string;
  pain_point: string;
  current_status: string;
  status: string;
  lead_score: number;
  lead_grade: string;
  next_action: string;
  contact_channel: string;
  has_vacancy: boolean;
  has_operation_pain: boolean;
  has_revenue_pain: boolean;
  created_at: string;
}

interface DashboardStats {
  total_leads: number;
  new_leads: number;
  contacted_leads: number;
  replied_leads: number;
  contracted_leads: number;
  today_contact_list: Lead[];
}

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

const GRADE_COLORS: Record<string, string> = {
  A: "bg-red-100 text-red-800",
  B: "bg-orange-100 text-orange-800",
  C: "bg-yellow-100 text-yellow-800",
  D: "bg-gray-100 text-gray-800",
};

type LaunchTab = 'investor' | 'property' | 'platform';

export default function Leads() {
  const [tab, setTab] = useState<LaunchTab>('investor');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">신규런칭</h1>
        <p className="mt-1 text-sm text-gray-500">투자자 확보 → 숙소 세팅 → 플랫폼 등록</p>
      </div>

      <div className="mb-4 flex gap-1 border-b border-gray-200">
        {([
          { key: 'investor' as LaunchTab, label: '투자자', desc: '리드·상담·계약' },
          { key: 'property' as LaunchTab, label: '숙소', desc: '세팅·촬영·등록' },
          { key: 'platform' as LaunchTab, label: '플랫폼', desc: '온보딩·URL·최적화' },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              tab === t.key
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {t.label}
            <span className="ml-1 text-xs text-gray-400">{t.desc}</span>
          </button>
        ))}
      </div>

      {tab === 'investor' && <InvestorTab />}
      {tab === 'property' && <PropertyTab />}
      {tab === 'platform' && <PlatformTab />}
    </div>
  );
}

// ===================== 탭 1. 투자자 (기존 Leads) =====================
function InvestorTab() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState({ status: "", grade: "" });
  const [showForm, setShowForm] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const navigate = useNavigate();

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => {
    Promise.all([fetchDashboard(), fetchLeads()]);
  }, [filter]);

  const fetchDashboard = async () => {
    const res = await fetch("/admin/marketing/dashboard", { headers });
    if (res.ok) setStats(await res.json());
  };

  const fetchLeads = async () => {
    const params = new URLSearchParams();
    if (filter.status) params.set("status", filter.status);
    if (filter.grade) params.set("grade", filter.grade);
    const res = await fetch(`/admin/marketing/leads?${params}`, { headers });
    if (res.ok) {
      const data = await res.json();
      setLeads(data.leads || []);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">투자자 관리</h2>
          <p className="mt-1 text-sm text-gray-500">위탁운영 리드 관리 및 영업 자동화</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowManual(true)}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            마케팅 매뉴얼
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            + 리드 추가
          </button>
        </div>
      </div>

      {/* Dashboard Stats */}
      {stats && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="전체 리드" value={stats.total_leads} />
          <StatCard label="신규" value={stats.new_leads} color="blue" />
          <StatCard label="연락완료" value={stats.contacted_leads} color="yellow" />
          <StatCard label="답장받음" value={stats.replied_leads} color="green" />
          <StatCard label="계약완료" value={stats.contracted_leads} color="red" />
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex gap-3">
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">전체 상태</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={filter.grade}
          onChange={(e) => setFilter({ ...filter, grade: e.target.value })}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">전체 등급</option>
          <option value="A">A급 - 즉시 상담</option>
          <option value="B">B급 - 우선 연락</option>
          <option value="C">C급 - 콘텐츠 육성</option>
          <option value="D">D급 - 보류</option>
        </select>
      </div>

      {/* Lead Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">등급</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">이름</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">지역</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">유형</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">고통</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">상태</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">점수</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">다음 액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {leads.map((lead) => (
              <tr
                key={lead.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => navigate(`/leads/${lead.id}`)}
              >
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${GRADE_COLORS[lead.lead_grade] || ""}`}>
                    {lead.lead_grade}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{lead.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{lead.area}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{lead.property_type}</td>
                <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">{lead.pain_point}</td>
                <td className="px-4 py-3">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                    {STATUS_LABELS[lead.status] || lead.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-gray-900">{lead.lead_score}</td>
                <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate">{lead.next_action}</td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">
                  등록된 리드가 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Lead Modal */}
      {showForm && (
        <CreateLeadModal
          headers={headers}
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); fetchLeads(); fetchDashboard(); }}
        />
      )}

      {showManual && <MarketingManual onClose={() => setShowManual(false)} />}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  const colors: Record<string, string> = {
    blue: "border-l-blue-500",
    yellow: "border-l-yellow-500",
    green: "border-l-green-500",
    red: "border-l-red-500",
  };
  return (
    <div className={`rounded-lg border border-gray-200 border-l-4 bg-white p-4 shadow-sm ${color ? colors[color] : "border-l-gray-300"}`}>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function CreateLeadModal({
  headers,
  onClose,
  onCreated,
}: {
  headers: Record<string, string>;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    area: "",
    property_type: "오피스텔",
    current_status: "",
    pain_point: "",
    contact_channel: "카카오톡",
    has_vacancy: false,
    has_operation_pain: false,
    has_revenue_pain: false,
    has_photos: false,
    ready_to_operate: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/admin/marketing/leads", {
      method: "POST",
      headers,
      body: JSON.stringify(form),
    });
    if (res.ok) onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold">새 리드 등록</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="이름" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded border px-3 py-2 text-sm" required />
            <input placeholder="전화번호" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded border px-3 py-2 text-sm" />
            <input placeholder="지역 (예: 서울 강동구)" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} className="rounded border px-3 py-2 text-sm" required />
            <select value={form.property_type} onChange={(e) => setForm({ ...form, property_type: e.target.value })} className="rounded border px-3 py-2 text-sm">
              <option>오피스텔</option>
              <option>다가구</option>
              <option>빌라</option>
              <option>도시형생활주택</option>
              <option>단독주택</option>
              <option>아파트</option>
            </select>
          </div>
          <input placeholder="현재 상황" value={form.current_status} onChange={(e) => setForm({ ...form, current_status: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" />
          <input placeholder="고통/문제점" value={form.pain_point} onChange={(e) => setForm({ ...form, pain_point: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" />
          <select value={form.contact_channel} onChange={(e) => setForm({ ...form, contact_channel: e.target.value })} className="w-full rounded border px-3 py-2 text-sm">
            <option>카카오톡</option>
            <option>문자</option>
            <option>전화</option>
            <option>이메일</option>
          </select>

          <div className="flex flex-wrap gap-4 pt-2">
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={form.has_vacancy} onChange={(e) => setForm({ ...form, has_vacancy: e.target.checked })} /> 공실 있음
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={form.has_operation_pain} onChange={(e) => setForm({ ...form, has_operation_pain: e.target.checked })} /> 운영 부담
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={form.has_revenue_pain} onChange={(e) => setForm({ ...form, has_revenue_pain: e.target.checked })} /> 매출 문제
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={form.has_photos} onChange={(e) => setForm({ ...form, has_photos: e.target.checked })} /> 사진 보유
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={form.ready_to_operate} onChange={(e) => setForm({ ...form, ready_to_operate: e.target.checked })} /> 즉시 운영 가능
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm">취소</button>
            <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">등록</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ===================== 탭 2. 숙소 라이프사이클 =====================
const API_URL = import.meta.env.VITE_API_URL;

const LIFECYCLE_STAGES = [
  { key: 'lead', label: 'Lead', phase: '공급 확보', color: 'bg-pink-100 text-pink-700' },
  { key: 'meeting', label: 'Meeting', phase: '공급 확보', color: 'bg-pink-100 text-pink-700' },
  { key: 'negotiating', label: '협상', phase: '공급 확보', color: 'bg-pink-100 text-pink-700' },
  { key: 'contracted', label: '계약', phase: '공급 확보', color: 'bg-indigo-100 text-indigo-700' },
  { key: 'setting', label: '세팅', phase: '공간 제작', color: 'bg-amber-100 text-amber-700' },
  { key: 'filming', label: '촬영', phase: '공간 제작', color: 'bg-amber-100 text-amber-700' },
  { key: 'ota_registering', label: 'OTA등록', phase: '디지털 배포', color: 'bg-violet-100 text-violet-700' },
  { key: 'operation_ready', label: '준비완료', phase: '디지털 배포', color: 'bg-violet-100 text-violet-700' },
  { key: 'active', label: 'Active', phase: '운영', color: 'bg-emerald-100 text-emerald-700' },
];

interface PipelineData {
  lead: number; meeting: number; negotiating: number; contracted: number;
  setting: number; filming: number; ota_registering: number; operation_ready: number;
  active: number; paused: number; closed: number; bottleneck_count: number;
}

function PropertyTab() {
  const [pipeline, setPipeline] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch(`${API_URL}/lifecycle/pipeline`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(setPipeline)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center text-gray-400 py-8">로딩 중...</div>;

  return (
    <div className="space-y-6">
      {/* 파이프라인 요약 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-700">공급 파이프라인</h2>
          {pipeline && pipeline.bottleneck_count > 0 && (
            <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
              병목 {pipeline.bottleneck_count}건
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {LIFECYCLE_STAGES.map(stage => {
            const count = pipeline ? (pipeline as Record<string, number>)[stage.key] || 0 : 0;
            return (
              <div key={stage.key} className="flex-1 text-center">
                <div className={`rounded-lg py-3 ${stage.color} ${count > 0 ? 'font-bold' : 'opacity-40'}`}>
                  <div className="text-lg">{count}</div>
                  <div className="text-[10px]">{stage.label}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-1 mt-1">
          {LIFECYCLE_STAGES.map((_, i) => (
            <div key={i} className="flex-1 flex justify-center">
              {i < LIFECYCLE_STAGES.length - 1 && <span className="text-gray-300 text-xs">→</span>}
            </div>
          ))}
        </div>
      </div>

      {/* 안내 */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-sm text-gray-500">
        <p className="font-semibold text-gray-700 mb-2">숙소별 상세 관리</p>
        <p>공간 관리 페이지에서 개별 숙소를 선택하면 라이프사이클 상태 변경, 온보딩 체크리스트, 플랫폼 등록 현황을 관리할 수 있습니다.</p>
      </div>
    </div>
  );
}

// ===================== 탭 3. 플랫폼 온보딩 =====================
const PLATFORMS = [
  { key: 'hostex', name: 'Hostex', color: 'bg-blue-100 text-blue-800', url: 'https://app.hostex.io' },
  { key: 'airbnb', name: 'Airbnb', color: 'bg-red-100 text-red-800', url: 'https://airbnb.com' },
  { key: 'booking', name: 'Booking.com', color: 'bg-blue-100 text-blue-800', url: 'https://admin.booking.com' },
  { key: 'agoda', name: 'Agoda', color: 'bg-purple-100 text-purple-800', url: 'https://ycs.agoda.com' },
  { key: '33m2', name: '삼삼엠투', color: 'bg-emerald-100 text-emerald-800', url: 'https://33m2.co.kr/webmobile/host/home' },
  { key: 'liv', name: '리브애니웨어', color: 'bg-cyan-100 text-cyan-800', url: 'https://console.liveanywhere.me' },
  { key: 'jaritalk', name: '자리톡', color: 'bg-amber-100 text-amber-800', url: 'https://jaritalk.com' },
  { key: 'naver', name: '네이버 플레이스', color: 'bg-green-100 text-green-800', url: 'https://new-m.place.naver.com' },
];

const ONBOARDING_PHASES = [
  {
    phase: 1, label: '물리 세팅', assignee: '현장',
    items: ['인테리어 완료', '가구/가전 배치', '어메니티/비품 세팅', '사진 촬영 (10장+)', '도어락 설정', '와이파이 설정'],
  },
  {
    phase: 2, label: 'HIERO 등록', assignee: '현장',
    items: ['숙소 코드 생성', '기본 정보 입력', '소유 구조 설정', '비용 설정', '운영 변수 입력'],
  },
  {
    phase: 3, label: '플랫폼 등록', assignee: '마케팅',
    items: PLATFORMS.map(p => `${p.name} 등록`),
  },
  {
    phase: 4, label: '리스팅 최적화', assignee: '마케팅',
    items: ['대표사진 설정', '제목 작성', '설명문 작성', '가격 설정', '최소 숙박일 설정', 'SEO 확인'],
  },
  {
    phase: 5, label: '운영 준비', assignee: '운영',
    items: ['체크인 안내 메시지', '하우스룰 설정', '청소 스케줄 등록', '첫 예약 수신 확인'],
  },
];

function PlatformTab() {
  return (
    <div className="space-y-6">
      {/* 플랫폼 바로가기 */}
      <div>
        <h2 className="text-sm font-bold text-gray-700 mb-3">플랫폼 바로가기</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PLATFORMS.map(p => (
            <a
              key={p.key}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition flex items-center gap-3"
            >
              <span className={`px-2 py-1 rounded text-xs font-bold ${p.color}`}>{p.name.charAt(0)}</span>
              <div>
                <div className="text-sm font-semibold text-gray-900">{p.name}</div>
                <div className="text-[10px] text-gray-400">호스트 페이지 열기</div>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* 온보딩 체크리스트 */}
      <div>
        <h2 className="text-sm font-bold text-gray-700 mb-3">신규 숙소 온보딩 체크리스트</h2>
        <div className="space-y-4">
          {ONBOARDING_PHASES.map(phase => (
            <div key={phase.phase} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold text-gray-200">{String(phase.phase).padStart(2, '0')}</span>
                  <div>
                    <span className="text-sm font-bold text-gray-900">{phase.label}</span>
                    <span className="text-xs text-gray-400 ml-2">담당: {phase.assignee}</span>
                  </div>
                </div>
                <span className="text-xs text-gray-400">{phase.items.length}개 항목</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {phase.items.map(item => (
                  <label key={item} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-100 transition">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
