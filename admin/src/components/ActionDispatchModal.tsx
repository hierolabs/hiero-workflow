import { useState } from "react";
import {
  createIssue,
  generateCleaningTasks,
  createComm,
  ISSUE_TYPE_LABELS,
} from "../utils/cleaning-api";

export interface DispatchAction {
  priority: string;
  type: string;
  title: string;
  detail: string;
  action: string;
  dispatch_target: string;
  dispatch_payload: Record<string, unknown>;
  property_ids?: number[];
}

interface Props {
  action: DispatchAction;
  onClose: () => void;
  onSuccess: (target: string) => void;
}

const TARGET_LABELS: Record<string, { label: string; desc: string }> = {
  issues: {
    label: "이슈 트래킹",
    desc: "의사결정 이슈로 등록됩니다",
  },
  cleaning: {
    label: "청소 관리",
    desc: "오늘자 청소 태스크가 생성됩니다",
  },
  settlement: {
    label: "정산 관리",
    desc: "정산 이슈로 등록됩니다",
  },
};

const PRIORITY_COLORS: Record<string, string> = {
  P0: "bg-red-600 text-white",
  P1: "bg-orange-500 text-white",
  P2: "bg-yellow-500 text-white",
  P3: "bg-gray-400 text-white",
};

export default function ActionDispatchModal({ action, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const target = TARGET_LABELS[action.dispatch_target] || TARGET_LABELS.issues;
  const payload = action.dispatch_payload || {};

  const handleDispatch = async () => {
    setLoading(true);
    setError("");

    try {
      if (action.dispatch_target === "cleaning") {
        const date = (payload.date as string) || new Date().toISOString().slice(0, 10);
        await generateCleaningTasks(date);
      } else {
        await createIssue({
          issue_type: (payload.issue_type as string) || "decision",
          priority: (payload.priority as string) || action.priority,
          title: (payload.title as string) || action.title,
          description: (payload.description as string) || action.detail,
        });
      }

      // 시스템 로그 기록
      try {
        await createComm({
          comm_type: "system",
          content: `[CEO 대시보드] ${action.title} → ${target.label}에 등록`,
          channel: "internal",
        });
      } catch {
        // 로그 실패는 무시
      }

      onSuccess(action.dispatch_target === "settlement" ? "settlement" : action.dispatch_target);
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className={`rounded px-2 py-0.5 text-xs font-bold ${PRIORITY_COLORS[action.priority] || "bg-gray-500 text-white"}`}>
              {action.priority}
            </span>
            <h3 className="text-lg font-bold text-gray-900">액션 실행</h3>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* 액션 내용 */}
          <div>
            <p className="text-sm font-semibold text-gray-900">{action.title}</p>
            <p className="mt-1 text-sm text-gray-500">{action.detail}</p>
            <p className="mt-2 text-sm font-medium text-blue-700">→ {action.action}</p>
          </div>

          {/* 대상 모듈 */}
          <div className="rounded-md bg-blue-50 border border-blue-200 p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">
                대상 모듈
              </span>
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                {target.label}
              </span>
            </div>
            <p className="mt-1 text-xs text-blue-600">{target.desc}</p>
          </div>

          {/* 생성될 내용 미리보기 */}
          {action.dispatch_target !== "cleaning" && (
            <div className="rounded-md bg-gray-50 border border-gray-200 p-3 space-y-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">생성될 이슈</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-xs text-gray-400">유형</span>
                  <p className="font-medium text-gray-900">
                    {ISSUE_TYPE_LABELS[(payload.issue_type as string)] || payload.issue_type as string}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-400">우선순위</span>
                  <p className="font-medium text-gray-900">{(payload.priority as string) || action.priority}</p>
                </div>
              </div>
              <div>
                <span className="text-xs text-gray-400">제목</span>
                <p className="text-sm font-medium text-gray-900">{(payload.title as string) || action.title}</p>
              </div>
              {payload.description && (
                <div>
                  <span className="text-xs text-gray-400">설명</span>
                  <p className="text-xs text-gray-600 whitespace-pre-line max-h-32 overflow-y-auto">
                    {payload.description as string}
                  </p>
                </div>
              )}
            </div>
          )}

          {action.dispatch_target === "cleaning" && (
            <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">청소 태스크 생성</p>
              <p className="mt-1 text-sm text-gray-700">
                {(payload.date as string) || new Date().toISOString().slice(0, 10)} 기준으로 체크아웃 숙소의 청소 태스크를 생성합니다.
              </p>
              {action.property_ids && action.property_ids.length > 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  대상 숙소 {action.property_ids.length}개
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleDispatch}
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "처리 중..." : "실행"}
          </button>
        </div>
      </div>
    </div>
  );
}
