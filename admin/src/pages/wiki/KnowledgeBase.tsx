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
  updated_at: string;
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
  const [filter, setFilter] = useState<string>("all"); // all, empty, draft, review, published
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // Fetch TOC + Progress
  const loadData = useCallback(async () => {
    const [tocRes, progRes] = await Promise.all([
      apiRequest("/wiki/toc"),
      apiRequest("/wiki/progress"),
    ]);
    if (tocRes.ok) {
      const d = await tocRes.json();
      setToc(d.items ?? []);
    }
    if (progRes.ok) setProgress(await progRes.json());
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Select article
  const selectArticle = async (id: number) => {
    setEditing(false);
    const [artRes, revRes] = await Promise.all([
      apiRequest(`/wiki/articles/${id}`),
      apiRequest(`/wiki/articles/${id}/revisions`),
    ]);
    if (artRes.ok) {
      const a = await artRes.json();
      setSelected(a);
      setDraft(a.content ?? "");
    }
    if (revRes.ok) {
      const d = await revRes.json();
      setRevisions(d.revisions ?? []);
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

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* ── Left: TOC ── */}
      <div className="w-80 shrink-0 overflow-y-auto border-r border-gray-200 bg-gray-50 p-4">
        <h2 className="text-lg font-bold text-gray-900">Hestory</h2>
        <p className="mb-3 text-xs text-gray-500">heiro.labs의 이야기 — 운영 기록이 자동으로 쌓이는 아카이브</p>

        {/* Quick Access — 완료/초안 바로가기 */}
        {(() => {
          const published = toc.filter((i) => i.status === "published");
          const drafts = toc.filter((i) => i.status === "draft");
          const reviews = toc.filter((i) => i.status === "review");
          const hasContent = published.length > 0 || drafts.length > 0 || reviews.length > 0;
          if (!hasContent) return null;
          return (
            <div className="mb-4 space-y-2">
              {published.length > 0 && (
                <div>
                  <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-green-700">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                    완료 {published.length}
                  </p>
                  <div className="space-y-0.5">
                    {published
                      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                      .map((item) => (
                      <button
                        key={item.id}
                        onClick={() => selectArticle(item.id)}
                        className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                          selected?.id === item.id
                            ? "bg-green-100 text-green-900"
                            : "bg-green-50 text-green-800 hover:bg-green-100"
                        }`}
                      >
                        <span className="flex-1 truncate text-xs font-medium">{item.title}</span>
                        <span className="shrink-0 text-[10px] text-green-600">{item.word_count.toLocaleString()}자</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {reviews.length > 0 && (
                <div>
                  <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
                    검토중 {reviews.length}
                  </p>
                  <div className="space-y-0.5">
                    {reviews
                      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                      .map((item) => (
                      <button
                        key={item.id}
                        onClick={() => selectArticle(item.id)}
                        className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                          selected?.id === item.id
                            ? "bg-blue-100 text-blue-900"
                            : "bg-blue-50 text-blue-800 hover:bg-blue-100"
                        }`}
                      >
                        <span className="flex-1 truncate text-xs font-medium">{item.title}</span>
                        <span className="shrink-0 text-[10px] text-blue-600">{item.word_count.toLocaleString()}자</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {drafts.length > 0 && (
                <div>
                  <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                    초안 {drafts.length}
                  </p>
                  <div className="space-y-0.5">
                    {drafts
                      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                      .map((item) => (
                      <button
                        key={item.id}
                        onClick={() => selectArticle(item.id)}
                        className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                          selected?.id === item.id
                            ? "bg-amber-100 text-amber-900"
                            : "bg-amber-50 text-amber-800 hover:bg-amber-100"
                        }`}
                      >
                        <span className="flex-1 truncate text-xs font-medium">{item.title}</span>
                        <span className="shrink-0 text-[10px] text-amber-600">{item.word_count.toLocaleString()}자</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* 소형 진행 카운터 */}
              {progress && (
                <div className="flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-1.5 text-[10px] text-gray-500">
                  <span>{progress.total - progress.empty}/{progress.total} 작성</span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-1 rounded-full bg-gray-400 transition-all"
                      style={{ width: `${((progress.total - progress.empty) / Math.max(progress.total, 1)) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })()}

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

      {/* ── Right: Article View/Edit ── */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selected ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-400">섹션을 선택하세요</p>
              <p className="mt-1 text-sm text-gray-400">좌측 목차에서 항목을 클릭하면 내용을 보거나 작성할 수 있습니다</p>
              <p className="mt-3 text-xs text-gray-300">예약·청소·이슈·정산 데이터가 자동으로 축적됩니다</p>
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
                <span className="text-xs text-gray-400">
                  담당: {roleLabel[selected.assigned_to] ?? selected.assigned_to}
                </span>
                {selected.author_name && (
                  <span className="text-xs text-gray-400">
                    작성자: {selected.author_name}
                  </span>
                )}
                <span className="text-xs text-gray-400">
                  {selected.word_count.toLocaleString()}자
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
                <div className="mt-3 flex gap-2">
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
                {selected.content ? (
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap rounded-lg border border-gray-100 bg-white p-6 text-gray-800">
                    {selected.content}
                  </div>
                ) : (
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

            {/* Revision History */}
            {revisions.length > 0 && (
              <div className="mt-8">
                <h3 className="mb-3 text-sm font-semibold text-gray-700">수정 이력</h3>
                <div className="space-y-2">
                  {revisions.map((rev) => (
                    <div key={rev.id} className="flex items-center justify-between rounded border border-gray-100 px-3 py-2 text-xs text-gray-600">
                      <span>{rev.author_name} · {rev.word_count.toLocaleString()}자</span>
                      <span>{new Date(rev.created_at).toLocaleString("ko-KR")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Part Progress */}
            {progress && (
              <div className="mt-8 rounded-lg border border-gray-200 bg-white p-4">
                <h3 className="mb-3 text-sm font-semibold text-gray-700">파트별 진행률</h3>
                <div className="space-y-2">
                  {(progress.by_part ?? [])
                    .sort((a, b) => a.part_number - b.part_number)
                    .map((p) => (
                    <div key={p.part_number} className="flex items-center gap-3">
                      <span className="w-40 text-xs text-gray-600 truncate">
                        Part {p.part_number === 99 ? "부록" : p.part_number}. {p.part_title}
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-1.5 rounded-full bg-green-500 transition-all"
                          style={{ width: `${(p.filled / Math.max(p.total, 1)) * 100}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-[10px] text-gray-500">{p.filled}/{p.total}</span>
                    </div>
                  ))}
                </div>

                <h3 className="mb-3 mt-5 text-sm font-semibold text-gray-700">담당자별 진행률</h3>
                <div className="space-y-2">
                  {(progress.by_role ?? []).map((r) => (
                    <div key={r.role} className="flex items-center gap-3">
                      <span className="w-28 text-xs text-gray-600">{roleLabel[r.role] ?? r.role}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-1.5 rounded-full bg-blue-500 transition-all"
                          style={{ width: `${(r.filled / Math.max(r.total, 1)) * 100}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-[10px] text-gray-500">{r.filled}/{r.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
