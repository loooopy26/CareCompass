// 내 증상 기록 입력값 (09~13)과 화면에 보여줄 글자.
// input: { area, side, detail, startDate, startTime, minutes, frequency, when, pain, memo }
// area는 자유 입력 (무릎, 두통, 기침 …). 질문·선택지·예시는 profile(area)로 증상에 맞게 바꿈.
import { ampmTime, fullDate, monthDay } from './format.js';

export const SIDES = ['왼쪽', '오른쪽', '양쪽'];
export const FREQUENCIES = ['가끔', '거의 계속', '잘 모르겠어요'];

// 받침이 있으면 a, 없으면 b (이/가, 은/는 …). 한글이 아니면 b
const josa = (word, a, b) => {
  const c = (word ?? '').trim().slice(-1).charCodeAt(0) - 0xac00;
  return c >= 0 && c <= 11171 && c % 28 ? a : b;
};

// 느낌별 글자: 아픈 / 가려운 / 힘든 / 불편한
const FEEL = {
  pain: { adj: '아픈', q: '아프십니까?', onset: '아프면', zero: '안 아파요' },
  itch: { adj: '가려운', q: '가려우십니까?', onset: '가려우면', zero: '안 가려워요' },
  hard: { adj: '힘든', q: '힘드십니까?', onset: null, zero: '괜찮아요' },
  vague: { adj: '불편한', q: '불편하십니까?', onset: '불편하면', zero: '괜찮아요' },
};

// 증상 종류: 낱말(앞에서부터 먼저 맞는 것), 어느 쪽인지 묻는지, 위치를 묻는지, 느낌, 주로 언제, 예시
const KINDS = [
  { id: 'skin', words: ['가려', '두드러기', '발진', '피부', '습진', '뾰루지', '여드름', '물집', '벌레'], located: true, feel: 'itch', region: '',
    whens: ['씻고 난 뒤', '땀 흘린 뒤', '밤에', '무언가 먹은 뒤'], detail: '예: 팔 안쪽, 목 뒤', memo: '예: 긁으면 붉게 부어올라요.' },
  { id: 'breath', words: ['기침', '가래', '콧물', '코막힘', '재채기', '인후', '목감기', '목이 따', '목이 아', '숨'], located: false, feel: 'hard',
    whens: ['아침에', '밤에 누우면', '찬 바람을 쐬면', '말을 많이 하면'], memo: '예: 밤에 누우면 기침이 심해져 잠을 깨요.' },
  { id: 'head', words: ['두통', '편두통', '머리'], located: true, feel: 'pain', region: '머리',
    whens: ['아침에 일어날 때', '오후에', '화면을 오래 볼 때', '잠이 부족할 때'], detail: '예: 관자놀이, 뒷머리', memo: '예: 오후가 되면 관자놀이가 지끈거려요.' },
  { id: 'chest', words: ['가슴', '흉통'], located: true, feel: 'pain', region: '가슴',
    whens: ['움직일 때', '숨을 깊이 쉴 때', '쉬고 있을 때', '밤에'], detail: '예: 가운데, 왼쪽 아래', memo: '예: 계단을 오르면 가슴이 조이는 느낌이에요.' },
  { id: 'belly', words: ['복통', '배', '속쓰', '속이', '위가', '명치', '옆구리', '소화'], located: true, feel: 'pain', region: '배',
    whens: ['밥 먹고 난 뒤', '배고플 때', '화장실 가기 전', '밤에'], detail: '예: 배꼽 아래 오른쪽', memo: '예: 밥 먹고 30분쯤 지나면 명치가 쓰려요.' },
  { id: 'body', words: ['열', '발열', '오한', '몸살', '어지러', '현기증', '피로', '피곤', '메스꺼', '구토', '설사', '변비', '불면', '잠이'], located: false, feel: 'hard',
    whens: ['아침에', '오후에', '밤에', '일어설 때'], memo: '예: 오후가 되면 몸이 으슬으슬 추워요.' },
  { id: 'eye', words: ['눈'], located: true, sided: true, feel: 'vague',
    whens: ['화면을 오래 볼 때', '아침에 일어날 때', '밝은 곳에서', '밤에'], detail: '예: 눈꺼풀, 눈 안쪽', memo: '예: 오래 보면 눈이 뻑뻑하고 침침해요.' },
  { id: 'ear', words: ['귀'], located: true, sided: true, feel: 'vague',
    whens: ['조용한 곳에서', '시끄러운 곳에 있다가', '아침에', '밤에'], detail: '예: 귀 안쪽, 귀 뒤', memo: '예: 조용하면 귀에서 삐 소리가 나요.' },
  { id: 'spine', words: ['허리', '목', '등', '골반', '꼬리뼈'], located: true, feel: 'pain',
    whens: ['오래 앉아 있을 때', '숙일 때', '아침에 일어날 때', '무거운 걸 들 때'], detail: '예: 아래쪽 가운데', memo: '예: 오래 앉아 있다 일어나면 허리가 뻐근해요.' },
  { id: 'upper', words: ['어깨', '팔꿈치', '손목', '손가락', '손', '팔'], located: true, sided: true, feel: 'pain',
    whens: ['팔을 들 때', '물건을 들 때', '많이 쓰고 난 뒤', '자려고 누울 때'], detail: '예: 바깥쪽, 뒤쪽', memo: '예: 팔을 위로 올리면 어깨 앞쪽이 찌릿해요.' },
  { id: 'lower', words: ['무릎', '발목', '발가락', '발바닥', '발', '고관절', '엉덩이', '허벅지', '종아리', '다리', '정강이'], located: true, sided: true, feel: 'pain',
    whens: ['걷고 난 뒤', '계단 오를 때', '오래 서 있을 때', '아침에 일어날 때'], detail: '예: 안쪽, 뒤쪽', memo: '예: 걷고 나면 무릎 안쪽이 시큰거려요.' },
];
const OTHER = { id: 'other', located: true, feel: 'vague',
  whens: ['아침에', '낮에', '밤에', '움직일 때', '쉬고 있을 때'], detail: '예: 오른쪽 아래', memo: '예: 오래 움직이면 더 불편해져요.' };

