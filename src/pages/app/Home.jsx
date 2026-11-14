// 01 홈 (13:2), 01-g 새 진료 기록 도착 (241:848), 02 기록 필터 (14:2), 03 기록 없음 (33:2),
// 01-a 연결 대기 (34:2), 01-b 아직 불러오지 않음 (35:2), 01-c 일부만 불러옴 (36:2), 01-d 불러오기 실패 (37:2), 01-e 예외 항목 (38:2)
// 병원 기록과 내가 쓴 기록은 탭으로 나눔 (?tab=mine). 진료과 칩·기록 필터는 병원 기록에만 적용.
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getFollowups, getMe, getRecords, now } from '../../api';
import FollowupCard from '../../components/Followup.jsx';
import { ChevronDown, ChevronRight, Filter, Img, Search } from '../../components/icons.jsx';
import { DateField } from '../../components/inputs.jsx';
import RecordRow, { YearDivider, yearLabel } from '../../components/RecordRow.jsx';
import { BottomBar, Button, Chips, ErrorView, MobileShell, Segmented, Sheet, Skeleton, SkeletonRows, Stagger, StaggerItem, StateView, TabBar, TextButton, useToast } from '../../components/ui';
import { SPECIALTIES, specialtyName, year } from '../../lib/format.js';
import { loadRecent, pushRecent, saveRecent } from '../../lib/recentClinics.js';
import { pain, whenFreq } from '../../lib/symptom.js';
import useAsync from '../../lib/useAsync.js';

const PAGE = 5;
const DAY = 24 * 3600 * 1000;
const PERIODS = [{ value: '3m', label: '최근 3개월' }, { value: '1y', label: '1년' }, { value: 'all', label: '전체' }, { value: 'custom', label: '직접 선택' }];
const EMPTY_FILTER = { period: 'all', from: '', to: '', specialty: '', clinic: '' };

// 병원 기록에 필터 적용 (서버에도 같은 조건을 보낼 수 있지만 칩·병원 목록을 만들려고 전체를 한 번 받아 여기서 거름)
function applyFilter(list, f) {
  const today = now();
  const from = f.period === '3m' ? new Date(today - 92 * DAY).toLocaleDateString('sv-SE')
    : f.period === '1y' ? new Date(today - 365 * DAY).toLocaleDateString('sv-SE') : f.period === 'custom' ? f.from : '';
  const to = f.period === 'custom' ? f.to : '';
  return list.filter((r) => (!f.specialty || r.specialty === f.specialty)
    && (!f.clinic || r.clinic === f.clinic)
    && (!from || (r.date && r.date >= from)) && (!to || (r.date && r.date.slice(0, 10) <= to)));
}

