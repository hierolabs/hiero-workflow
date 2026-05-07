import type {
  DashboardKPI, MonthlyRevenue, ChannelRevenue,
  RegionOccupancy, PropertyProfit, CostBreakdown,
  CleaningStats, ReservationStatusDist,
} from '../types';

export const mockKPI: DashboardKPI = {
  total_properties: 10,
  revenue_by_booking: 18_450_000,   // 5월 예약일 기준
  revenue_by_payment: 15_820_000,   // 5월 입금일 기준
  revenue_by_stay: 16_950_000,      // 5월 숙박일 분할 기준
  avg_occupancy: 78.5,
  adr: 142_000,
  unsettled_amount: 3_680_000,
  problem_properties: 3,            // 마포(수리), 종로(누수), 을지로(침구)
};

export const mockMonthlyRevenue: MonthlyRevenue[] = [
  { month: '2025-12', booking_revenue: 12_300_000, payment_revenue: 11_800_000, stay_revenue: 12_050_000 },
  { month: '2026-01', booking_revenue: 10_500_000, payment_revenue: 10_200_000, stay_revenue: 10_350_000 },
  { month: '2026-02', booking_revenue: 13_200_000, payment_revenue: 12_600_000, stay_revenue: 12_900_000 },
  { month: '2026-03', booking_revenue: 16_800_000, payment_revenue: 15_500_000, stay_revenue: 16_100_000 },
  { month: '2026-04', booking_revenue: 17_200_000, payment_revenue: 16_800_000, stay_revenue: 17_000_000 },
  { month: '2026-05', booking_revenue: 18_450_000, payment_revenue: 15_820_000, stay_revenue: 16_950_000 },
];

export const mockChannelRevenue: ChannelRevenue[] = [
  { channel: 'airbnb', revenue: 7_380_000, bookings: 12, share: 40 },
  { channel: 'booking', revenue: 4_610_000, bookings: 7, share: 25 },
  { channel: 'agoda', revenue: 2_580_000, bookings: 4, share: 14 },
  { channel: 'samsam', revenue: 1_845_000, bookings: 3, share: 10 },
  { channel: 'liveanywhere', revenue: 1_290_000, bookings: 2, share: 7 },
  { channel: 'direct', revenue: 553_000, bookings: 1, share: 3 },
  { channel: 'hostex', revenue: 184_000, bookings: 1, share: 1 },
];

export const mockRegionOccupancy: RegionOccupancy[] = [
  { region: '성수', occupancy: 92, properties: 2 },
  { region: '강남', occupancy: 88, properties: 1 },
  { region: '용산', occupancy: 85, properties: 1 },
  { region: '홍대', occupancy: 82, properties: 1 },
  { region: '잠실', occupancy: 80, properties: 1 },
  { region: '여의도', occupancy: 76, properties: 1 },
  { region: '을지로', occupancy: 72, properties: 1 },
  { region: '마포', occupancy: 0, properties: 1 },
  { region: '종로', occupancy: 0, properties: 1 },
];

export const mockPropertyProfit: PropertyProfit[] = [
  { property_id: 9, property_name: '용산 센트럴 901', region: '용산', revenue: 3_270_000, cost: 2_870_000, profit: 400_000, margin: 12.2 },
  { property_id: 7, property_name: '여의도 리버 701', region: '여의도', revenue: 5_040_000, cost: 4_605_000, profit: 435_000, margin: 8.6 },
  { property_id: 4, property_name: '강남 프리미엄 401', region: '강남', revenue: 2_830_000, cost: 2_450_000, profit: 380_000, margin: 13.4 },
  { property_id: 2, property_name: '성수 로프트 202', region: '성수', revenue: 2_000_000, cost: 1_650_000, profit: 350_000, margin: 17.5 },
  { property_id: 1, property_name: '성수 레지던스 101', region: '성수', revenue: 1_475_000, cost: 1_170_000, profit: 305_000, margin: 20.7 },
  { property_id: 6, property_name: '잠실 파크뷰 601', region: '잠실', revenue: 3_160_000, cost: 2_930_000, profit: 230_000, margin: 7.3 },
  { property_id: 3, property_name: '홍대 스튜디오 301', region: '홍대', revenue: 1_110_000, cost: 910_000, profit: 200_000, margin: 18.0 },
  { property_id: 5, property_name: '을지로 빈티지 501', region: '을지로', revenue: 1_265_000, cost: 1_090_000, profit: 175_000, margin: 13.8 },
  { property_id: 8, property_name: '마포 테라스 801', region: '마포', revenue: 0, cost: 1_010_000, profit: -1_010_000, margin: -100 },
  { property_id: 10, property_name: '종로 한옥 001', region: '종로', revenue: 0, cost: 670_000, profit: -670_000, margin: -100 },
];

export const mockCostBreakdown: CostBreakdown[] = [
  { category: '임대료', amount: 10_750_000, share: 42 },
  { category: '관리비', amount: 3_480_000, share: 14 },
  { category: '청소비', amount: 2_450_000, share: 10 },
  { category: '수수료(채널)', amount: 4_150_000, share: 16 },
  { category: '수리/유지보수', amount: 995_000, share: 4 },
  { category: '소모품', amount: 620_000, share: 2 },
  { category: '인건비', amount: 2_100_000, share: 8 },
  { category: '기타', amount: 1_005_000, share: 4 },
];

export const mockCleaningStats: CleaningStats = {
  total: 15,
  completed: 4,
  in_progress: 1,
  pending: 9,
  skipped: 1,
  completion_rate: 26.7,
};

export const mockReservationStatusDist: ReservationStatusDist[] = [
  { status: 'confirmed', count: 8 },
  { status: 'checked_in', count: 4 },
  { status: 'checked_out', count: 17 },
  { status: 'cancelled', count: 1 },
  { status: 'no_show', count: 0 },
];
