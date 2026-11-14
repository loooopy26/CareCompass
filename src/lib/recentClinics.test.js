import { describe, expect, it } from 'vitest';
import { MAX_RECENT, pushRecent } from './recentClinics.js';

describe('최근 찾은 병원 큐', () => {
  it('새 병원은 맨 앞, 4곳이 넘으면 가장 먼저 고른 병원이 빠진다', () => {
    let list = [];
    for (const c of ['A', 'B', 'C', 'D', 'E']) list = pushRecent(list, c);
    expect(list).toEqual(['E', 'D', 'C', 'B']);
    expect(list).toHaveLength(MAX_RECENT);
  });
  it('이미 있는 병원을 다시 고르면 맨 앞으로 옮기고 중복은 없다', () => {
    expect(pushRecent(['C', 'B', 'A'], 'A')).toEqual(['A', 'C', 'B']);
  });
});
