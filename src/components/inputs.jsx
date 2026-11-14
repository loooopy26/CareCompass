// 증상 기록 입력 부품: 날짜 칸 + 10-a 날짜 고르기, 시간 칸 + 10-b 시간 고르기, 12 시간 스테퍼, 13 아픈 정도 슬라이더, 칩 한 개 고르기
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronRight } from './icons.jsx';
import { Button, Field, Sheet, TextButton } from './ui';
import { ampmTime, fullDate, monthDay, phoneInput, phoneOk } from '../lib/format.js';
import { now } from '../api';

const cx = (...c) => c.filter(Boolean).join(' ');
const ymd = (d) => d.toLocaleDateString('sv-SE');
const CalendarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#52667a" strokeWidth="1.8" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" strokeLinecap="round" />
  </svg>
);

/* 날짜 칸: 누르면 아래에서 달력 (10-a 45:2). 브라우저 기본 달력 대신 앱 디자인 그대로 씀.
   min/max: 'YYYY-MM-DD'. max 기본값은 오늘 (생년월일·증상 시작일은 미래가 없음) */
export function DateField({ label, value, onChange, placeholder = '날짜를 골라 주세요', min, max, compact }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cx('flex min-w-0 flex-col gap-2', compact && 'flex-1')}>
      {label && <span className="text-[14px] font-semibold text-sub">{label}</span>}
      <button type="button" onClick={() => setOpen(true)} aria-label={label ? `${label}: ${value ? fullDate(value) : placeholder}` : undefined}
        className={cx('flex items-center gap-2 rounded-xl bg-field px-4 text-left', compact ? 'h-11 text-[15px]' : 'h-[52px] text-[16px]')}>
        <span className={cx('min-w-0 flex-1 truncate', !value && 'text-muted')}>{value ? fullDate(value) : placeholder}</span><CalendarIcon />
      </button>
      <DateSheet open={open} value={value} min={min} max={max} onClose={() => setOpen(false)} onPick={(v) => { onChange(v); setOpen(false); }} />
    </div>
  );
}

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
const pad = (n) => String(n).padStart(2, '0');
const navBtn = 'flex size-9 items-center justify-center rounded-full hover:bg-field disabled:opacity-30 disabled:hover:bg-transparent';

