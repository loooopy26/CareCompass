// 진료과: 건강보험심사평가원(HIRA) 진료과목 코드. SELF는 환자가 쓴 기록.
// 프로토타입이 없는 객체라 'toString' 같은 코드가 와도 함수가 나오지 않음.
// 진료과 (심평원 진료과목 코드). 화면에 보여 주는 순서대로: 병원 찾기 칩, 기록 필터
export const SPECIALTIES = [
  ['01', '내과'], ['05', '정형외과'], ['49', '치과'], ['13', '이비인후과'], ['14', '피부과'], ['12', '안과'], ['11', '소아청소년과'],
  ['10', '산부인과'], ['15', '비뇨의학과'], ['23', '가정의학과'], ['21', '재활의학과'], ['02', '신경과'], ['06', '신경외과'],
  ['04', '외과'], ['03', '정신건강의학과'], ['09', '마취통증의학과'], ['08', '성형외과'],
];
export const specialtyLabel = Object.assign(Object.create(null), Object.fromEntries(SPECIALTIES), { SELF: '내 기록', UNKNOWN: '기타 진료과' });

const DAYS =['일', '월', '화', '수', '목', '금', '토'];
const d = (v) => new Date(v.length === 10 ? `${v}T00:00:00` : v);
const pad = (n) => String(n).padStart(2, '0');

export const monthDay = (v) => `${d(v).getMonth() + 1}월 ${d(v).getDate()}일`; // 10월 31일
export const monthDayWeek = (v) => `${monthDay(v)} ${DAYS[d(v).getDay()]}요일`; // 11월 27일 금요일
export const fullDate = (v) => `${d(v).getFullYear()}년 ${monthDay(v)}`; // 2026년 10월 31일
export const fullDateShortWeek = (v) => `${fullDate(v)} (${DAYS[d(v).getDay()]})`; // 2026년 11월 27일 (금)
export const time = (v) => `${pad(d(v).getHours())}:${pad(d(v).getMinutes())}`; // 09:40
export const fullDateTime = (v) => `${fullDate(v)} ${time(v)}`; // 2026년 10월 31일 09:40
// 'HH:mm' (24시간) → 오전/오후 표시
export const ampmTime = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${pad(m)}`; }; // 15:05 → 오후 3:05
export const year = (v) => d(v).getFullYear();
export const birth = (v) => (v ? fullDate(v) : '—'); // 1990년 5월 14일. 없으면 —

// 진료과 이름. 목록에 없는 코드: fallback(기본: 빈 글자) 반환, 화면에 'undefined'가 나오지 않음
export const specialtyName = (code, fallback = '') => specialtyLabel[code] ?? fallback;

// 병원 기록 날짜는 연도만, 연·월만 오거나 없을 수 있음 (01-e). 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD[THH:mm]' | null
export const precision = (v) => (!v ? 'none' : v.length === 4 ? 'year' : v.length === 7 ? 'month' : 'day');
export const yearMonth = (v) => `${v.slice(0, 4)}년 ${Number(v.slice(5, 7))}월`; // 2024년 3월
export const looseDate = (v) => ({ none: '날짜 미확인', year: `${v?.slice(0, 4)}년`, month: v && yearMonth(v), day: v && monthDay(v) })[precision(v)];
export const looseFullDate = (v) => ({ none: '날짜 미확인', year: `${v?.slice(0, 4)}년`, month: v && yearMonth(v), day: v && fullDate(v) })[precision(v)];

// 다음 진료 날짜: 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD[THH:mm]'. 연·월만 온 경우: 날짜와 요일을 만들지 않음.
export const nextVisitText = (v, { weekday = true } = {}) => {
  const p = precision(v);
  if (p === 'none') return '';
  if (p === 'year') return `${v.slice(0, 4)}년 중`; // 2027년 중
  if (p === 'month') return `${yearMonth(v)} 중`; // 2027년 4월 중
  return weekday ? monthDayWeek(v) : monthDay(v);
};

// 남은 시간 (초) → 4:32 / 03:12
export const mss = (sec) => `${Math.floor(sec / 60)}:${pad(sec % 60)}`;
export const mmss = (sec) => `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;

// 휴대폰 번호. 화면은 010-1234-5678, 저장(Cognito phone_number)은 +821012345678
// shortcut: 휴대폰(01x)만 맞춤, 지역번호가 필요하면 바꿈
export const phoneInput = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  const mid = d.length === 11 ? 7 : 6;
  return d.length < 4 ? d : d.length < 7 ? `${d.slice(0, 3)}-${d.slice(3)}` : `${d.slice(0, 3)}-${d.slice(3, mid)}-${d.slice(mid)}`;
};
export const phoneOk = (v) => /^01[016789]-\d{3,4}-\d{4}$/.test(v);
export const toE164 = (v) => (v ? `+82${v.replace(/\D/g, '').slice(1)}` : '');
export const phoneText = (e164) => (e164?.startsWith('+82') ? phoneInput(`0${e164.slice(3)}`) : e164 ?? '');
