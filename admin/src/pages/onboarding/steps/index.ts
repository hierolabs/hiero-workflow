import BasicInfo from "./BasicInfo";
import RoomDetail from "./RoomDetail";
import CostStructure from "./CostStructure";
import PlatformListing from "./PlatformListing";
import CleaningOps from "./CleaningOps";
import Settlement from "./Settlement";

export interface StepDef {
  key: string;
  label: string;
  component: React.ComponentType<StepProps>;
}

export interface StepProps {
  propertyId: number;
  data: Record<string, unknown>;
  onSaved: () => void;
}

// 업종별 온보딩 설정 — 나중에 키만 추가하면 됨
export const ONBOARDING_CONFIGS: Record<string, { label: string; steps: StepDef[] }> = {
  accommodation: {
    label: "숙소 온보딩",
    steps: [
      { key: "basic", label: "기본 정보", component: BasicInfo },
      { key: "room", label: "공간 상세", component: RoomDetail },
      { key: "cost", label: "비용 구조", component: CostStructure },
      { key: "platform", label: "채널 등록", component: PlatformListing },
      { key: "cleaning", label: "청소/운영", component: CleaningOps },
      { key: "settlement", label: "투자자/정산", component: Settlement },
    ],
  },
};
