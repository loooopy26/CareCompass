import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { loginPath, safeNext } from './redirect.js';

describe('safeNext', () => {
  it('역할에 맞는 앱 안 경로는 그대로 돌려준다', () => {
    for (const p of ['/app/records/r1', '/app/home?x=1', '/app/prep/f1#q']) expect(safeNext(p, 'patient')).toBe(p);
    for (const p of ['/clinician', '/clinician/records/a', '/clinician/scan?x=1']) expect(safeNext(p, 'clinician')).toBe(p);
  });

  it('문자열이 아니거나 비었거나 상대 경로면 null', () => {
    for (const v of [null, undefined, '', 'app/home', 42, {}]) expect(safeNext(v, 'patient')).toBeNull();
  });

  it('다른 사이트로 가는 주소는 null', () => {
    for (const v of ['//evil.com', '//evil.com/app/home', '/\\evil.com', '/app\\..\\evil', 'https://evil.com', 'https://evil.com/app/home', 'javascript:alert(1)']) {
      expect(safeNext(v, 'patient')).toBeNull();
      expect(safeNext(v, 'clinician')).toBeNull();
    }
  });

  it('제어 문자가 섞이면 null', () => {
    expect(safeNext('/app/home\n', 'patient')).toBeNull();
    expect(safeNext('/\t/evil.com', 'patient')).toBeNull();
    expect(safeNext('/app/\u0000home', 'patient')).toBeNull();
  });

  it('로그인 관련 화면은 null', () => {
    for (const v of ['/app/login', '/app/login?next=/app/home', '/app/login/', '/app/signup', '/app/verify', '/app/forgot']) expect(safeNext(v, 'patient')).toBeNull();
    for (const v of ['/clinician/login', '/clinician/new-password', '/clinician/forgot?x=1']) expect(safeNext(v, 'clinician')).toBeNull();
  });

  it('인코딩으로 감춘 로그인 화면이나 깨진 인코딩은 null', () => {
    for (const p of ['/app/%6Cogin', '/app/%6c%6fgin', '/app/%E0%A4%A']) expect(safeNext(p, 'patient')).toBeNull();
    expect(safeNext('/clinician/new%2Dpassword', 'clinician')).toBeNull();
  });

  it('다른 역할의 경로나 비슷한 접두사는 null', () => {
    expect(safeNext('/clinician/patients', 'patient')).toBeNull();
    expect(safeNext('/app/home', 'clinician')).toBeNull();
    expect(safeNext('/apple', 'patient')).toBeNull();
    expect(safeNext('/app', 'patient')).toBeNull();
    expect(safeNext('/clinicianx', 'clinician')).toBeNull();
    expect(safeNext('/app/home', 'admin')).toBeNull();
  });

  it('허용한 값은 항상 같은 앱 안의 경로다 (속성)', () => {
    fc.assert(fc.property(fc.string(), fc.constantFrom('patient', 'clinician'), (s, role) => {
      for (const v of [s, `/${s}`, `/app/${s}`, `/clinician/${s}`]) {
        const out = safeNext(v, role);
        if (out === null) continue;
        expect(out).toBe(v);
        expect(new URL(out, 'http://x.invalid').origin).toBe('http://x.invalid');
        expect(out.startsWith('//')).toBe(false);
      }
    }));
  });
});

describe('loginPath', () => {
  it('역할의 로그인 화면에 next를 인코딩해 붙인다', () => {
    expect(loginPath('patient')).toBe('/app/login');
    expect(loginPath('clinician')).toBe('/clinician/login');
    expect(loginPath('patient', '/app/records/r1?x=1&y=2')).toBe('/app/login?next=%2Fapp%2Frecords%2Fr1%3Fx%3D1%26y%3D2');
    expect(loginPath('clinician', '/clinician/records/a')).toBe('/clinician/login?next=%2Fclinician%2Frecords%2Fa');
  });
});
