// 화면은 이 파일의 함수만 부름. fetch와 Cognito 호출은 여기서만 씀.
// 서버는 VITE_API_URL, 로그인은 Amazon Cognito.
// 아래 타입이 서버 응답의 약속. 백엔드 응답 모양이 바뀐 경우: 여기부터 고침.
// API에 보낼 Cognito 토큰. 백엔드가 Access Token으로 검증함 (화면의 이메일·역할은 idToken에서 따로 읽음).
const AUTH_TOKEN = 'accessToken';

import { Amplify } from 'aws-amplify';
import * as cognito from 'aws-amplify/auth';
import type { SignInOutput } from 'aws-amplify/auth';
import { areaCode, errorOf, messageOf, toClinic, toFollowup, toRecordDetail, toRecordList } from './lib/backendMap.js';
import { ClinicSearchApiError, ClinicSearchClient } from './lib/clinicSearch';
import type { SearchOptions, SubmitClinicSearchInput } from './lib/clinicSearch';


/* ── 서버가 주고받는 데이터 ── */

export type Role = 'patient' | 'clinician';
export type Session = { role: Role | null; email?: string };
type SignInStep = SignInOutput['nextStep']['signInStep'];
// 'DONE'인 경우: role이 함께 옴. 그 밖(CONFIRM_SIGN_UP, CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED 등)인 경우: 갈 화면만 정함.
export type SignInResult = ({ step: 'DONE' } & Session) | { step: Exclude<SignInStep, 'DONE'>; role?: undefined };

// phone: +821012345678 (Cognito phone_number). 성별·키·몸무게·질환·약은 선택 (빈 값: '' / null)
type ProfileExtra = { phone: string; gender: string; height: number | null; weight: number | null; conditions: string; medications: string };
export type Profile = { id: string; name: string; birth: string | null; email: string } & ProfileExtra;
export type ProfileUpdate = { name: string; birthdate: string } & ProfileExtra;
export type Clinician = { id: string; name: string; specialty: string; specialtyLabel: string; clinic: string };

// 진료과 코드 ('05' 정형외과 …, 'SELF' 직접 입력한 증상). 이름은 lib/format.js의 specialtyLabel
export type Specialty = string;
// unavailable: 서버에 쉬운 설명(AI) 기능이 없음. 원문 기록만 보여 줌
export type EasyStatus = 'ready' | 'pending' | 'failed' | 'unavailable';

export type Diagnosis = { original: string; easy: string; status?: string };
export type Test = { original: string; easy: string; result?: string };
export type Medication = { name: string; dose?: string };

// lib/symptom.js의 입력값
export type SymptomInput = {
  area: string; side: string; detail: string; startDate: string; startTime: string;
  minutes: number; frequency: string; when: string; pain: number; memo: string;
};
// AI 요약 (15, 16에서 고칠 수 있음). start·when·pain이 없는 경우: 입력값으로 채움.
export type SymptomSummary = { say: string; start?: string; when?: string; pain?: string; at: string };

type RecordBase = {
  id: string;
  specialty: Specialty;
  title: string;
  date: string | null; // '2026-11-12' 또는 '2026-11-12T10:00'
  clinic?: string;
  clinicId?: string;
  easyStatus: EasyStatus;
  unread: boolean;
};
export type VisitRecord = RecordBase & {
  kind: 'visit';
  author: string | null;
  receivedAt: string;
  note: string[];
  // 병원마다 하나 또는 여러 개로 옴
  diagnosis?: Diagnosis | Diagnosis[] | null;
  test?: Test | Test[] | null;
  prescription?: Medication[] | null;
  nextVisit?: string | null;
  plan?: { text: string; date: string | null };
  easy: string[];
  external?: boolean; // 다른 병원 원문 (05-b)
  missingLinks?: boolean; // 연결된 기록 일부를 못 찾음 (04-b)
  status?: 'cancelled';
  fhir?: string;
};
export type SymptomRecord = RecordBase & {
  kind: 'symptom';
  source: string;
  symptom: SymptomInput;
  summary: SymptomSummary | null;
};
export type CareRecord = VisitRecord | SymptomRecord;

