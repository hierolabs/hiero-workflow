import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getMessageAnalysis } from "../utils/message-api";
import { apiRequest } from "../utils/api";

interface Issue {
  conversation_id: string;
  guest_name: string;
  property_name: string;
  category: string;
  content: string;
  sender_type: string;
  sent_at: string;
  channel_type: string;
}

interface ReviewIssue {
  reservation_code: string;
  property_name: string;
  guest_score: number;
  guest_content: string;
  check_in_date: string;
  check_out_date: string;
  channel_type: string;
  low_categories: string[];
}

interface ReviewSummary {
  total_reviews: number;
  avg_score: number;
  low_score_count: number;
  low_score_reviews: ReviewIssue[];
  category_avgs: Record<string, number>;
}

interface KPIMetrics {
  period: string;
  total_messages: number;
  issue_count: number;
  issue_rate: number;
  praise_count: number;
  praise_rate: number;
  avg_review_score: number;
  low_review_count: number;
}

interface KPIChange {
  issue_rate: number;
  praise_rate: number;
  review_score: number;
  message_volume: number;
}

interface KPIComparison {
  current: KPIMetrics;
  prev_day: KPIMetrics;
  prev_week: KPIMetrics;
  prev_month: KPIMetrics;
  day_change: KPIChange;
  week_change: KPIChange;
  month_change: KPIChange;
}

interface PropertySummary {
  property_name: string;
  issue_count: number;
  categories: string[];
}

interface Analysis {
  period: string;
  start_date: string;
  end_date: string;
  total_messages: number;
  total_guest: number;
  total_host: number;
  issues: Issue[];
  category_counts: Record<string, number>;
  top_properties: PropertySummary[];
  reviews: ReviewSummary | null;
  kpi: KPIComparison | null;
}

// 카테고리 → 이슈 유형 + 담당자 자동 매핑
const CATEGORY_TO_ISSUE: Record<string, { issue_type: string; assignee: string; priority: string }> = {
  "시설 고장":                 { issue_type: "facility",   assignee: "김진태", priority: "P1" },
  "청결 불만":                 { issue_type: "cleaning",   assignee: "우연",   priority: "P1" },
  "체크인 문제":               { issue_type: "guest",      assignee: "오재관", priority: "P0" },
  "얼리체크인/레이트체크아웃": { issue_type: "guest",      assignee: "오재관", priority: "P2" },
  "환불/취소":                 { issue_type: "settlement", assignee: "박수빈", priority: "P1" },
  "위치/교통":                 { issue_type: "guest",      assignee: "오재관", priority: "P3" },
  "어메니티 요청":             { issue_type: "cleaning",   assignee: "우연",   priority: "P2" },
  "소음":                      { issue_type: "facility",   assignee: "김진태", priority: "P2" },
};

const CATEGORY_COLORS: Record<string, string> = {
  "시설 고장": "bg-red-100 text-red-800 border-red-200",
  "청결 불만": "bg-orange-100 text-orange-800 border-orange-200",
  "체크인 문제": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "얼리체크인/레이트체크아웃": "bg-blue-100 text-blue-800 border-blue-200",
  "환불/취소": "bg-purple-100 text-purple-800 border-purple-200",
  "위치/교통": "bg-green-100 text-green-800 border-green-200",
  "어메니티 요청": "bg-teal-100 text-teal-800 border-teal-200",
  "소음": "bg-pink-100 text-pink-800 border-pink-200",
};

const PRIORITY_COLORS: Record<string, string> = {
  P0: "bg-red-600 text-white",
  P1: "bg-orange-500 text-white",
  P2: "bg-yellow-400 text-gray-900",
  P3: "bg-gray-300 text-gray-700",
};

function renderChange(value: number, invertColor: boolean, suffix = "%p") {
  if (value === 0) return <span className="text-gray-400">-</span>;
  const isPositive = value > 0;
  // invertColor: 이슈율은 올라가면 나쁜 것 (빨강), 내려가면 좋은 것 (초록)
  const isGood = invertColor ? !isPositive : isPositive;
  const color = isGood ? "text-green-600" : "text-red-600";
  const arrow = isPositive ? "▲" : "▼";
  return (
    <span className={`${color} font-medium`}>
      {arrow} {Math.abs(value).toFixed(1)}{suffix}
    </span>
  );
}

