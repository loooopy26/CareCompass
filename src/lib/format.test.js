import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import * as fmt from './format.js';

// 수정 전에는 새 헬퍼가 없으므로, 보존 테스트는 기존 함수로 만든 동등한 식과 비교함.
const specialtyNameRef = fmt.specialtyName ?? ((code, fallback = '') => fmt.specialtyLabel[code] ?? fallback);
const nextVisitTextRef = fmt.nextVisitText
  ?? ((v, { weekday = true } = {}) => (weekday ? fmt.monthDayWeek(v) : fmt.monthDay(v)));

const pad = (n) => String(n).padStart(2, '0');
const ymd = fc.date({ min: new Date(2000, 0, 1), max: new Date(2040, 11, 31), noInvalidDate: true })
  .map((dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`);

describe('Fix checking', () => {
  it('birth: null / undefined / 빈 글자는 던지지 않고 —', () => {
    for (const v of [null, undefined, '']) {
      expect(() => fmt.birth(v)).not.toThrow();
      expect(fmt.birth(v)).toBe('—');
    }
  });

  it('specialtyName: 목록에 없는 코드는 "undefined"를 내지 않는다', () => {
    expect(fmt.specialtyName('99')).toBe('');
    expect(fmt.specialtyName(undefined)).toBe('');
    expect(fmt.specialtyName('99', '99')).toBe('99');
    fc.assert(fc.property(fc.string(), (code) => {
      const out = fmt.specialtyName(code);
      expect(typeof out).toBe('string');
      expect(out).not.toContain('undefined');
      if (!Object.hasOwn(fmt.specialtyLabel, code)) expect(out).toBe('');
    }));
  });

  it('nextVisitText: 월 단위는 "N년 M월 중", 연도만은 "N년 중"', () => {
    expect(fmt.nextVisitText('2027-04')).toBe('2027년 4월 중');
    expect(fmt.nextVisitText('2027')).toBe('2027년 중');
    expect(fmt.nextVisitText('2027-04', { weekday: false })).toBe('2027년 4월 중');
  });

  it('nextVisitText: 월 단위 값에서 일·요일을 만들지 않는다 (속성)', () => {
    fc.assert(fc.property(ymd, (day) => {
      const month = day.slice(0, 7);
      const out = fmt.nextVisitText(month);
      expect(out).toBe(`${Number(month.slice(0, 4))}년 ${Number(month.slice(5, 7))}월 중`);
      expect(out).not.toMatch(/\d+일|요일/);
    }));
  });
});

describe('Preservation', () => {
  it('birth: 유효한 날짜', () => {
    expect(fmt.birth('1990-05-14')).toBe('1990년 5월 14일');
    fc.assert(fc.property(ymd, (day) => {
      const [y, m, dd] = day.split('-').map(Number);
      expect(fmt.birth(day)).toBe(`${y}년 ${m}월 ${dd}일`);
    }));
  });

  it('진료과 5개 코드 라벨', () => {
    const expected = { '01': '내과', '05': '정형외과', '14': '피부과', '49': '치과', SELF: '내 기록' };
    for (const [code, label] of Object.entries(expected)) {
      expect(fmt.specialtyLabel[code]).toBe(label);
      expect(specialtyNameRef(code)).toBe(label);
    }
  });

  it('Home 칩용 specialtyName(s, s)는 기존 specialtyLabel[s] ?? s와 같다', () => {
    fc.assert(fc.property(fc.oneof(fc.string(), fc.constantFrom('01', '05', '14', '49', 'SELF', '99')), (s) => {
      expect(specialtyNameRef(s, s)).toBe(fmt.specialtyLabel[s] ?? s);
    }));
  });

  it('nextVisitText: YYYY-MM-DD[THH:mm]는 monthDayWeek / monthDay와 같다', () => {
    expect(nextVisitTextRef('2026-11-13')).toBe('11월 13일 금요일');
    expect(nextVisitTextRef('2026-11-13', { weekday: false })).toBe('11월 13일');
    fc.assert(fc.property(ymd, fc.boolean(), (day, withTime) => {
      const v = withTime ? `${day}T10:00` : day;
      expect(nextVisitTextRef(v)).toBe(fmt.monthDayWeek(v));
      expect(nextVisitTextRef(v, { weekday: false })).toBe(fmt.monthDay(v));
    }));
  });
});

describe('ampmTime', () => {
  it('24시간 HH:mm을 오전/오후로', () => {
    expect(fmt.ampmTime('00:05')).toBe('오전 12:05');
    expect(fmt.ampmTime('09:40')).toBe('오전 9:40');
    expect(fmt.ampmTime('12:00')).toBe('오후 12:00');
    expect(fmt.ampmTime('15:20')).toBe('오후 3:20');
    expect(fmt.ampmTime('23:55')).toBe('오후 11:55');
  });
});

describe('phone', () => {
  it('입력하면서 하이픈이 붙고, E.164로 오가도 같음', () => {
    expect(fmt.phoneInput('01012345678')).toBe('010-1234-5678');
    expect(fmt.phoneInput('010-123')).toBe('010-123');
    expect(fmt.phoneInput('0101234567')).toBe('010-123-4567');
    expect(fmt.phoneOk('010-1234-5678')).toBe(true);
    expect(fmt.phoneOk('010-12')).toBe(false);
    expect(fmt.toE164('010-1234-5678')).toBe('+821012345678');
    expect(fmt.phoneText('+821012345678')).toBe('010-1234-5678');
    expect(fmt.phoneText(null)).toBe('');
    expect(fmt.toE164('')).toBe('');
  });
});
