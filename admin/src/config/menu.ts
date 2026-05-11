import type { MenuItem, UserRole } from '../types';

const ALL_ROLES: UserRole[] = ['super_admin', 'ceo', 'cto', 'cfo', 'operations', 'cleaning_manager', 'marketing', 'field_manager'];
const MANAGEMENT: UserRole[] = ['super_admin', 'ceo', 'cto', 'cfo', 'operations'];
const FINANCE: UserRole[] = ['super_admin', 'ceo', 'cfo'];
const OPS: UserRole[] = ['super_admin', 'ceo', 'operations', 'cleaning_manager', 'field_manager'];

export const menuItems: MenuItem[] = [
  // 오늘의 업무
  { path: '/today', label: '오늘의 업무', icon: '📌', roles: ALL_ROLES },

  // Founder OS
  { path: '/founder', label: 'Founder', icon: '🎯', roles: ['super_admin'] },
  { path: '/etf-board', label: 'ETF Board', icon: '📊', roles: ['super_admin', 'ceo', 'cto', 'cfo'] },

  // 커뮤니케이션
  { path: '/chat', label: '팀 채팅', icon: '💬', roles: ALL_ROLES },
  { path: '/issue-detections', label: '이슈 감지', icon: '🔔', roles: MANAGEMENT },

  // 기존 메뉴
  { path: '/', label: '대시보드', icon: '📋', roles: ALL_ROLES },
  { path: '/calendar', label: '운영 캘린더', icon: '📅', roles: OPS },
  { path: '/reservations', label: '예약 관리', icon: '🗓️', roles: [...MANAGEMENT, 'field_manager'] },
  { path: '/guest-analytics', label: '게스트 분석', icon: '👤', roles: MANAGEMENT },
  { path: '/properties', label: '숙소 관리', icon: '🏠', roles: MANAGEMENT },
  { path: '/settlement', label: '정산 관리', icon: '💰', roles: FINANCE },
  { path: '/profit', label: '수익성 분석', icon: '📈', roles: FINANCE },
  { path: '/revenue', label: '매출 현황', icon: '💵', roles: [...FINANCE, 'operations'] },
  { path: '/cleaning', label: '청소 관리', icon: '🧹', roles: OPS },
  { path: '/issues', label: '민원/하자', icon: '⚠️', roles: OPS },
  { path: '/diagnosis', label: '사업 진단', icon: '🔍', roles: ['super_admin', 'ceo', 'cto'] },
  { path: '/leads', label: '리드 관리', icon: '🎯', roles: ['super_admin', 'ceo', 'marketing'] },
  { path: '/growth-story', label: '성장 스토리', icon: '📖', roles: MANAGEMENT },
  { path: '/team', label: '팀 관리', icon: '👥', roles: ['super_admin', 'ceo', 'cto'] },
  { path: '/users', label: '사용자 관리', icon: '⚙️', roles: ['super_admin'] },
  { path: '/hostex', label: 'Hostex 연동', icon: '🔗', roles: ['super_admin', 'cto'] },
];

export function getMenuForRole(role: UserRole): MenuItem[] {
  return menuItems.filter(item => item.roles.includes(role));
}

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: '최고 관리자',
  ceo: 'CEO',
  cto: 'CTO',
  cfo: 'CFO',
  operations: '운영 매니저',
  cleaning_manager: '청소 매니저',
  marketing: '마케팅',
  field_manager: '현장 매니저',
};

export const CHANNEL_COLORS: Record<string, string> = {
  airbnb: '#FF5A5F',
  booking: '#003580',
  agoda: '#5C2D91',
  samsam: '#00C4B3',
  liveanywhere: '#FF9500',
  direct: '#34C759',
  hostex: '#6B7280',
};

export const CHANNEL_LABELS: Record<string, string> = {
  airbnb: 'Airbnb',
  booking: 'Booking.com',
  agoda: 'Agoda',
  samsam: '삼삼엠투',
  liveanywhere: '리브애니웨어',
  direct: '직접예약',
  hostex: 'Hostex',
};
