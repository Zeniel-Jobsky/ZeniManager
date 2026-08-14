/**
 * Client Registration Page (상담자 등록)
 * Design: 모던 웰니스 미니멀리즘
 */
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { ChevronLeft, User, Phone, Mail, Calendar, Building2, Briefcase, BookOpen, Car, MapPin, Target, Home, FileText } from 'lucide-react';
import { usePageGuard } from '@/hooks/usePageGuard';
import { createClient } from '@/lib/api';
import DaumPostcode from 'react-daum-postcode';

export default function ClientRegister() {
  const { canRender, user } = usePageGuard('counselor');
  const [, navigate] = useLocation();

  const [form, setForm] = useState({
    name: '',
    resident_id: '',
    birth_date: '',
    phone: '',
    email: '',
    age: '',
    gender: 'M',
    address_1: '',
    address_2: '',
    has_car: false,
    can_drive: false,
    education_level: '',
    school: '',
    major: '',
    MBTI: '',
    businessType: '1',
    participationType: '',
    processStage: '초기상담',
    is_working_parttime: false,
    future_card_stat: false,
    capa: '',
    desired_job_1: '',
    desired_job_2: '',
    desired_job_3: '',
    desired_area_1: '',
    desired_area_2: '',
    desired_area_3: '',
    desired_payment: '',
    work_ex_desire: '',
    work_ex_intent_checkbox: false,
    work_ex_type: '',
    work_ex_company: '',
    work_ex_start: '',
    work_ex_end: '',
    work_ex_graduate: '',
    branch: '',
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [showPostcode, setShowPostcode] = useState(false);

  const update = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }));

  // 전화번호 자동 하이픈
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 11);
    let formatted = raw;
    if (raw.length > 7) formatted = `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7)}`;
    else if (raw.length > 3) formatted = `${raw.slice(0, 3)}-${raw.slice(3)}`;
    update('phone', formatted);
  };

  // 주민등록번호 자동 하이픈
  const handleResidentIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '').slice(0, 13);
    const formatted = raw.length > 6 ? `${raw.slice(0, 6)}-${raw.slice(6)}` : raw;
    update('resident_id', formatted);
  };

  // 주민등록번호 입력 시 성별, 생년월일, 나이 자동 계산
  useEffect(() => {
    const res = form.resident_id.replace(/-/g, '');
    if (res.length >= 7) {
      const yearPrefixStr = res.substring(0, 2);
      const month = res.substring(2, 4);
      const day = res.substring(4, 6);
      const genderDigit = res.substring(6, 7);

      let yearPrefix = '19';
      if (['3', '4'].includes(genderDigit)) yearPrefix = '20';

      const fullYear = parseInt(yearPrefix + yearPrefixStr, 10);
      const birthDateStr = `${fullYear}-${month}-${day}`;

      let gender = form.gender;
      if (['1', '3'].includes(genderDigit)) gender = 'M';
      if (['2', '4'].includes(genderDigit)) gender = 'F';

      const currentYear = new Date().getFullYear();
      let calculatedAge = currentYear - fullYear;

      setForm(f => ({ ...f, birth_date: birthDateStr, age: calculatedAge.toString(), gender }));
    }
  }, [form.resident_id]);

  const handleCompleteAddress = (data: any) => {
    let fullAddress = data.address;
    let extraAddress = '';

    if (data.addressType === 'R') {
      if (data.bname !== '') extraAddress += data.bname;
      if (data.buildingName !== '') extraAddress += (extraAddress !== '' ? `, ${data.buildingName}` : data.buildingName);
      fullAddress += (extraAddress !== '' ? ` (${extraAddress})` : '');
    }

    update('address_1', fullAddress);
    setShowPostcode(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.resident_id) {
      toast.error('이름, 연락처, 주민번호는 필수 입력 항목입니다.');
      return;
    }

    // 전화번호 형태 검증 010-XXXX-XXXX
    const phoneRegex = /^010-\d{4}-\d{4}$/;
    if (!phoneRegex.test(form.phone)) {
      toast.error('전화번호 형식이 올바르지 않습니다. (예: 010-1234-5678)');
      return;
    }

    setLoading(true);

    try {
      await createClient({
        name: form.name,
        resident_id: form.resident_id,
        birth_date: form.birth_date || null,
        age: form.age ? parseInt(form.age, 10) : null,
        gender: form.gender,
        phone: form.phone,
        address_1: form.address_1,
        address_2: form.address_2,
        has_car: form.has_car,
        can_drive: form.can_drive,
        education_level: form.education_level || null,
        school: form.school || null,
        major: form.major || null,
        MBTI: form.MBTI || null,
        business_type: form.businessType ? form.businessType : null,
        participation_type: form.participationType || null,
        participation_stage: form.processStage || null,
        is_working_parttime: form.is_working_parttime,
        future_card_stat: form.future_card_stat ? 1 : 0,
        capa: form.capa || null,
        desired_job_1: form.desired_job_1 || null,
        desired_job_2: form.desired_job_2 || null,
        desired_job_3: form.desired_job_3 || null,
        desired_area_1: form.desired_area_1 || null,
        desired_area_2: form.desired_area_2 || null,
        desired_area_3: form.desired_area_3 || null,
        desired_payment: form.desired_payment ? parseInt(form.desired_payment, 10) : null,
        work_ex_desire: form.work_ex_desire ? parseInt(form.work_ex_desire, 10) : null,
        work_ex_type: form.work_ex_type ? parseInt(form.work_ex_type, 10) : null,
        work_ex_company: form.work_ex_company || null,
        work_ex_start: form.work_ex_start || null,
        work_ex_end: form.work_ex_end || null,
        work_ex_graduate: form.work_ex_graduate ? parseInt(form.work_ex_graduate, 10) : null,
        memo: form.notes || null,
        counselor_id: user?.id || null,
      } as any);

      toast.success(`${form.name}님이 등록되었습니다.`);
      navigate('/clients/list');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || '상담자 등록 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!canRender) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/clients/list')}
          className="p-1.5 rounded-sm hover:bg-muted transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">상담자 통합 등록</h1>
          <p className="text-sm text-muted-foreground mt-0.5">상세한 신규 상담자 정보를 입력하세요</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Basic Info */}
        <div className="bg-card rounded-md p-5 shadow-sm border border-border space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 border-b border-border pb-2">
            <User size={15} /> 기본 정보
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">이름 <span className="text-destructive">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={e => update('name', e.target.value)}
                placeholder="홍길동"
                className="w-full px-3 py-2 rounded-sm border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">연락처 <span className="text-destructive">*</span></label>
              <input
                type="tel"
                value={form.phone}
                onChange={handlePhoneChange}
                placeholder="010-0000-0000"
                maxLength={13}
                className="w-full px-3 py-2 rounded-sm border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="col-span-1 md:col-span-1">
              <label className="block text-sm font-medium mb-1.5">주민등록번호 <span className="text-destructive">*</span></label>
              <input
                type="text"
                value={form.resident_id}
                onChange={handleResidentIdChange}
                placeholder="900101-1234567"
                maxLength={14}
                className="w-full px-3 py-2 rounded-sm border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">생년월일 / 나이 (자동입력)</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={form.birth_date}
                  onChange={e => update('birth_date', e.target.value)}
                  className="flex-1 px-3 py-2 rounded-sm border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  type="number"
                  value={form.age}
                  readOnly
                  placeholder="나이"
                  className="w-16 px-2 py-2 rounded-sm border border-input bg-muted text-sm text-center"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">성별 (자동입력)</label>
              <select
                value={form.gender}
                disabled
                className="w-full px-3 py-2 rounded-sm border border-input bg-muted text-sm"
              >
                <option value="M">남성</option>
                <option value="F">여성</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">거주지 주소</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.address_1}
                readOnly
                placeholder="도로명 주소를 검색하세요"
                className="flex-1 px-3 py-2 rounded-sm border border-input bg-muted text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPostcode(!showPostcode)}
                className="btn-secondary px-4 py-2"
              >
                {showPostcode ? '닫기' : '주소 검색'}
              </button>
            </div>
            {showPostcode && (
              <div className="border border-input rounded-sm overflow-hidden mb-2 relative z-10">
                <DaumPostcode onComplete={handleCompleteAddress} autoClose />
              </div>
            )}
            <input
              type="text"
              value={form.address_2}
              onChange={e => update('address_2', e.target.value)}
              placeholder="상세 주소 (동, 호수 등)"
              className="w-full px-3 py-2 rounded-sm border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Section 2: Education & Skills */}
        <div className="bg-card rounded-md p-5 shadow-sm border border-border space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 border-b border-border pb-2">
            <BookOpen size={15} /> 학력 및 부가정보
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">최종 학력</label>
              <select
                value={form.education_level}
                onChange={e => update('education_level', e.target.value)}
                className="w-full px-3 py-2 rounded-sm border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">선택 안함</option>
                {['초졸', '중졸', '고졸', '전문대졸', '대졸', '석사', '박사'].map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">학교명</label>
              <input
                type="text"
                value={form.school}
                onChange={e => update('school', e.target.value)}
                placeholder="OO대학교"
                className="w-full px-3 py-2 rounded-sm border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">전공</label>
              <input
                type="text"
                value={form.major}
                onChange={e => update('major', e.target.value)}
                placeholder="경영학"
                className="w-full px-3 py-2 rounded-sm border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
            <div>
              <label className="block text-sm font-medium mb-1.5">MBTI</label>
              <select
                value={form.MBTI}
                onChange={e => update('MBTI', e.target.value)}
                className="w-full px-3 py-2 rounded-sm border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">선택 안함</option>
                {['ISTJ', 'ISFJ', 'INFJ', 'INTJ', 'ISTP', 'ISFP', 'INFP', 'INTP', 'ESTP', 'ESFP', 'ENFP', 'ENTP', 'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ'].map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 flex items-center gap-1"><Car size={13} /> 차량/운전</label>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.has_car} onChange={e => update('has_car', e.target.checked)} className="rounded-sm border-input" />
                  자차보유
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.can_drive} onChange={e => update('can_drive', e.target.checked)} className="rounded-sm border-input" />
                  운전가능
                </label>
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1.5">기타 자격/상태</label>
              <div className="flex flex-wrap gap-4 mt-2">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.is_working_parttime} onChange={e => update('is_working_parttime', e.target.checked)} className="rounded-sm border-input" />
                  현재 알바중
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.future_card_stat} onChange={e => update('future_card_stat', e.target.checked)} className="rounded-sm border-input" />
                  내일배움카드 소유
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Job Requirements */}
        <div className="bg-card rounded-md p-5 shadow-sm border border-border space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 border-b border-border pb-2">
            <Target size={15} /> 희망 취업 조건 & 일경험
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3">
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">희망 직종 1</label>
              <input type="text" value={form.desired_job_1} onChange={e => update('desired_job_1', e.target.value)} className="w-full px-2 py-1.5 text-sm border border-input rounded-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">희망 직종 2</label>
              <input type="text" value={form.desired_job_2} onChange={e => update('desired_job_2', e.target.value)} className="w-full px-2 py-1.5 text-sm border border-input rounded-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">희망 직종 3</label>
              <input type="text" value={form.desired_job_3} onChange={e => update('desired_job_3', e.target.value)} className="w-full px-2 py-1.5 text-sm border border-input rounded-sm" />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">희망 지역 1</label>
              <input type="text" value={form.desired_area_1} onChange={e => update('desired_area_1', e.target.value)} className="w-full px-2 py-1.5 text-sm border border-input rounded-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">희망 지역 2</label>
              <input type="text" value={form.desired_area_2} onChange={e => update('desired_area_2', e.target.value)} className="w-full px-2 py-1.5 text-sm border border-input rounded-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">희망 지역 3</label>
              <input type="text" value={form.desired_area_3} onChange={e => update('desired_area_3', e.target.value)} className="w-full px-2 py-1.5 text-sm border border-input rounded-sm" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-border pt-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">희망 연봉 (만원)</label>
              <input type="number" value={form.desired_payment} onChange={e => update('desired_payment', e.target.value)} placeholder="3000" className="w-full px-3 py-2 rounded-sm border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">역량 레벨 (A/B/C/D)</label>
              <select value={form.capa} onChange={e => update('capa', e.target.value)} className="w-full px-3 py-2 rounded-sm border border-input bg-background text-sm">
                <option value="">미작성</option>
                <option value="A">A등급 (구직준비도 높음)</option>
                <option value="B">B등급 (구직역량 필요)</option>
                <option value="C">C등급 (취업의지 부족)</option>
                <option value="D">D등급 (심층상담 필요)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">일경험 필요여부</label>
              <select value={form.work_ex_desire} onChange={e => update('work_ex_desire', e.target.value)} className="w-full px-3 py-2 rounded-sm border border-input bg-background text-sm">
                <option value="">선택 안함</option>
                <option value="1">필요</option>
                <option value="2">미필요</option>
                <option value="3">해당없음</option>
              </select>
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium mb-2">
              <input type="checkbox" checked={form.work_ex_intent_checkbox} onChange={e => update('work_ex_intent_checkbox', e.target.checked)} className="rounded-sm border-input" />
              참여의사 및 상세 정보 작성하기
            </label>
          </div>

          {form.work_ex_intent_checkbox && (
            <div className="bg-muted/30 p-4 border border-border rounded-sm space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">일경험 유형</label>
                  <select value={form.work_ex_type} onChange={e => update('work_ex_type', e.target.value)} className="w-full px-2 py-1.5 text-sm border border-input rounded-sm">
                    <option value="">유형 선택</option>
                    <option value="1">훈련연계형</option>
                    <option value="2">체험형</option>
                    <option value="3">인턴형</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">일경험 참여기업</label>
                  <input type="text" value={form.work_ex_company} onChange={e => update('work_ex_company', e.target.value)} className="w-full px-2 py-1.5 text-sm border border-input rounded-sm" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1 text-muted-foreground">시작일</label>
                  <input type="date" value={form.work_ex_start} onChange={e => update('work_ex_start', e.target.value)} className="w-full px-2 py-1.5 text-sm border border-input rounded-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-muted-foreground">종료일</label>
                  <input type="date" value={form.work_ex_end} onChange={e => update('work_ex_end', e.target.value)} className="w-full px-2 py-1.5 text-sm border border-input rounded-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-muted-foreground">수료 여부</label>
                  <select value={form.work_ex_graduate} onChange={e => update('work_ex_graduate', e.target.value)} className="w-full px-2 py-1.5 text-sm border border-input rounded-sm">
                    <option value="">확인 불가</option>
                    <option value="1">수료</option>
                    <option value="0">미수료</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 4: Counseling Processing Info */}
        <div className="bg-card rounded-md p-5 shadow-sm border border-border space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 border-b border-border pb-2">
            <Briefcase size={15} /> 사업 운영부서 정보
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">위탁 지점</label>
              <input
                type="text"
                value={form.branch}
                onChange={e => update('branch', e.target.value)}
                placeholder="서울 강남지점"
                className="w-full px-3 py-2 rounded-sm border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">참여 사업 유형</label>
              <select
                value={form.businessType}
                onChange={e => update('businessType', e.target.value)}
                className="w-full px-3 py-2 rounded-sm border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="1">취업성공패키지</option>
                <option value="2">국민취업지원제도</option>
                <option value="3">청년도약계좌</option>
                <option value="99">기타</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">참여 유형 분류</label>
              <input
                type="text"
                value={form.participationType}
                onChange={e => update('participationType', e.target.value)}
                placeholder="(예: 1유형, 2유형)"
                className="w-full px-3 py-2 rounded-sm border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">상담 단계</label>
            <div className="flex flex-wrap gap-2">
              {['초기상담', '심층상담', '취업지원', '취업완료', '사후관리'].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => update('processStage', s)}
                  className={`px-4 py-2 rounded-sm text-[13px] font-medium border transition-all ${
                    form.processStage === s ? 'text-white' : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
                  style={form.processStage === s ? { background: '#009C64', borderColor: '#009C64' } : {}}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">기타 특이사항 (메모)</label>
            <textarea
              value={form.notes}
              onChange={e => update('notes', e.target.value)}
              placeholder="내담자 특이사항, 초기진단 결과 등 전달 메모"
              rows={4}
              className="w-full px-3 py-2 rounded-sm border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-2 pb-8">
          <button
            type="button"
            onClick={() => navigate('/clients/list')}
            className="btn-cancel px-6"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary px-8 disabled:opacity-60 text-sm py-2.5"
          >
            {loading ? '등록 처리 중...' : '신규 상담자 DB 등록 확정'}
          </button>
        </div>
      </form>
    </div>
  );
}
