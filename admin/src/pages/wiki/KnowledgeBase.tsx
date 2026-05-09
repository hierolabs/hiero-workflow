import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../utils/api";

/* ── Types ─────────────────────────────────────────────────────────── */

interface TOCItem {
  id: number;
  part_number: number;
  part_title: string;
  chapter: number;
  chapter_title: string;
  section: string;
  title: string;
  status: string;
  assigned_to: string;
  author_name: string;
  word_count: number;
  updated_at: string;
}

interface Article {
  id: number;
  part_number: number;
  part_title: string;
  chapter: number;
  chapter_title: string;
  section: string;
  title: string;
  content: string;
  status: string;
  assigned_to: string;
  author_name: string;
  word_count: number;
  tags: string;
  references: string;
  updated_at: string;
}

interface RefItem {
  url: string;
  title: string;
  note: string;
}

interface Revision {
  id: number;
  author_name: string;
  revision_note: string;
  word_count: number;
  created_at: string;
}

interface Progress {
  total: number;
  empty: number;
  draft: number;
  review: number;
  published: number;
  by_part: { part_number: number; part_title: string; total: number; filled: number }[];
  by_role: { role: string; total: number; filled: number }[];
}

interface ArchivingJob {
  id: number;
  type: string;
  status: string;
  article_ids: string;
  tabs_generated: string;
  created_by_name: string;
  created_at: string;
  completed_at: string | null;
}

/* ── Helpers ────────────────────────────────────────────────────────── */

const statusLabel: Record<string, string> = {
  empty: "비어있음",
  draft: "초안",
  review: "검토중",
  published: "완료",
};

const statusColor: Record<string, string> = {
  empty: "bg-gray-100 text-gray-500",
  draft: "bg-amber-50 text-amber-700",
  review: "bg-blue-50 text-blue-700",
  published: "bg-green-50 text-green-700",
};

const roleLabel: Record<string, string> = {
  cto: "CTO",
  ceo: "CEO",
  cfo: "CFO",
  operations: "Operations",
  cleaning_dispatch: "Cleaning",
  field: "Field",
  marketing: "Marketing",
  unassigned: "미배정",
};

function groupByPart(items: TOCItem[]) {
  const map = new Map<number, { title: string; chapters: Map<number, { title: string; items: TOCItem[] }> }>();
  for (const item of items) {
    if (!map.has(item.part_number)) {
      map.set(item.part_number, { title: item.part_title, chapters: new Map() });
    }
    const part = map.get(item.part_number)!;
    if (!part.chapters.has(item.chapter)) {
      part.chapters.set(item.chapter, { title: item.chapter_title, items: [] });
    }
    part.chapters.get(item.chapter)!.items.push(item);
  }
  return map;
}

/* ── Component ──────────────────────────────────────────────────────── */