// 이미 증상 이름으로 쓴 경우 (두통, 저림, 어지러움 …): 제목에 '불편감'을 붙이지 않음
const NAMED = /(통|증|림|움|함|감|침|물|열|진|기|려|요)$/;
const SIDE_IN_TEXT = /^(왼|오른|양)/;

export const profile = (area = '') => {
  const a = area.replace(/\s+/g, ' ').trim();
  // 가장 길게 맞는 낱말의 종류 ('손목'은 '목'보다 '손목', '발진'은 '발'보다 '발진')
  const len = (x) => Math.max(0, ...x.words.filter((w) => a.includes(w)).map((w) => w.length));
  const k = KINDS.reduce((best, x) => (len(x) > (best ? len(best) : 0) ? x : best), null) ?? OTHER;
  const f = FEEL[k.feel];
  const named = NAMED.test(a) || !k.located; // 기침, 열 … 은 그 자체가 증상 이름
  const sided = !!k.sided && !SIDE_IN_TEXT.test(a); // '오른쪽 무릎'처럼 이미 쓴 경우: 다시 묻지 않음
  const sbj = /요$/.test(a) ? '증상이' : `${a}${josa(a, '이', '가')}`; // 기침이, 열이, 콧물이
  return {
    kind: k.id, located: k.located, sided, named,
    whens: k.whens,
    // 11 위치
    whereQ: sided ? (named ? '어느 쪽입니까?' : `어느 쪽 ${a}입니까?`) : k.region ? `${k.region} 어디가 ${f.q}` : named ? `어디가 ${f.q}` : `${a} 어디쯤입니까?`,
    detail: k.detail,
    // 12 시간과 빈도
    onset: f.onset ?? `${sbj} 시작되면`, // 한 번 아프면 / 한 번 기침이 시작되면
    oftenQ: f.onset ? `얼마나 자주 ${f.q}` : `얼마나 자주 그렇습니까?`,
    whenQ: f.onset ? `주로 언제 ${f.q} (선택)` : '주로 언제 심해집니까? (선택)',
    // 13 정도와 메모
    howQ: `얼마나 ${f.q}`,
    zero: f.zero,
    memo: k.memo,
    // 요약 표의 글자
    whenLabel: f.onset ? `자주 ${f.adj} 때` : '심해지는 때',
    painLabel: `${f.adj} 정도`,
  };
};

// 입력 순서 (1 무엇, 2 언제부터, 3 위치, 4 시간과 빈도, 5 정도). 위치를 묻지 않는 증상(기침, 열 …)은 3을 건너뜀
export const steps = (area) => (profile(area).located ? [1, 2, 3, 4, 5] : [1, 2, 4, 5]);

export const emptyInput = () => ({ area: '', side: '', detail: '', startDate: '', startTime: '', minutes: 20, frequency: '', when: '', pain: 0, memo: '' });

