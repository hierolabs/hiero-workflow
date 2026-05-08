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

        {/* Quick Access — 드릴다운 형태 */}
        {(() => {
          const published = toc.filter((i) => i.status === "published");
          const drafts = toc.filter((i) => i.status === "draft");
          const reviews = toc.filter((i) => i.status === "review");
          const hasContent = published.length > 0 || drafts.length > 0 || reviews.length > 0;
          if (!hasContent) return null;

          const renderList = (items: TOCItem[], color: { bg: string; bgActive: string; text: string }) =>
            items.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
              .map((item) => (
              <button
                key={item.id}
                onClick={() => selectArticle(item.id)}
                className={`flex w-full items-start gap-2 rounded-md px-2 py-1 text-left transition-colors ${
                  selected?.id === item.id ? color.bgActive : `${color.bg} hover:${color.bgActive}`
                }`}
              >
                <span className="flex-1 truncate text-[11px] font-medium">{item.title}</span>
                <span className={`shrink-0 text-[9px] ${color.text}`}>{item.word_count.toLocaleString()}자</span>
              </button>
            ));

          return (
            <div className="mb-4 space-y-1">
              {/* 진행 카운터 (항상 보임) */}
              {progress && (
                <div className="flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-1.5 text-[10px] text-gray-500 mb-2">
                  <span>{progress.total - progress.empty}/{progress.total} 작성</span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-gray-200">
                    <div className="h-1 rounded-full bg-gray-400 transition-all" style={{ width: `${((progress.total - progress.empty) / Math.max(progress.total, 1)) * 100}%` }} />
                  </div>
                </div>
              )}

              {published.length > 0 && (
                <details className="group">
                  <summary className="flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-1 text-[10px] font-bold uppercase tracking-wider text-green-700 hover:bg-green-50">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                    완료 {published.length}
                    <span className="ml-auto text-[9px] text-green-400 group-open:hidden">펼치기</span>
                  </summary>
                  <div className="mt-1 space-y-0.5">{renderList(published, { bg: "bg-green-50", bgActive: "bg-green-100", text: "text-green-600" })}</div>
                </details>
              )}

              {reviews.length > 0 && (
                <details className="group">
                  <summary className="flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-700 hover:bg-blue-50">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
                    검토중 {reviews.length}
                    <span className="ml-auto text-[9px] text-blue-400 group-open:hidden">펼치기</span>
                  </summary>
                  <div className="mt-1 space-y-0.5">{renderList(reviews, { bg: "bg-blue-50", bgActive: "bg-blue-100", text: "text-blue-600" })}</div>
                </details>
              )}

              {drafts.length > 0 && (
                <details className="group">
                  <summary className="flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 hover:bg-amber-50">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                    초안 {drafts.length}
                    <span className="ml-auto text-[9px] text-amber-400 group-open:hidden">펼치기</span>
                  </summary>
                  <div className="mt-1 space-y-0.5">{renderList(drafts, { bg: "bg-amber-50", bgActive: "bg-amber-100", text: "text-amber-600" })}</div>
                </details>
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
          </div>
        )}
      </div>

      {/* ── Right: Activity Log Sidebar ── */}
      {selected && (
        <div className="w-56 shrink-0 overflow-y-auto border-l border-gray-200 bg-gray-50/50 p-3">

          {/* 전체 아카이빙 현황 (맨 위) */}
          {progress && (() => {
            const completed = progress.published;
            const draftCount = progress.draft;
            const total = progress.total;
            return (
              <div className="mb-3 rounded-lg bg-white p-2.5 border border-gray-100">
                <div className="flex justify-between mb-1.5">
                  <span className="text-[11px] font-medium text-gray-700">전체 아카이빙</span>
                  <span className="text-[10px] text-gray-400">{completed + draftCount} / {total}</span>
                </div>
                <div className="h-1 rounded-full bg-gray-100 mb-2">
                  <div className="h-1 rounded-full bg-green-500 transition-all" style={{ width: `${((completed + draftCount) / Math.max(total, 1)) * 100}%` }} />
                </div>
                <div className="flex gap-3 text-[10px] text-gray-400">
                  <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-green-500" />완료 {completed}</span>
                  <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />초안 {draftCount}</span>
                </div>
              </div>
            );
          })()}

          {/* 아카이빙 단계 (이 글이 어디까지 왔는지) */}
          <div className="mb-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">아카이빙 단계</p>
            {(() => {
              const hasContent = (selected.word_count || 0) > 0;
              const isDraft = selected.status === "draft";
              const isReview = selected.status === "review";
              const isPublished = selected.status === "published";
              const hasRevisions = revisions.length > 1;
              const steps = [
                { label: "초안 작성", done: hasContent, desc: "첫 내용 입력" },
                { label: "검토/보완", done: hasRevisions || isReview || isPublished, desc: "수정 1회+" },
                { label: "발행 완료", done: isPublished, desc: "위키 확정" },
                { label: "블로그 변환", done: false, desc: "외부 발행" },
                { label: "백서/강의", done: false, desc: "콘텐츠 확장" },
              ];
              return (
                <div className="space-y-1">
                  {steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className={`mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 flex items-center justify-center ${
                        step.done
                          ? "border-green-500 bg-green-500"
                          : i === steps.findIndex(s => !s.done)
                            ? "border-amber-400 bg-amber-50"
                            : "border-gray-200 bg-white"
                      }`}>
                        {step.done && <svg className="h-2 w-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                        {!step.done && i === steps.findIndex(s => !s.done) && <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
                      </div>
                      <div>
                        <p className={`text-[11px] leading-tight ${step.done ? "font-semibold text-green-700" : i === steps.findIndex(s => !s.done) ? "font-semibold text-amber-700" : "text-gray-300"}`}>
                          {step.label}
                        </p>
                        <p className="text-[9px] text-gray-400">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* 작성자 한 줄 */}
          <div className="mb-3 text-[11px] text-gray-500">
            <span className="font-semibold text-gray-700">{selected.author_name || "-"}</span>
            {" · "}{selected.word_count.toLocaleString()}자{" · "}수정 {revisions.length}회
          </div>

          {/* 수정 이력 타임라인 */}
          <details className="group" open>
            <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-gray-600 mb-2">
              수정 이력 {revisions.length > 0 && `(${revisions.length})`}
            </summary>
            {revisions.length === 0 ? (
              <p className="text-[11px] text-gray-300 italic pl-1">아직 수정 이력 없음</p>
            ) : (
              <div className="relative">
                <div className="absolute left-[5px] top-2 bottom-2 w-px bg-gray-200" />
                <div className="space-y-2.5">
                  {revisions.map((rev, idx) => {
                    const d = new Date(rev.created_at);
                    const isFirst = idx === 0;
                    return (
                      <div key={rev.id} className="relative pl-4">
                        <div className={`absolute left-0 top-1 h-2.5 w-2.5 rounded-full border-2 ${
                          isFirst ? "border-slate-700 bg-slate-700" : "border-gray-300 bg-white"
                        }`} />
                        <p className={`text-[11px] ${isFirst ? "font-semibold text-gray-800" : "text-gray-500"}`}>
                          {rev.author_name}
                        </p>
                        {rev.revision_note && (
                          <p className="text-[10px] text-gray-400 leading-snug">{rev.revision_note}</p>
                        )}
                        <p className="text-[9px] text-gray-300">
                          {d.getFullYear()}.{String(d.getMonth()+1).padStart(2,"0")}.{String(d.getDate()).padStart(2,"0")} {String(d.getHours()).padStart(2,"0")}:{String(d.getMinutes()).padStart(2,"0")}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </details>

          {/* 드릴다운: 상세 정보 */}
          <details className="mt-4 group">
            <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-gray-600">
              상세 정보
            </summary>
            <div className="mt-2 space-y-1.5 text-[11px] text-gray-500">
              <div className="flex justify-between"><span>담당</span><span className="text-gray-700">{roleLabel[selected.assigned_to] ?? selected.assigned_to}</span></div>
              <div className="flex justify-between"><span>상태</span><span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${statusColor[selected.status]}`}>{statusLabel[selected.status]}</span></div>
              {selected.tags && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {selected.tags.split(",").map((tag, i) => (
                    <span key={i} className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] text-gray-500">{tag.trim()}</span>
                  ))}
                </div>
              )}
            </div>
          </details>

          {/* 드릴다운: 진행률 (접기/펼치기) */}
          {progress && (
            <details className="mt-3 group">
              <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-gray-600">
                전체 진행 {progress.total - progress.empty}/{progress.total}
              </summary>
              <div className="mt-2 space-y-1">
                {(progress.by_part ?? [])
                  .filter(p => p.filled > 0)
                  .sort((a, b) => a.part_number - b.part_number)
                  .map((p) => (
                  <div key={p.part_number} className="flex items-center gap-1.5">
                    <span className="w-6 text-[9px] text-gray-400 shrink-0">P{p.part_number === 99 ? "+" : p.part_number}</span>
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-gray-200">
                      <div className="h-1 rounded-full bg-green-500" style={{ width: `${(p.filled / Math.max(p.total, 1)) * 100}%` }} />
                    </div>
                    <span className="w-6 text-right text-[9px] text-gray-400">{p.filled}/{p.total}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
