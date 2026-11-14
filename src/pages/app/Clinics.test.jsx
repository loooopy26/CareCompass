// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { fetchAuthSession, signOut } from 'aws-amplify/auth';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('aws-amplify', () => ({ Amplify: { configure: vi.fn() } }));
vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn(async () => ({ tokens: { accessToken: 'mock-access-token', idToken: 'mock-id-token' } })),
  signOut: vi.fn(async () => {}),
}));

vi.stubEnv('VITE_API_URL', 'https://different-api.example.test');
vi.stubEnv('VITE_COGNITO_REGION', 'us-east-1');
vi.stubEnv('VITE_COGNITO_USER_POOL_ID', 'us-east-1_test');
vi.stubEnv('VITE_COGNITO_CLIENT_ID', 'client');
const { default: Clinics } = await import('./Clinics.jsx');
const { SESSION_EXPIRED } = await import('../../api');

const endpoint = `${window.location.origin}/v1/clinic-search/jobs`;
const fetchMock = vi.fn();
const getCurrentPosition = vi.fn();
const transit = 'https://m.search.naver.com/search.naver?' + new URLSearchParams({
  query: '빠른길찾기',
  nso_path: 'placeType^place;name^서울역;address^;code^;longitude^126.9706;latitude^37.5547|type^place;name^서울의원;address^;code^;longitude^126.971;latitude^37.555|objtype^path;by^pubtrans',
});
const walking = 'https://map.naver.com/index.nhn?' + new URLSearchParams({
  slng: '126.9706', slat: '37.5547', stext: '서울역', elng: '126.971', elat: '37.555', etext: '서울의원',
  menu: 'route', pathType: '3', showMap: 'true',
});

function candidate(clinicName, availability) {
  const useWalk = availability === 'NOT_FOUND';
  return {
    clinicKey: `hira|${clinicName}`, clinicName, address: '서울시 중구', phone: '02-000-0000', latitude: 37.555, longitude: 126.971,
    specialties: [{ code: '05', name: '정형외과', specialistCount: 1 }], sourceId: 'HIRA_15051059_20260930', sourceAsOf: '2026-09-30',
    distanceMeters: 120, naverSearchUrl: useWalk ? walking : transit, walkingSearchUrl: walking,
    navigation: { availability, selectedMode: useWalk ? 'WALK' : 'TRANSIT', automaticFallback: useWalk, transitUrl: transit, walkingUrl: walking },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock.mockReset());
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: getCurrentPosition.mockReset() } });
  fetchMock.mockResolvedValueOnce(Response.json({ items: [] }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function openNearby(origin) {
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Clinics /></MemoryRouter>);
  await screen.findByText('조건에 맞는 병원을 찾지 못했습니다');
  expect(fetchMock.mock.calls[0][0]).toMatch(/^\/v1\/clinics\?/);
  fireEvent.click(screen.getByRole('radio', { name: '주변 병원 검색' }));
  expect(screen.getByText(/CareCompass 서버에 전송됩니다.*네이버에 전송합니다/)).toBeTruthy();
  expect(getCurrentPosition).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('searchbox', { name: '검색어' }), { target: { value: '정형외과' } });
  if (origin) fireEvent.change(screen.getByLabelText('출발 위치'), { target: { value: origin } });
}

