import { useEffect, useRef, useState } from 'react';
import { searchNearbyClinics } from '../../api';
import { Button, TextButton } from '../../components/ui';
import { CLINIC_SEARCH_LOCATION_NOTICE, ClinicSearchApiError, ClinicSearchTimeoutError, getBrowserLocation, getClinicNavigationPrimaryLabel } from '../../lib/clinicSearch';
import { SPECIALTIES } from '../../lib/format.js';

const DEMO_ORIGINS = [
  { label: '서울역', region: 'SEOUL', latitude: 37.5547, longitude: 126.9706 },
  { label: '춘천역', region: 'CHUNCHEON', latitude: 37.88455, longitude: 127.71668 },
  { label: '원주역', region: 'WONJU', latitude: 37.31585, longitude: 127.9212 },
];
const FIELD = 'min-h-11 w-full rounded-xl bg-field px-3 py-2 text-[15px]';

function searchErrorMessage(error) {
  if (error instanceof ClinicSearchTimeoutError) return '검색 응답이 늦어지고 있습니다. 잠시 뒤 다시 시도해 주세요.';
  if (error instanceof ClinicSearchApiError) {
    if (error.status === 401 || error.status === 403) return '병원을 검색하려면 다시 로그인해 주세요.';
    if (error.status === 429) return '요청이 많습니다. 잠시 뒤 다시 시도해 주세요.';
    if (error.status === 400) return '검색어, 지역 또는 출발 위치를 확인해 주세요.';
  }
  return '주변 병원을 검색하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.';
}