export const part = (s) => [profile(s.area).sided && s.side, s.area.trim()].filter(Boolean).join(' '); // 오른쪽 무릎
export const title = (s) => (profile(s.area).named ? part(s) : `${part(s)} 불편감`); // 오른쪽 무릎 불편감 / 기침
const where = (s) => part(s) + (s.detail ? ` ${s.detail}` : '');
export const duration = (s) => { // 약 20분, 약 1시간 30분
  if (s.minutes < 60) return `약 ${s.minutes}분`;
  const h = Math.floor(s.minutes / 60), m = s.minutes % 60;
  return m ? `약 ${h}시간 ${m}분` : `약 ${h}시간`;
};
// 입력 선택지는 환자 말투('잘 모르겠어요'), 요약·의료진 화면에 보여 줄 때는 '모름'으로 통일
const UNKNOWN = '모름';
const freq = (s) => (s.frequency && s.frequency !== '잘 모르겠어요' ? s.frequency : '');
export const whenFreq = (s) => [s.when, freq(s)].filter(Boolean).join(' ') || UNKNOWN; // 걷고 난 뒤 가끔
export const oftenShort = (s) => [s.when, freq(s)].filter(Boolean).join(' ') || `빈도 ${UNKNOWN}`; // 한 줄 요약용: 빈도 모름
export const pain = (s) => `${s.pain} / 10`;
// 시작한 날을 모르는 경우: startDate가 빈 글자 ('잘 모르겠어요'를 고름)
export const DATE_UNKNOWN = '잘 모르겠어요';
export const start = (s) => (s.startDate ? fullDate(s.startDate) : UNKNOWN); // 2026년 10월 28일
export const startShort = (s) => (s.startDate ? monthDay(s.startDate) : UNKNOWN); // 10월 28일
export const since = (s) => (s.startDate ? `${monthDay(s.startDate)}부터` : '시작한 날 모름'); // 10월 28일부터

// AI 요약 (15, 16에서 고칠 수 있음): { say, start, when, pain, at }. 없는 경우: 입력값으로 채움.
// 06 요약 탭, 14 입력 확인의 표. 위치를 묻지 않는 증상은 위치 줄이 없음
export const summaryRows = (s, sum = {}) => {
  const p = profile(s.area);
  return [['시작', sum.start ?? start(s)], p.located && ['위치', where(s)], ['이어지는 시간', duration(s)], [p.whenLabel, sum.when ?? whenFreq(s)], [p.painLabel, sum.pain ?? pain(s)]].filter(Boolean);
};
// 15 증상 요약 아래 세 줄
export const shortSummaryRows = (s, sum = {}) => {
  const p = profile(s.area);
  return [['시작', sum.start ?? start(s)], [p.whenLabel, sum.when ?? whenFreq(s)], [p.painLabel, sum.pain ?? pain(s)]];
};
// 06-b 내가 쓴 내용 탭
export const inputRows = (s) => {
  const p = profile(s.area);
  return [
    p.located ? ['부위', where(s)] : ['증상', s.area], ['시작한 날', start(s) + (s.startTime ? ` ${ampmTime(s.startTime)}` : '')], [`한 번 ${p.onset}`, duration(s)],
    ['얼마나 자주', freq(s) || UNKNOWN], [p.whenLabel, s.when || '고르지 않았습니다'], [p.painLabel, pain(s)],
  ];
};
// 의료진 화면 한 줄 요약
export const clinicianRows = (s) => {
  const p = profile(s.area);
  return [['시작', startShort(s)], p.located ? ['위치', where(s)] : ['증상', s.area], ['시간과 빈도', `${duration(s)}, ${freq(s) || `빈도 ${UNKNOWN}`}`], [p.painLabel, pain(s)]];
};

// 증상 종류별로 관련 있는 진료과 (심평원 진료과목 코드). 기록 공유 때 그 진료과에 맞는 내 기록만 보여 줌.
// shortcut: 낱말로 고른 대략의 짝. 증상 종류(KINDS)를 늘리면 여기도 함께 맞춤.
const GENERAL = ['01', '11', '23']; // 내과, 소아청소년과, 가정의학과: 몸 전체·속 증상
const KIND_SPECIALTIES = {
  skin: ['14'],
  breath: [...GENERAL, '13'],
  head: ['02', '06', ...GENERAL],
  chest: GENERAL,
  belly: [...GENERAL, '04'],
  body: [...GENERAL, '02', '03'],
  eye: ['12'],
  ear: ['13'],
  spine: ['05', '06', '21', '09'],
  upper: ['05', '21', '09'],
  lower: ['05', '21', '09'],
};
const TOOTH = /치아|이빨|잇몸|사랑니|충치|턱/; // 증상 종류에 치과가 없어서 따로 봄
export const symptomSpecialties = (area = '') => (TOOTH.test(area) ? ['49'] : KIND_SPECIALTIES[profile(area).kind] ?? []);

// 기록이 그 진료과에 맞는지: 병원 기록은 같은 진료과, 내 기록은 관련 진료과. 진료과를 모르면 모두 맞음
export const fitsSpecialty = (r, specialty) => !specialty
  || (r.kind === 'symptom' ? symptomSpecialties(r.symptom?.area ?? r.title).includes(specialty) : r.specialty === specialty);
// 일정·병원의 진료과: 그 일정을 만든 기록, 없으면 같은 병원의 진료 기록에서 찾음
// shortcut: 백엔드 일정에 병원·진료과가 아직 없어서(backendMap toFollowup) 실서버에서는 못 찾음. 일정에 진료과가 오면 그걸 씀.
export const visitSpecialty = (records, clinic, fromRecordId) =>
  (records.find((r) => fromRecordId && r.id === fromRecordId) ?? records.find((r) => r.kind === 'visit' && clinic && r.clinic === clinic))?.specialty;
