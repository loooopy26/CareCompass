import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

// profile.js가 아직 없어도 파일이 로드되도록 glob으로 가져옴 (수정 전 상태 검증용).
const mods = import.meta.glob('./profile.js', { eager: true });
const real = mods['./profile.js']?.isProfileChanged;
const load = () => {
  if (!real) throw new Error('src/lib/profile.js의 isProfileChanged가 없습니다');
  return real;
};
// 수정 전 Me.jsx의 식
const legacy = (form, saved) => form.name.trim() !== saved.name || form.birthdate !== saved.birth;

describe('Fix checking: isProfileChanged', () => {
  it('birth가 null이고 아무것도 안 바꿨으면 false', () => {
    expect(load()({ name: '가', birthdate: '' }, { name: '가', birth: null })).toBe(false);
  });

  it('저장값을 그대로 넣은 폼은 항상 false (속성)', () => {
    fc.assert(fc.property(fc.string().filter((s) => s === s.trim()), fc.option(fc.constantFrom('1990-05-14', '2001-01-01'), { nil: null }), (name, b) => {
      expect(load()({ name, birthdate: b ?? '' }, { name, birth: b })).toBe(false);
    }));
  });
});

describe('Preservation: isProfileChanged', () => {
  const fn = real ?? legacy;

  it('이름이나 생년월일을 실제로 바꾸면 true', () => {
    expect(fn({ name: '나', birthdate: '1990-05-14' }, { name: '가', birth: '1990-05-14' })).toBe(true);
    expect(fn({ name: '가', birthdate: '1991-05-14' }, { name: '가', birth: '1990-05-14' })).toBe(true);
    expect(fn({ name: '가', birthdate: '1990-05-14' }, { name: '가', birth: null })).toBe(true);
  });

  it('바꾸지 않았으면 false', () => {
    expect(fn({ name: '가', birthdate: '1990-05-14' }, { name: '가', birth: '1990-05-14' })).toBe(false);
  });
});

describe('profileForm / isProfileChanged: 선택 항목', () => {
  const saved = { name: '가', birth: '1990-05-14', phone: '+821012345678', gender: '', height: 170, weight: null, conditions: '', medications: '' };
  it('저장값으로 만든 폼은 바뀌지 않음', async () => {
    const { profileForm } = await import('./profile.js');
    const f = profileForm(saved);
    expect(f.phone).toBe('010-1234-5678');
    expect(f.height).toBe('170');
    expect(load()(f, saved)).toBe(false);
    expect(load()({ ...f, medications: '타이레놀' }, saved)).toBe(true);
    expect(load()({ ...f, height: '171' }, saved)).toBe(true);
  });
});
