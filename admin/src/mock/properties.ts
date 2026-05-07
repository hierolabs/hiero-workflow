import type { Property } from '../types';

export const mockProperties: Property[] = [
  { id: 1, code: 'SS-101', name: '성수 레지던스 101', hostex_id: 'HX001', region: '성수', address: '서울 성동구 성수이로 88', property_type: '원룸', status: 'active', owner_name: '김민수', monthly_rent: 800000, management_fee: 100000, cleaning_fee: 35000, created_at: '2024-01-15' },
  { id: 2, code: 'SS-202', name: '성수 로프트 202', hostex_id: 'HX002', region: '성수', address: '서울 성동구 연무장길 45', property_type: '복층', status: 'active', owner_name: '이정은', monthly_rent: 1200000, management_fee: 150000, cleaning_fee: 45000, created_at: '2024-02-01' },
  { id: 3, code: 'HD-301', name: '홍대 스튜디오 301', hostex_id: 'HX003', region: '홍대', address: '서울 마포구 와우산로 112', property_type: '원룸', status: 'active', owner_name: '박지훈', monthly_rent: 700000, management_fee: 80000, cleaning_fee: 30000, created_at: '2024-02-15' },
  { id: 4, code: 'GN-401', name: '강남 프리미엄 401', hostex_id: 'HX004', region: '강남', address: '서울 강남구 테헤란로 156', property_type: '투룸', status: 'active', owner_name: '최유진', monthly_rent: 1500000, management_fee: 200000, cleaning_fee: 50000, created_at: '2024-03-01' },
  { id: 5, code: 'EJ-501', name: '을지로 빈티지 501', hostex_id: 'HX005', region: '을지로', address: '서울 중구 을지로 281', property_type: '원룸', status: 'active', owner_name: '정태욱', monthly_rent: 650000, management_fee: 90000, cleaning_fee: 30000, created_at: '2024-03-10' },
  { id: 6, code: 'JS-601', name: '잠실 파크뷰 601', hostex_id: 'HX006', region: '잠실', address: '서울 송파구 올림픽로 300', property_type: '투룸', status: 'active', owner_name: '한소희', monthly_rent: 1100000, management_fee: 130000, cleaning_fee: 40000, created_at: '2024-04-01' },
  { id: 7, code: 'YD-701', name: '여의도 리버 701', hostex_id: 'HX007', region: '여의도', address: '서울 영등포구 여의대로 108', property_type: '쓰리룸', status: 'active', owner_name: '송민호', monthly_rent: 1800000, management_fee: 250000, cleaning_fee: 55000, created_at: '2024-04-15' },
  { id: 8, code: 'MP-801', name: '마포 테라스 801', hostex_id: 'HX008', region: '마포', address: '서울 마포구 양화로 186', property_type: '복층', status: 'maintenance', owner_name: '윤서연', monthly_rent: 900000, management_fee: 110000, cleaning_fee: 40000, created_at: '2024-05-01' },
  { id: 9, code: 'YS-901', name: '용산 센트럴 901', hostex_id: 'HX009', region: '용산', address: '서울 용산구 한남대로 95', property_type: '펜트하우스', status: 'active', owner_name: '강다니엘', monthly_rent: 2500000, management_fee: 300000, cleaning_fee: 70000, created_at: '2024-05-15' },
  { id: 10, code: 'JR-001', name: '종로 한옥 001', hostex_id: 'HX010', region: '종로', address: '서울 종로구 북촌로 31', property_type: '원룸', status: 'inactive', owner_name: '이하늘', monthly_rent: 600000, management_fee: 70000, cleaning_fee: 25000, created_at: '2024-06-01' },
];
