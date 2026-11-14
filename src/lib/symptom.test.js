import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { clinicianRows, duration, profile, steps, summaryRows, title } from './symptom.js';

describe('Fix checking: duration', () => {
  it('60분 이상은 시간과 분으로 나눈다', () => {
    expect(duration({ minutes: 90 })).toBe('약 1시간 30분');
    expect(duration({ minutes: 150 })).toBe('약 2시간 30분');
    expect(duration({ minutes: 61 })).toBe('약 1시간 1분');
    expect(duration({ minutes: 1439 })).toBe('약 23시간 59분');
  });

  it('시간 × 60 + 분 = 입력 (속성)', () => {
    fc.assert(fc.property(fc.integer({ min: 60, max: 1440 }), (m) => {
      const out = duration({ minutes: m });
      const [, h, min] = /^약 (\d+)시간(?: (\d+)분)?$/.exec(out) ?? [];
      expect(h, out).toBeDefined();
      expect(Number(h) * 60 + Number(min ?? 0)).toBe(m);
      expect(out).not.toMatch(/NaN|undefined/);
    }));
  });

  it('의료진 화면 한 줄도 같은 글자를 쓴다', () => {
    const rows = clinicianRows({ startDate: '2026-10-28', area: '무릎', side: '', detail: '', minutes: 90, frequency: '가끔', pain: 3 });
    expect(rows.find(([k]) => k === '시간과 빈도')[1]).toBe('약 1시간 30분, 가끔');
  });
});

describe('Preservation: duration', () => {
  it('60분 미만 또는 60의 배수', () => {
    expect(duration({ minutes: 5 })).toBe('약 5분');
    expect(duration({ minutes: 20 })).toBe('약 20분');
    expect(duration({ minutes: 59 })).toBe('약 59분');
    expect(duration({ minutes: 60 })).toBe('약 1시간');
    expect(duration({ minutes: 120 })).toBe('약 2시간');
  });

  it('속성: 60 미만은 "약 N분", 60의 배수는 "약 H시간"', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 59 }), (m) => {
      expect(duration({ minutes: m })).toBe(`약 ${m}분`);
    }));
    fc.assert(fc.property(fc.integer({ min: 1, max: 24 }), (h) => {
      expect(duration({ minutes: h * 60 })).toBe(`약 ${h}시간`);
    }));
  });
});

describe('profile: 증상에 맞게 질문이 바뀐다', () => {
  const base = { side: '', detail: '', startDate: '2026-11-02', minutes: 20, frequency: '가끔', when: '', pain: 5 };
  it('관절 부위: 어느 쪽을 묻고, 움직임과 관련된 때를 고른다', () => {
    const p = profile('무릎');
    expect(p.sided).toBe(true);
    expect(p.whereQ).toBe('어느 쪽 무릎입니까?');
    expect(p.whens).toContain('계단 오를 때');
    expect(title({ ...base, area: '무릎', side: '오른쪽' })).toBe('오른쪽 무릎 불편감');
  });
  it('손목은 목이 아니라 팔 쪽, 발진은 발이 아니라 피부', () => {
    expect(profile('손목').whens).toContain('물건을 들 때');
    expect(profile('발진').kind).toBe('skin');
  });
  it('두통: 쪽 대신 머리 어디인지, 제목에 불편감을 붙이지 않음', () => {
    const p = profile('두통');
    expect(p.sided).toBe(false);
    expect(p.whereQ).toBe('머리 어디가 아프십니까?');
    expect(p.whens).not.toContain('계단 오를 때');
    expect(title({ ...base, area: '두통' })).toBe('두통');
  });
  it('기침: 위치 단계를 건너뛰고 아픔 대신 힘듦으로 묻는다', () => {
    const p = profile('기침');
    expect(steps('기침')).toEqual([1, 2, 4, 5]);
    expect(p.onset).toBe('기침이 시작되면');
    expect(p.howQ).toBe('얼마나 힘드십니까?');
    expect(summaryRows({ ...base, area: '기침' }).map(([k]) => k)).not.toContain('위치');
  });
  it('가려움: 가려운 정도로 묻는다', () => {
    expect(profile('가려움').howQ).toBe('얼마나 가려우십니까?');
    expect(profile('가려움').painLabel).toBe('가려운 정도');
  });
  it('이미 쪽을 쓴 경우 다시 묻지 않음', () => {
    expect(profile('오른쪽 무릎').sided).toBe(false);
  });
  it('모르는 부위: 위치는 묻고 말투는 불편함으로', () => {
    expect(profile('턱').whereQ).toBe('턱 어디쯤입니까?');
    expect(profile('턱').howQ).toBe('얼마나 불편하십니까?');
  });
});

describe('시작한 날·빈도를 모를 때', () => {
  const s = { area: '기침', side: '', detail: '', startDate: '', startTime: '', minutes: 20, frequency: '잘 모르겠어요', when: '', pain: 3 };
  it('요약과 의료진 화면은 모름으로 통일', async () => {
    const m = await import('./symptom.js');
    expect(m.start(s)).toBe('모름');
    expect(m.since(s)).toBe('시작한 날 모름');
    expect(m.oftenShort(s)).toBe('빈도 모름');
    expect(m.clinicianRows(s)[0]).toEqual(['시작', '모름']);
    expect(m.clinicianRows(s)[2][1]).toBe('약 20분, 빈도 모름');
  });
});

describe('symptomSpecialties', () => {
  it('증상과 관련 있는 진료과만', async () => {
    const { symptomSpecialties: f } = await import('./symptom.js');
    expect(f('기침')).not.toContain('49'); // 기침은 치과와 관련 없음
    expect(f('두통')).toContain('02'); // 두통은 신경과
    expect(f('두통')).not.toContain('05');
    expect(f('무릎 불편감')).toContain('05');
    expect(f('오른쪽 무릎')).not.toContain('02');
    expect(f('잇몸이 부었어요')).toEqual(['49']);
    expect(f('눈이 침침')).toEqual(['12']);
    expect(f('알 수 없는 것')).toEqual([]);
  });
});
