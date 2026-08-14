// Mock data for the counseling management system

export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  age: number;
  gender: '남' | '여';
  registeredAt: string;
  counselorId: string;
  counselorName: string;
  branch: string;
  processStage: '초기상담' | '심층상담' | '취업지원' | '취업완료' | '사후관리';
  score?: number;
  followUp: boolean;
  employmentStatus: '미취업' | '취업중' | '취업완료';
  businessType: '일반취업' | '창업지원' | '직업훈련' | '취업성공패키지';
  notes?: string;
  sessions: Session[];
}

export interface Session {
  id: string;
  date: string;
  type: '초기상담' | '심층상담' | '취업지원' | '사후관리';
  content: string;
  counselorName: string;
  nextAction?: string;
}

export interface Counselor {
  id: string;
  name: string;
  email: string;
  phone: string;
  branch: string;
  clientCount: number;
  completedCount: number;
  joinedAt: string;
  status: '재직' | '휴직' | '퇴직';
}

export const MOCK_COUNSELORS: Counselor[] = [
  { id: 'c001', name: '김상담', email: 'kim@counsel.com', phone: '010-1234-5678', branch: '서울 강남지점', clientCount: 24, completedCount: 18, joinedAt: '2022-03-15', status: '재직' },
  { id: 'c002', name: '이민준', email: 'lee@counsel.com', phone: '010-2345-6789', branch: '서울 강북지점', clientCount: 31, completedCount: 22, joinedAt: '2021-07-01', status: '재직' },
  { id: 'c003', name: '박지영', email: 'park@counsel.com', phone: '010-3456-7890', branch: '경기 수원지점', clientCount: 19, completedCount: 15, joinedAt: '2023-01-10', status: '재직' },
  { id: 'c004', name: '최수연', email: 'choi@counsel.com', phone: '010-4567-8901', branch: '부산지점', clientCount: 27, completedCount: 20, joinedAt: '2022-09-05', status: '재직' },
  { id: 'c005', name: '정태호', email: 'jung@counsel.com', phone: '010-5678-9012', branch: '대구지점', clientCount: 15, completedCount: 10, joinedAt: '2023-06-20', status: '재직' },
];

export const MOCK_CLIENTS: Client[] = [
  {
    id: 'cl001', name: '홍길동', phone: '010-1111-2222', email: 'hong@example.com',
    age: 35, gender: '남', registeredAt: '2024-01-15',
    counselorId: 'c001', counselorName: '김상담', branch: '서울 강남지점',
    processStage: '취업지원', score: 82, followUp: false,
    employmentStatus: '미취업', businessType: '취업성공패키지',
    sessions: [
      { id: 's001', date: '2024-01-15', type: '초기상담', content: '초기 상담 진행. 구직 의지 확인.', counselorName: '김상담', nextAction: '이력서 작성 지원' },
      { id: 's002', date: '2024-02-01', type: '심층상담', content: '직업 적성 검사 실시. 결과 분석.', counselorName: '김상담', nextAction: '취업처 발굴' },
    ],
  },
  {
    id: 'cl002', name: '김영희', phone: '010-2222-3333', email: 'kim@example.com',
    age: 28, gender: '여', registeredAt: '2024-02-03',
    counselorId: 'c001', counselorName: '김상담', branch: '서울 강남지점',
    processStage: '취업완료', score: 95, followUp: true,
    employmentStatus: '취업완료', businessType: '일반취업',
    sessions: [
      { id: 's003', date: '2024-02-03', type: '초기상담', content: '경력 단절 여성 지원 프로그램 안내.', counselorName: '김상담' },
      { id: 's004', date: '2024-03-10', type: '취업지원', content: '면접 코칭 실시. 합격 통보 수령.', counselorName: '김상담' },
    ],
  },
  {
    id: 'cl003', name: '박철수', phone: '010-3333-4444',
    age: 42, gender: '남', registeredAt: '2024-01-20',
    counselorId: 'c002', counselorName: '이민준', branch: '서울 강북지점',
    processStage: '심층상담', score: 65, followUp: true,
    employmentStatus: '미취업', businessType: '직업훈련',
    sessions: [
      { id: 's005', date: '2024-01-20', type: '초기상담', content: '장기 실업자 지원 프로그램 안내.', counselorName: '이민준' },
    ],
  },
  {
    id: 'cl004', name: '이수진', phone: '010-4444-5555',
    age: 31, gender: '여', registeredAt: '2024-03-05',
    counselorId: 'c001', counselorName: '김상담', branch: '서울 강남지점',
    processStage: '초기상담', followUp: false,
    employmentStatus: '미취업', businessType: '창업지원',
    sessions: [],
  },
  {
    id: 'cl005', name: '최민호', phone: '010-5555-6666',
    age: 26, gender: '남', registeredAt: '2024-03-12',
    counselorId: 'c003', counselorName: '박지영', branch: '경기 수원지점',
    processStage: '취업지원', score: 78, followUp: false,
    employmentStatus: '미취업', businessType: '취업성공패키지',
    sessions: [
      { id: 's006', date: '2024-03-12', type: '초기상담', content: '청년 취업 지원 상담.', counselorName: '박지영' },
      { id: 's007', date: '2024-03-25', type: '심층상담', content: '직무 역량 강화 계획 수립.', counselorName: '박지영' },
    ],
  },
  {
    id: 'cl006', name: '정미래', phone: '010-6666-7777',
    age: 38, gender: '여', registeredAt: '2024-02-18',
    counselorId: 'c002', counselorName: '이민준', branch: '서울 강북지점',
    processStage: '사후관리', score: 90, followUp: true,
    employmentStatus: '취업완료', businessType: '일반취업',
    sessions: [
      { id: 's008', date: '2024-02-18', type: '초기상담', content: '재취업 희망자 상담.', counselorName: '이민준' },
      { id: 's009', date: '2024-03-20', type: '사후관리', content: '취업 후 적응 상담.', counselorName: '이민준' },
    ],
  },
  {
    id: 'cl007', name: '강준서', phone: '010-7777-8888',
    age: 23, gender: '남', registeredAt: '2024-03-01',
    counselorId: 'c001', counselorName: '김상담', branch: '서울 강남지점',
    processStage: '초기상담', followUp: false,
    employmentStatus: '미취업', businessType: '취업성공패키지',
    sessions: [],
  },
  {
    id: 'cl008', name: '윤서연', phone: '010-8888-9999',
    age: 45, gender: '여', registeredAt: '2024-01-08',
    counselorId: 'c004', counselorName: '최수연', branch: '부산지점',
    processStage: '취업완료', score: 88, followUp: false,
    employmentStatus: '취업완료', businessType: '직업훈련',
    sessions: [
      { id: 's010', date: '2024-01-08', type: '초기상담', content: '직업훈련 과정 안내.', counselorName: '최수연' },
    ],
  },
];

