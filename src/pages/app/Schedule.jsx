// 29 진료 일정 목록 (15:2): 다가오는 일정 / 날짜 미정 / 지나거나 취소된 일정
import { getSchedule, now } from '../../api';
import { followupWhen } from '../../components/Followup.jsx';
import { YearDivider } from '../../components/RecordRow.jsx';
import { ErrorView, FadeIn, MobileShell, PageHeader, SkeletonRows, StateView, usePaged } from '../../components/ui';
import { looseFullDate, precision } from '../../lib/format.js';
import { isPastFollowup } from '../../lib/schedule.js';
import useAsync from '../../lib/useAsync.js';

const PAST_LABEL = { FULFILLED: '지난 예약', CANCELLED: '취소된 예약', NOSHOW: '방문하지 않은 예약' };

export default function Schedule() {
  const { data, error, loading, reload } = useAsync(getSchedule);
  const today = new Date(now()).toLocaleDateString('sv-SE');
  const thisYear = today.slice(0, 4);

  const items = data ?? [];
  const isPast = (f) => isPastFollowup(f, today);
  const upcoming = items.filter((f) => !isPast(f) && precision(f.date) !== 'none').sort((a, b) => a.date.localeCompare(b.date));
  const undated = items.filter((f) => !isPast(f) && precision(f.date) === 'none');
  const past = items.filter(isPast).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  const [pastShown, morePast] = usePaged(past, 5);

  const row = (f, dim, right) => (
    <div key={f.id} className="flex min-h-16 items-center gap-3 border-b border-line py-2">
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={`text-[17px] font-semibold leading-6 ${dim ? 'text-muted' : ''}`}>{precision(f.date) === 'none' ? '날짜 미정' : precision(f.date) === 'day' ? followupWhen(f) : looseFullDate(f.date)}</span>
        <span className={`truncate text-[13px] leading-[19px] ${dim ? 'text-muted' : 'text-sub'}`}>{[f.clinic, f.kind === 'PLAN' || dim || !f.clinic ? f.title : null].filter(Boolean).join(' ')}</span>
      </span>
      <span className={`shrink-0 text-[13px] font-semibold ${dim ? 'text-muted' : 'text-done-text'}`}>{right}</span>
    </div>
  );
  const section = (title, children) => <section className="flex flex-col"><h2 className="pb-1 pt-3 text-[15px] font-semibold text-sub">{title}</h2>{children}</section>;

  return (
    <MobileShell>
      <PageHeader title="진료 일정" back="/app/home" />
      {loading ? (
        <div className="px-5"><SkeletonRows rows={4} right={false} /></div>
      ) : error ? (
        <ErrorView error={error} onRetry={reload} title="일정을 불러오지 못했습니다" />
      ) : items.length === 0 ? (
        <StateView icon="calendar" title="받은 진료 일정이 없습니다" body="병원에서 예약이나 진료 계획을 보내면 여기에 보입니다." />
      ) : (
        <FadeIn className="flex flex-1 flex-col px-5 pb-6">
          {upcoming.length > 0 && section('다가오는 일정', upcoming.map((f, i) => {
            const y = f.date.slice(0, 4);
            const divider = y !== thisYear && (i === 0 || upcoming[i - 1].date.slice(0, 4) !== y);
            return <div key={f.id}>{divider && <YearDivider label={`${y}년`} />}{row(f, false, f.kind === 'APPOINTMENT' ? '예약' : '진료 계획')}</div>;
          }))}
          {undated.length > 0 && section('날짜 미정', undated.map((f) => row(f, false, '진료 계획')))}
          {past.length > 0 && section('지나거나 취소된 일정', <>{pastShown.map((f) => row(f, true, PAST_LABEL[f.status] ?? '지난 예약'))}{morePast}</>)}
          <p className="mt-5 text-[13px] text-sub">바뀐 일정은 병원에 확인해 주세요.</p>
        </FadeIn>
      )}
    </MobileShell>
  );
}
