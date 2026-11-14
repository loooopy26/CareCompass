// 기록 목록 한 줄 (01 홈, 01-e 예외 항목): 제목 + 병원/내가 쓴 기록 + 오른쪽 날짜와 상태 글자
import { Link } from 'react-router-dom';
import { ChevronRight } from './icons.jsx';
import { looseDate, precision } from '../lib/format.js';

// 상태 글자 (B1: 배경 없이 글자색만)
const STATUS = {
  cancelled: { label: '취소된 기록', cls: 'text-muted' },
  'entered-in-error': { label: '잘못 입력된 기록', cls: 'text-danger-text' },
};

export const recordSub = (r) => (r.kind === 'symptom' ? '내가 쓴 기록' : r.clinic);

export default function RecordRow({ r, sub = recordSub(r), right, to = `/app/records/${r.id}` }) {
  const status = STATUS[r.status];
  return (
    <Link to={to} className="flex min-h-16 items-center gap-3 border-b border-line py-2 text-left">
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={`truncate text-[16px] font-semibold leading-6 ${r.status === 'cancelled' ? 'text-muted' : ''}`}>{r.title || '제목 없는 기록'}</span>
        {sub && <span className="truncate text-[13px] leading-[19px] text-sub">{sub}</span>}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1 text-right text-[13px] leading-[19px]">
        <span className="text-sub">{right ?? (precision(r.date) === 'none' ? '' : looseDate(r.date))}</span>
        {status && <span className={`font-semibold ${status.cls}`}>{status.label}</span>}
      </span>
      <ChevronRight />
    </Link>
  );
}

// 목록을 연도로 나누는 줄: 올해는 줄 없이, 지난해부터 "2025년", 날짜가 없으면 "날짜 미확인"
export function yearLabel(r, prev, thisYear) {
  const key = (x) => (precision(x?.date) === 'none' ? 'none' : Number(x.date.slice(0, 4)));
  const k = key(r);
  if (k === thisYear || (prev && key(prev) === k)) return null;
  return k === 'none' ? '날짜 미확인' : `${k}년`;
}

export const YearDivider = ({ label }) => (
  <div className="flex items-center gap-2.5 pb-0.5 pt-1.5">
    <span className="text-[13px] font-semibold text-sub">{label}</span>
    <span className="h-px flex-1 bg-line-strong" />
  </div>
);