export type RecordFilter = { specialty?: Specialty; clinicId?: string; kind?: CareRecord['kind']; from?: string; to?: string };
// partial인 경우: 일부 병원 기록을 못 불러옴 (01-c), linking인 경우: 아직 연결 중 (01-a)
export type RecordList = { records: CareRecord[]; partial: boolean; linking: boolean };

export type Followup = {
  id: string;
  kind: 'APPOINTMENT' | 'PLAN';
  status: 'BOOKED' | 'FULFILLED' | 'CANCELLED' | 'NOSHOW' | 'PLANNED';
  date: string | null; // '2027-04'처럼 달까지만 오기도 함
  clinic: string;
  title: string;
  fromRecordId?: string;
};
export type Prep = { recordIds: string[] | null; questions: string[] };

export type Clinic = {
  id: string; name: string; area: string; specialties: Specialty[];
  address: string | null; phone: string | null; lat: number | null; lng: number | null;
};
export type ClinicFilter = { area?: string; specialty?: Specialty };

export type GrantStatus = 'active' | 'opened' | 'expired' | 'revoked';
export type SharedPatient = { name: string; birth: string | null };
export type SharedRecordSummary = Pick<CareRecord, 'id' | 'kind' | 'title' | 'date' | 'clinic' | 'specialty'>;
export type GrantSummary = {
  grantId: string;
  patient: SharedPatient;
  visitCount: number;
  symptomCount: number;
  records: SharedRecordSummary[];
  excluded: string[]; // 받은 쪽에서 빠진 정보 (고르지 않은 진료과, 처방받은 약)
  expiresAt: string;
};
export type ShareGrant = GrantSummary & {
  id: string;
  status: GrantStatus;
  qrToken: string;
  shareCode: string; // 'K7Q4-M29X'
  recordIds: string[];
  includeMedication: boolean;
  ttlMinutes: number;
  allowedSpecialties: Specialty[];
  createdAt: string;
  rotatedAt?: string;
  openedAt: string | null;
  openedBy: string | null;
  revokedAt: string | null;
};
export type NewShareGrant = { recordIds: string[]; includeMedication: boolean; ttlMinutes: number };
export type CreatedShareGrant = Pick<ShareGrant, 'grantId' | 'qrToken' | 'shareCode' | 'expiresAt' | 'allowedSpecialties'>;
export type ShareKey = { qrToken: string } | { shareCode: string };
export type RedeemedShare = Omit<GrantSummary, 'records'> & { records: CareRecord[]; includeMedication: boolean; openedAt: string };
export type ReceivedShare = { grantId: string; patient: SharedPatient; receivedAt: string; count: number; expiresAt: string };

export type VisitItem = { name: string; detail: string };
export type NewVisit = {
  grantId: string; title: string; note: string;
  diagnoses: VisitItem[]; tests: VisitItem[]; prescriptions: VisitItem[];
  showNextVisit: boolean; nextVisit: string;
};

/* ── 서버 연결 ── */

const BASE_URL = import.meta.env.VITE_API_URL ?? '';
// 백엔드 경로는 모두 /v1 아래. 화면은 항상 같은 주소의 /v1로 보내고, 백엔드(VITE_API_URL)로 전달은
// 개발 중에는 Vite 프록시(vite.config.js), 배포 뒤에는 호스팅의 다시 쓰기 규칙이 맡음 → 백엔드 CORS 설정이 필요 없음
const API_URL = BASE_URL && '/v1';

