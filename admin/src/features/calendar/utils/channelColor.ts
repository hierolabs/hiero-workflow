interface ChannelStyle {
  bg: string;
  text: string;
}

/**
 * channel_name 기준 색상 매핑 (기존 캘린더 규칙)
 * - Airbnb → 핑크
 * - 삼삼엠투 → 초록
 * - 리브 → 연두
 * - Agoda → 주황
 * - Booking → 파랑(진)
 * - 개인(xxx) → 파랑 계열
 * - 오류검토 / 미납 → 빨강
 */
const channelNameStyles: Record<string, ChannelStyle> = {
  Airbnb:         { bg: "#FF7F7F", text: "#FFFFFF" },
  삼삼엠투:       { bg: "#4CAF50", text: "#FFFFFF" },
  리브:           { bg: "#9CCC65", text: "#FFFFFF" },
  Agoda:          { bg: "#FF9800", text: "#FFFFFF" },
  Booking:        { bg: "#1976D2", text: "#FFFFFF" },
  "개인(박수빈)": { bg: "#2196F3", text: "#FFFFFF" },
  "개인(오재관)": { bg: "#E91E63", text: "#FFFFFF" },
  "개인(김진우)": { bg: "#7E57C2", text: "#FFFFFF" },
  "개인(김진태)": { bg: "#00ACC1", text: "#FFFFFF" },
  "개인(김아영)": { bg: "#00ACC1", text: "#FFFFFF" },
  오류검토:       { bg: "#E91E63", text: "#FFFFFF" },
  미납:           { bg: "#C62828", text: "#FFFFFF" },
};

/** channel_type 기반 폴백 */
const channelTypeFallback: Record<string, ChannelStyle> = {
  airbnb:        { bg: "#FF7F7F", text: "#FFFFFF" },
  agoda:         { bg: "#FF9800", text: "#FFFFFF" },
  "booking.com": { bg: "#1976D2", text: "#FFFFFF" },
  booking:       { bg: "#1976D2", text: "#FFFFFF" },
  hostex_direct: { bg: "#4CAF50", text: "#FFFFFF" },
  direct:        { bg: "#4CAF50", text: "#FFFFFF" },
};

const defaultStyle: ChannelStyle = { bg: "#9E9E9E", text: "#FFFFFF" };

export function getChannelStyle(channelName: string, channelType?: string): ChannelStyle {
  // 1차: channel_name 정확 매칭
  if (channelName && channelNameStyles[channelName]) {
    return channelNameStyles[channelName];
  }
  // 2차: channel_name에 "개인" 포함 시 파랑 계열
  if (channelName && channelName.startsWith("개인")) {
    return { bg: "#2196F3", text: "#FFFFFF" };
  }
  // 3차: channel_type 폴백
  if (channelType) {
    const key = channelType.toLowerCase();
    if (channelTypeFallback[key]) return channelTypeFallback[key];
  }
  return defaultStyle;
}

export function getChannelColor(channelName: string, channelType?: string) {
  return getChannelStyle(channelName, channelType);
}

export function getChannelLabel(channelName: string, channelType?: string): string {
  if (channelName) return channelName;
  const labels: Record<string, string> = {
    airbnb: "Airbnb",
    agoda: "Agoda",
    "booking.com": "Booking",
    booking: "Booking",
    hostex_direct: "직접예약",
  };
  return labels[channelType?.toLowerCase() || ""] || channelType || "기타";
}

/** 금액을 만원 단위로 표시 (예: 152000 → "15.2") */
export function toManwon(amount: number | undefined): string | null {
  if (!amount || amount <= 0) return null;
  return (amount / 10000).toFixed(1);
}

/** 객단가 (1박 금액, 만원 단위) */
export function toPerNight(amount: number | undefined, nights: number): string | null {
  if (!amount || amount <= 0 || !nights) return null;
  return (amount / nights / 10000).toFixed(1);
}