export default function KnowledgeBase() {
  const [toc, setToc] = useState<TOCItem[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [selected, setSelected] = useState<Article | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [filter, setFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  // References
  const [refs, setRefs] = useState<RefItem[]>([]);
  const [refUrl, setRefUrl] = useState("");
  const [refTitle, setRefTitle] = useState("");
  const [refNote, setRefNote] = useState("");
  // AI Research Chat
  const [chatMessages, setChatMessages] = useState<{role: string; content: string}[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [rightTab, setRightTab] = useState<"info"|"refs"|"ai"|"review">("info");
  // Archiving jobs
  const [jobs, setJobs] = useState<ArchivingJob[]>([]);
  // Review
  const [reviewResult, setReviewResult] = useState<{
    article_id: number;
    article_title: string;
    perspectives: { key: string; name: string; review: string; score: number }[];
    summary: string;
  } | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [savedReviews, setSavedReviews] = useState<{
    id: number; article_id: number; perspective: string; name: string;
    score: number; review: string; content_snapshot: string;
    word_count_at: number; requested_by: string; created_at: string;
  }[]>([]);
  // Focus Write Mode (리셋 모드)
  const [focusMode, setFocusMode] = useState(false);
  const [focusDraft, setFocusDraft] = useState("");
  const [focusStep, setFocusStep] = useState<"write"|"refine"|"review"|"done">("write");
  const [focusRefined, setFocusRefined] = useState("");
  const [focusRefining, setFocusRefining] = useState(false);
  const [focusTargetArticle, setFocusTargetArticle] = useState<number | null>(null);
  // AI Rewrite
  const [rewriting, setRewriting] = useState(false);

  // Fetch TOC + Progress + Jobs
  const loadData = useCallback(async () => {
    const [tocRes, progRes, jobsRes] = await Promise.all([
      apiRequest("/wiki/toc"),
      apiRequest("/wiki/progress"),
      apiRequest("/archiving/jobs?limit=20"),
    ]);
    if (tocRes.ok) {
      const d = await tocRes.json();
      setToc(d.items ?? []);
    }
    if (progRes.ok) setProgress(await progRes.json());
    if (jobsRes.ok) {
      const d = await jobsRes.json();
      setJobs(d.jobs ?? []);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Select article
  const selectArticle = async (id: number) => {
    setEditing(false);
    setReviewResult(null);
    const [artRes, revRes, reviewRes] = await Promise.all([
      apiRequest(`/wiki/articles/${id}`),
      apiRequest(`/wiki/articles/${id}/revisions`),
      apiRequest(`/archiving/review/${id}`),
    ]);
    if (artRes.ok) {
      const a = await artRes.json();
      setSelected(a);
      setDraft(a.content ?? "");
      try { setRefs(JSON.parse(a.references || "[]")); } catch { setRefs([]); }
      setChatMessages([]);
    }
    if (revRes.ok) {
      const d = await revRes.json();
      setRevisions(d.revisions ?? []);
    }
    if (reviewRes.ok) {
      const d = await reviewRes.json();
      setSavedReviews(d.reviews ?? []);
    } else {
      setSavedReviews([]);
    }
  };

  // Save
  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    const res = await apiRequest(`/wiki/articles/${selected.id}`, {
      method: "PUT",
      body: JSON.stringify({ content: draft, status: draft.trim() ? "draft" : "empty" }),
    });
    if (res.ok) {
      const updated = await res.json();
      setSelected(updated);
      setEditing(false);
      loadData();
    }
    setSaving(false);
  };

  // Publish
  const handlePublish = async () => {
    if (!selected) return;
    const res = await apiRequest(`/wiki/articles/${selected.id}`, {
      method: "PUT",
      body: JSON.stringify({ content: draft, status: "published" }),
    });
    if (res.ok) {
      const updated = await res.json();
      setSelected(updated);
      setEditing(false);
      loadData();
    }
  };

  // Filter
  const filtered = toc.filter((item) => {
    if (filter !== "all" && item.status !== filter) return false;
    if (roleFilter !== "all" && item.assigned_to !== roleFilter) return false;
    return true;
  });

  const grouped = groupByPart(filtered);

  // Focus Mode: AI 구조화 요청
  const handleFocusRefine = async () => {
    if (!focusDraft.trim()) return;
    setFocusRefining(true);
    try {
      const res = await apiRequest("/ai/agent", {
        method: "POST",
        body: JSON.stringify({
          page: "wiki",
          message: `아래 자유 작성 글을 HIERO 백서 스타일로 구조화해주세요.

규칙:
1. 원문의 핵심 메시지와 톤을 유지하면서 구조를 잡아주세요
2. <!-- TAB: 작업 기록 --> 부터 시작하여 해당하는 탭들을 자동 배치
3. 도시계획적 관점의 비유나 연결이 가능하면 추가
4. 코드/데이터 관련 내용은 "작업 기록"이나 "시스템 흐름도"에
5. 생각/느낌/관점은 "개념 설명"이나 "에세이"에
6. 실무 관련 내용은 "업무 지침"에
7. 모든 내용을 빠짐없이 포함 — 삭제하지 말고 재배치만
8. 한국어로 작성

원문:
${focusDraft}`,
          data: selected ? `현재 아티클: ${selected.title} (Part ${selected.part_number})` : "새 글",
        }),
      });
      if (res.ok) {
        const d = await res.json();
        setFocusRefined(d.response || d.message || "");
        setFocusStep("review");
      }
    } catch { alert("구조화 실패"); }
    setFocusRefining(false);
  };

  // Focus Mode: 최종 저장
  const handleFocusSave = async (articleId: number) => {
    const res = await apiRequest(`/wiki/articles/${articleId}`, {
      method: "PUT",
      body: JSON.stringify({
        content: focusRefined,
        status: "draft",
        revision_note: "포커스 모드에서 자유 작성 → 구조화",
      }),
    });
    if (res.ok) {
      setFocusMode(false);
      setFocusStep("write");
      setFocusDraft("");
      setFocusRefined("");
      setFocusTargetArticle(null);
      selectArticle(articleId);
      loadData();
    }
  };

  // ── Focus Write Mode (전체화면) ──
  if (focusMode) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex flex-col bg-white">
        {/* 상단 바 */}
        <div className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setFocusMode(false); setFocusStep("write"); }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← 돌아가기
            </button>
            <div className="h-4 w-px bg-gray-300" />
            <span className="text-sm font-bold text-gray-800">
              {focusStep === "write" ? "자유 글쓰기" :
               focusStep === "refine" ? "구조화 중..." :
               focusStep === "review" ? "구조화 결과 검토" :
               "저장 대상 선택"}
            </span>
          </div>
          {/* 단계 표시 */}
          <div className="flex items-center gap-2 text-[10px]">
            {["write", "review", "done"].map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                {i > 0 && <span className="text-gray-300">→</span>}
                <span className={`px-2 py-0.5 rounded ${
                  focusStep === s ? "bg-slate-800 text-white" :
                  ["write","review","done"].indexOf(focusStep) > i ? "bg-emerald-100 text-emerald-700" :
                  "bg-gray-100 text-gray-400"
                }`}>
                  {s === "write" ? "1. 자유 작성" : s === "review" ? "2. 검토·수정" : "3. 저장"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: 자유 글쓰기 */}
        {focusStep === "write" && (
          <div className="flex-1 flex flex-col p-8 max-w-4xl mx-auto w-full">
            <p className="text-gray-400 text-sm mb-4">
              자유롭게 쓰세요. 구조, 형식, 순서 상관없이. 생각나는 대로.
            </p>
            <textarea
              value={focusDraft}
              onChange={e => setFocusDraft(e.target.value)}
              className="flex-1 w-full resize-none rounded-xl border border-gray-200 p-6 text-base text-gray-800 leading-relaxed focus:border-slate-400 focus:ring-1 focus:ring-slate-400 placeholder:text-gray-300"
              placeholder="여기에 자유롭게 쓰세요...&#10;&#10;생각, 메모, 아이디어, 작업 기록, 느낀 점...&#10;구조는 AI가 잡아줍니다."
              autoFocus
            />
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {focusDraft.length > 0 ? `${[...focusDraft].length}자` : ""}
              </span>
              <button
                onClick={handleFocusRefine}
                disabled={!focusDraft.trim() || focusRefining}
                className="px-6 py-3 rounded-xl text-sm font-medium bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {focusRefining ? "구조화 중..." : "AI 구조화 →"}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: 구조화 결과 검토 + 수정 */}
        {focusStep === "review" && (
          <div className="flex-1 flex flex-col p-8 max-w-4xl mx-auto w-full">
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-500 text-sm">AI가 구조화한 결과입니다. 자유롭게 수정하세요.</p>
              <button
                onClick={() => setFocusStep("write")}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                ← 다시 쓰기
              </button>
            </div>
            <textarea
              value={focusRefined}
              onChange={e => setFocusRefined(e.target.value)}
              className="flex-1 w-full resize-none rounded-xl border border-gray-200 p-6 font-mono text-sm text-gray-800 leading-relaxed focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
            />
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {focusRefined.length > 0 ? `${[...focusRefined].length}자` : ""}
              </span>
              <button
                onClick={() => setFocusStep("done")}
                disabled={!focusRefined.trim()}
                className="px-6 py-3 rounded-xl text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 transition"
              >
                저장 대상 선택 →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: 저장 대상 아티클 선택 */}
        {focusStep === "done" && (
          <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
            <p className="text-gray-500 text-sm mb-4">어떤 아티클에 저장할까요?</p>

            {/* 현재 선택된 아티클이 있으면 우선 표시 */}
            {selected && (
              <button
                onClick={() => handleFocusSave(selected.id)}
                className="w-full mb-4 p-4 rounded-xl border-2 border-emerald-400 bg-emerald-50 text-left hover:bg-emerald-100 transition"
              >
                <div className="text-xs text-emerald-600 mb-1">현재 아티클에 저장</div>
                <div className="text-sm font-bold text-gray-900">{selected.section} {selected.title}</div>
                <div className="text-xs text-gray-500 mt-1">Part {selected.part_number}. {selected.part_title}</div>
              </button>
            )}

            {/* 전체 아티클 목록 */}
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">또는 다른 아티클 선택</p>
            <div className="space-y-1 max-h-[50vh] overflow-y-auto">
              {toc.map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    if (confirm(`"${item.section} ${item.title}"에 저장하시겠습니까?`)) {
                      handleFocusSave(item.id);
                    }
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-gray-50 transition"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${
                    item.status === "published" ? "bg-green-500" :
                    item.status === "review" ? "bg-blue-500" :
                    item.status === "draft" ? "bg-amber-500" : "bg-gray-300"
                  }`} />
                  <span className="text-xs text-gray-400 w-8 shrink-0">{item.section}</span>
                  <span className="text-xs text-gray-700 flex-1 truncate">{item.title}</span>
                  <span className="text-[10px] text-gray-400">Part {item.part_number}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* ── Left: TOC ── */}
      <div className="w-80 shrink-0 overflow-y-auto border-r border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-gray-900">Hestory</h2>
          <button
            onClick={() => { setFocusMode(true); setFocusStep("write"); setFocusDraft(""); setFocusRefined(""); }}
            className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-slate-800 text-white hover:bg-slate-700 transition"
            title="전체화면 자유 글쓰기"
          >
            자유 글쓰기
          </button>
        </div>
        <p className="mb-3 text-xs text-gray-500">heiro.labs의 이야기 — 운영 기록이 자동으로 쌓이는 아카이브</p>

        {/* Quick Access 제거 — 오른쪽 사이드로 이동 */}

        {/* Filters */}
        <div className="mb-3 flex gap-1.5">
          {["all", "empty", "draft", "review", "published"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                filter === s ? "bg-slate-800 text-white" : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              {s === "all" ? "전체" : statusLabel[s]}
            </button>
          ))}
        </div>
        <div className="mb-4">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs text-gray-700"
          >
            <option value="all">모든 담당자</option>
            {["cto", "ceo", "cfo", "operations", "cleaning_dispatch", "field", "marketing"].map((r) => (
              <option key={r} value={r}>{roleLabel[r]}</option>
            ))}
          </select>
        </div>

        {/* TOC tree */}
        <div className="space-y-4">
          {Array.from(grouped.entries())
            .sort(([a], [b]) => a - b)
            .map(([partNum, part]) => (
            <div key={partNum}>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Part {partNum === 99 ? "부록" : partNum}. {part.title}
              </p>
              {Array.from(part.chapters.entries())
                .sort(([a], [b]) => a - b)
                .map(([chNum, ch]) => (
                <div key={chNum} className="mb-2">
                  <p className="mb-0.5 text-xs font-semibold text-gray-700">
                    {chNum < 90 ? `${chNum}장` : ""} {ch.title}
                  </p>
                  {ch.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => selectArticle(item.id)}
                      className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs transition-colors ${
                        selected?.id === item.id
                          ? "bg-slate-200 font-medium text-slate-900"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                        item.status === "published" ? "bg-green-500" :
                        item.status === "review" ? "bg-blue-500" :
                        item.status === "draft" ? "bg-amber-500" : "bg-gray-300"
                      }`} />
                      <span className="truncate">{item.section} {item.title}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Center: Article View/Edit ── */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selected ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-400">섹션을 선택하세요</p>
              <p className="mt-1 text-sm text-gray-400">좌측 목차에서 항목을 클릭</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl">
            {/* Header */}
            <div className="mb-6">
              <p className="text-xs text-gray-400">
                Part {selected.part_number === 99 ? "부록" : selected.part_number}. {selected.part_title} &gt; {selected.chapter_title}
              </p>
              <h1 className="mt-1 text-2xl font-bold text-gray-900">
                {selected.section} {selected.title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusColor[selected.status]}`}>
                  {statusLabel[selected.status]}
                </span>
                {selected.author_name && (
                  <span className="text-xs text-gray-400">
                    {selected.author_name}
                  </span>
                )}
                <span className="text-xs text-gray-400">
                  {selected.word_count.toLocaleString()}자
                </span>
                <span className="text-xs text-gray-300">
                  {new Date(selected.updated_at).toLocaleString("ko-KR")}
                </span>
              </div>
            </div>

            {/* Content or Editor */}
            {editing ? (
              <div>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="min-h-[400px] w-full rounded-lg border border-gray-300 p-4 font-mono text-sm text-gray-800 focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                  placeholder="마크다운으로 작성하세요..."
                />
                <div className="mt-3 flex gap-2 flex-wrap">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    {saving ? "저장 중..." : "저장 (초안)"}
                  </button>
                  <button
                    onClick={handlePublish}
                    className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500"
                  >
                    발행
                  </button>
                  {/* AI 재작성 — 평가자 선택 드롭다운 */}
                  {savedReviews.length > 0 ? (
                    <div className="relative group">
                      <button
                        disabled={rewriting}
                        className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50 peer"
                      >
                        {rewriting ? "다시 쓰는 중..." : "AI로 다시 쓰기 ▾"}
                      </button>
                      {!rewriting && (
                        <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                          <div className="p-2 border-b border-gray-100">
                            <p className="text-[10px] text-gray-400 font-medium">누구의 피드백을 반영할까요?</p>
                          </div>
                          {savedReviews.map(r => {
                            const scoreColor = r.score >= 8 ? "text-emerald-600" : r.score >= 6 ? "text-blue-600" : r.score >= 4 ? "text-amber-600" : "text-red-600";
                            return (
                              <button
                                key={r.perspective}
                                onClick={async () => {
                                  setRewriting(true);
                                  try {
                                    const res = await apiRequest(`/archiving/rewrite/${selected.id}`, {
                                      method: "POST",
                                      body: JSON.stringify({ perspectives: [r.perspective] }),
                                    });
                                    if (res.ok) {
                                      const d = await res.json();
                                      if (d.content) setDraft(d.content);
                                    } else { alert("재작성 실패"); }
                                  } catch { alert("네트워크 오류"); }
                                  setRewriting(false);
                                }}
                                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 transition text-xs"
                              >
                                <span className="text-gray-700">{r.name} 관점</span>
                                <span className={`font-bold ${scoreColor}`}>{r.score}/10</span>
                              </button>
                            );
                          })}
                          <button
                            onClick={async () => {
                              setRewriting(true);
                              try {
                                const res = await apiRequest(`/archiving/rewrite/${selected.id}`, {
                                  method: "POST",
                                  body: JSON.stringify({ perspectives: savedReviews.map(r => r.perspective) }),
                                });
                                if (res.ok) {
                                  const d = await res.json();
                                  if (d.content) setDraft(d.content);
                                } else { alert("재작성 실패"); }
                              } catch { alert("네트워크 오류"); }
                              setRewriting(false);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-violet-50 transition text-xs font-medium text-violet-700 border-t border-gray-100"
                          >
                            전체 피드백 반영
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 py-2">평가 후 AI 재작성 가능</span>
                  )}
                  <button
                    onClick={() => { setEditing(false); setDraft(selected.content ?? ""); }}
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-4 flex gap-2">
                  <button
                    onClick={() => setEditing(true)}
                    className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                  >
                    편집
                  </button>
                </div>
                {selected.content ? (() => {
                  // <!-- TAB: 이름 --> 구분자로 탭 분리
                  const tabRegex = /<!-- TAB: (.+?) -->/g;
                  const tabNames: string[] = [];
                  let match;
                  while ((match = tabRegex.exec(selected.content)) !== null) {
                    tabNames.push(match[1]);
                  }

                  if (tabNames.length === 0) {
                    // 탭 구분자 없으면 기존처럼 전체 표시
                    return (
                      <div className="prose prose-sm max-w-none whitespace-pre-wrap rounded-lg border border-gray-100 bg-white p-6 text-gray-800">
                        {selected.content}
                      </div>
                    );
                  }

                  // 탭별 콘텐츠 분리
                  const sections = selected.content.split(/<!-- TAB: .+? -->/).filter(Boolean);
                  const safeTab = Math.min(activeTab, tabNames.length - 1);
                  const tabColors = [
                    "border-slate-600 text-slate-800",
                    "border-blue-500 text-blue-700",
                    "border-amber-500 text-amber-700",
                    "border-green-500 text-green-700",
                    "border-purple-500 text-purple-700",
                  ];

                  return (
                    <div>
                      {/* 탭 바 */}
                      <div className="flex gap-1 mb-4 border-b border-gray-200">
                        {tabNames.map((name, i) => (
                          <button
                            key={i}
                            onClick={() => setActiveTab(i)}
                            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
                              safeTab === i
                                ? tabColors[i % tabColors.length]
                                : "border-transparent text-gray-400 hover:text-gray-600"
                            }`}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                      {/* 탭 콘텐츠 */}
                      <div className="prose prose-sm max-w-none whitespace-pre-wrap rounded-lg border border-gray-100 bg-white p-6 text-gray-800">
                        {sections[safeTab]?.trim() || "(이 탭은 아직 비어있습니다)"}
                      </div>
                    </div>
                  );
                })() : (
                  <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-12 text-center">
                    <p className="text-sm text-gray-400">아직 작성된 내용이 없습니다</p>
                    <button
                      onClick={() => setEditing(true)}
                      className="mt-3 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                    >
                      작성 시작
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Right Sidebar ── */}
      <div className="w-72 shrink-0 flex flex-col border-l border-gray-200 bg-gray-50/50">
        {/* 전체 아카이빙 현황 (항상 표시) */}
        {progress && (
          <div className="shrink-0 border-b border-gray-200 p-3 bg-white">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">아카이빙 현황</p>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div className="h-2.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.round(((progress.total - progress.empty) / progress.total) * 100)}%` }} />
              </div>
              <span className="text-xs font-bold text-gray-700">{Math.round(((progress.total - progress.empty) / progress.total) * 100)}%</span>
            </div>
            <div className="flex gap-1.5 text-[10px] mb-3">
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">{progress.published}</span>
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">{progress.review}</span>
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">{progress.draft}</span>
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-500">{progress.empty}</span>
            </div>
            {/* Part별 프로그레스 — 클릭→해당 Part 첫 아티클 이동 */}
            <div className="space-y-1">
              {(progress.by_part ?? []).sort((a, b) => a.part_number - b.part_number).map(p => {
                const pct = Math.round((p.filled / Math.max(p.total, 1)) * 100);
                const firstArticle = toc.find(t => t.part_number === p.part_number);
                return (
                  <button
                    key={p.part_number}
                    onClick={() => firstArticle && selectArticle(firstArticle.id)}
                    className="flex items-center gap-1.5 w-full hover:bg-gray-100 rounded px-0.5 py-0.5 transition-colors group"
                    title={`Part ${p.part_number}. ${p.part_title}`}
                  >
                    <span className="w-5 text-[9px] text-gray-400 text-right shrink-0 group-hover:text-gray-700">{p.part_number === 99 ? '부' : p.part_number}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div className={`h-1.5 rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-400' : 'bg-gray-200'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-[9px] text-gray-400 text-right shrink-0">{p.filled}/{p.total}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 아티클 선택 시: 3탭 */}
        {selected ? (
          <>
          <div className="flex border-b border-gray-200 shrink-0">
            {([["info","정보"],["review","평가"],["refs","참고"],["ai","AI"]] as const).map(([key, label]) => (
              <button key={key} onClick={() => setRightTab(key)}
                className={`flex-1 py-2 text-[11px] font-semibold transition-colors ${
                  rightTab === key ? "text-slate-800 border-b-2 border-slate-800 bg-white" : "text-gray-400 hover:text-gray-600"
                }`}>{label}</button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {/* ── 정보 탭 ── */}
            {rightTab === "info" && (<>
              {/* 아카이빙 단계 */}
              <div className="mb-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">아카이빙 단계</p>
                {(() => {
                  const isPublished = selected.status === "published";
                  const hasWorkLog = (selected.content || '').includes('TAB: 작업 기록');
                  const hasFlow = (selected.content || '').includes('TAB: 시스템 흐름도');
                  const hasConcept = (selected.content || '').includes('TAB: 개념 설명');
                  const hasGuide = (selected.content || '').includes('TAB: 업무 지침');
                  const hasEssay = (selected.content || '').includes('TAB: 에세이');
                  const hasPaper = (selected.content || '').includes('TAB: 논문형');
                  const hasBlog = (selected.content || '').includes('TAB: 블로그');
                  const steps = [
                    { label: "작업 기록", done: hasWorkLog, desc: "코드/설계/데이터" },
                    { label: "시스템 흐름도", done: hasFlow, desc: "데이터 흐름" },
                    { label: "개념 설명", done: hasConcept, desc: "왜 이렇게" },
                    { label: "업무 지침", done: hasGuide, desc: "실무 가이드" },
                    { label: "에세이", done: hasEssay, desc: "느낀 것" },
                    { label: "논문형", done: hasPaper, desc: "인과관계" },
                    { label: "블로그", done: hasBlog, desc: "공감대" },
                    { label: "검토/퇴고", done: isPublished, desc: "Founder" },
                  ];
                  return (
                    <div className="space-y-1">
                      {steps.map((step, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className={`h-3 w-3 shrink-0 rounded-full border-2 flex items-center justify-center ${
                            step.done ? "border-green-500 bg-green-500" : i === steps.findIndex(s => !s.done) ? "border-amber-400 bg-amber-50" : "border-gray-200 bg-white"
                          }`}>
                            {step.done && <svg className="h-1.5 w-1.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <span className={`text-[11px] ${step.done ? "text-green-700 font-medium" : i === steps.findIndex(s => !s.done) ? "text-amber-700 font-medium" : "text-gray-300"}`}>{step.label}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* 메타 정보 */}
              <div className="mb-3 space-y-1 text-[11px] text-gray-500">
                <div className="flex justify-between"><span>담당</span><span className="text-gray-700">{roleLabel[selected.assigned_to] ?? selected.assigned_to}</span></div>
                <div className="flex justify-between"><span>작성자</span><span className="text-gray-700">{selected.author_name || "-"}</span></div>
                <div className="flex justify-between"><span>분량</span><span>{selected.word_count.toLocaleString()}자</span></div>
                <div className="flex justify-between"><span>수정</span><span>{revisions.length}회</span></div>
              </div>

              {/* 수정 이력 */}
              {revisions.length > 0 && (
                <details className="group">
                  <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">수정 이력 ({revisions.length})</summary>
                  <div className="space-y-2">
                    {revisions.slice(0, 5).map((rev) => {
                      const d = new Date(rev.created_at);
                      return (
                        <div key={rev.id} className="text-[10px] text-gray-500">
                          <span className="font-medium text-gray-700">{rev.author_name}</span>
                          {rev.revision_note && <span> — {rev.revision_note}</span>}
                          <p className="text-[9px] text-gray-300">{d.toLocaleString("ko-KR")}</p>
                        </div>
                      );
                    })}
                  </div>
                </details>
              )}
            </>)}

            {/* ── 평가 탭 ── */}
            {rightTab === "review" && (<>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">다관점 AI 평가</p>

              {/* 저장된 평가가 있으면 바로 표시 */}
              {savedReviews.length > 0 && !reviewLoading ? (
                <div className="space-y-3">
                  {/* 평가 시점 정보 */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-medium text-slate-600">평가 시점</span>
                      <span className="text-[9px] text-slate-400">
                        {new Date(savedReviews[0].created_at).toLocaleDateString("ko-KR")}
                      </span>
                    </div>
                    <div className="text-[9px] text-slate-500">
                      {savedReviews[0].word_count_at.toLocaleString()}자 기준 · {savedReviews[0].requested_by}
                    </div>
                    {/* 원문 스냅샷 (접기/펼치기) */}
                    <details className="mt-2">
                      <summary className="text-[9px] text-blue-600 cursor-pointer hover:underline">
                        평가받은 원문 보기
                      </summary>
                      <div className="mt-1.5 text-[9px] text-gray-500 bg-white rounded p-2 border border-gray-100 max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                        {savedReviews[0].content_snapshot}
                      </div>
                    </details>
                  </div>

                  {/* 종합 점수 바 */}
                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {savedReviews.map(r => {
                        const c = r.score >= 8 ? "bg-emerald-500" : r.score >= 6 ? "bg-blue-500" : r.score >= 4 ? "bg-amber-500" : "bg-red-500";
                        return (
                          <div key={r.perspective} className="flex items-center gap-1">
                            <span className="text-[9px] text-gray-500">{r.name}</span>
                            <span className={`text-[10px] text-white font-bold px-1.5 py-0.5 rounded ${c}`}>{r.score}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 각 관점 상세 (접기/펼치기) */}
                  {savedReviews.map(r => {
                    const scoreColor = r.score >= 8 ? "text-emerald-600 bg-emerald-50" :
                                       r.score >= 6 ? "text-blue-600 bg-blue-50" :
                                       r.score >= 4 ? "text-amber-600 bg-amber-50" : "text-red-600 bg-red-50";
                    return (
                      <details key={r.perspective} className="group bg-white border border-gray-100 rounded-lg">
                        <summary className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors">
                          <span className="text-[11px] font-medium text-gray-700">{r.name}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${scoreColor}`}>{r.score}/10</span>
                        </summary>
                        <div className="px-3 pb-3 pt-1 text-[10px] text-gray-600 leading-relaxed whitespace-pre-line border-t border-gray-50">
                          {r.review}
                        </div>
                      </details>
                    );
                  })}

                  {/* 보완하기 (편집 모드로 진입) */}
                  <button
                    onClick={() => { setEditing(true); setRightTab("review"); }}
                    className="w-full py-2 rounded-lg text-xs font-medium bg-slate-800 text-white hover:bg-slate-700 transition"
                  >
                    평가 기반으로 보완하기
                  </button>

                  {/* 재평가 */}
                  <button
                    onClick={async () => {
                      if (!confirm("기존 평가를 삭제하고 새로 평가합니다. 진행할까요?")) return;
                      setReviewLoading(true);
                      setSavedReviews([]);
                      try {
                        const res = await apiRequest(`/archiving/review/${selected.id}`, {
                          method: "POST",
                          body: JSON.stringify({ perspectives: ["investor", "academic", "operator", "reader", "tech"] }),
                        });
                        if (res.ok) {
                          const d = await res.json();
                          setReviewResult(d);
                          // 저장된 리뷰 다시 불러오기
                          const r2 = await apiRequest(`/archiving/review/${selected.id}`);
                          if (r2.ok) { const d2 = await r2.json(); setSavedReviews(d2.reviews ?? []); }
                        }
                      } catch { alert("평가 실패"); }
                      setReviewLoading(false);
                    }}
                    className="w-full py-1.5 rounded text-[10px] text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition"
                  >
                    재평가 (현재 내용 기준)
                  </button>
                </div>
              ) : (
                /* 평가 없을 때: 새 평가 시작 */
                <div className="space-y-2">
                  <p className="text-[10px] text-gray-400 mb-2">이 글을 5가지 관점에서 평가합니다</p>
                  <button
                    onClick={async () => {
                      setReviewLoading(true);
                      setReviewResult(null);
                      try {
                        const res = await apiRequest(`/archiving/review/${selected.id}`, {
                          method: "POST",
                          body: JSON.stringify({ perspectives: ["investor", "academic", "operator", "reader", "tech"] }),
                        });
                        if (res.ok) {
                          const d = await res.json();
                          setReviewResult(d);
                          // 저장된 리뷰 불러오기
                          const r2 = await apiRequest(`/archiving/review/${selected.id}`);
                          if (r2.ok) { const d2 = await r2.json(); setSavedReviews(d2.reviews ?? []); }
                        } else {
                          alert("평가 실패");
                        }
                      } catch { alert("네트워크 오류"); }
                      setReviewLoading(false);
                    }}
                    disabled={reviewLoading || !selected.content}
                    className="w-full py-2.5 rounded-lg text-xs font-medium bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {reviewLoading ? "평가 중... (약 30초)" : "5관점 평가 시작"}
                  </button>
                  <div className="grid grid-cols-1 gap-1.5 text-[10px]">
                    {[
                      { icon: "💰", name: "투자자", desc: "시장·차별화·확장성" },
                      { icon: "🎓", name: "도시계획 학자", desc: "이론·논리·실증" },
                      { icon: "🏠", name: "숙소 운영자", desc: "현실성·실용성·비용" },
                      { icon: "📖", name: "일반 독자", desc: "이해도·흥미·공감" },
                      { icon: "💻", name: "시니어 개발자", desc: "아키텍처·확장·자동화" },
                    ].map(p => (
                      <div key={p.name} className="flex items-center gap-2 bg-white rounded-lg px-2.5 py-1.5 border border-gray-100">
                        <span>{p.icon}</span>
                        <div>
                          <span className="font-medium text-gray-700">{p.name}</span>
                          <span className="text-gray-400 ml-1">{p.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>)}

            {/* ── 참고자료 탭 ── */}
            {rightTab === "refs" && (<>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">참고자료 · 논문 · 링크</p>

              {/* 추가 폼 */}
              <div className="mb-4 space-y-1.5 rounded-lg border border-gray-200 bg-white p-2.5">
                <input value={refUrl} onChange={e => setRefUrl(e.target.value)}
                  placeholder="URL" className="w-full rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-700 placeholder:text-gray-300" />
                <input value={refTitle} onChange={e => setRefTitle(e.target.value)}
                  placeholder="제목 (논문명, 사이트명)" className="w-full rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-700 placeholder:text-gray-300" />
                <input value={refNote} onChange={e => setRefNote(e.target.value)}
                  placeholder="메모 (왜 참고하는지)" className="w-full rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-700 placeholder:text-gray-300" />
                <button onClick={async () => {
                  if (!refUrl.trim() && !refTitle.trim()) return;
                  const newRefs = [...refs, { url: refUrl.trim(), title: refTitle.trim(), note: refNote.trim() }];
                  setRefs(newRefs);
                  setRefUrl(""); setRefTitle(""); setRefNote("");
                  // Save to server
                  await apiRequest(`/wiki/articles/${selected.id}`, {
                    method: "PUT",
                    body: JSON.stringify({ content: selected.content || "", references: JSON.stringify(newRefs) }),
                  });
                }} className="w-full rounded bg-slate-800 py-1.5 text-[11px] font-medium text-white hover:bg-slate-700">
                  추가
                </button>
              </div>

              {/* 참고자료 목록 */}
              {refs.length === 0 ? (
                <p className="text-[11px] text-gray-300 italic">아직 참고자료가 없습니다</p>
              ) : (
                <div className="space-y-2">
                  {refs.map((ref, i) => (
                    <div key={i} className="group rounded-lg border border-gray-100 bg-white p-2.5">
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex-1 min-w-0">
                          {ref.url ? (
                            <a href={ref.url} target="_blank" rel="noopener noreferrer"
                              className="text-[11px] font-medium text-blue-600 hover:underline truncate block">
                              {ref.title || ref.url}
                            </a>
                          ) : (
                            <p className="text-[11px] font-medium text-gray-700">{ref.title}</p>
                          )}
                          {ref.note && <p className="text-[10px] text-gray-400 mt-0.5">{ref.note}</p>}
                        </div>
                        <button onClick={async () => {
                          const newRefs = refs.filter((_, j) => j !== i);
                          setRefs(newRefs);
                          await apiRequest(`/wiki/articles/${selected.id}`, {
                            method: "PUT",
                            body: JSON.stringify({ content: selected.content || "", references: JSON.stringify(newRefs) }),
                          });
                        }} className="shrink-0 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs">
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>)}

            {/* ── AI 리서치 탭 ── */}
            {rightTab === "ai" && (<>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">AI 리서치 어시스턴트</p>
              <p className="text-[10px] text-gray-400 mb-3">이 글과 관련된 자료 검색, 논문 찾기, 개념 질문</p>

              {/* 채팅 메시지 */}
              <div className="mb-3 space-y-2 max-h-[calc(100vh-20rem)] overflow-y-auto">
                {chatMessages.length === 0 && (
                  <div className="text-center py-6">
                    <p className="text-[11px] text-gray-300">질문을 입력하세요</p>
                    <div className="mt-2 space-y-1">
                      {[
                        "이 주제의 관련 논문 찾아줘",
                        "도시계획에서 이건 뭐에 해당해?",
                        "유사 사례가 있을까?",
                      ].map((q, i) => (
                        <button key={i} onClick={() => { setChatInput(q); }}
                          className="block w-full rounded bg-gray-100 px-2 py-1.5 text-left text-[10px] text-gray-500 hover:bg-gray-200 transition-colors">
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`rounded-lg p-2.5 text-[11px] leading-relaxed ${
                    msg.role === "user"
                      ? "bg-slate-800 text-white ml-4"
                      : "bg-white border border-gray-100 text-gray-700 mr-2"
                  }`}>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex items-center gap-2 text-[11px] text-gray-400 p-2">
                    <div className="h-2 w-2 rounded-full bg-gray-300 animate-pulse" />
                    생각 중...
                  </div>
                )}
              </div>
            </>)}
          </div>

          {/* AI 입력 (AI 탭일 때만) */}
          {rightTab === "ai" && (
            <div className="shrink-0 border-t border-gray-200 p-2.5">
              <div className="flex gap-1.5">
                <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && !e.shiftKey && chatInput.trim()) {
                      e.preventDefault();
                      const msg = chatInput.trim();
                      setChatInput("");
                      setChatMessages(prev => [...prev, { role: "user", content: msg }]);
                      setChatLoading(true);
                      try {
                        const context = `현재 위키 글: "${selected.title}" (Part ${selected.part_number}. ${selected.part_title})\n내용 요약: ${(selected.content || "").slice(0, 500)}`;
                        const res = await apiRequest("/ai/agent", {
                          method: "POST",
                          body: JSON.stringify({ page: "wiki", message: msg, data: context }),
                        });
                        if (res.ok) {
                          const d = await res.json();
                          setChatMessages(prev => [...prev, { role: "assistant", content: d.response || d.message || "응답 없음" }]);
                        } else {
                          setChatMessages(prev => [...prev, { role: "assistant", content: "오류가 발생했습니다." }]);
                        }
                      } catch {
                        setChatMessages(prev => [...prev, { role: "assistant", content: "네트워크 오류" }]);
                      }
                      setChatLoading(false);
                    }
                  }}
                  placeholder="질문하세요..."
                  className="flex-1 rounded border border-gray-200 px-2.5 py-1.5 text-[11px] text-gray-700 placeholder:text-gray-300 focus:border-slate-500 focus:ring-1 focus:ring-slate-500" />
                <button onClick={async () => {
                  if (!chatInput.trim()) return;
                  const msg = chatInput.trim();
                  setChatInput("");
                  setChatMessages(prev => [...prev, { role: "user", content: msg }]);
                  setChatLoading(true);
                  try {
                    const context = `현재 위키 글: "${selected.title}" (Part ${selected.part_number}. ${selected.part_title})\n내용 요약: ${(selected.content || "").slice(0, 500)}`;
                    const res = await apiRequest("/ai/agent", {
                      method: "POST",
                      body: JSON.stringify({ page: "wiki", message: msg, data: context }),
                    });
                    if (res.ok) {
                      const d = await res.json();
                      setChatMessages(prev => [...prev, { role: "assistant", content: d.response || d.message || "응답 없음" }]);
                    }
                  } catch {}
                  setChatLoading(false);
                }} className="shrink-0 rounded bg-slate-800 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-slate-700">
                  전송
                </button>
              </div>
            </div>
          )}
          </>
        ) : (
          /* 아티클 미선택 시: 최근 작업 로그 + 변경 아티클 */
          <div className="flex-1 overflow-y-auto p-3">
            {/* 최근 변경된 아티클 (클릭→이동) */}
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">최근 변경</p>
            <div className="space-y-1 mb-4">
              {toc
                .filter(t => t.status !== "empty")
                .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                .slice(0, 10)
                .map(item => (
                  <button
                    key={item.id}
                    onClick={() => selectArticle(item.id)}
                    className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left hover:bg-white transition-colors group"
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      item.status === "published" ? "bg-green-500" :
                      item.status === "review" ? "bg-blue-500" :
                      item.status === "draft" ? "bg-amber-500" : "bg-gray-300"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-gray-700 truncate group-hover:text-gray-900">{item.section} {item.title}</div>
                      <div className="text-[9px] text-gray-400">{item.word_count.toLocaleString()}자 · {item.author_name || "—"}</div>
                    </div>
                  </button>
                ))
              }
              {toc.filter(t => t.status !== "empty").length === 0 && (
                <p className="text-[10px] text-gray-300 italic px-2">아직 작성된 아티클이 없습니다</p>
              )}
            </div>

            {/* 아카이빙 작업 로그 (누가/언제/무엇을) */}
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">작업 로그</p>
            <div className="space-y-2">
              {jobs.slice(0, 10).map(job => {
                let articleIds: number[] = [];
                try { articleIds = JSON.parse(job.article_ids || "[]"); } catch {}
                const matchedArticles = toc.filter(t => articleIds.includes(t.id));
                const typeLabel = job.type === "session" ? "TAB 1~4" : job.type === "weekly" ? "TAB 5~7" : "알림";
                const statusIcon = job.status === "completed" ? "✓" : job.status === "failed" ? "✗" : "…";
                const statusColor = job.status === "completed" ? "text-emerald-600" : job.status === "failed" ? "text-red-500" : "text-amber-500";
                const date = new Date(job.created_at);
                const timeStr = `${(date.getMonth()+1)}/${date.getDate()} ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;

                return (
                  <div key={job.id} className="bg-white border border-gray-100 rounded-lg p-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold ${statusColor}`}>{statusIcon}</span>
                        <span className="text-[10px] font-medium text-gray-700">{typeLabel}</span>
                      </div>
                      <span className="text-[9px] text-gray-400">{timeStr}</span>
                    </div>
                    <div className="text-[9px] text-gray-500 mb-1">
                      {job.created_by_name} · {matchedArticles.length}개 아티클
                    </div>
                    {/* 관련 아티클 목록 (클릭→이동) */}
                    <div className="space-y-0.5">
                      {matchedArticles.slice(0, 3).map(a => (
                        <button
                          key={a.id}
                          onClick={() => selectArticle(a.id)}
                          className="flex items-center gap-1 w-full text-left rounded px-1 py-0.5 hover:bg-gray-50 transition-colors"
                        >
                          <span className="text-[9px] text-gray-400 w-6 shrink-0">{a.section}</span>
                          <span className="text-[9px] text-blue-600 hover:underline truncate">{a.title}</span>
                        </button>
                      ))}
                      {matchedArticles.length > 3 && (
                        <span className="text-[9px] text-gray-400 pl-1">+{matchedArticles.length - 3}개 더</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {jobs.length === 0 && (
                <p className="text-[10px] text-gray-300 italic">아카이빙 작업이 없습니다</p>
              )}
            </div>

            {/* 8탭 파이프라인 안내 */}
            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">8탭 파이프라인</p>
              <div className="flex items-center gap-1 text-[9px] flex-wrap">
                <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">empty</span>
                <span className="text-gray-300">→</span>
                <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">draft (1~4)</span>
                <span className="text-gray-300">→</span>
                <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">review (5~7)</span>
                <span className="text-gray-300">→</span>
                <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded">published (8)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
