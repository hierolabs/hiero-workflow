import { useState } from "react";
import { PLACES } from "./data";

interface TaskItem {
  label: string;
  done: boolean;
}

interface KanbanCard {
  name: string;
  district: string;
  gapCount: number;
  tasks: TaskItem[];
}

const GAP_TO_TASK: Record<string, string> = {
  phone: "연락처 표준 데이터 등록",
  hours: "운영시간 등록",
  web: "공식 채널 연결",
  official_channel_missing: "공식 채널 생성 및 연결",
  map_platform_coverage_low: "지도 플랫폼 등록 요청",
  public_memory_sparse: "시민 기록 수집 캠페인",
  photo_data_sparse: "현장 사진 촬영 및 업로드",
  hours_missing: "운영시간 데이터 확보",
  phone_missing: "연락처 확보",
  owner_control_missing: "관리권 소유자 확인",
  address_inconsistent: "주소 데이터 통일",
  hours_inconsistent: "영업시간 교차 검증",
  platform_memory_dependency_high: "다중 플랫폼 분산 등록",
  high_value_data_gap: "핵심 데이터 우선 확보",
};

function buildCards(): KanbanCard[] {
  return PLACES.map((p) => ({
    name: p.name,
    district: p.district,
    gapCount: p.gaps.length,
    tasks: p.gaps.map((g) => ({ label: GAP_TO_TASK[g] || g, done: false })),
  }));
}

type Column = "discovered" | "analyzing" | "structured";

export default function StructurePage() {
  const [columns, setColumns] = useState<Record<Column, KanbanCard[]>>({
    discovered: buildCards(),
    analyzing: [],
    structured: [],
  });

  const moveCard = (from: Column, to: Column, idx: number) => {
    const card = columns[from][idx];
    if (!card) return;
    setColumns((prev) => ({
      ...prev,
      [from]: prev[from].filter((_, i) => i !== idx),
      [to]: [...prev[to], card],
    }));
  };

  const toggleTask = (col: Column, cardIdx: number, taskIdx: number) => {
    setColumns((prev) => {
      const newCols = { ...prev };
      const cards = [...newCols[col]];
      const card = { ...cards[cardIdx] };
      const tasks = [...card.tasks];
      tasks[taskIdx] = { ...tasks[taskIdx], done: !tasks[taskIdx].done };
      card.tasks = tasks;
      cards[cardIdx] = card;
      newCols[col] = cards;
      return newCols;
    });
  };

  const colMeta: { key: Column; label: string; color: string; headerBg: string }[] = [
    { key: "discovered", label: "발견됨", color: "border-blue-300", headerBg: "bg-blue-50 text-blue-700" },
    { key: "analyzing", label: "분석 중", color: "border-yellow-300", headerBg: "bg-yellow-50 text-yellow-700" },
    { key: "structured", label: "구조화 완료", color: "border-green-300", headerBg: "bg-green-50 text-green-700" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">구조화</h1>
        <p className="text-sm text-gray-500 mt-1">발견된 장소의 데이터 공백을 작업으로 전환하고 진행 상태를 관리합니다</p>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {colMeta.map((col) => (
          <div key={col.key} className={`bg-white rounded-lg border-2 ${col.color} min-h-[400px]`}>
            {/* Column Header */}
            <div className={`px-4 py-3 border-b border-gray-200 ${col.headerBg} rounded-t-lg`}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{col.label}</h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-white bg-opacity-60">
                  {columns[col.key].length}건
                </span>
              </div>
            </div>

            {/* Cards */}
            <div className="p-3 space-y-3 max-h-[600px] overflow-y-auto">
              {columns[col.key].map((card, cardIdx) => (
                <div key={card.name} className="bg-gray-50 rounded-lg border border-gray-200 p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{card.name}</p>
                      <p className="text-xs text-gray-500">{card.district}</p>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-red-100 text-red-600">
                      {card.gapCount} 공백
                    </span>
                  </div>

                  {/* Tasks */}
                  <div className="space-y-1.5 mb-3">
                    {card.tasks.map((task, taskIdx) => (
                      <label key={task.label} className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={task.done}
                          onChange={() => toggleTask(col.key, cardIdx, taskIdx)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className={`text-xs ${task.done ? "line-through text-gray-400" : "text-gray-700"}`}>
                          {task.label}
                        </span>
                      </label>
                    ))}
                  </div>

                  {/* Move buttons */}
                  <div className="flex gap-1.5">
                    {col.key !== "discovered" && (
                      <button
                        onClick={() => {
                          const prevCol = colMeta[colMeta.findIndex((c) => c.key === col.key) - 1]?.key;
                          if (prevCol) moveCard(col.key, prevCol, cardIdx);
                        }}
                        className="flex-1 text-xs py-1 rounded bg-gray-200 text-gray-600 hover:bg-gray-300"
                      >
                        ← 이전
                      </button>
                    )}
                    {col.key !== "structured" && (
                      <button
                        onClick={() => {
                          const nextCol = colMeta[colMeta.findIndex((c) => c.key === col.key) + 1]?.key;
                          if (nextCol) moveCard(col.key, nextCol, cardIdx);
                        }}
                        className="flex-1 text-xs py-1 rounded bg-blue-500 text-white hover:bg-blue-600"
                      >
                        다음 →
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {columns[col.key].length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-400">카드가 없습니다</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