{
  const { VITE_COGNITO_USER_POOL_ID: userPoolId, VITE_COGNITO_CLIENT_ID: userPoolClientId, VITE_COGNITO_REGION: region } = import.meta.env;
  // 풀 ID는 "ap-northeast-2_xxxx" 꼴이라 지역이 앞에 붙음. 다른 경우: .env를 잘못 채운 것.
  if (!userPoolId || !userPoolClientId || !userPoolId.startsWith(`${region}_`)) throw new Error('.env의 VITE_COGNITO_* 값을 확인해 주세요');
  if (!API_URL) throw new Error('.env의 VITE_API_URL 값을 확인해 주세요');
  Amplify.configure({ Auth: { Cognito: { userPoolId, userPoolClientId, loginWith: { email: true } } } });
}

export class ApiError extends Error {
  status: number;
  code: string | undefined;
  constructor(status: number, code: string | undefined, message: string) { super(message); this.status = status; this.code = code; }
}

// API가 401을 준 경우: 지금 화면 위에 공통 로그인 만료 대화상자 (App.jsx가 이 이벤트를 받음)
export const SESSION_EXPIRED = 'cc-session-expired';
function expire() {
  roleCache = null;
  cognito.signOut().catch(() => {});
  window.dispatchEvent(new Event(SESSION_EXPIRED));
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = (await cognito.fetchAuthSession().catch(() => null))?.tokens?.[AUTH_TOKEN]?.toString();
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', '인터넷 연결을 확인하고 다시 시도해 주세요.');
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (res.status === 401) expire();
  const err = errorOf(data);
  if (!res.ok) throw new ApiError(res.status, err?.code, messageOf(res.status, err));
  return data as T; // 서버를 믿는 경계: 응답 모양은 위 타입대로 온다고 봄
}

const q = (params: Record<string, string | undefined>) => {
  const s = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1])).toString();
  return s ? `?${s}` : '';
};

// 화면이 쓰는 지금 시각
export const now = (): number => Date.now();

/* 인증: 화면은 err.code(Cognito 오류 이름)와 결과의 step으로 갈 화면을 정함 */
const AUTH_MESSAGES: Record<string, string> = {
  NotAuthorizedException: '이메일 또는 비밀번호가 맞지 않습니다',
  UsernameExistsException: '이미 가입된 이메일입니다',
  CodeMismatchException: '인증 코드가 맞지 않습니다. 다시 확인해 주세요.',
  ExpiredCodeException: '인증 코드가 만료됐습니다. 새 코드를 받아 주세요.',
  InvalidPasswordException: '비밀번호 규칙에 맞지 않습니다. 12자 이상, 대문자·소문자·숫자를 섞어 주세요.',
  InvalidParameterException: '입력한 값을 다시 확인해 주세요.',
  LimitExceededException: '시도가 너무 많습니다. 잠시 뒤 다시 해 주세요.',
  TooManyRequestsException: '시도가 너무 많습니다. 잠시 뒤 다시 해 주세요.',
  UserNotFoundException: '이메일 또는 비밀번호가 맞지 않습니다',
};
const authError = (e: unknown): ApiError => {
  const err = e as { status?: number; name?: string } | null;
  if (err?.status !== undefined) return err as ApiError; // ApiError는 그대로
  if (err?.name === 'NetworkError') return new ApiError(0, 'NETWORK', '인터넷 연결을 확인하고 다시 시도해 주세요.');
  return new ApiError(400, err?.name, (err?.name && AUTH_MESSAGES[err.name]) ?? '잠시 뒤 다시 시도해 주세요.');
};
const auth = <A extends unknown[], R>(fn: (...args: A) => Promise<R>) => async (...args: A): Promise<R> => {
  try { return await fn(...args); } catch (e) { throw authError(e); }
};

// cognito:groups → 'patient' | 'clinician'
// shortcut: 백엔드 Cognito에 그룹이 아직 없어 clinician 그룹이 아니면 환자로 봄. 그룹이 생긴 경우: patient 그룹만 환자로 바꿈
const roleOf = (groups: unknown = []): Role => (Array.isArray(groups) && groups.includes('clinician') ? 'clinician' : 'patient');

