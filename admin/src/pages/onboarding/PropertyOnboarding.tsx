import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ONBOARDING_CONFIGS } from "./steps";
import { fetchOnboardingFull } from "./api";

export default function PropertyOnboarding() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const propertyId = Number(id);

  const config = ONBOARDING_CONFIGS.accommodation; // 나중에 업종별 분기
  const [stepIdx, setStepIdx] = useState(0);
  const [data, setData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchOnboardingFull(propertyId);
      setData(result);
    } catch { /* */ }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [propertyId]);

  const currentStep = config.steps[stepIdx];
  const StepComponent = currentStep.component;

  const propName = (data.property as Record<string, unknown>)?.name as string || `#${propertyId}`;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button onClick={() => navigate("/properties")} className="text-xs text-gray-400 hover:text-gray-600 mb-1">
            &larr; 공간 관리
          </button>
          <h1 className="text-xl font-bold text-gray-900">{propName} — {config.label}</h1>
        </div>
        <span className="text-xs text-gray-400">Step {stepIdx + 1} / {config.steps.length}</span>
      </div>

      {/* Step Navigation */}
      <div className="mb-6 flex gap-1">
        {config.steps.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setStepIdx(i)}
            className={`flex-1 rounded-lg px-3 py-2.5 text-xs font-medium transition-all ${
              i === stepIdx
                ? "bg-slate-900 text-white shadow-sm"
                : i < stepIdx
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            <span className="block text-[10px] opacity-60 mb-0.5">Step {i + 1}</span>
            {s.label}
          </button>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 min-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-400">로딩 중...</div>
        ) : (
          <StepComponent propertyId={propertyId} data={data} onSaved={loadData} />
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="mt-4 flex justify-between">
        <button
          onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
          disabled={stepIdx === 0}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30"
        >
          이전
        </button>
        {stepIdx < config.steps.length - 1 ? (
          <button
            onClick={() => setStepIdx((i) => i + 1)}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            다음
          </button>
        ) : (
          <button
            onClick={() => navigate("/properties")}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            완료
          </button>
        )}
      </div>
    </div>
  );
}
