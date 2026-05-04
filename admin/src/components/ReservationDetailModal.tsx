import { useState, useEffect } from "react";
import { apiRequest } from "../utils/api";

export interface ReservationData {
  id: number;
  reservation_code: string;
  guest_name: string;
  guest_phone: string;
  guest_email: string;
  channel_type: string;
  channel_name: string;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  number_of_guests: number;
  status: string;
  stay_status: string;
  total_rate: number;
  total_commission: number;
  currency: string;
  booked_at: string;
  remarks: string;
  internal_prop_id?: number | null;
  property_id?: number;
}

interface Props {
  reservationId: number | null;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  accepted: "확정", pending: "대기", cancelled: "취소", declined: "거절",
};
const STATUS_STYLES: Record<string, string> = {
  accepted: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function ReservationDetailModal({ reservationId, onClose }: Props) {
  const [data, setData] = useState<ReservationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [memo, setMemo] = useState("");
  const [memoSaved, setMemoSaved] = useState(false);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueTitle, setIssueTitle] = useState("");
  const [issueType, setIssueType] = useState("guest");
  const [issuePriority, setIssuePriority] = useState("P1");
  const [issueSubmitting, setIssueSubmitting] = useState(false);
  const [issueResult, setIssueResult] = useState("");

  useEffect(() => {
    if (!reservationId) { setData(null); return; }
    setLoading(true);
    setMemoSaved(false);
    setShowIssueForm(false);
    setIssueResult("");
    apiRequest(`/reservations/${reservationId}`)
      .then(async (res) => {
        if (res.ok) {
          const d = await res.json();
          setData(d);
          setMemo(d.remarks || "");
        }
      })
      .finally(() => setLoading(false));
  }, [reservationId]);

  if (!reservationId) return null;

  async function saveMemo() {
    if (!data) return;
    await apiRequest(`/reservations/${data.id}`, {
      method: "PATCH",
      body: JSON.stringify({ remarks: memo }),
    });
    setMemoSaved(true);
    setTimeout(() => setMemoSaved(false), 2000);
  }

  async function submitIssue() {
    if (!data || !issueTitle.trim()) return;
    setIssueSubmitting(true);
    const body = {
      title: issueTitle,
      description: memo || `예약 ${data.reservation_code} 관련 이슈`,
      issue_type: issueType,
      priority: issuePriority,
      reservation_id: data.id,
      reservation_code: data.reservation_code,
      property_id: data.internal_prop_id || undefined,
    };
    const res = await apiRequest("/issues", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setIssueResult("이슈 등록 완료");
      setShowIssueForm(false);
      setIssueTitle("");
    } else {
      setIssueResult("등록 실패");
    }
    setIssueSubmitting(false);
    setTimeout(() => setIssueResult(""), 3000);
  }

  const d = data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4 rounded-t-xl">
          <h3 className="text-lg font-bold text-gray-900">예약 상세</h3>
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {loading ? (
            <div className="flex h-32 items-center justify-center text-gray-400">로딩 중...</div>
          ) : d ? (
            <div className="space-y-4">
              {/* Channel + Status */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  d.channel_type === "airbnb" ? "bg-rose-100 text-rose-800" :
                  d.channel_type === "booking.com" ? "bg-blue-100 text-blue-800" :
                  d.channel_type === "agoda" ? "bg-indigo-100 text-indigo-800" :
                  "bg-gray-100 text-gray-700"
                }`}>
                  {d.channel_name || d.channel_type}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[d.status] || "bg-gray-100 text-gray-600"}`}>
                  {STATUS_LABELS[d.status] || d.status}
                </span>
              </div>

              {/* Property + Guest */}
              {(d as Record<string,unknown>).property_name && (
                <p className="text-xs font-medium text-gray-500">{(d as Record<string,unknown>).property_name as string}</p>
              )}
              <p className="text-xl font-bold text-gray-900">{d.guest_name || "-"}</p>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="체크인" value={d.check_in_date} />
                <Field label="체크아웃" value={d.check_out_date} />
                <Field label="숙박" value={`${d.nights}박`} />
                <Field label="인원" value={`${d.number_of_guests}명`} />
                <Field label="매출" value={`${d.total_rate.toLocaleString()}원`} />
                <Field label="수수료" value={`${(d.total_commission || 0).toLocaleString()}원`} />
              </div>

              {/* Contact */}
              {d.guest_phone && <Field label="전화" value={d.guest_phone} />}
              {d.guest_email && <Field label="이메일" value={d.guest_email} />}
              <Field label="예약코드" value={d.reservation_code} />
              {d.booked_at && <Field label="예약일시" value={new Date(d.booked_at).toLocaleString("ko-KR")} />}

              {/* Memo */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-500">메모</span>
                  <div className="flex gap-2">
                    {memoSaved && <span className="text-xs text-green-600">저장됨</span>}
                    <button
                      onClick={saveMemo}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      저장
                    </button>
                  </div>
                </div>
                <textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="메모를 입력하세요..."
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none resize-none"
                  rows={3}
                />
              </div>

              {/* Issue Submit */}
              {issueResult && (
                <div className="rounded-md bg-green-50 px-3 py-2 text-xs text-green-700">{issueResult}</div>
              )}

              {!showIssueForm ? (
                <button
                  onClick={() => { setShowIssueForm(true); setIssueTitle(memo ? `[예약] ${d.guest_name}: ${memo.slice(0, 30)}` : ""); }}
                  className="w-full rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                >
                  이슈로 전송
                </button>
              ) : (
                <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
                  <input
                    type="text"
                    value={issueTitle}
                    onChange={(e) => setIssueTitle(e.target.value)}
                    placeholder="이슈 제목"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <select value={issueType} onChange={(e) => setIssueType(e.target.value)} className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs">
                      <option value="guest">게스트 응대</option>
                      <option value="cleaning">청소 문제</option>
                      <option value="facility">시설 문제</option>
                      <option value="settlement">비용/정산</option>
                      <option value="decision">의사결정</option>
                      <option value="other">기타</option>
                    </select>
                    <select value={issuePriority} onChange={(e) => setIssuePriority(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-xs">
                      <option value="P0">P0 즉시</option>
                      <option value="P1">P1 오늘</option>
                      <option value="P2">P2 이번주</option>
                      <option value="P3">P3 여유</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={submitIssue}
                      disabled={issueSubmitting || !issueTitle.trim()}
                      className="flex-1 rounded-md bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      {issueSubmitting ? "등록 중..." : "이슈 등록"}
                    </button>
                    <button
                      onClick={() => setShowIssueForm(false)}
                      className="rounded-md border border-gray-300 px-3 py-2 text-xs text-gray-600 hover:bg-gray-100"
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <p className="text-sm text-gray-900">{value}</p>
    </div>
  );
}