async function cognitoSession(): Promise<Session | null> {
  const { tokens } = await cognito.fetchAuthSession();
  const email = tokens?.idToken?.payload.email;
  return tokens ? { role: roleOf(tokens.idToken?.payload['cognito:groups']), email: typeof email === 'string' ? email : undefined } : null;
}
// 로그인 뒤 다음 단계. DONE인 경우: role이 함께 옴
async function afterSignIn({ nextStep }: SignInOutput): Promise<SignInResult> {
  const step = nextStep.signInStep;
  return step === 'DONE' ? { step, role: null, ...(await cognitoSession()) } : { step };
}

// 지금 로그인한 사람의 역할. 화면을 넘길 때마다 다시 확인하지만, 기다리는 동안 빈 화면이 되지 않도록 기억해 둠.
// 로그아웃·로그인 만료·계정 삭제·다른 계정 로그인 때 비움 (이전 사용자의 화면이 잠깐이라도 보이지 않도록).
let roleCache: Role | null = null;
export const cachedRole = () => roleCache;
const remember = <S extends { step?: string; role?: Role | null } | null>(s: S): S => {
  roleCache = s?.step && s.step !== 'DONE' ? null : s?.role ?? null;
  return s;
};

// 지금 로그인한 사람 { role, email } 또는 null
export const getSession = auth(async (): Promise<Session | null> => remember(await cognitoSession()));
export const login = auth(async ({ email, password }: { email: string; password: string; role?: Role }): Promise<SignInResult> => {
  roleCache = null;
  await cognito.signOut(); // 다른 계정이 남아 있는 경우: signIn이 실패하므로 먼저 정리
  return remember(await afterSignIn(await cognito.signIn({ username: email, password })));
});
export const logout = auth(async (): Promise<void> => { roleCache = null; await cognito.signOut(); });
// 회원가입 (A2 약관 → A4 계정 → A3 인증). 동의한 약관 버전은 가입 뒤 서버가 Cognito 속성에서 읽음.
export const signUp = auth(async ({ email, password, name, birthdate, phone, consents }: { email: string; password: string; name: string; birthdate: string; phone: string; consents: string[] }): Promise<void> => {
  await cognito.signUp({ username: email, password, options: { userAttributes: { email, name, birthdate, phone_number: phone, 'custom:consents': consents.join(',') } } });
});
// 인증을 마친 뒤 바로 로그인해서 A5 가입 완료로 감 (비밀번호를 모르면 로그인 화면으로: null)
export const confirmSignUp = auth(async ({ email, code, password }: { email: string; code: string; password?: string }): Promise<SignInResult | null> => {
  await cognito.confirmSignUp({ username: email, confirmationCode: code });
  return password ? login({ email, password }) : null;
});
export const resendSignUpCode = auth(async ({ email }: { email: string }): Promise<void> => {
  await cognito.resendSignUpCode({ username: email });
});
// 비밀번호 찾기: 코드 받기 → 코드 확인 → 새 비밀번호
export const resetPassword = auth(async ({ email }: { email: string }): Promise<void> => {
  await cognito.resetPassword({ username: email });
});
export const confirmResetPassword = auth(async ({ email, code, newPassword }: { email: string; code: string; newPassword: string }): Promise<void> => {
  await cognito.confirmResetPassword({ username: email, confirmationCode: code, newPassword });
});
// 관리자가 만든 계정의 첫 로그인 (P1-a). login 직후 같은 탭에서만 됨.
export const confirmNewPassword = auth(async ({ newPassword }: { newPassword: string }): Promise<SignInResult> => remember(
  await afterSignIn(await cognito.confirmSignIn({ challengeResponse: newPassword }))));
