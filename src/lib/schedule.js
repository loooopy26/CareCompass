import { precision } from './format.js';

const DONE_STATUS = new Set(['FULFILLED', 'CANCELLED', 'NOSHOW']);

// 지난 일정인지. today는 'YYYY-MM-DD'.
// 완료·취소·노쇼: 날짜와 상관없이 지난 일정.
// 날짜가 달까지만 있는 경우: 그 달이 끝나야 지난 일정. 연도만 있는 경우: 그 해가 끝나야 지난 일정.
export const isPastFollowup = (f, today) => {
  if (DONE_STATUS.has(f.status)) return true;
  switch (precision(f.date)) {
    case 'day': return f.date.slice(0, 10) < today.slice(0, 10);
    case 'month': return f.date.slice(0, 7) < today.slice(0, 7);
    case 'year': return f.date.slice(0, 4) < today.slice(0, 4);
    default: return false;
  }
};
