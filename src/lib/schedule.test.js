import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { isPastFollowup } from './schedule.js';

const TODAY = '2026-05-10';
const at = (date, status = 'BOOKED') => ({ id: 'f', status, date });
const pad = (n) => String(n).padStart(2, '0');

describe('isPastFollowup', () => {
  it('완료·취소·노쇼는 날짜와 상관없이 지난 일정', () => {
    for (const status of ['FULFILLED', 'CANCELLED', 'NOSHOW']) {
      expect(isPastFollowup(at('2099-01-01', status), TODAY)).toBe(true);
      expect(isPastFollowup(at('2099-01', status), TODAY)).toBe(true);
      expect(isPastFollowup(at(null, status), TODAY)).toBe(true);
    }
  });

  it('일 단위: 어제는 지났고 오늘은 아니다', () => {
    expect(isPastFollowup(at('2026-05-09'), TODAY)).toBe(true);
    expect(isPastFollowup(at('2026-05-10'), TODAY)).toBe(false);
    expect(isPastFollowup(at('2026-05-10T09:00'), TODAY)).toBe(false);
    expect(isPastFollowup(at('2026-05-11'), TODAY)).toBe(false);
  });

  it('월 단위: 그 달이 끝나야 지난 일정', () => {
    expect(isPastFollowup(at('2026-04'), TODAY)).toBe(true);
    expect(isPastFollowup(at('2026-05'), TODAY)).toBe(false);
    expect(isPastFollowup(at('2026-06'), TODAY)).toBe(false);
    expect(isPastFollowup(at('2025-12'), TODAY)).toBe(true);
  });

  it('연도 단위: 그 해가 끝나야 지난 일정', () => {
    expect(isPastFollowup(at('2025'), TODAY)).toBe(true);
    expect(isPastFollowup(at('2026'), TODAY)).toBe(false);
    expect(isPastFollowup(at('2027'), TODAY)).toBe(false);
  });

  it('날짜가 없으면 지난 일정이 아니다', () => {
    expect(isPastFollowup(at(null), TODAY)).toBe(false);
    expect(isPastFollowup(at(undefined), TODAY)).toBe(false);
  });

  it('월 단위 일정은 today의 연·월보다 앞설 때만 지난 일정 (속성)', () => {
    const ym = fc.tuple(fc.integer({ min: 2000, max: 2040 }), fc.integer({ min: 1, max: 12 }));
    fc.assert(fc.property(ym, ym, fc.integer({ min: 1, max: 28 }), ([y, m], [ty, tm], td) => {
      const today = `${ty}-${pad(tm)}-${pad(td)}`;
      expect(isPastFollowup(at(`${y}-${pad(m)}`), today)).toBe(y * 12 + m < ty * 12 + tm);
    }));
  });
});