export default function Home() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'mine' ? 'mine' : 'visit';
  const [filter, setFilter] = useState(EMPTY_FILTER);
  const [sheet, setSheet] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const me = useAsync(getMe);
  const followups = useAsync(getFollowups);
  const res = useAsync(() => getRecords());

  const all = useMemo(() => res.data?.records ?? [], [res.data]);
  const visits = all.filter((r) => r.kind === 'visit');
  const mine = all.filter((r) => r.kind === 'symptom');
  const specialties = [...new Set(visits.map((r) => r.specialty))];
  // 병원 이름이 없는 기록은 병원 필터에 넣지 않음
  const clinics = [...new Set(visits.map((r) => r.clinic).filter(Boolean))];
  const list = tab === 'visit' ? applyFilter(visits, filter) : mine;
  const ready = !res.loading && !res.error;
  const pickTab = (t) => { setParams(t === 'mine' ? { tab: 'mine' } : {}, { replace: true }); setShown(PAGE); };
  const unread = all.find((r) => r.unread);
  const thisYear = year(new Date(now()));

  // 01-c 일부 병원 기록을 못 불러온 경우: 위쪽에 주황 토스트
  useEffect(() => {
    if (res.data?.partial) toast({ tone: 'warn', title: '일부 기록을 불러오지 못했습니다', action: { label: '다시 시도', onClick: res.reload } });
  }, [res.data, toast, res.reload]);

  // 칩: 전체 / 병원 기록이 있는 진료과. 필터에서 기록이 없는 진료과를 고른 경우: 그 칩도 보여 줌
  const chipCodes = filter.specialty && !specialties.includes(filter.specialty) ? [...specialties, filter.specialty] : specialties;
  const chips = [{ value: '', label: '전체' }, ...chipCodes.map((s) => ({ value: s, label: specialtyName(s, s) }))];
  const pickChip = (v) => { setFilter({ ...filter, specialty: v }); setShown(PAGE); };
  const filtered = JSON.stringify(filter) !== JSON.stringify(EMPTY_FILTER);

  const rows = (
    <Stagger className="-mt-2 flex flex-col">
      {list.slice(0, shown).map((r, i, arr) => {
        const label = tab === 'visit' && yearLabel(r, arr[i - 1], thisYear);
        return (
          <StaggerItem key={r.id}>
            {label && <YearDivider label={label} />}
            {/* 내가 쓴 기록 탭: "내가 쓴 기록" 대신 언제·얼마나 아픈지 */}
            <RecordRow r={r} {...(r.kind === 'symptom' && r.symptom && { sub: `${whenFreq(r.symptom)}, ${pain(r.symptom)}` })} />
          </StaggerItem>
        );
      })}
      {list.length > PAGE && (
        <button type="button" onClick={() => setShown(shown >= list.length ? PAGE : shown + PAGE * 2)}
          className="flex h-10 items-center justify-center gap-1 text-[15px] font-semibold text-primary">
          {shown >= list.length ? '접기' : '더 보기'}
          <ChevronDown className={shown >= list.length ? 'shrink-0 rotate-180' : 'shrink-0'} />
        </button>
      )}
    </Stagger>
  );

  const records = res.loading ? (
    <SkeletonRows rows={4} />
  ) : res.error?.code === 'PATIENT_NOT_LINKED' ? (
    <StateView icon="hospital" title="연결된 진료 기록이 없습니다" body="가입은 완료됐습니다. 진료 기록은 관리자가 환자 정보를 연결한 뒤 볼 수 있습니다."
      action={<Button size="md" className="px-6" to="/app/clinics">병원 찾기</Button>} />
  ) : res.error ? (
    <ErrorView error={res.error} onRetry={res.reload} title="기록을 불러오지 못했습니다" />
  ) : tab === 'mine' ? (
    mine.length === 0 ? (
      <StateView icon="pencil" title="아직 쓴 증상 기록이 없습니다" body="불편한 곳이 생기면 기록해 두고 진료 때 보여주세요."
        action={<Button size="md" className="px-6" to="/app/symptoms/new">증상 기록하기</Button>} />
    ) : rows
  ) : res.data.linking && visits.length === 0 ? (
    <StateView icon="hospital" title="병원 기록을 연결하고 있습니다" body="연결되면 여기에 병원 기록이 보입니다."
      action={<Button size="md" className="px-6" to="/app/symptoms/new">증상 먼저 기록하기</Button>} />
  ) : visits.length === 0 ? (
    <StateView icon="hospital" title="아직 병원 기록이 없습니다" body="병원에서 진료를 받으면 여기에 기록이 보입니다." />
  ) : list.length === 0 ? (
    <StateView icon="tray" title="조건에 맞는 기록이 없습니다" body="필터를 바꿔 보세요." action={<TextButton onClick={() => setFilter(EMPTY_FILTER)}>필터 초기화</TextButton>} />
  ) : rows;

  return (
    <MobileShell>
      <header className="flex h-16 shrink-0 items-center gap-2.5 px-5">
        <img src="/assets/cc-icon.png" alt="" width="40" height="40" />
        <span className="flex-1 text-[20px] font-semibold">CareCompass</span>
        <Link to="/app/me" aria-label="내 정보" className="-mr-2 flex size-12 items-center justify-center">
          <Img name="profile" size={34} />
        </Link>
      </header>

      <main className="flex flex-1 flex-col gap-2.5 px-5 pb-6 pt-1">
        <h1 className="text-[24px] font-semibold leading-[30px]">{me.data ? (me.data.name ? `${me.data.name}님의 진료 기록` : '내 진료 기록') : me.error ? '진료 기록' : <Skeleton className="h-[30px] w-48" />}</h1>

        {!res.error && all.length > 0 && <FollowupCard state={followups} />}

        {unread ? (
          <Link to={`/app/records/${unread.id}`} className="flex shrink-0 items-center gap-3 rounded-2xl bg-primary-wash py-3 pl-4 pr-3">
            <Img name="document" size={28} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-medium leading-[22px]">새 진료 기록이 도착했습니다</span>
              <span className="text-[13px] font-semibold leading-[19px] text-primary">쉬운 설명 보기</span>
            </span>
            <ChevronRight color="#2479c8" />
          </Link>
        ) : !res.error && all.length > 0 && (
          <div className="flex h-12 shrink-0 items-center gap-3 rounded-2xl bg-panel px-4">
            <Img name="pencil" size={28} />
            <span className="flex-1 text-[15px] font-medium">오늘 불편한 곳이 있습니까?</span>
            <TextButton to="/app/symptoms/new" className="cc-hit !text-primary-dark">기록하기</TextButton>
          </div>
        )}

        {ready && (
          <Segmented className="mt-1" value={tab} onChange={pickTab}
            options={[{ value: 'visit', label: `병원 기록${visits.length ? ` ${visits.length}` : ''}` }, { value: 'mine', label: `내가 쓴 기록${mine.length ? ` ${mine.length}` : ''}` }]} />
        )}

        {ready && tab === 'visit' && visits.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Chips className="min-w-0 flex-1" options={chips} value={filter.specialty} onChange={pickChip} />
            <button type="button" aria-label="기록 필터" onClick={() => setSheet(true)}
              className={`cc-hit flex size-9 shrink-0 items-center justify-center rounded-xl ${filtered ? 'bg-primary-soft' : 'bg-chip'}`}>
              <Filter />
              {filtered && <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" />}
            </button>
          </div>
        )}

        {records}
      </main>

      <TabBar active="home" />

      <FilterSheet open={sheet} value={filter} specialties={specialties} clinics={clinics} onClose={() => setSheet(false)}
        onApply={(f) => { setFilter(f); setShown(PAGE); setSheet(false); }}
        onReset={() => { setFilter(EMPTY_FILTER); setShown(PAGE); setSheet(false); toast({ title: '필터를 초기화했습니다' }); }} />
    </MobileShell>
  );
}

