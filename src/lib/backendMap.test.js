import { describe, expect, it } from 'vitest';
import { areaCode, errorOf, toClinic, toFollowup, toRecordDetail, toRecordList } from './backendMap.js';

// 백엔드 v0.3 응답 예시 (app/models.py 모양 그대로)
const item = {
  recordId: 'Y2FyZWNvbXBhc3MtZGVtby12MXxFbmNvdW50ZXIvQTEtMDg', resourceType: 'Encounter',
  occurredAt: '2026-10-15T00:00:00Z', datePrecision: 'DATETIME', specialtyCode: '05', specialtySource: 'DEMO_MAPPING',
  organizationName: '가톨릭정형외과의원', title: '무릎 골관절염 정기 추적 진료 8회차', fhirStatus: 'finished', isSynthetic: true,
};

describe('기록', () => {
  it('목록: 이름을 화면 모양으로 바꾸고 dataState를 partial·linking으로', () => {
    const { records, partial, linking } = toRecordList({ items: [item, { ...item, recordId: 'b', fhirStatus: 'cancelled', organizationName: null, occurredAt: null }], nextCursor: null, dataState: 'PARTIAL' });
    expect(partial).toBe(true);
    expect(linking).toBe(false);
    expect(records[0]).toMatchObject({ id: item.recordId, kind: 'visit', specialty: '05', title: item.title, date: item.occurredAt, clinic: '가톨릭정형외과의원', easyStatus: 'unavailable', unread: false, external: true });
    expect(records[0].status).toBeUndefined();
    expect(records[1]).toMatchObject({ status: 'cancelled', date: null, clinic: undefined });
    expect(toRecordList({ items: [], dataState: 'NOT_LOADED' }).linking).toBe(true);
  });

  it('상세: 연결된 기록 제목으로 진단·검사·처방을 채우고, 연결이 덜 되면 missingLinks', () => {
    const r = toRecordDetail({
      record: item, linkageStatus: 'PARTIAL', ingestedAt: '2026-11-01T01:00:00Z', originalUrl: '/v1/me/records/x/fhir',
      clinicalDetails: {}, source: {},
      relatedRecords: [
        { recordId: 'c', resourceType: 'Condition', title: '무릎 골관절염' },
        { recordId: 'o', resourceType: 'Observation', title: '무릎 X-ray' },
        { recordId: 'd', resourceType: 'DiagnosticReport', title: '혈액 검사' },
        { recordId: 'm', resourceType: 'MedicationRequest', title: '아세트아미노펜' },
        { recordId: 'p', resourceType: 'Patient', title: 'A1' },
      ],
    });
    expect(r.diagnosis).toEqual([{ original: '무릎 골관절염' }]);
    expect(r.test).toEqual([{ original: '무릎 X-ray' }, { original: '혈액 검사' }]);
    expect(r.prescription).toEqual([{ name: '아세트아미노펜' }]);
    expect(r).toMatchObject({ missingLinks: true, receivedAt: '2026-11-01T01:00:00Z', note: [], easy: [], author: null });
    expect(toRecordDetail({ record: item, linkageStatus: 'RESOLVED', relatedRecords: [] }).missingLinks).toBe(false);
  });
});

it('자리표시 제목(\'정형외과 / Encounter\', \'Condition / A1-condition-01\')은 보여 주지 않음', () => {
  const r = toRecordDetail({
    record: { ...item, title: '정형외과 / Encounter' }, linkageStatus: 'RESOLVED',
    relatedRecords: [
      { recordId: 'c', resourceType: 'Condition', title: 'Condition / A1-condition-01' },
      { recordId: 'o', resourceType: 'Observation', title: 'Observation / A1-observation-08' },
      { recordId: 'm', resourceType: 'MedicationRequest', title: '아세트아미노펜 500mg' },
    ],
  });
  expect(r.title).toBe('정형외과 진료');
  expect(r.diagnosis).toEqual([{ original: '이름 없는 진단' }]);
  expect(r.test).toEqual([{ original: '이름 없는 검사' }]);
  expect(r.prescription).toEqual([{ name: '아세트아미노펜 500mg' }]);
  expect(toRecordList({ items: [{ ...item, title: 'UNKNOWN / Encounter', specialtyCode: 'UNKNOWN' }] }).records[0].title).toBe('기타 진료과 진료');
  expect(toRecordList({ items: [{ ...item, title: '무릎 / 어깨 통증 진료' }] }).records[0].title).toBe('무릎 / 어깨 통증 진료');
});