// 31 비밀번호 바꾸기 (로그인한 상태)
export const changePassword = auth(async ({ oldPassword, newPassword }: { oldPassword: string; newPassword: string }): Promise<void> => {
  await cognito.updatePassword({ oldPassword, newPassword });
});
// 34 계정 삭제: 비밀번호를 먼저 Cognito로 확인 → 서버가 기록·공유 내역을 지움 → Cognito 사용자를 지움.
// 틀린 비밀번호는 서버를 부르기 전에 NotAuthorizedException으로 멈춤 (화면: "비밀번호가 맞지 않습니다").
// shortcut: Cognito에 비밀번호만 확인하는 API가 없어 같은 비밀번호로 바꾸기(ChangePassword)로 확인함. 재사용 금지 정책을 켠 경우 나는 오류는 맞은 것으로 봄.
export const deleteAccount = auth(async ({ password }: { password: string }): Promise<void> => {
  await cognito.updatePassword({ oldPassword: password, newPassword: password })
    .catch((e: { name?: string }) => { if (e?.name !== 'PasswordHistoryPolicyViolationException') throw e; });
  await request<null>('POST', '/me/delete', { password });
  await cognito.deleteUser();
  roleCache = null;
});

// 서버 /me는 계정과 환자 연결만 확인해 줌. 이름·생년월일·이메일·전화번호는 로그인 정보(idToken)에서 읽음.
// 성별·키·몸무게·질환·약: 서버 /me가 주는 경우에만 채움 (백엔드가 PATCH /me로 받은 값을 돌려줘야 함)
export const getMe = async (): Promise<Profile> => {
  const [me, session] = await Promise.all([request<{ userId: string } & Partial<ProfileExtra>>('GET', '/me'), cognito.fetchAuthSession()]);
  const p = session.tokens?.idToken?.payload ?? {};
  const text = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    id: me.userId, name: text(p.name), birth: text(p.birthdate) || null, email: text(p.email),
    phone: text(me.phone ?? p.phone_number), gender: text(me.gender ?? p.gender),
    height: me.height ?? null, weight: me.weight ?? null, conditions: text(me.conditions), medications: text(me.medications),
  };
};
// 프로필 수정 → 바뀐 내 정보. 서버가 Cognito 속성(name, birthdate, phone_number, gender)도 함께 맞춤. 이메일은 로그인 아이디라 여기서 바꾸지 않음.
export const updateMe = (body: ProfileUpdate): Promise<Profile> => request('PATCH', '/me', body);
export const getClinicianMe = (): Promise<Clinician> => request('GET', '/clinician/me');

// 환자 기록 (02 기록 필터)
// shortcut: 한 번에 100건까지만 받음(nextCursor 무시). 환자당 기록이 100건을 넘는 경우: 커서로 이어 받기
export const getRecords = async ({ specialty, from, to, kind }: RecordFilter = {}): Promise<RecordList> => {
  if (kind === 'symptom') return { records: [], partial: false, linking: false }; // 서버에 아직 증상 기록이 없음
  return toRecordList(await request('GET', `/me/records${q({ specialty, from, to, includeUndated: 'true', limit: '100' })}`)) as RecordList;
};
export const getRecord = async (id: string): Promise<CareRecord> => toRecordDetail(await request('GET', `/me/records/${encodeURIComponent(id)}`)) as CareRecord;
// 39 쉬운 설명 다시 만들기 → 바뀐 기록 (easyStatus: 'pending'이면 04-a, 'failed'면 04-a 실패)
export const regenerateEasy = (id: string): Promise<CareRecord> => request('POST', `/me/records/${id}/easy`);
// 다음 진료 (홈 카드용, 다가오는 것만)
const followups = async (from?: string): Promise<Followup[]> =>
  ((await request<{ items: unknown[] }>('GET', `/me/followups${q({ from, includeUndated: 'true', limit: '100' })}`)).items ?? []).map(toFollowup) as Followup[];
export const getFollowups = (): Promise<Followup[]> => followups(new Date(now()).toLocaleDateString('en-CA')); // 오늘(기기 시간대)부터
// 29 진료 일정 목록: 지나거나 취소된 일정까지
export const getSchedule = (): Promise<Followup[]> => followups();
// 07 진료 준비
export const getPrep = (followupId: string): Promise<Prep> => request('GET', `/me/followups/${followupId}/prep`);
export const savePrep = (followupId: string, body: Prep): Promise<Prep> => request('PUT', `/me/followups/${followupId}/prep`, body);

