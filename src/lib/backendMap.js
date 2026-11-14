// 백엔드 v0.3 응답 → 화면이 쓰는 모양 (api.ts의 CareRecord, Followup, Clinic 타입).
// 백엔드 계약: carecompass_backend_v01 app/models.py (RecordItem, RecordDetailResponse, FollowupItem, ClinicItem)

import { specialtyName } from './format.js';

// 백엔드 병원 검색의 area 값 (심평원 시·도 코드). 20-a 지역 선택 목록도 이 순서.
// 서울만 'seoul': 배포 서버는 6자리 코드와 'seoul'을, 로컬 시연 서버는 'seoul' 같은 이름만 받아서 둘 다 되는 값으로 보냄
export const HIRA_SIDO = {
  서울: 'seoul', 부산: '210000', 대구: '230000', 인천: '220000', 광주: '240000', 대전: '250000', 울산: '260000', 세종: '410000',
  경기: '310000', 강원: '320000', 충북: '330000', 충남: '340000', 전북: '350000', 전남: '360000', 경북: '370000', 경남: '380000', 제주: '390000',
};
export const SIDO = Object.keys(HIRA_SIDO);
// '부산' → '210000'. 백엔드가 시·군·구 검색을 받지 않아 시·도까지만 보냄
export const areaCode = (areaName) => HIRA_SIDO[String(areaName ?? '').split(' ')[0]] ?? null;

const RECORD_STATUS = new Set(['cancelled', 'entered-in-error']);

// 원본에 제목이 없는 경우: 백엔드가 'Condition / A1-condition-01', '정형외과 / Encounter'처럼 채움. 화면에는 보여 주지 않음
const PLACEHOLDER = /^[^/]+ \/ [A-Za-z][\w.-]*$/;
const named = (title) => (title && !PLACEHOLDER.test(title) ? title : null);

// 목록 한 줄. 백엔드 기록은 모두 병원에서 받은 FHIR 원문이라 external, 쉬운 설명(AI)은 아직 없음
export const toRecord = (it) => ({
  id: it.recordId,
  kind: 'visit',
  specialty: it.specialtyCode,
  title: named(it.title) ?? `${specialtyName(it.specialtyCode) || '병원'} 진료`,
  date: it.occurredAt ?? null,
  clinic: it.organizationName ?? undefined,
  easyStatus: 'unavailable',
  unread: false,
  external: true,
  ...(RECORD_STATUS.has(it.fhirStatus) ? { status: it.fhirStatus } : {}),
});

export const toRecordList = (res) => ({
  records: (res.items ?? []).map(toRecord),
  partial: res.dataState === 'PARTIAL',
  linking: res.dataState === 'NOT_LOADED',
});

// 상세: 연결된 Condition·Observation·MedicationRequest의 제목으로 진단·검사·처방을 채움. 수치·복용 방법·의사 이름은 백엔드가 아직 주지 않음
export const toRecordDetail = (d) => {
  const titles = (fallback, ...types) => (d.relatedRecords ?? []).filter((x) => types.includes(x.resourceType)).map((x) => named(x.title) ?? fallback);
  return {
    ...toRecord(d.record),
    author: null,
    receivedAt: d.ingestedAt ?? undefined,
    note: [],
    easy: [],
    diagnosis: titles('이름 없는 진단', 'Condition').map((original) => ({ original })),
    test: titles('이름 없는 검사', 'Observation', 'DiagnosticReport').map((original) => ({ original })),
    prescription: titles('이름 없는 처방', 'MedicationRequest').map((name) => ({ name })),
    nextVisit: null,
    missingLinks: d.linkageStatus !== 'RESOLVED',
  };
};

// FHIR 원본 상태 → 화면 상태
const APPOINTMENT_STATUS = { fulfilled: 'FULFILLED', cancelled: 'CANCELLED', 'entered-in-error': 'CANCELLED', noshow: 'NOSHOW' };
const PLAN_STATUS = { completed: 'FULFILLED', revoked: 'CANCELLED', 'entered-in-error': 'CANCELLED' };

export const toFollowup = (it) => {
  const appointment = it.kind === 'APPOINTMENT';
  const status = String(it.sourceStatus ?? '').toLowerCase(); // 배포 서버는 'booked', 로컬 시연 서버는 'BOOKED'
  return {
    id: it.followupId,
    kind: appointment ? 'APPOINTMENT' : 'PLAN',
    status: (appointment ? APPOINTMENT_STATUS : PLAN_STATUS)[status] ?? (appointment ? 'BOOKED' : 'PLANNED'),
    date: it.scheduledAt ?? it.scheduledDate ?? null,
    clinic: '', // 백엔드가 일정의 병원 이름을 아직 주지 않음
    title: String(it.title ?? '').replace(/ \(\d{4}-\d{2}-\d{2}\)$/, ''), // 로컬 시연 서버의 '예약 (2026-11-12)': 날짜는 카드에 따로 나옴
  };
};

export const toClinic = (it) => ({
  id: it.clinicId,
  name: it.name,
  area: '',
  specialties: (it.specialties ?? []).map((s) => s.code),
  address: it.address || null,
  phone: null, // 백엔드가 전화번호를 아직 주지 않음
  lat: it.latitude ?? null,
  lng: it.longitude ?? null,
});

// 백엔드 오류 본문 { error: { code, message } }
export const errorOf = (data) => data?.error ?? data ?? null;

// 백엔드 오류 코드 → 앱 문구. 서버 문구(합니다체)나 API Gateway 영어 문구("Unauthorized", "Not Found")를 그대로 보여 주지 않음
const MESSAGES = {
  PATIENT_NOT_LINKED: '계정에 연결된 진료 기록이 아직 없습니다. 병원 관리자에게 문의해 주세요.',
  RECORD_NOT_FOUND: '기록을 찾을 수 없습니다.',
  INVALID_ARGUMENT: '요청 내용을 다시 확인해 주세요.',
  INVALID_CURSOR: '목록을 처음부터 다시 불러와 주세요.',
  UNAUTHENTICATED: '로그인이 만료됐습니다. 다시 로그인해 주세요.',
  FORBIDDEN: '볼 수 있는 권한이 없습니다.',
};
export const messageOf = (status, err) => MESSAGES[err?.code]
  ?? (status === 401 ? MESSAGES.UNAUTHENTICATED : status === 404 ? '아직 준비 중인 기능입니다.' : '잠시 뒤 다시 시도해 주세요.');