describe('일정', () => {
  const base = { followupId: 'f', title: '정형외과 재진 예약', scheduledAt: null, scheduledDate: null, datePrecision: 'UNKNOWN', sourceRecordId: null, isSynthetic: true };
  it('예약: 소문자 FHIR 상태를 화면 상태로, 날짜는 시각 → 날짜 순', () => {
    expect(toFollowup({ ...base, kind: 'APPOINTMENT', sourceStatus: 'booked', scheduledAt: '2026-11-12T01:00:00Z' })).toEqual({ id: 'f', kind: 'APPOINTMENT', status: 'BOOKED', date: '2026-11-12T01:00:00Z', clinic: '', title: '정형외과 재진 예약' });
    expect(toFollowup({ ...base, kind: 'APPOINTMENT', sourceStatus: 'cancelled', scheduledDate: '2026-10-29' })).toMatchObject({ status: 'CANCELLED', date: '2026-10-29' });
    expect(toFollowup({ ...base, kind: 'APPOINTMENT', sourceStatus: 'noshow' }).status).toBe('NOSHOW');
    expect(toFollowup({ ...base, kind: 'APPOINTMENT', sourceStatus: 'fulfilled' }).status).toBe('FULFILLED');
    // 로컬 시연 서버는 대문자로 줌
    expect(toFollowup({ ...base, kind: 'APPOINTMENT', sourceStatus: 'CANCELLED' }).status).toBe('CANCELLED');
  });
  it('계획: CARE_PLAN·SERVICE_REQUEST는 PLAN, 진행 중이면 PLANNED, 날짜 없으면 null', () => {
    expect(toFollowup({ ...base, kind: 'CARE_PLAN', sourceStatus: 'active' })).toMatchObject({ kind: 'PLAN', status: 'PLANNED', date: null });
    expect(toFollowup({ ...base, kind: 'SERVICE_REQUEST', sourceStatus: 'revoked' })).toMatchObject({ kind: 'PLAN', status: 'CANCELLED' });
  });
});

describe('병원', () => {
  it('지역 이름의 시·도를 심평원 코드로, 모르는 지역은 null', () => {
    expect(areaCode('서울')).toBe('seoul');
    expect(areaCode('부산')).toBe('210000');
    expect(areaCode('강원 원주시')).toBe('320000');
    expect(areaCode('세종 세종시')).toBe('410000');
    expect(areaCode('어딘가')).toBeNull();
    expect(areaCode(undefined)).toBeNull();
  });
  it('병원 항목: 진료과 코드 목록, 좌표 이름, 없는 전화번호는 null', () => {
    expect(toClinic({ clinicId: 'hira|abc/=', name: 'A의원', address: '서울 강남구 언주로 601', specialties: [{ code: '05', name: '정형외과' }], latitude: 37.5, longitude: 127.03, distanceMeters: null, dataSource: 'HIRA', sourceUpdatedAt: null, isSynthetic: false }))
      .toEqual({ id: 'hira|abc/=', name: 'A의원', area: '', specialties: ['05'], address: '서울 강남구 언주로 601', phone: null, lat: 37.5, lng: 127.03 });
    expect(toClinic({ clinicId: 'x', name: 'B', address: '', specialties: [], latitude: null, longitude: null })).toMatchObject({ address: null, lat: null, lng: null });
  });
});

it('오류 본문: { error: { code, message } }와 예전 { code, message } 모두 읽음', () => {
  expect(errorOf({ error: { code: 'PATIENT_NOT_LINKED', message: '계정에 연결된 환자 정보가 없습니다.' } })).toEqual({ code: 'PATIENT_NOT_LINKED', message: '계정에 연결된 환자 정보가 없습니다.' });
  expect(errorOf({ message: 'Unauthorized' })).toEqual({ message: 'Unauthorized' });
  expect(errorOf(null)).toBeNull();
});
