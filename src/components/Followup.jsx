// 다음 진료 카드 4종 (01-f 39:2): 날짜가 확정된 예약 / 진료 계획(날짜 미정) / 월까지만 아는 일정 / 받은 일정이 없을 때
import { Link } from 'react-router-dom';
import { ChevronRight, Img } from './icons.jsx';
import { Skeleton } from './ui';
import { monthDayWeek, precision, time, yearMonth } from '../lib/format.js';

// 일정 한 건의 날짜 글자: 11월 13일 금요일 / 2026년 12월 중 / 필요할 때 다시 진료
export const followupWhen = (f) => {
  const p = precision(f.date);
  if (p === 'day') return `${monthDayWeek(f.date)}${f.date.length > 10 ? ` ${time(f.date)}` : ''}`;
  if (p === 'month') return `${yearMonth(f.date)} 중`;
  if (p === 'year') return `${f.date}년 중`;
  return f.title ?? '날짜 미정';
};

export default function FollowupCard({ state }) {
  if (state.loading) return <Skeleton className="h-[134px] rounded-[20px]" />;
  const next = state.data?.[0];
  if (state.error || !next) {
    return (
      <div className="flex flex-col gap-0.5 rounded-[20px] bg-panel px-5 py-3">
        <span className="text-[13px] font-semibold text-sub">다음 진료</span>
        <span className="text-[16px] font-semibold leading-6 text-sub">{state.error ? '일정을 불러오지 못했습니다' : '예정된 진료가 없습니다'}</span>
      </div>
    );
  }
  const booked = next.kind === 'APPOINTMENT';
  const monthOnly = precision(next.date) === 'month' || precision(next.date) === 'year';
  return (
    <div className="flex flex-col gap-2.5 rounded-[20px] bg-done px-5 py-3">
      <Link to="/app/schedule" className="flex items-center gap-3">
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-[13px] font-semibold text-done-text">{booked ? '다음 진료 예약' : '다음 진료 계획'}</span>
          <span className="text-[20px] font-semibold leading-7">{followupWhen(next)}</span>
          <span className="text-[15px] leading-[22px]">{next.clinic || next.title}</span>
        </span>
        <Img name="calendar" size={40} />
        <ChevronRight />
      </Link>
      {monthOnly && <span className="text-[13px] text-done-sub">정확한 날짜는 병원에 확인해 주세요</span>}
      {booked && (
        <div className="flex justify-end">
          <Link to={`/app/prep/${next.id}`} className="cc-hit flex h-9 items-center rounded-[10px] bg-white px-4 text-[14px] font-semibold">진료 준비</Link>
        </div>
      )}
    </div>
  );
}
