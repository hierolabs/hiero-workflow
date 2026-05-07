import type { TeamMember } from '../types';

export const mockTeamMembers: TeamMember[] = [
  { id: 1, name: '김진우', login_id: 'jinwoo', role: 'ceo', phone: '010-0000-0001', assigned_regions: ['성수', '을지로', '홍대', '강남', '잠실', '여의도', '마포', '용산', '종로'], managed_properties: 100, active_issues: 1, cleaning_tasks_today: 0, kpi_score: 95 },
  { id: 2, name: '오재관', login_id: 'jaekwan', role: 'operations', phone: '010-0000-0002', assigned_regions: ['성수', '을지로', '홍대', '강남'], managed_properties: 45, active_issues: 4, cleaning_tasks_today: 0, kpi_score: 88 },
  { id: 3, name: '우연', login_id: 'wooyeon', role: 'cleaning_manager', phone: '010-1111-0001', assigned_regions: ['성수', '홍대', '마포'], managed_properties: 30, active_issues: 1, cleaning_tasks_today: 2, kpi_score: 92 },
  { id: 4, name: '김진태', login_id: 'jintae', role: 'field_manager', phone: '010-1111-0002', assigned_regions: ['을지로', '강남', '용산'], managed_properties: 25, active_issues: 1, cleaning_tasks_today: 1, kpi_score: 85 },
  { id: 5, name: '박수빈', login_id: 'subin', role: 'field_manager', phone: '010-1111-0003', assigned_regions: ['잠실', '여의도', '종로'], managed_properties: 25, active_issues: 0, cleaning_tasks_today: 1, kpi_score: 90 },
  { id: 6, name: '관리자', login_id: 'admin', role: 'super_admin', phone: '010-0000-0000', assigned_regions: ['성수', '을지로', '홍대', '강남', '잠실', '여의도', '마포', '용산', '종로'], managed_properties: 100, active_issues: 0, cleaning_tasks_today: 0, kpi_score: 100 },
  { id: 7, name: 'CTO', login_id: 'cto', role: 'cto', phone: '010-0000-0003', assigned_regions: [], managed_properties: 0, active_issues: 0, cleaning_tasks_today: 0, kpi_score: 94 },
  { id: 8, name: 'CFO', login_id: 'cfo', role: 'cfo', phone: '010-0000-0004', assigned_regions: [], managed_properties: 0, active_issues: 0, cleaning_tasks_today: 0, kpi_score: 91 },
  { id: 9, name: '마케팅', login_id: 'marketing', role: 'marketing', phone: '010-0000-0005', assigned_regions: [], managed_properties: 0, active_issues: 0, cleaning_tasks_today: 0, kpi_score: 87 },
];
