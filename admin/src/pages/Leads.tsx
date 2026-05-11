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

type LaunchTab4 = 'investor' | 'contract' | 'design' | 'platform';

export default function Leads() {
  const [tab, setTab] = useState<LaunchTab4>('investor');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">성장 관리</h1>
        <p className="mt-1 text-sm text-gray-500">투자자 → 계약 → 공간 디자인 → 플랫폼 등록</p>
      </div>

      <div className="mb-4 flex gap-1 border-b border-gray-200">
        {([
          { key: 'investor' as LaunchTab4, label: '투자자', desc: '리드·상담' },
          { key: 'contract' as LaunchTab4, label: '계약', desc: '계약·조건·일정' },
          { key: 'design' as LaunchTab4, label: '공간 디자인', desc: '세팅·촬영·콘텐츠' },
          { key: 'platform' as LaunchTab4, label: '플랫폼 등록', desc: '온보딩·URL·최적화' },
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
      {tab === 'contract' && <ContractTab />}
      {tab === 'design' && <PropertyTab />}
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

// ===================== 탭 2. 계약 관리 =====================
interface ContractProperty {
  id: number;
  name: string;
  code: string;
  region: string;
  lifecycle_status: string;
  contract_type: string;
  operation_type: string;
  owner_name: string;
  monthly_rent: number;
  management_fee: number;
  deposit: number;
  contracted_at: string | null;
  expected_active_date: string | null;
  setting_type: string;
}

const LIFECYCLE_LABEL: Record<string, string> = {
  lead: '리드', meeting: '미팅', negotiating: '협상중', contracted: '계약완료',
  setting: '세팅중', filming: '촬영', ota_registering: 'OTA등록', operation_ready: '준비완료',
  partially_active: '부분운영', fully_distributed: '전체배포', active: '운영중', paused: '일시중단', closed: '종료',
};

const CONTRACT_TYPE_LABEL: Record<string, string> = {
  SUBLEASE_CONTRACT: '전대차', PLATFORM_BOOKING: '숙박예약', SERVICE_CONTRACT: '운영관리',
};

const OPERATION_TYPE_LABEL: Record<string, string> = {
  MID_TERM_SUBLEASE: '중기전대', LICENSED_AIRBNB: '인허가 에어비앤비', MIXED: '혼합',
};

function ContractTab() {
  const [properties, setProperties] = useState<ContractProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pipeline' | 'active'>('pipeline');

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch(`${API_URL}/properties?page=1&page_size=200`, { headers })
      .then(r => r.json())
      .then(data => setProperties(data.properties || []))
      .finally(() => setLoading(false));
  }, []);

  const pipelineStatuses = ['lead','meeting','negotiating','contracted','setting','filming','ota_registering','operation_ready'];
  const filtered = properties.filter(p => {
    if (filter === 'pipeline') return pipelineStatuses.includes(p.lifecycle_status);
    if (filter === 'active') return p.lifecycle_status === 'active';
    return true;
  });

  // 파이프라인 단계별 카운트
  const stageCounts = pipelineStatuses.reduce<Record<string, number>>((acc, s) => {
    acc[s] = properties.filter(p => p.lifecycle_status === s).length;
    return acc;
  }, {});

  if (loading) return <div className="text-center text-gray-400 py-8">로딩 중...</div>;

  return (
    <div className="space-y-6">
      {/* 파이프라인 미니 요약 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-2 overflow-x-auto">
          {pipelineStatuses.map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={`text-center px-3 py-2 rounded-lg min-w-[60px] ${stageCounts[s] > 0 ? 'bg-gray-100 font-bold text-gray-900' : 'bg-gray-50 text-gray-300'}`}>
                <div className="text-lg">{stageCounts[s]}</div>
                <div className="text-[10px]">{LIFECYCLE_LABEL[s]}</div>
              </div>
              {i < pipelineStatuses.length - 1 && <span className="text-gray-300 text-xs">→</span>}
            </div>
          ))}
        </div>
      </div>

      {/* 필터 */}
      <div className="flex gap-2">
        {([
          { key: 'pipeline' as const, label: '파이프라인 (진행 중)' },
          { key: 'active' as const, label: '운영 중' },
          { key: 'all' as const, label: '전체' },
        ]).map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition ${
              filter === f.key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
            }`}
          >
            {f.label} ({f.key === 'pipeline' ? properties.filter(p => pipelineStatuses.includes(p.lifecycle_status)).length : f.key === 'active' ? properties.filter(p => p.lifecycle_status === 'active').length : properties.length})
          </button>
        ))}
      </div>

      {/* 숙소 계약 리스트 */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">숙소</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">단계</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">계약유형</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">운영유형</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">임대인</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">월세</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">관리비</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">계약일</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">예상 Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-gray-900">{p.display_name || p.name}</div>
                  <div className="text-[10px] text-gray-400">{p.code} · {p.region}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    p.lifecycle_status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                    p.lifecycle_status === 'contracted' ? 'bg-indigo-100 text-indigo-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {LIFECYCLE_LABEL[p.lifecycle_status] || p.lifecycle_status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{CONTRACT_TYPE_LABEL[p.contract_type] || p.contract_type || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{OPERATION_TYPE_LABEL[p.operation_type] || p.operation_type || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{p.owner_name || '-'}</td>
                <td className="px-4 py-3 text-sm text-right text-gray-900">{p.monthly_rent ? `${(p.monthly_rent / 10000).toFixed(0)}만` : '-'}</td>
                <td className="px-4 py-3 text-sm text-right text-gray-600">{p.management_fee ? `${(p.management_fee / 10000).toFixed(0)}만` : '-'}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{p.contracted_at ? new Date(p.contracted_at).toLocaleDateString('ko') : '-'}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{p.expected_active_date ? new Date(p.expected_active_date).toLocaleDateString('ko') : '-'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400">해당 조건의 숙소가 없습니다</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===================== 탭 3. 공간 디자인 (숙소 라이프사이클) =====================
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

const PHASE_LABELS: Record<number, { label: string; assignee: string }> = {
  1: { label: '공간 세팅', assignee: '현장' },
  2: { label: '촬영 + 디지털', assignee: '현장' },
  3: { label: '콘텐츠', assignee: '마케팅' },
  4: { label: '플랫폼 등록', assignee: '마케팅' },
  5: { label: '운영 준비', assignee: '운영' },
};

interface OnboardingCheck {
  id: number;
  property_id: number;
  phase: number;
  item: string;
  is_checked: boolean;
  checked_by_name: string;
  checked_at: string | null;
}

interface SimpleProperty {
  id: number;
  name: string;
  display_name?: string;
  lifecycle_status: string;
}

function PlatformTab() {
  const [properties, setProperties] = useState<SimpleProperty[]>([]);
  const [selectedPropId, setSelectedPropId] = useState<number | null>(null);
  const [checks, setChecks] = useState<OnboardingCheck[]>([]);
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // 숙소 목록 (lead~operation_ready만 — 온보딩 대상)
  useEffect(() => {
    fetch(`${API_URL}/properties?page=1&page_size=200`, { headers })
      .then(r => r.json())
      .then(data => {
        const all: SimpleProperty[] = (data.properties || []).map((p: Record<string, unknown>) => ({
          id: p.id as number,
          name: p.name as string,
          display_name: p.display_name as string | undefined,
          lifecycle_status: (p.lifecycle_status as string) || 'lead',
        }));
        // 온보딩 대상: active 이전 단계
        const onboardingStatuses = ['lead','meeting','negotiating','contracted','setting','filming','ota_registering','operation_ready','partially_active'];
        const filtered = all.filter(p => onboardingStatuses.includes(p.lifecycle_status));
        // active 숙소도 뒤에 표시 (체크 확인용)
        const active = all.filter(p => !onboardingStatuses.includes(p.lifecycle_status));
        setProperties([...filtered, ...active]);
      });
  }, []);

  // 체크리스트 조회
  useEffect(() => {
    if (!selectedPropId) { setChecks([]); return; }
    setLoading(true);
    fetch(`${API_URL}/properties/${selectedPropId}/onboarding`, { headers })
      .then(r => r.json())
      .then(data => setChecks(data.checks || []))
      .finally(() => setLoading(false));
  }, [selectedPropId]);

  // 체크 토글
  const toggleCheck = async (checkId: number) => {
    const res = await fetch(`${API_URL}/properties/${selectedPropId}/onboarding/${checkId}`, {
      method: 'PATCH', headers,
    });
    if (res.ok) {
      const updated: OnboardingCheck = await res.json();
      setChecks(prev => prev.map(c => c.id === checkId ? updated : c));
    }
  };

  // Phase별 그룹핑
  const phases = checks.reduce<Record<number, OnboardingCheck[]>>((acc, c) => {
    (acc[c.phase] = acc[c.phase] || []).push(c);
    return acc;
  }, {});

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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-700">온보딩 체크리스트</h2>
          <select
            value={selectedPropId || ''}
            onChange={e => setSelectedPropId(e.target.value ? Number(e.target.value) : null)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm min-w-[200px]"
          >
            <option value="">숙소 선택</option>
            {properties.map(p => (
              <option key={p.id} value={p.id}>
                {p.display_name || p.name} ({p.lifecycle_status})
              </option>
            ))}
          </select>
        </div>

        {!selectedPropId && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">
            숙소를 선택하면 온보딩 체크리스트가 표시됩니다
          </div>
        )}

        {loading && <div className="text-center text-gray-400 py-8">로딩 중...</div>}

        {selectedPropId && !loading && (
          <div className="space-y-4">
            {/* 진행률 */}
            {checks.length > 0 && (() => {
              const done = checks.filter(c => c.is_checked).length;
              const pct = Math.round((done / checks.length) * 100);
              return (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">전체 진행률</span>
                    <span className="text-sm font-bold text-gray-900">{done}/{checks.length} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })()}

            {Object.entries(phases).sort(([a],[b]) => Number(a) - Number(b)).map(([phaseNum, items]) => {
              const p = Number(phaseNum);
              const meta = PHASE_LABELS[p] || { label: `Phase ${p}`, assignee: '-' };
              const done = items.filter(c => c.is_checked).length;
              return (
                <div key={p} className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-bold text-gray-200">{String(p).padStart(2, '0')}</span>
                      <div>
                        <span className="text-sm font-bold text-gray-900">{meta.label}</span>
                        <span className="text-xs text-gray-400 ml-2">담당: {meta.assignee}</span>
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${done === items.length ? 'bg-emerald-100 text-emerald-700' : 'text-gray-400'}`}>
                      {done}/{items.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {items.map(check => (
                      <label
                        key={check.id}
                        onClick={() => toggleCheck(check.id)}
                        className={`flex items-center justify-between text-sm rounded-lg px-3 py-2 cursor-pointer transition ${
                          check.is_checked ? 'bg-emerald-50 text-emerald-800' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={check.is_checked}
                            readOnly
                            className="rounded border-gray-300"
                          />
                          <span className={check.is_checked ? 'line-through opacity-60' : ''}>{check.item}</span>
                        </div>
                        {check.is_checked && check.checked_by_name && (
                          <span className="text-[10px] text-gray-400 ml-2 whitespace-nowrap">
                            {check.checked_by_name} · {check.checked_at ? new Date(check.checked_at).toLocaleDateString('ko') : ''}
                          </span>
                        )}
                      </label>
                    ))}
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