export default function NearbyClinics() {
  const [origin, setOrigin] = useState('');
  const [phase, setPhase] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const active = useRef(null);

  useEffect(() => () => active.current?.abort(), []);

  function cancel() {
    active.current?.abort();
    active.current = null;
    setPhase('');
  }

  async function search(event) {
    event.preventDefault();
    if (active.current) return;
    const fields = new FormData(event.currentTarget);
    const query = String(fields.get('query') ?? '').trim();
    const specialtyCode = fields.get('specialty') || undefined;
    const region = fields.get('region') || undefined;
    const demo = DEMO_ORIGINS.find((item) => item.region === origin);
    setResult(null);
    setError('');
    if (!query) {
      setError('검색어를 확인해 주세요. 병원 이름이나 진료과를 입력할 수 있습니다.');
      return;
    }

    const controller = new AbortController();
    active.current = controller;
    const { signal } = controller;
    const originLabel = demo?.label ?? '내 위치';
    setPhase(demo ? 'search' : 'location');
    let location;
    try {
      location = demo
        ? { latitude: demo.latitude, longitude: demo.longitude }
        : await getBrowserLocation({ signal, maximumAgeMs: 0 });
      if (signal.aborted) return;
      if (location.accuracyMeters > 5_000) {
        setError('현재 위치를 충분히 정확하게 확인하지 못했습니다. 위치 설정을 확인하고 다시 시도해 주세요.');
        return;
      }
      setPhase('search');
      const data = await searchNearbyClinics({ query, location, originLabel, specialtyCode, region: region ?? demo?.region }, { signal });
      if (!signal.aborted) setResult({ data, originLabel, demo: Boolean(demo) });
    } catch (cause) {
      if (!signal.aborted) {
        setError(location ? searchErrorMessage(cause) : cause.message || '현재 위치를 가져오지 못했습니다.');
      }
    } finally {
      if (active.current === controller) {
        active.current = null;
        if (!signal.aborted) setPhase('');
      }
    }
  }

  return (
    <section aria-labelledby="nearby-heading" className="flex flex-col gap-4 pb-6">
      <h2 id="nearby-heading" className="text-[17px] font-semibold">출발 위치 주변 병원</h2>
      <p className="text-[14px] leading-5 text-sub">서울, 춘천, 원주의 병원을 검색할 수 있습니다. 진료 시간과 예약은 병원에 직접 확인해 주세요.</p>
      <p id="clinic-location-notice" className="rounded-xl bg-primary-soft p-3 text-[14px] font-medium leading-5 text-navy">
        {CLINIC_SEARCH_LOCATION_NOTICE}
      </p>
      <form onSubmit={search} className="flex flex-col gap-3" aria-describedby="clinic-location-notice">
        <fieldset disabled={Boolean(phase)} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-[14px] font-semibold">
            검색어
            <input name="query" type="search" className={FIELD} placeholder="예) 정형외과" required maxLength={300} autoComplete="off" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-[14px] font-semibold">
              진료과
              <select name="specialty" className={FIELD}>
                <option value="">전체 진료과</option>
                {SPECIALTIES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[14px] font-semibold">
              검색 지역
              <select name="region" className={FIELD}>
                <option value="">지역 자동 선택</option>
                <option value="SEOUL">서울</option>
                <option value="CHUNCHEON">춘천</option>
                <option value="WONJU">원주</option>
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-[14px] font-semibold">
            출발 위치
            <select value={origin} onChange={(event) => setOrigin(event.target.value)} className={FIELD} aria-describedby="clinic-demo-notice">
              <option value="">내 위치</option>
              {DEMO_ORIGINS.map(({ region, label }) => <option key={region} value={region}>체험 위치 · {label}</option>)}
            </select>
          </label>
          <p id="clinic-demo-notice" className="text-[13px] text-sub">체험 위치는 기기 위치 권한 없이 선택한 역을 출발점으로 사용합니다.</p>
          <Button type="submit" size="md" loading={Boolean(phase)}>{origin ? '체험 위치로 검색' : '내 위치로 검색'}</Button>
        </fieldset>
        {phase && <TextButton onClick={cancel}>검색 취소</TextButton>}
      </form>
      <p role="status" className={phase ? 'text-[14px] text-sub' : 'sr-only'}>
        {phase === 'location' ? '현재 위치를 확인하고 있습니다.' : phase ? '주변 병원을 검색하고 있습니다.' : ''}
      </p>
      {error && <p role="alert" className="rounded-xl bg-field p-3 text-[14px] text-navy">{error}</p>}
      {result && <NearbyResults result={result} />}
    </section>
  );
}

function NearbyResults({ result: { data, originLabel, demo } }) {
  return (
    <section aria-label="주변 병원 검색 결과" className="flex flex-col gap-3">
      <h3 role="status" className="text-[16px] font-semibold">
        {demo ? `체험 위치 · ${originLabel}` : originLabel} 기준 {data.candidates.length}곳
      </h3>
      {data.candidates.length === 0 ? (
        <p className="text-[14px] text-sub">조건에 맞는 병원을 찾지 못했습니다. 검색어나 진료과를 바꿔 보세요.</p>
      ) : (
        <>
          {data.answer && <p className="whitespace-pre-line text-[14px] leading-5 text-sub">{data.answer}</p>}
          <ul className="flex flex-col gap-3">
            {data.candidates.map((candidate) => <NearbyClinic key={candidate.clinicKey} candidate={candidate} />)}
          </ul>
        </>
      )}
    </section>
  );
}

function NearbyClinic({ candidate }) {
  const { clinicName, address, phone, specialties, distanceMeters, sourceId, sourceAsOf, naverSearchUrl, walkingSearchUrl, navigation } = candidate;
  const walking = walkingSearchUrl ?? navigation?.walkingUrl;
  const distance = distanceMeters === null ? '거리 미확인' : distanceMeters < 1_000
    ? `${Math.round(distanceMeters)} m` : `${(distanceMeters / 1_000).toFixed(1)} km`;

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-line p-4">
      <h4 className="text-[17px] font-semibold">{clinicName}</h4>
      <dl className="space-y-1 text-[14px] leading-5 text-sub">
        <div><dt className="mr-2 inline font-semibold">주소</dt><dd className="inline">{address || '주소 미확인'}</dd></div>
        <div><dt className="mr-2 inline font-semibold">전화</dt><dd className="inline">{phone || '전화번호 미확인'}</dd></div>
        <div><dt className="mr-2 inline font-semibold">진료과</dt><dd className="inline">{specialties.map(({ name }) => name).join(', ') || '진료과 미확인'}</dd></div>
        <div><dt className="mr-2 inline font-semibold">직선거리</dt><dd className="inline">{distance}</dd></div>
        <div><dt className="mr-2 inline font-semibold">출처</dt><dd className="inline break-words">{sourceId.startsWith('HIRA_') ? '건강보험심사평가원' : sourceId} · {sourceAsOf ?? '기준일 미확인'}</dd></div>
      </dl>
      {navigation?.availability === 'UNKNOWN' && <p className="text-[13px] text-sub">대중교통 경로가 있는지 확인하지 못했습니다. 네이버에서 확인해 주세요.</p>}
      {navigation?.availability === 'NOT_FOUND' && <p className="text-[13px] text-sub">대중교통 경로가 없어 도보 길찾기를 표시했습니다.</p>}
      <Button href={naverSearchUrl} target="_blank" rel="noopener noreferrer" size="pc">
        {getClinicNavigationPrimaryLabel(navigation)} <span className="sr-only">(새 탭)</span>
      </Button>
      {walking && navigation?.selectedMode !== 'WALK' && (
        <a href={walking} target="_blank" rel="noopener noreferrer" className="py-1 text-center text-[14px] font-semibold text-primary">
          도보로도 보기 <span className="sr-only">(새 탭)</span>
        </a>
      )}
    </li>
  );
}