export default function MessageAnalysis() {
  const [period, setPeriod] = useState("week");
  const [data, setData] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [createdIssues, setCreatedIssues] = useState<Set<number>>(new Set());
  const [creating, setCreating] = useState<number | null>(null);

  useEffect(() => {
    load();
    // 30초마다 자동 새로고침
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [period]);

  async function load() {
    setLoading(true);
    const result = await getMessageAnalysis(period);
    setData(result);
    setLoading(false);
    setCreatedIssues(new Set());
  }

  // 이슈 등록 → 자동 배정
  async function createIssue(issue: Issue, idx: number) {
    const mapping = CATEGORY_TO_ISSUE[issue.category] || {
      issue_type: "other",
      assignee: "김진우",
      priority: "P2",
    };

    setCreating(idx);
    try {
      const res = await apiRequest("/issues", {
        method: "POST",
        body: JSON.stringify({
          title: `[${issue.category}] ${issue.property_name || issue.guest_name}`,
          description: `게스트 메시지에서 감지된 이슈\n\n채널: ${issue.channel_type}\n게스트: ${issue.guest_name}\n숙소: ${issue.property_name}\n시간: ${issue.sent_at}\n\n내용:\n${issue.content}`,
          issue_type: mapping.issue_type,
          priority: mapping.priority,
          assignee_name: mapping.assignee,
          property_name: issue.property_name,
          status: "open",
        }),
      });

      if (res.ok) {
        setCreatedIssues((prev) => new Set([...prev, idx]));
      }
    } finally {
      setCreating(null);
    }
  }

  if (!data) {
    return <div className="p-6 text-gray-400">로딩 중...</div>;
  }

  const filteredIssues = filterCategory
    ? data.issues.filter((i) => i.category === filterCategory)
    : data.issues;

  const sortedCategories = Object.entries(data.category_counts).sort(
    (a, b) => b[1] - a[1]
  );

  const totalIssues = Object.values(data.category_counts).reduce(
    (a, b) => a + b,
    0
  );

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">메시지 이슈 분석</h1>
          <p className="text-sm text-gray-500">
            {data.start_date} ~ {data.end_date}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/issues"
            className="text-xs px-3 py-1.5 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100"
          >
            이슈 목록 보기
          </Link>
          <div className="flex gap-1">
            {[
              { value: "day", label: "1일" },
              { value: "week", label: "1주" },
              { value: "month", label: "1달" },
            ].map((p) => (
              <button
                key={p.value}
                onClick={() => {
                  setPeriod(p.value);
                  setFilterCategory(null);
                }}
                disabled={loading}
                className={`px-3 py-1.5 text-sm rounded-md font-medium ${
                  period === p.value
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">총 메시지</div>
          <div className="text-2xl font-bold text-gray-900">
            {data.total_messages}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            게스트 {data.total_guest} / 호스트 {data.total_host}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">이슈 감지</div>
          <div className="text-2xl font-bold text-red-600">{totalIssues}</div>
          <div className="text-xs text-gray-400 mt-1">
            {data.total_messages > 0
              ? Math.round((totalIssues / data.total_messages) * 100)
              : 0}
            % 이슈율
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">문제 숙소</div>
          <div className="text-2xl font-bold text-orange-600">
            {data.top_properties.length}
          </div>
          <div className="text-xs text-gray-400 mt-1">이슈 발생 숙소 수</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">주요 이슈</div>
          <div className="text-2xl font-bold text-gray-900">
            {sortedCategories[0]?.[0] || "-"}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {sortedCategories[0]?.[1] || 0}건
          </div>
        </div>
      </div>

      {/* KPI 비교 */}
      {data.kpi && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">기간 대비 KPI</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100">
                  <th className="text-left py-2 pr-4">지표</th>
                  <th className="text-right py-2 px-3">현재</th>
                  <th className="text-right py-2 px-3">전일대비</th>
                  <th className="text-right py-2 px-3">전주대비</th>
                  <th className="text-right py-2 px-3">전월대비</th>
                </tr>
              </thead>
              <tbody className="text-gray-900">
                <tr className="border-b border-gray-50">
                  <td className="py-2 pr-4 font-medium">이슈율</td>
                  <td className="text-right px-3">{data.kpi.current.issue_rate.toFixed(1)}%</td>
                  <td className="text-right px-3">{renderChange(data.kpi.day_change.issue_rate, true)}</td>
                  <td className="text-right px-3">{renderChange(data.kpi.week_change.issue_rate, true)}</td>
                  <td className="text-right px-3">{renderChange(data.kpi.month_change.issue_rate, true)}</td>
                </tr>
                <tr className="border-b border-gray-50">
                  <td className="py-2 pr-4 font-medium">칭찬율</td>
                  <td className="text-right px-3">{data.kpi.current.praise_rate.toFixed(1)}%</td>
                  <td className="text-right px-3">{renderChange(data.kpi.day_change.praise_rate, false)}</td>
                  <td className="text-right px-3">{renderChange(data.kpi.week_change.praise_rate, false)}</td>
                  <td className="text-right px-3">{renderChange(data.kpi.month_change.praise_rate, false)}</td>
                </tr>
                <tr className="border-b border-gray-50">
                  <td className="py-2 pr-4 font-medium">리뷰 평점</td>
                  <td className="text-right px-3">{data.kpi.current.avg_review_score > 0 ? data.kpi.current.avg_review_score.toFixed(2) : "-"}</td>
                  <td className="text-right px-3">{renderChange(data.kpi.day_change.review_score, false)}</td>
                  <td className="text-right px-3">{renderChange(data.kpi.week_change.review_score, false)}</td>
                  <td className="text-right px-3">{renderChange(data.kpi.month_change.review_score, false)}</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium">메시지 수</td>
                  <td className="text-right px-3">{data.kpi.current.total_messages}</td>
                  <td className="text-right px-3">{renderChange(data.kpi.day_change.message_volume, false, "%")}</td>
                  <td className="text-right px-3">{renderChange(data.kpi.week_change.message_volume, false, "%")}</td>
                  <td className="text-right px-3">{renderChange(data.kpi.month_change.message_volume, false, "%")}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 자동 배정 규칙 안내 */}
      <div className="bg-slate-50 rounded-lg border border-slate-200 px-4 py-3">
        <div className="text-xs font-semibold text-slate-600 mb-1.5">이슈 등록 시 자동 배정 규칙</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>시설 고장/소음 → <b className="text-slate-700">김진태</b></span>
          <span>청결/어메니티 → <b className="text-slate-700">우연</b></span>
          <span>체크인/응대/교통 → <b className="text-slate-700">오재관</b></span>
          <span>환불/취소 → <b className="text-slate-700">박수빈</b></span>
        </div>
      </div>

      {/* 카테고리 필터 바 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          카테고리별 이슈
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterCategory(null)}
            className={`px-3 py-1.5 text-sm rounded-full border ${
              !filterCategory
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            전체 ({totalIssues})
          </button>
          {sortedCategories.map(([cat, count]) => (
            <button
              key={cat}
              onClick={() =>
                setFilterCategory(filterCategory === cat ? null : cat)
              }
              className={`px-3 py-1.5 text-sm rounded-full border ${
                filterCategory === cat
                  ? CATEGORY_COLORS[cat] || "bg-gray-200 text-gray-800"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {cat} ({count})
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* 이슈 목록 (2/3) */}
        <div className="col-span-2 bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="font-semibold text-sm text-gray-900">
              이슈 메시지 ({filteredIssues.length}건)
              {filterCategory && (
                <span className="ml-2 text-gray-400 font-normal">
                  — {filterCategory}
                </span>
              )}
            </h3>
          </div>
          <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
            {filteredIssues.map((issue, idx) => {
              const mapping = CATEGORY_TO_ISSUE[issue.category];
              const isCreated = createdIssues.has(idx);
              const isCreating = creating === idx;

              return (
                <div key={idx} className="px-4 py-3 hover:bg-gray-50">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded border ${
                        CATEGORY_COLORS[issue.category] ||
                        "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {issue.category}
                    </span>
                    {mapping && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          PRIORITY_COLORS[mapping.priority]
                        }`}
                      >
                        {mapping.priority}
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      {issue.sender_type === "guest" ? "게스트" : "호스트"}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(issue.sent_at).toLocaleDateString("ko-KR", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {issue.channel_type}
                    </span>

                    {/* 오른쪽: 채팅 보기 + 이슈 등록 */}
                    <div className="ml-auto flex items-center gap-1.5">
                      {mapping && (
                        <span className="text-[10px] text-gray-400">
                          → {mapping.assignee}
                        </span>
                      )}
                      <Link
                        to={`/messages?conv=${issue.conversation_id}`}
                        className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        채팅
                      </Link>
                      {isCreated ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-green-100 text-green-700">
                          등록됨
                        </span>
                      ) : (
                        <button
                          onClick={() => createIssue(issue, idx)}
                          disabled={isCreating}
                          className="text-[10px] px-2 py-0.5 rounded bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
                        >
                          {isCreating ? "등록중..." : "이슈 등록"}
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-gray-900 line-clamp-2">
                    {issue.content}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-medium text-gray-700">
                      {issue.guest_name}
                    </span>
                    {issue.property_name && (
                      <span className="text-xs text-gray-400">
                        · {issue.property_name}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredIssues.length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm">
                해당 기간에 감지된 이슈가 없습니다
              </div>
            )}
          </div>
        </div>

        {/* 숙소별 이슈 TOP (1/3) */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="font-semibold text-sm text-gray-900">
              문제 숙소 TOP
            </h3>
          </div>
          <div className="divide-y divide-gray-50">
            {data.top_properties.map((prop, idx) => (
              <div key={idx} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 truncate flex-1">
                    {idx + 1}. {prop.property_name}
                  </span>
                  <span className="text-sm font-bold text-red-600 ml-2">
                    {prop.issue_count}건
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {prop.categories.map((cat) => (
                    <span
                      key={cat}
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        CATEGORY_COLORS[cat] || "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {data.top_properties.length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm">
                이슈 발생 숙소 없음
              </div>
            )}
          </div>
        </div>
      </div>
      {/* 리뷰 분석 섹션 */}
      {data.reviews && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900">리뷰 분석</h2>

          {/* 리뷰 요약 카드 */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500">리뷰 수</div>
              <div className="text-2xl font-bold text-gray-900">
                {data.reviews.total_reviews}
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500">평균 점수</div>
              <div className={`text-2xl font-bold ${data.reviews.avg_score >= 4.5 ? "text-green-600" : data.reviews.avg_score >= 4 ? "text-yellow-600" : "text-red-600"}`}>
                {data.reviews.avg_score > 0 ? data.reviews.avg_score.toFixed(1) : "-"}
              </div>
              <div className="text-xs text-gray-400 mt-1">/ 5.0</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500">낮은 점수 (4점 이하)</div>
              <div className="text-2xl font-bold text-red-600">
                {data.reviews.low_score_count}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {data.reviews.total_reviews > 0
                  ? Math.round((data.reviews.low_score_count / data.reviews.total_reviews) * 100)
                  : 0}% 불만율
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500">카테고리 평균</div>
              <div className="space-y-1 mt-1">
                {Object.entries(data.reviews.category_avgs)
                  .sort((a, b) => a[1] - b[1])
                  .map(([cat, avg]) => (
                    <div key={cat} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">{cat}</span>
                      <span className={`font-medium ${avg >= 4.5 ? "text-green-600" : avg >= 4 ? "text-yellow-600" : "text-red-600"}`}>
                        {avg.toFixed(1)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* 낮은 점수 리뷰 목록 */}
          {data.reviews.low_score_reviews && data.reviews.low_score_reviews.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold text-sm text-gray-900">
                  낮은 점수 리뷰 ({data.reviews.low_score_count}건) — 확인 필요
                </h3>
              </div>
              <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
                {data.reviews.low_score_reviews.map((review, idx) => (
                  <div key={idx} className="px-4 py-3 hover:bg-gray-50">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                        review.guest_score <= 2 ? "bg-red-100 text-red-800" :
                        review.guest_score <= 3 ? "bg-orange-100 text-orange-800" :
                        "bg-yellow-100 text-yellow-800"
                      }`}>
                        {review.guest_score}점
                      </span>
                      <span className="text-xs text-gray-500">
                        {review.check_in_date} ~ {review.check_out_date}
                      </span>
                      <span className="text-[10px] text-gray-400">{review.channel_type}</span>

                      <div className="ml-auto flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            const mapping = review.low_categories.includes("청결도")
                              ? { issue_type: "cleaning", assignee: "우연", priority: "P1" }
                              : review.low_categories.includes("체크인")
                              ? { issue_type: "guest", assignee: "오재관", priority: "P1" }
                              : { issue_type: "facility", assignee: "김진태", priority: "P1" };
                            apiRequest("/issues", {
                              method: "POST",
                              body: JSON.stringify({
                                title: `[리뷰 ${review.guest_score}점] ${review.property_name}`,
                                description: `게스트 리뷰에서 낮은 점수 감지\n\n숙소: ${review.property_name}\n기간: ${review.check_in_date} ~ ${review.check_out_date}\n점수: ${review.guest_score}/5\n낮은 항목: ${review.low_categories.join(", ")}\n\n리뷰 내용:\n${review.guest_content}`,
                                issue_type: mapping.issue_type,
                                priority: mapping.priority,
                                assignee_name: mapping.assignee,
                                property_name: review.property_name,
                                status: "open",
                              }),
                            }).then(() => alert("이슈 등록 완료"));
                          }}
                          className="text-[10px] px-2 py-0.5 rounded bg-red-50 text-red-600 hover:bg-red-100"
                        >
                          이슈 등록
                        </button>
                      </div>
                    </div>
                    {review.property_name && (
                      <div className="text-xs font-medium text-gray-700 mb-1">
                        {review.property_name}
                      </div>
                    )}
                    <p className="text-sm text-gray-900 line-clamp-3">
                      {review.guest_content || "(리뷰 내용 없음)"}
                    </p>
                    {review.low_categories && review.low_categories.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {review.low_categories.map((cat) => (
                          <span key={cat} className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600">
                            {cat} 낮음
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