/* 02 기록 필터 (병원 기록) */
function FilterSheet({ open, value, specialties, clinics, onClose, onApply, onReset }) {
  const [f, setF] = useState(value);
  const [q, setQ] = useState('');
  const [recent, setRecent] = useState(loadRecent);
  useEffect(() => { if (open) { setF(value); setQ(''); } }, [open, value]);
  const group = (title, children) => <section className="flex flex-col gap-2.5"><h3 className="text-[15px] font-semibold">{title}</h3>{children}</section>;
  const wrap = 'flex-wrap overflow-visible';

  // 진료과: 전체 목록 + 목록에 없는 코드로 온 기록의 진료과
  const codes = [...SPECIALTIES.map(([c]) => c), ...specialties.filter((c) => !SPECIALTIES.some(([k]) => k === c))];
  // 병원: 이름으로 찾아서 고름. 최근에 고른 4곳은 칩으로 (내 병원 기록에 있는 병원만)
  const pickClinic = (clinic) => { const next = pushRecent(recent, clinic); setRecent(next); saveRecent(next); setF({ ...f, clinic }); setQ(''); };
  const term = q.trim();
  const matches = term ? clinics.filter((c) => c.includes(term)).slice(0, 6) : [];
  const recentChips = recent.filter((c) => clinics.includes(c));
  if (f.clinic && !recentChips.includes(f.clinic)) recentChips.unshift(f.clinic);

  return (
    <Sheet open={open} title="기록 필터" onClose={onClose}>
      {group('기간', (
        <>
          <Chips className={wrap} options={PERIODS} value={f.period} onChange={(period) => setF({ ...f, period })} />
          {f.period === 'custom' && (
            <div className="flex items-end gap-2">
              <DateField compact label="시작" placeholder="시작 날짜" value={f.from} max={f.to || undefined} onChange={(from) => setF({ ...f, from })} />
              <span className="pb-3 text-sub">~</span>
              <DateField compact label="끝" placeholder="끝 날짜" value={f.to} min={f.from || undefined} onChange={(to) => setF({ ...f, to })} />
            </div>
          )}
        </>
      ))}
      {group('진료과', <Chips className={wrap} options={[{ value: '', label: '전체' }, ...codes.map((c) => ({ value: c, label: specialtyName(c, c) }))]} value={f.specialty} onChange={(specialty) => setF({ ...f, specialty })} />)}
      {group('병원', (
        <>
          <label className="flex h-11 items-center gap-2 rounded-xl bg-field px-4 focus-within:bg-white focus-within:shadow-[inset_0_0_0_1.5px_#2479c8]">
            <Search />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="병원 이름으로 찾기" aria-label="병원 이름으로 찾기" maxLength={40}
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted" />
          </label>
          {term ? (
            matches.length ? (
              <div className="flex flex-col">
                {matches.map((c) => (
                  <button key={c} type="button" onClick={() => pickClinic(c)} className="flex min-h-11 items-center border-b border-line py-2 text-left text-[15px]">{c}</button>
                ))}
              </div>
            ) : <p className="text-[14px] text-sub">내 병원 기록에 없는 병원입니다.</p>
          ) : (
            <>
              <span className="text-[13px] text-sub">{recentChips.length ? '최근 찾은 병원' : '병원을 찾으면 최근 4곳이 여기에 보입니다.'}</span>
              <Chips className={wrap} options={[{ value: '', label: '전체' }, ...recentChips.map((c) => ({ value: c, label: <span className="block max-w-[260px] truncate" title={c}>{c}</span> }))]} value={f.clinic} onChange={(clinic) => setF({ ...f, clinic })} />
            </>
          )}
        </>
      ))}
      <BottomBar className="!static -mx-5 -mb-7 mt-1">
        <Button variant="secondary" className="w-[100px]" onClick={onReset}>초기화</Button>
        <Button className="flex-1" onClick={() => onApply(f)}>적용</Button>
      </BottomBar>
    </Sheet>
  );
}