// Monthly stats for charts
export const MONTHLY_STATS = [
  { month: '1월', clients: 45, completed: 12, sessions: 89 },
  { month: '2월', clients: 52, completed: 18, sessions: 102 },
  { month: '3월', clients: 61, completed: 22, sessions: 118 },
  { month: '4월', clients: 58, completed: 20, sessions: 110 },
  { month: '5월', clients: 67, completed: 25, sessions: 130 },
  { month: '6월', clients: 72, completed: 28, sessions: 145 },
  { month: '7월', clients: 69, completed: 24, sessions: 138 },
  { month: '8월', clients: 75, completed: 30, sessions: 150 },
  { month: '9월', clients: 80, completed: 35, sessions: 160 },
  { month: '10월', clients: 85, completed: 38, sessions: 170 },
  { month: '11월', clients: 78, completed: 32, sessions: 155 },
  { month: '12월', clients: 90, completed: 42, sessions: 180 },
];

export const BRANCH_STATS = [
  { branch: '서울 강남지점', clients: 145, completed: 98, rate: 67.6 },
  { branch: '서울 강북지점', clients: 132, completed: 85, rate: 64.4 },
  { branch: '경기 수원지점', clients: 98, completed: 60, rate: 61.2 },
  { branch: '부산지점', clients: 112, completed: 78, rate: 69.6 },
  { branch: '대구지점', clients: 87, completed: 55, rate: 63.2 },
];

export const PROCESS_STAGES = [
  { stage: '초기상담', count: 45, color: '#009C64' },
  { stage: '심층상담', count: 32, color: '#00B87A' },
  { stage: '취업지원', count: 28, color: '#F6AD55' },
  { stage: '취업완료', count: 38, color: '#4299E1' },
  { stage: '사후관리', count: 15, color: '#9F7AEA' },
];

// Kanban memo data
export interface MemoCard {
  id: string;
  title: string;
  content: string;
  priority: 'high' | 'medium' | 'low';
  dueDate?: string;
  clientName?: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  cards: MemoCard[];
}

export const INITIAL_KANBAN: KanbanColumn[] = [
  {
    id: 'todo',
    title: '할 일',
    cards: [
      { id: 'm001', title: '홍길동 이력서 검토', content: '이력서 작성 지원 필요', priority: 'high', dueDate: '2024-04-05', clientName: '홍길동' },
      { id: 'm002', title: '취업처 발굴', content: '강남구 IT 기업 리스트업', priority: 'medium', dueDate: '2024-04-10' },
    ],
  },
  {
    id: 'inprogress',
    title: '진행 중',
    cards: [
      { id: 'm003', title: '박철수 직업훈련 연계', content: '용접 기술 훈련 과정 연결 진행 중', priority: 'high', clientName: '박철수' },
    ],
  },
  {
    id: 'done',
    title: '완료',
    cards: [
      { id: 'm004', title: '김영희 취업 확인', content: '취업 완료 확인 및 서류 처리', priority: 'low', clientName: '김영희' },
    ],
  },
];