it('체험 위치로 접수·조회하고 반환된 병원과 각각의 경로를 표시한다', async () => {
  await openNearby('SEOUL');
  fireEvent.change(screen.getByLabelText('진료과'), { target: { value: '05' } });
  fetchMock.mockImplementation(async (url, init) => {
    const jobId = init.method === 'POST' ? init.headers['Idempotency-Key'] : url.split('/').at(-1);
    return Response.json({ ok: true, data: init.method === 'POST' ? {
      jobId, status: 'QUEUED', pollAfterMs: 1_500,
    } : {
      jobId, status: 'SUCCEEDED', result: {
        answer: '검색 결과 안내', generationMode: 'RETRIEVAL_ONLY',
        candidates: [candidate('서울의원', 'UNKNOWN'), candidate('서울정형외과의원', 'NOT_FOUND')],
      },
    } });
  });
  fireEvent.click(screen.getByRole('button', { name: '체험 위치로 검색' }));
  const list = await screen.findByRole('list', {}, { timeout: 4_000 });
  const [[postUrl, post], [pollUrl, poll]] = fetchMock.mock.calls.slice(1);
  expect(postUrl).toBe(endpoint);
  expect(post.headers.Authorization).toBe('Bearer mock-access-token');
  expect(post.headers['Idempotency-Key']).toMatch(/^[\da-f-]{36}$/);
  expect(JSON.parse(post.body)).toEqual({ query: '정형외과', location: { latitude: 37.5547, longitude: 126.9706 }, originLabel: '서울역', specialtyCode: '05', region: 'SEOUL' });
  expect(pollUrl).toBe(`${endpoint}/${post.headers['Idempotency-Key']}`);
  expect(poll.headers.Authorization).toBe('Bearer mock-access-token');
  expect(getCurrentPosition).not.toHaveBeenCalled();

  const [unknown, noRoute] = within(list).getAllByRole('listitem');
  expect(within(unknown).getByText(/대중교통 경로가 있는지 확인하지 못했습니다/)).toBeTruthy();
  expect(within(unknown).getByText('120 m')).toBeTruthy();
  expect(within(unknown).getByText(/건강보험심사평가원.*2026-09-30/)).toBeTruthy();
  const primary = within(unknown).getByRole('link', { name: /대중교통 길찾기/ });
  expect(primary.getAttribute('href')).toBe(transit);
  expect(primary.getAttribute('target')).toBe('_blank');
  expect(within(unknown).getByRole('link', { name: /도보로도 보기/ }).getAttribute('href')).toBe(walking);
  expect(within(noRoute).getByRole('link', { name: /도보 길찾기/ }).getAttribute('href')).toBe(walking);
  expect(within(noRoute).queryByRole('link', { name: /대중교통 길찾기/ })).toBeNull();
});

it('위치 권한 거부를 표시하고 검색 요청을 보내지 않는다', async () => {
  await openNearby();
  getCurrentPosition.mockImplementation((_success, fail) => fail({ code: 1 }));
  fireEvent.click(screen.getByRole('button', { name: '내 위치로 검색' }));
  expect((await screen.findByRole('alert')).textContent).toContain('위치 권한이 거부됐습니다');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('검색을 취소하면 늦게 도착한 위치로 검색하지 않는다', async () => {
  await openNearby();
  fireEvent.click(screen.getByRole('button', { name: '내 위치로 검색' }));
  expect(screen.getByText('현재 위치를 확인하고 있습니다.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '검색 취소' }));
  const [reportLocation] = getCurrentPosition.mock.calls[0];
  await act(async () => reportLocation({ coords: { latitude: 37.5547, longitude: 126.9706, accuracy: 20 }, timestamp: Date.now() }));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('alert')).toBeNull();
});

it('다른 검색 모드로 전환할 때 처리 중인 HTTP 요청을 취소한다', async () => {
  await openNearby('WONJU');
  fetchMock.mockImplementation((_url, { signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }));
  fireEvent.click(screen.getByRole('button', { name: '체험 위치로 검색' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  const signal = fetchMock.mock.calls[1][1].signal;
  expect(signal.aborted).toBe(false);
  fireEvent.click(screen.getByRole('radio', { name: '지역별 병원' }));
  expect(signal.aborted).toBe(true);
  expect(screen.queryByRole('searchbox')).toBeNull();
});

it.each(['서버 401', '세션 갱신 실패'])('%s에 공통 로그인 만료 이벤트를 보낸다', async (scenario) => {
  await openNearby('SEOUL');
  const expired = vi.fn();
  window.addEventListener(SESSION_EXPIRED, expired, { once: true });
  if (scenario === '서버 401') {
    fetchMock.mockResolvedValueOnce(Response.json({ ok: false, error: { code: 'AUTH_REQUIRED' } }, { status: 401 }));
  } else {
    fetchAuthSession.mockRejectedValueOnce(new Error('Session expired'));
  }
  fireEvent.click(screen.getByRole('button', { name: '체험 위치로 검색' }));
  expect((await screen.findByRole('alert')).textContent).toContain('다시 로그인해 주세요');
  expect(expired).toHaveBeenCalledOnce();
  expect(signOut).toHaveBeenCalledOnce();
  expect(fetchMock).toHaveBeenCalledTimes(scenario === '서버 401' ? 2 : 1);
});

it('세션 조회가 지연돼도 120초 후 검색을 종료한다', async () => {
  await openNearby('SEOUL');
  vi.useFakeTimers();
  let completeSession;
  fetchAuthSession.mockImplementationOnce(() => new Promise((resolve) => { completeSession = resolve; }));
  try {
    fireEvent.click(screen.getByRole('button', { name: '체험 위치로 검색' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(screen.getByRole('alert').textContent).toContain('검색 응답이 늦어지고 있습니다');
    await act(async () => completeSession({ tokens: { accessToken: 'late-token' } }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  } finally {
    vi.useRealTimers();
  }
});
