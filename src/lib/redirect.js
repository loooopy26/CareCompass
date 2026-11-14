// 로그인 뒤 돌아갈 주소(?next=). 다른 사이트로 보내는 주소(오픈 리다이렉트)는 받지 않음.
// 같은 앱 안의 역할에 맞는 경로만 허용. 그 밖의 경우: null (부른 쪽이 기본 화면으로 보냄).
const PREFIX = { patient: /^\/app\//, clinician: /^\/clinician(\/|$)/ };
// 로그인 관련 화면으로 돌아가면 되돌이 고리가 생기므로 받지 않음
const AUTH_PAGES = {
  patient: ['/app/login', '/app/signup', '/app/verify', '/app/forgot'],
  clinician: ['/clinician/login', '/clinician/new-password', '/clinician/forgot'],
};
const BASE = 'http://x.invalid';

export function safeNext(next, role) {
  if (typeof next !== 'string' || !PREFIX[role]) return null;
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(next)) return null;
  let url;
  try { url = new URL(next, BASE); } catch { return null; }
  if (url.origin !== BASE) return null;
  // 라우터는 디코딩한 경로로 화면을 고르므로 검사도 디코딩한 경로로 함 ('/app/%6Cogin'은 로그인 화면)
  let path;
  try { path = decodeURIComponent(url.pathname); } catch { return null; }
  if (!PREFIX[role].test(path)) return null;
  path = path.replace(/\/+$/, '');
  if (AUTH_PAGES[role].some((p) => path === p || path.startsWith(`${p}/`))) return null;
  return next;
}

// 역할의 로그인 화면 주소. next가 있는 경우: ?next=로 붙임.
export const loginPath = (role, next) => {
  const base = role === 'clinician' ? '/clinician/login' : '/app/login';
  return next ? `${base}?next=${encodeURIComponent(next)}` : base;
};