// 내 증상 기록 (09~19, 06, 41)
export const summarizeSymptom = (input: SymptomInput): Promise<SymptomSummary> => request('POST', '/me/symptoms/summary', input);
export const createSymptom = (body: { input: SymptomInput; summary: SymptomSummary | null }): Promise<SymptomRecord> => request('POST', '/me/symptoms', body);
export const updateSymptom = (id: string, body: { input?: SymptomInput; summary?: SymptomSummary | null }): Promise<SymptomRecord> => request('PATCH', `/me/symptoms/${id}`, body);
export const deleteSymptom = (id: string): Promise<void> => request('DELETE', `/me/symptoms/${id}`);

// 병원
export async function searchNearbyClinics(input: SubmitClinicSearchInput, options: SearchOptions = {}) {
  const client = new ClinicSearchClient({
    baseUrl: window.location.origin,
    timeoutMs: 120_000,
    getAccessToken: async () => (await cognito.fetchAuthSession().catch(() => null))?.tokens?.[AUTH_TOKEN]?.toString() ?? null,
  });
  try {
    return await client.search(input, options);
  } catch (error) {
    if (!options.signal?.aborted && error instanceof ClinicSearchApiError && error.status === 401) expire();
    throw error;
  }
}

// shortcut: 서버에 병원 상세 API가 없어 마지막으로 받은 목록에서 찾음. 새로고침하면 비어서 404. 상세 API가 생긴 경우: GET /clinics/{id}로 바꿈
const clinicCache = new Map<string, Clinic>();
export const getClinics = async ({ area, specialty }: ClinicFilter = {}): Promise<Clinic[]> => {
  const code = areaCode(area);
  if (!code) throw new ApiError(400, 'INVALID_ARGUMENT', '이 지역은 아직 병원 찾기를 지원하지 않습니다.');
  const list: Clinic[] = ((await request<{ items: unknown[] }>('GET', `/clinics${q({ area: code, specialty, limit: '100' })}`)).items ?? []).map(toClinic);
  for (const c of list) clinicCache.set(c.id, c);
  return list;
};
export const getClinic = async (id: string): Promise<Clinic> => {
  const c = clinicCache.get(id);
  if (!c) throw new ApiError(404, 'NOT_FOUND', '병원 정보를 찾지 못했습니다');
  return c;
};

// 공유
export const getShareGrants = (): Promise<ShareGrant[]> => request('GET', '/share-grants');
export const createShareGrant = (body: NewShareGrant): Promise<CreatedShareGrant> => request('POST', '/share-grants', body);
export const getShareGrant = (id: string): Promise<ShareGrant> => request('GET', `/share-grants/${id}`);
// 공유 중인 QR을 새 토큰으로 바꿈 (캡처한 QR을 나중에 못 쓰게).
// 서버는 바로 전 토큰도 잠깐(다음 교체 전까지) 받아 줌. 의사가 읽는 순간 바뀌어도 열림.
export const rotateShareGrant = (id: string): Promise<{ qrToken: string; rotatedAt: string }> => request('POST', `/share-grants/${id}/rotate`);
export const revokeShareGrant = (id: string): Promise<{ ok: true }> => request('POST', `/share-grants/${id}/revoke`);
// preview는 열람 횟수를 쓰지 않고 요약만 받음 (P2 오른쪽 카드용).
export const previewShareGrant = (body: ShareKey): Promise<GrantSummary> => request('POST', '/share-grants/preview', body);
export const redeemShareGrant = (body: ShareKey): Promise<RedeemedShare> => request('POST', '/share-grants/redeem', body);
// P9 오늘 공유받은 환자
export const getReceivedShares = (): Promise<ReceivedShare[]> => request('GET', '/clinician/shares?date=today');

// 의료진 진료 기록
export const createVisit = (body: NewVisit): Promise<{ visitId: string; savedAt: string }> => request('POST', '/clinician/visits', body);
