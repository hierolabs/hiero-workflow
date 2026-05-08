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
  const [rightTab, setRightTab] = useState<"info"|"refs"|"ai">("info");

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
      try { setRefs(JSON.parse(a.references || "[]")); } catch { setRefs([]); }
      setChatMessages([]);
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

      {/* ── Right: 3-Tab Sidebar (정보/참고자료/AI) ── */}
      {selected && (
        <div className="w-72 shrink-0 flex flex-col border-l border-gray-200 bg-gray-50/50">
          {/* 탭 헤더 */}
          <div className="flex border-b border-gray-200 shrink-0">
            {([["info","정보"],["refs","참고자료"],["ai","AI 리서치"]] as const).map(([key, label]) => (
              <button key={key} onClick={() => setRightTab(key)}
                className={`flex-1 py-2 text-[11px] font-semibold transition-colors ${
                  rightTab === key ? "text-slate-800 border-b-2 border-slate-800 bg-white" : "text-gray-400 hover:text-gray-600"
                }`}>{label}{key === "refs" && refs.length > 0 ? ` (${refs.length})` : ""}</button>
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
        </div>
      )}
    </div>
  );
}
