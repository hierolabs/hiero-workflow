// Execution Layer — 역할별 대시보드 설정

export interface TodoRule {
  key: string;
  label: (count: number) => string;
  source: string;         // API response path
  countPath: string;      // dot-path to number
  urgency: 'high' | 'medium' | 'low';
  link: string;
}

export interface SectionConfig {
  type: string;
  title: string;
}

export interface QuickLink {
  label: string;
  path: string;
}

export interface RoleConfig {
  key: string;
  backendKey: string;     // backend에서 사용하는 role 이름
  title: string;
  person: string;
  color: string;          // tailwind bg color
  icon: string;
  apis: string[];         // 호출할 API 목록
  sections: SectionConfig[];
  todoRules: TodoRule[];
  quickLinks: QuickLink[];
}

export const ROLE_CONFIGS: Record<string, RoleConfig> = {
  operations: {
    key: 'operations',
    backendKey: 'operations',
    title: '예약 / 운영 / CS',
    person: '오재관',
    color: 'bg-amber-500',
    icon: 'O',
    apis: ['execution', 'directives', 'checklist', 'calendar', 'messages'],
    sections: [
      { type: 'calendar', title: '오늘 운영 현황' },
      { type: 'messages', title: '미읽은 메시지' },
    ],
    todoRules: [
      {
        key: 'checkin', label: (n) => `체크인 안내 ${n}건`,
        source: 'calendar', countPath: 'today_checkins',
        urgency: 'high', link: '/messages',
      },
      {
        key: 'unread', label: (n) => `미읽은 메시지 ${n}건 응대`,
        source: 'messages', countPath: 'unread',
        urgency: 'high', link: '/messages',
      },
      {
        key: 'checkout', label: (n) => `체크아웃 확인 ${n}건`,
        source: 'calendar', countPath: 'today_checkouts',
        urgency: 'medium', link: '/calendar',
      },
      {
        key: 'delayed', label: (n) => `지연 업무 ${n}건 처리`,
        source: 'execution', countPath: 'delayed_count',
        urgency: 'high', link: '/issues',
      },
      {
        key: 'issues', label: (n) => `미해결 이슈 ${n}건`,
        source: 'execution', countPath: 'today_count',
        urgency: 'medium', link: '/issues',
      },
    ],
    quickLinks: [
      { label: '예약 관리', path: '/reservations' },
      { label: '운영 캘린더', path: '/calendar' },
      { label: '메시지', path: '/messages' },
      { label: '이슈', path: '/issues' },
    ],
  },

  cleaning: {
    key: 'cleaning',
    backendKey: 'cleaning_dispatch',
    title: '예약보조 / 청소배정',
    person: '김우현',
    color: 'bg-cyan-500',
    icon: 'C',
    apis: ['execution', 'directives', 'checklist', 'calendar', 'cleaning', 'cleaningWorkload'],
    sections: [
      { type: 'cleaning', title: '청소 현황' },
      { type: 'cleaningWorkload', title: '청소자별 부하' },
    ],
    todoRules: [
      {
        key: 'turnover', label: (n) => `오늘 턴오버 ${n}건 배정`,
        source: 'calendar', countPath: 'turnover',
        urgency: 'high', link: '/cleaning',
      },
      {
        key: 'pending', label: (n) => `미배정 청소 ${n}건`,
        source: 'cleaning', countPath: 'pending',
        urgency: 'high', link: '/cleaning',
      },
      {
        key: 'inprogress', label: (n) => `진행 중 청소 ${n}건 완료 확인`,
        source: 'cleaning', countPath: 'in_progress',
        urgency: 'medium', link: '/cleaning',
      },
      {
        key: 'tomorrow', label: (n) => `내일 체크인 ${n}건 사전 준비`,
        source: 'calendar', countPath: 'tomorrow_checkins',
        urgency: 'low', link: '/calendar',
      },
      {
        key: 'delayed', label: (n) => `지연 업무 ${n}건`,
        source: 'execution', countPath: 'delayed_count',
        urgency: 'high', link: '/issues',
      },
    ],
    quickLinks: [
      { label: '띵동 배정', path: '/cleaning' },
      { label: '예약 관리', path: '/reservations' },
    ],
  },

  field: {
    key: 'field',
    backendKey: 'field',
    title: '현장 / 세팅 / 데이터',
    person: '김진태',
    color: 'bg-orange-500',
    icon: 'F',
    apis: ['execution', 'directives', 'checklist', 'issues', 'lifecycle'],
    sections: [
      { type: 'issues', title: '시설 이슈' },
      { type: 'lifecycle', title: '세팅 · 촬영 대기' },
    ],
    todoRules: [
      {
        key: 'facility', label: (n) => `시설 이슈 ${n}건 처리`,
        source: 'execution', countPath: 'today_count',
        urgency: 'high', link: '/issues',
      },
      {
        key: 'setting', label: (n) => `세팅 필요 숙소 ${n}건`,
        source: 'lifecycle', countPath: 'setting',
        urgency: 'medium', link: '/properties',
      },
      {
        key: 'delayed', label: (n) => `지연 업무 ${n}건`,
        source: 'execution', countPath: 'delayed_count',
        urgency: 'high', link: '/issues',
      },
    ],
    quickLinks: [
      { label: '숙소 관리', path: '/properties' },
      { label: '이슈', path: '/issues' },
    ],
  },

  marketing: {
    key: 'marketing',
    backendKey: 'marketing',
    title: '마케팅 / 디자인 / 외부영업',
    person: '이예린',
    color: 'bg-pink-500',
    icon: 'M',
    apis: ['execution', 'directives', 'checklist', 'leads', 'lifecycle'],
    sections: [
      { type: 'leads', title: '리드 현황' },
      { type: 'lifecycle', title: '촬영 · OTA 등록 대기' },
    ],
    todoRules: [
      {
        key: 'leads', label: (n) => `활성 리드 ${n}건 관리`,
        source: 'leads', countPath: 'active_leads',
        urgency: 'medium', link: '/leads',
      },
      {
        key: 'filming', label: (n) => `촬영 대기 ${n}건`,
        source: 'lifecycle', countPath: 'filming',
        urgency: 'medium', link: '/properties',
      },
      {
        key: 'ota', label: (n) => `OTA 등록 대기 ${n}건`,
        source: 'lifecycle', countPath: 'ota_registering',
        urgency: 'medium', link: '/properties',
      },
      {
        key: 'delayed', label: (n) => `지연 업무 ${n}건`,
        source: 'execution', countPath: 'delayed_count',
        urgency: 'high', link: '/issues',
      },
    ],
    quickLinks: [
      { label: '리드 관리', path: '/leads' },
      { label: '숙소 관리', path: '/properties' },
    ],
  },
};