function DateSheet({ open, value, min, max, onClose, onPick }) {
  const today = ymd(new Date(now()));
  const hi = max ?? today;
  const lo = min ?? '1900-01-01';
  const [month, setMonth] = useState(() => (value || hi).slice(0, 7));
  const [picked, setPicked] = useState(value);
  const [mode, setMode] = useState('day'); // day | year | month: 제목을 누르면 연도 → 달을 바로 고름 (생년월일처럼 먼 날짜)
  const yearList = useRef(null);

  // 열 때마다 지금 값에서 시작
  useEffect(() => {
    if (!open) return;
    setMonth((value || hi).slice(0, 7));
    setPicked(value);
    setMode('day');
  }, [open, value, hi]);
  useEffect(() => { if (mode === 'year') yearList.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'center' }); }, [mode]);

  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1).getDay();
  const days = new Date(y, m, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${pad(i + 1)}`)];
  const shift = (n) => { const d = new Date(y, m - 1 + n, 1); setMonth(ymd(d).slice(0, 7)); };
  const years = Array.from({ length: Number(hi.slice(0, 4)) - Number(lo.slice(0, 4)) + 1 }, (_, i) => Number(hi.slice(0, 4)) - i);
  const label = picked && (picked.slice(0, 4) === today.slice(0, 4) ? monthDay(picked) : fullDate(picked));

  return (
    <Sheet open={open} title="날짜 고르기" onClose={onClose}>
      <div className="flex items-center justify-between">
        <button type="button" aria-label="이전 달" disabled={mode !== 'day' || month <= lo.slice(0, 7)} onClick={() => shift(-1)} className={navBtn}><ChevronRight className="rotate-180" /></button>
        <button type="button" onClick={() => setMode(mode === 'day' ? 'year' : 'day')} aria-expanded={mode !== 'day'}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[16px] font-semibold hover:bg-field">
          {y}년 {m}월<ChevronDown size={16} color="#52667a" className={cx('shrink-0 transition-transform', mode !== 'day' && 'rotate-180')} />
        </button>
        <button type="button" aria-label="다음 달" disabled={mode !== 'day' || month >= hi.slice(0, 7)} onClick={() => shift(1)} className={navBtn}><ChevronRight /></button>
      </div>

      {mode === 'year' ? (
        <div ref={yearList} className="grid h-[288px] grid-cols-4 content-start gap-2 overflow-y-auto" role="listbox" aria-label="연도">
          {years.map((yy) => (
            <button key={yy} type="button" aria-pressed={yy === y} onClick={() => { setMonth(`${yy}-${pad(m)}`); setMode('month'); }}
              className={cx('h-11 rounded-xl text-[15px]', yy === y ? 'bg-primary font-semibold text-white' : 'bg-field hover:bg-[#e6ebf0]')}>{yy}</button>
          ))}
        </div>
      ) : mode === 'month' ? (
        <div className="grid h-[288px] grid-cols-3 content-start gap-2" role="listbox" aria-label="달">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((mm) => {
            const key = `${y}-${pad(mm)}`;
            const off = key > hi.slice(0, 7) || key < lo.slice(0, 7);
            return (
              <button key={mm} type="button" disabled={off} aria-pressed={mm === m} onClick={() => { setMonth(key); setMode('day'); }}
                className={cx('h-14 rounded-xl text-[15px]', mm === m ? 'bg-primary font-semibold text-white' : 'bg-field hover:bg-[#e6ebf0]', off && 'text-[#c3ccd5] hover:bg-field')}>{mm}월</button>
            );
          })}
        </div>
      ) : (
        <div className="grid h-[288px] grid-cols-7 content-start gap-y-1 text-center" role="grid">
          {DAYS.map((d) => <span key={d} className="pb-1 text-[13px] text-sub">{d}</span>)}
          {cells.map((c, i) => {
            if (!c) return <span key={`e${i}`} />;
            const off = c > hi || c < lo;
            const on = c === picked;
            return (
              <button key={c} type="button" disabled={off} onClick={() => setPicked(c)} aria-pressed={on} aria-label={fullDate(c)}
                className={cx('mx-auto flex size-10 items-center justify-center rounded-full text-[15px]',
                  on ? 'bg-primary font-semibold text-white' : c === today ? 'font-semibold text-primary shadow-[inset_0_0_0_1.5px_#2479c8]' : 'hover:bg-field',
                  off && 'text-[#c3ccd5] hover:bg-transparent')}>
                {Number(c.slice(8))}
              </button>
            );
          })}
        </div>
      )}
      <Button size="md" disabled={!picked} onClick={() => onPick(picked)}>{picked ? `${label}로 정하기` : '날짜를 골라 주세요'}</Button>
    </Sheet>
  );
}

const ClockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#52667a" strokeWidth="1.8" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* 시간 칸: 누르면 아래에서 시간 고르기. 날짜 칸과 같은 방식 (브라우저 기본 시간 선택 대신 앱 디자인).
   value: 'HH:mm' (24시간) 또는 '' (비워 둠) */
export function TimeField({ label, value, onChange, placeholder = '시간을 골라 주세요' }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {label && <span className="text-[14px] font-semibold text-sub">{label}</span>}
      <button type="button" onClick={() => setOpen(true)} aria-label={label ? `${label}: ${value ? ampmTime(value) : placeholder}` : undefined}
        className="flex h-[52px] items-center gap-2 rounded-xl bg-field px-4 text-left text-[16px]">
        <span className={cx('min-w-0 flex-1 truncate', !value && 'text-muted')}>{value ? ampmTime(value) : placeholder}</span><ClockIcon />
      </button>
      <TimeSheet open={open} value={value} onClose={() => setOpen(false)} onPick={(v) => { onChange(v); setOpen(false); }} />
    </div>
  );
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const AMPM = ['오전', '오후'];
const ROW = 44; // 다이얼 한 칸 높이 (px). 보이는 칸은 5개, 가운데 칸이 고른 값

/* 다이얼 한 줄: 위아래로 굴려서 가운데 띠에 멈춘 값을 고름. 칸을 누르거나 ↑↓ 키로도 움직임 */
function Wheel({ label, items, value, onChange, format = String }) {
  const ref = useRef(null);
  const settle = useRef(0);
  const index = Math.max(0, items.indexOf(value));
  const go = (i, smooth = true) => ref.current?.scrollTo({ top: i * ROW, behavior: smooth ? 'smooth' : 'auto' });

  // 값이 바깥에서 바뀐 경우(시트를 연 때): 그 값으로 바로 굴려 둠
  useEffect(() => {
    const el = ref.current;
    if (el && Math.round(el.scrollTop / ROW) !== index) go(index, false);
  }, [index]);

  // 굴리기가 멈춘 뒤 가운데 칸의 값으로 정함
  const onScroll = () => {
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const i = Math.min(items.length - 1, Math.max(0, Math.round((ref.current?.scrollTop ?? 0) / ROW)));
      if (items[i] !== value) onChange(items[i]);
    }, 90);
  };
  useEffect(() => () => clearTimeout(settle.current), []);
  const onKeyDown = (e) => {
    const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const i = Math.min(items.length - 1, Math.max(0, index + step));
    onChange(items[i]);
    go(i);
  };

  return (
    <div className="relative flex-1">
      <div ref={ref} onScroll={onScroll} onKeyDown={onKeyDown} tabIndex={0} role="listbox" aria-label={label} aria-activedescendant={`${label}-${index}`}
        className="relative z-10 h-[220px] snap-y snap-mandatory overflow-y-auto rounded-xl outline-none [mask-image:linear-gradient(transparent,#000_32%,#000_68%,transparent)] [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-scrollbar]:hidden">
        <div style={{ height: ROW * 2 }} aria-hidden="true" />
        {items.map((it, i) => (
          <button key={it} id={`${label}-${i}`} type="button" tabIndex={-1} role="option" aria-selected={i === index} onClick={() => go(i)}
            className={cx('flex w-full snap-center items-center justify-center transition-colors', i === index ? 'text-[24px] font-semibold' : 'text-[17px] text-muted')} style={{ height: ROW }}>
            {format(it)}
          </button>
        ))}
        <div style={{ height: ROW * 2 }} aria-hidden="true" />
      </div>
    </div>
  );
}

function TimeSheet({ open, value, onClose, onPick }) {
  const [ampm, setAmpm] = useState('오후');
  const [hour, setHour] = useState(12); // 1~12
  const [minute, setMinute] = useState(0);

  // 열 때마다 지금 값에서 시작 (값이 없는 경우: 지금 시각, 분은 5분 단위로 내림)
  useEffect(() => {
    if (!open) return;
    const d = new Date(now());
    const [h, m] = value ? value.split(':').map(Number) : [d.getHours(), d.getMinutes()];
    setAmpm(h >= 12 ? '오후' : '오전');
    setHour(h % 12 || 12);
    setMinute(m - (m % 5));
  }, [open, value]);

  const hh = (hour % 12) + (ampm === '오후' ? 12 : 0);
  const label = `${ampm} ${hour}시${minute ? ` ${minute}분` : ''}`;

  return (
    <Sheet open={open} title="시간 고르기" onClose={onClose}>
      <div className="relative flex gap-1">
        {/* 가운데 띠: 여기에 멈춘 값이 고른 값 */}
        <div className="pointer-events-none absolute inset-x-0 rounded-xl bg-field" style={{ top: ROW * 2, height: ROW }} aria-hidden="true" />
        <Wheel label="오전 오후" items={AMPM} value={ampm} onChange={setAmpm} />
        <Wheel label="시" items={HOURS} value={hour} onChange={setHour} format={(h) => `${h}시`} />
        <Wheel label="분" items={MINUTES} value={minute} onChange={setMinute} format={(m) => `${pad(m)}분`} />
      </div>
      <Button size="md" onClick={() => onPick(`${pad(hh)}:${pad(minute)}`)}>{`${label}${minute ? '으로' : '로'} 정하기`}</Button>
      {value && <TextButton className="-mt-1 self-center" onClick={() => onPick('')}>시간 지우기</TextButton>}
    </Sheet>
  );
}

/* 12 한 번 아프면 얼마나 가나요? − 20 분 + (5분 단위, 60분부터 30분 단위) */
export function Stepper({ value, onChange, min = 5, max = 24 * 60 }) {
  const step = (dir) => {
    const s = value + dir > 60 || (dir < 0 && value > 60) ? 30 : 5;
    onChange(Math.min(max, Math.max(min, value + dir * s)));
  };
  const text = value >= 60 ? [`${Math.floor(value / 60)}`, value % 60 ? `시간 ${value % 60}분` : '시간'] : [`${value}`, '분'];
  const btn = 'flex size-10 items-center justify-center rounded-[10px] bg-white text-[24px] font-medium shadow-[0_1px_2px_rgba(24,59,91,0.08)] disabled:opacity-40';
  return (
    <div className="flex h-[60px] items-center justify-between rounded-[14px] bg-field px-2.5">
      <button type="button" aria-label="줄이기" className={btn} disabled={value <= min} onClick={() => step(-1)}>−</button>
      <span className="text-[20px] font-semibold" aria-live="polite">{text[0]}<span className="ml-1 text-[15px] font-medium text-sub">{text[1]}</span></span>
      <button type="button" aria-label="늘리기" className={btn} disabled={value >= max} onClick={() => step(1)}>+</button>
    </div>
  );
}

/* 13 얼마나 아프십니까? 0~10 */
export function PainSlider({ value, onChange, label = '아픈 정도', zero = '안 아파요' }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-center">
        <motion.span key={value} initial={{ scale: 1.25 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }}
          className="inline-block text-[52px] font-semibold leading-[60px] text-primary">{value}</motion.span>
        <span className="ml-1 text-[20px] font-semibold text-sub">/ 10</span>
      </div>
      <input type="range" min="0" max="10" step="1" value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label}
        aria-valuetext={`10점 중 ${value}점`} className="cc-range w-full" style={{ '--p': `${value * 10}%` }} />
      <div className="flex justify-between text-[13px] text-sub"><span>0 {zero}</span><span>10 참기 힘들어요</span></div>
    </div>
  );
}

/* 한 개 고르는 버튼 줄 (11 어느 쪽, 12 얼마나 자주): 고르면 연한 파랑 + 파란 테두리 */
export function SegmentPick({ options, value, onChange, label }) {
  return (
    <div className="flex gap-2" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={o === value} onClick={() => onChange(o)} className={cx('flex-1', pick(o === value))}>{o}</button>
      ))}
    </div>
  );
}
const pick = (on) => cx('flex h-[52px] items-center justify-center rounded-[14px] text-[15px]',
  on ? 'bg-primary-soft font-semibold text-primary-dark shadow-[inset_0_0_0_1.5px_#2479c8]' : 'bg-field font-medium');

/* 켜고 끄는 버튼 하나 (SegmentPick과 같은 모양). 예: 시작한 날 '잘 모르겠어요' */
export const ToggleChip = ({ on, onToggle, children }) => (
  <button type="button" role="checkbox" aria-checked={on} onClick={onToggle} className={pick(on)}>{children}</button>
);

/* 칸에서 나간 뒤에만 오류를 보여 줌 (입력 중에는 조용히) */
function useTouched() {
  const [touched, setTouched] = useState(false);
  return [touched, () => setTouched(true)];
}
const ErrorText = ({ children }) => <p className="-mt-2 text-[13px] text-danger-text">{children}</p>;

/* 휴대폰 번호 칸: 010-1234-5678로 하이픈을 붙임. 필수 */
export function PhoneField({ value, onChange }) {
  const [touched, touch] = useTouched();
  return (
    <>
      <Field label="휴대폰 번호" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="010-1234-5678" value={value}
        onChange={(e) => onChange(phoneInput(e.target.value))} onBlur={touch} />
      {touched && !phoneOk(value) && <ErrorText>{value ? '휴대폰 번호를 끝까지 입력해 주세요' : '휴대폰 번호를 입력해 주세요'}</ErrorText>}
    </>
  );
}

/* 숫자 + 단위 칸 (키 cm, 몸무게 kg). 소수 첫째 자리까지. 비워 둘 수 있음 */
export const unitOk = (v, min, max) => v === '' || (Number(v) >= min && Number(v) <= max);
export function UnitField({ label, unit, value, onChange, min, max }) {
  const [touched, touch] = useTouched();
  return (
    <div className="flex flex-1 flex-col gap-2">
      <div className="relative">
        <Field label={label} inputMode="decimal" className="w-full pr-12" value={value} onBlur={touch}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, '').replace(/^(\d{0,3}(\.\d?)?).*$/, '$1'))} />
        <span className="pointer-events-none absolute bottom-[15px] right-4 text-[16px] text-sub">{unit}</span>
      </div>
      {touched && !unitOk(value, min, max) && <p className="text-[13px] text-danger-text">{min}~{max}{unit} 사이로 적어 주세요</p>}
    </div>
  );
}

/* 여러 줄 입력칸 */
export function TextArea({ label, className, ...rest }) {
  return (
    <label className="flex flex-col gap-2">
      {label && <span className="text-[14px] font-semibold text-sub">{label}</span>}
      <textarea rows={3} {...rest}
        className={cx('resize-none rounded-xl bg-field px-4 py-4 text-[16px] leading-6 outline-none placeholder:text-muted focus:bg-white focus:shadow-[inset_0_0_0_1.5px_#2479c8]', className)} />
    </label>
  );
}
