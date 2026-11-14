// B1 브랜드와 컴포넌트 (Figma 103:2) 기준 공통 컴포넌트
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, HTMLAttributes, InputHTMLAttributes, Key, ReactNode, RefObject } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { ArrowBack, Check, ChevronDown, CheckCircle, ChevronRight, Clock, Close, ErrorIcon, Img, Info, Spinner, TabIcon, Warn } from './icons.jsx';
import { mss } from '../lib/format.js';
import { REVEAL, useReveal } from '../lib/reveal.js';

const cx = (...c: unknown[]) => c.filter(Boolean).join(' ');

type Children = { children?: ReactNode };
type WithClass = { className?: string };

/* 버튼: 주요 / 보조 / 누를 수 없습니다 / 처리 중 */
const BTN_SIZE = {
  lg: 'h-[60px] rounded-[14px] text-[17px]', // 환자 앱 하단 버튼
  md: 'h-[56px] rounded-[12px] text-[17px]', // 시트, 의료진 로그인
  pc: 'h-[52px] rounded-[12px] text-[16px] px-6', // 의료진 화면
};
const BTN_VARIANT = {
  primary: 'bg-primary text-white hover:bg-primary-dark',
  secondary: 'bg-white text-primary shadow-[inset_0_0_0_1.5px_#2479c8] hover:bg-primary-tint',
  // 되돌릴 수 없는 일 (계정 삭제, 기록 삭제): 빨강
  danger: 'bg-[#c23b3b] text-white hover:bg-[#a83232]',
  dangerLine: 'bg-white text-[#c23b3b] shadow-[inset_0_0_0_1.5px_#c23b3b] hover:bg-danger',
};

// to: 앱 안 주소(Link), href: 바깥 주소(a), 둘 다 없으면 button. disabled면 언제나 button.
type ButtonProps = Children & WithClass & HTMLAttributes<HTMLElement> & {
  variant?: keyof typeof BTN_VARIANT;
  size?: keyof typeof BTN_SIZE;
  loading?: boolean;
  disabled?: boolean;
  to?: string;
  state?: unknown; // to로 갈 때 넘길 router state
  href?: string;
  type?: 'button' | 'submit' | 'reset';
};

export function Button({ variant = 'primary', size = 'lg', loading, disabled, to, state, href, className, children, ...rest }: ButtonProps) {
  const cls = cx(
    'flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[scale,background-color] active:scale-[0.98]',
    BTN_SIZE[size],
    disabled ? 'bg-disabled text-disabled-text pointer-events-none' : BTN_VARIANT[variant],
    loading && 'opacity-85 pointer-events-none',
    className,
  );
  // 테두리 버튼은 바탕이 흰색이라 흰 스피너가 보이지 않음
  const line = variant === 'secondary' || variant === 'dangerLine';
  const body = <>{loading && <Spinner {...(line && { color: 'currentColor', track: 'rgba(24,59,91,0.15)' })} />}{children}</>;
  if (to && !disabled) return <Link to={to} state={state} className={cls} {...rest}>{body}</Link>;
  if (href && !disabled) return <a href={href} className={cls} {...rest}>{body}</a>;
  return <button type="button" className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>{body}</button>;
}

/* 글자 버튼: 파랑 */
export function TextButton({ to, className, children, ...rest }: Children & WithClass & HTMLAttributes<HTMLElement> & { to?: string }) {
  const cls = cx('font-semibold text-primary text-[15px] hover:text-primary-dark', className);
  return to ? <Link to={to} className={cls} {...rest}>{children}</Link> : <button type="button" className={cls} {...rest}>{children}</button>;
}

/* 목록 행: 제목 + 보조 + 오른쪽 날짜 + 꺾쇠 */
export function ListRow({ title, sub, right, to, onClick }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; to?: string; onClick?: () => void }) {
  const inner = (
    <>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="line-clamp-2 text-[16px] font-medium leading-6">{title}</div>
        {sub && <div className="truncate text-[13px] leading-[19px] text-sub">{sub}</div>}
      </div>
      {right && <div className="shrink-0 text-right text-[13px] leading-6 text-sub">{right}</div>}
      <ChevronRight />
    </>
  );
  const cls = 'flex min-h-16 items-center gap-3 border-b border-line py-2 text-left text-navy w-full';
  return to ? <Link to={to} className={cls}>{inner}</Link> : <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}

/* 정보 묶음 카드: 회색 배경 + 이름/값 줄 */
export function InfoCard({ rows, size = 'md', className }: WithClass & { rows: [label: string, value: ReactNode][]; size?: 'sm' | 'md' }) {
  const text = size === 'sm' ? 'text-[14px] leading-[21px]' : 'text-[15px] leading-[22px]';
  return (
    <div className={cx('flex flex-col rounded-2xl bg-panel', size === 'sm' ? 'gap-2.5 p-4' : 'gap-4 p-5', className)}>
      {rows.map(([label, value]) => <KV key={label} label={label} value={value} className={text} />)}
    </div>
  );
}

export const KV = ({ label, value, className = 'text-[15px] leading-[22px]' }: WithClass & { label: ReactNode; value: ReactNode }) => (
  <div className={cx('flex justify-between gap-4', className)}>
    <span className="shrink-0 text-sub">{label}</span>
    <span className="min-w-0 text-right font-semibold">{value}</span>
  </div>
);

export type Option<T extends Key> = { value: T; label: ReactNode; to?: string };

/* 칩: 선택하면 남색 */
export function Chips<T extends Key>({ options, value, onChange, size = 'md', className }: WithClass & { options: Option<T>[]; value: T; onChange: (v: T) => void; size?: 'md' | 'lg' }) {
  return (
    <div className={cx('-my-1 flex gap-1.5 overflow-x-auto py-1 [scrollbar-width:none]', size === 'lg' && 'gap-2', className)} role="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            className={cx(
              'cc-hit flex shrink-0 items-center whitespace-nowrap rounded-xl text-[15px]',
              size === 'lg' ? 'h-10 px-4' : 'h-9 px-3',
              on ? 'bg-navy font-semibold text-white' : 'bg-chip font-medium text-navy hover:bg-[#e6ebf0]',
            )}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* 탭 (쉬운 설명 | 원문 기록). option.to가 있으면 주소로 이동.
   흰 바탕이 고른 칸으로 미끄러져 감 (layoutId). 움직임 줄이기는 App의 MotionConfig가 처리 */
export function Segmented<T extends Key>({ options, value, onChange, size = 'md', className }: WithClass & { options: Option<T>[]; value: T; onChange?: (v: T) => void; size?: 'sm' | 'md' }) {
  const pill = useId();
  return (
    <div className={cx('flex shrink-0 gap-1 rounded-xl bg-field p-1', size === 'sm' ? 'h-11' : 'h-12', className)} role="tablist">
      {options.map((o) => {
        const on = o.value === value;
        const cls = cx(
          'relative flex flex-1 items-center justify-center transition-colors',
          size === 'sm' ? 'text-[14px]' : 'text-[15px]',
          on ? 'font-semibold text-navy' : 'font-medium text-sub hover:text-navy',
        );
        const label = (
          <>
            {on && <motion.span layoutId={pill} className="absolute inset-0 rounded-lg bg-white shadow-[0_1px_3px_rgba(24,59,91,0.12)]"
              transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
            <span className="relative">{o.label}</span>
          </>
        );
        return o.to && !on
          ? <Link key={o.value} to={o.to} replace className={cls} role="tab" aria-selected={on}>{label}</Link>
          : <button key={o.value} type="button" className={cls} role="tab" aria-selected={on} onClick={() => onChange?.(o.value)}>{label}</button>;
      })}
    </div>
  );
}

/* 하단 탭 바 */
const TABS = [
  { name: 'home', label: '홈', to: '/app/home' },
  { name: 'hospital', label: '병원 찾기', to: '/app/clinics' },
  { name: 'share', label: '공유', to: '/app/share' },
] as const;
export function TabBar({ active }: { active: (typeof TABS)[number]['name'] }) {
  return (
    <nav className="sticky bottom-0 z-10 flex h-[68px] shrink-0 border-t border-line-bar bg-white pb-2.5">
      {TABS.map((t) => (
        <Link key={t.name} to={t.to} state={{ transition: 'fade' }} className="flex flex-1 flex-col items-center justify-center gap-1" aria-current={t.name === active ? 'page' : undefined}>
          <TabIcon name={t.name} active={t.name === active} />
          <span className={cx('text-[13px]', t.name === active ? 'font-semibold text-primary' : 'font-medium text-sub')}>{t.label}</span>
        </Link>
      ))}
    </nav>
  );
}

/* 토스트: 화면 위쪽, 3초 (버튼이 있으면 5초) */
const TOAST_TONE = {
  warn: { box: 'bg-warn', title: 'text-warn-text', body: 'text-warn-text', Icon: Warn },
  danger: { box: 'bg-danger', title: 'text-danger-text', body: 'text-danger-text', Icon: ErrorIcon },
  info: { box: 'bg-white', title: 'text-navy', body: 'text-sub', Icon: Info },
};
export type Toast = {
  tone?: keyof typeof TOAST_TONE;
  title: ReactNode;
  body?: ReactNode;
  action?: { label: ReactNode; onClick: () => void };
};
const ToastCtx = createContext<(t: Toast) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: Children) {
  const [toast, setToast] = useState<(Toast & { tone: keyof typeof TOAST_TONE; key: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((t: Toast) => {
    clearTimeout(timer.current);
    setToast({ tone: 'info', ...t, key: Date.now() });
    timer.current = setTimeout(() => setToast(null), t.action ? 5000 : 3000);
  }, []);
  const tone = toast && TOAST_TONE[toast.tone];
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4" role="status" aria-live="polite">
        <AnimatePresence mode="wait">
          {toast && tone && (
          <motion.div key={toast.key} initial={{ opacity: 0, y: -12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            className={cx('pointer-events-auto flex w-full max-w-[360px] items-start gap-2.5 rounded-[14px] border border-[rgba(15,30,45,0.06)] px-4 py-3 shadow-[0_8px_24px_rgba(15,30,45,0.18)]', tone.box)}>
            <span className="flex h-[22px] items-center"><tone.Icon /></span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className={cx('text-[15px] font-semibold leading-[22px]', tone.title)}>{toast.title}</div>
              {toast.body && <div className={cx('text-[14px] leading-[21px]', tone.body)}>{toast.body}</div>}
            </div>
            {toast.action && (
              <button type="button" className="pl-2 text-[15px] font-semibold leading-[22px] text-primary" onClick={() => { setToast(null); toast.action?.onClick(); }}>
                {toast.action.label}
              </button>
            )}
          </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

/* 환자 앱 틀: 360px 기준, 넓은 화면에서는 가운데 정렬 */
// 안의 콘텐츠는 위에서부터 차례로 떠오르며 나타남 (lib/reveal.js)
export function MobileShell({ children, className }: Children & WithClass) {
  const ref = useRef<HTMLDivElement>(null);
  useReveal(ref);
  return (
    <div className="min-h-dvh bg-[#e9edf2]">
      <div ref={ref} className={cx('relative mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-white', className)}>{children}</div>
    </div>
  );
}

/* 환자 앱 머리: 뒤로 가기(브라우저 기록) + 제목, 또는 제목 + 닫기 */
// back: true(이전 화면) | 주소(기록이 없을 때 갈 곳) | 함수(화면 안 단계 되돌리기). close면 ✕ 모양
export function PageHeader({ title, back, close, right, size = 'md' }: { title?: ReactNode; back?: true | string | (() => void); close?: boolean; right?: ReactNode; size?: 'md' | 'lg' }) {
  const navigate = useNavigate();
  const goBack = typeof back === 'function' ? back : () => (window.history.length > 1 ? navigate(-1) : navigate(typeof back === 'string' ? back : '/app/home'));
  // 뒤로 가기(<, ✕)가 있으면: 첫 줄에 버튼, 한 칸 띄우고 아래 줄에 큰 제목
  if (back) {
    return (
      <header className="shrink-0 px-5 pb-1">
        <div className="flex h-[60px] items-center justify-between">
          <button type="button" aria-label={close ? '닫기' : '뒤로 가기'} className="-m-2 rounded-full p-2 transition-colors hover:bg-field" onClick={goBack}>
            {close ? <Close size={28} width={2.2} /> : <ArrowBack />}
          </button>
          {right}
        </div>
        <h1 className={TITLE}>{title}</h1>
      </header>
    );
  }
  return (
    <header className="flex h-[52px] shrink-0 items-center gap-1.5 pl-5 pr-4">
      <h1 className={cx('flex-1 font-semibold', size === 'lg' ? 'text-[20px]' : 'text-[17px]')}>{title}</h1>
      {right}
    </header>
  );
}
// 뒤로 가기(←) 아래로 넉넉히 띄워 놓는 큰 제목
const TITLE = 'mt-4 text-[32px] font-semibold leading-[42px] tracking-[-0.4px]';

export const CloseButton = ({ onClick, label = '닫기' }: { onClick?: () => void; label?: string }) => (
  <button type="button" aria-label={label} onClick={onClick} className="-m-2 p-2"><Close /></button>
);

/* 단계가 있는 머리 (회원가입 1/3, 증상 기록 2/5): 제목 + 단계 + 진행 막대 */
export function StepHeader({ title, step, total, onBack }: { title: ReactNode; step: number; total: number; onBack: () => void }) {
  return (
    <div className="shrink-0">
      <header className="px-5 pb-3">
        <div className="flex h-[60px] items-center justify-between">
          <button type="button" aria-label="뒤로 가기" className="-m-2 rounded-full p-2 transition-colors hover:bg-field" onClick={onBack}><ArrowBack /></button>
          <span className="text-[14px] font-semibold text-sub" aria-label={`${total}단계 중 ${step}단계`}>{step} / {total}</span>
        </div>
        <h1 className={TITLE}>{title}</h1>
      </header>
      <div className="mx-5 h-1 rounded-sm bg-line">
        <motion.div className="h-1 rounded-sm bg-primary" initial={false} animate={{ width: `${(step / total) * 100}%` }} transition={{ type: 'spring', stiffness: 260, damping: 30 }} />
      </div>
    </div>
  );
}

/* 화면 아래 고정 버튼 줄 */
export const BottomBar = ({ children, className }: Children & WithClass) => (
  <div className={cx('sticky bottom-0 z-10 flex gap-2.5 bg-white px-5 pb-7 pt-3', className)}>{children}</div>
);

// Esc로 닫기 (시트, 대화상자)
function useEscape(open: boolean | undefined, onClose: (() => void) | undefined) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
}

// 포커스 가두기 (시트, 대화상자). 열릴 때: 안으로 포커스를 옮김. Tab은 안에서만 돌아감. 닫힐 때: 연 요소로 되돌림.
// 겹쳐 열린 경우(시트 위 로그인 만료 대화상자 등): 맨 위 것만 Tab을 잡음.
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
const traps: RefObject<HTMLElement | null>[] = [];
function useFocusTrap(open: boolean | undefined, ref: RefObject<HTMLElement | null>) {
  // 연 요소는 그릴 때 기억함. 안쪽 autoFocus(textarea, 코드 칸)가 effect보다 먼저 포커스를 가져가기 때문
  const wasOpen = useRef(false);
  const opener = useRef<Element | null>(null);
  if (open && !wasOpen.current && typeof document !== 'undefined') opener.current = document.activeElement;
  wasOpen.current = !!open;

  useEffect(() => {
    const panel = ref.current;
    if (!open || !panel) return;
    const active = document.activeElement;
    const back = opener.current && !panel.contains(opener.current) ? opener.current : active && !panel.contains(active) ? active : null;
    opener.current = null;
    traps.push(ref);
    const items = () => [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!panel.contains(document.activeElement)) (items()[0] ?? panel).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || traps[traps.length - 1] !== ref) return;
      const list = items();
      const cur = document.activeElement;
      const outside = !cur || cur === panel || !panel.contains(cur);
      if (!list.length) { e.preventDefault(); panel.focus(); return; }
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey ? outside || cur === first : outside || cur === last) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const i = traps.lastIndexOf(ref);
      if (i >= 0) traps.splice(i, 1);
      if (back instanceof HTMLElement && back !== document.body && back.isConnected) back.focus();
    };
  }, [open, ref]);
}

/* 아래에서 올라오는 시트 (02 기록 필터, 10-a 날짜 고르기, 20-a 지역 선택, 07-a 물어볼 것 추가) */
export function Sheet({ open, title, onClose, children }: Children & { open: boolean; title: string; onClose?: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useEscape(open, onClose);
  useFocusTrap(open, panel);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-30 flex flex-col justify-end bg-[rgba(15,30,45,0.5)]" onClick={onClose}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          <motion.div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className="mx-auto outline-none flex max-h-[92dvh] w-full max-w-[480px] flex-col gap-4 overflow-y-auto rounded-t-3xl bg-white px-5 pb-7 pt-2.5 shadow-[0_-8px_24px_rgba(15,30,45,0.18)]">
            <div className="h-1 w-10 shrink-0 self-center rounded-sm bg-[#d5dde5]" />
            <div className="flex items-center"><h2 className="flex-1 text-[20px] font-semibold">{title}</h2><CloseButton onClick={onClose} /></div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* 확인 대화상자: 제목 + 설명 + [취소][확인] */
export function Confirm({ open, title, body, cancel = '취소', ok, danger, loading, onCancel, onOk }: {
  open: boolean; title: string; body?: ReactNode; cancel?: ReactNode; ok: ReactNode;
  danger?: boolean; loading?: boolean; onCancel: () => void; onOk: () => void;
}) {
  return (
    <Dialog open={open} title={title} onClose={onCancel}>
      {body && <p className="text-[15px] leading-[23px] text-sub">{body}</p>}
      <div className="mt-1 flex gap-2.5">
        <Button size="pc" variant="secondary" className="flex-1" onClick={onCancel}>{cancel}</Button>
        <Button size="pc" variant={danger ? 'danger' : 'primary'} className="flex-1" loading={loading} onClick={onOk}>{ok}</Button>
      </div>
    </Dialog>
  );
}

/* 고르는 카드 (09 증상 종류, 11 어느 쪽): 고르면 파란 테두리 + 체크 */
export function OptionCard({ on, onClick, children, chevron, className }: Children & WithClass & { on?: boolean; onClick: () => void; chevron?: boolean }) {
  return (
    <button type="button" role={chevron ? undefined : 'radio'} aria-checked={chevron ? undefined : on} onClick={onClick}
      className={cx('flex min-h-14 items-center gap-3 rounded-[14px] px-4 text-left text-[16px] transition-colors',
        on ? 'bg-primary-soft font-semibold shadow-[inset_0_0_0_1.5px_#2479c8]' : 'bg-field font-medium hover:bg-[#eaeef3]', chevron && 'text-sub', className)}>
      <span className="flex-1">{children}</span>
      {on && <CheckCircle on />}
      {chevron && <ChevronRight />}
    </button>
  );
}

/* 체크 줄 (23 공유할 기록, 07 진료 준비) */
export const CheckRow = ({ on, onToggle, compact, children }: Children & { on: boolean; onToggle: () => void; compact?: boolean }) => (
  <button type="button" role="checkbox" aria-checked={on} onClick={onToggle}
    className={cx('flex items-center text-left', compact ? 'gap-2.5' : 'min-h-[52px] gap-3 py-1')}>
    <CheckCircle on={on} />
    {children}
  </button>
);

/* 현재 CareCompass Cognito 정책: 12자 이상, 대문자·소문자·숫자. 특수문자는 선택. */
export const PASSWORD_RULE = '12자 이상, 대문자·소문자·숫자를 섞어 주세요 (특수문자는 선택)';
export const passwordOk = (p: string) => p.length >= 12 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p);

// 입력칸 아래 확인 글자: 맞으면 연두 체크, 틀리면 빨강, 아직 안 썼으면 회색
export function Hint({ ok, children }: Children & { ok?: boolean }) {
  const tone = ok === true ? 'text-done-text' : ok === false ? 'text-danger-text' : 'text-sub';
  return (
    <p className={cx('-mt-1 flex items-center gap-1 text-[13px] leading-[19px]', tone)}>
      {ok === true && <Check size={16} />}{ok === false && <ErrorIcon size={15} color="#9e2f2f" />}{children}
    </p>
  );
}

/* 새 비밀번호 + 확인 (A4, A6 3/3, 31, P1-a) */
export type PasswordPair = { password: string; confirm: string };
export function NewPasswordFields({ value, onChange, labels = ['비밀번호', '비밀번호 확인'] }: { value: PasswordPair; onChange: (v: PasswordPair) => void; labels?: [string, string] }) {
  const { password, confirm } = value;
  return (
    <>
      <Field label={labels[0]} type="password" autoComplete="new-password" value={password} onChange={(e) => onChange({ ...value, password: e.target.value })} />
      <Hint ok={password ? passwordOk(password) : undefined}>{PASSWORD_RULE}</Hint>
      <Field label={labels[1]} type="password" autoComplete="new-password" value={confirm} onChange={(e) => onChange({ ...value, confirm: e.target.value })} />
      {confirm && <Hint ok={confirm === password}>{confirm === password ? '비밀번호가 일치합니다' : '비밀번호가 일치하지 않습니다'}</Hint>}
    </>
  );
}
export const newPasswordOk = ({ password, confirm }: PasswordPair) => passwordOk(password) && password === confirm;

/* 6자리 코드 칸 + 남은 시간 + 다시 받기 (A3, A6 2/3, P12). 코드는 5분 동안 쓸 수 있음. */
const CODE_SECONDS = 300;
export function CodeInput({ value, onChange, onResend, size = 'md' }: { value: string; onChange: (v: string) => void; onResend: () => Promise<boolean>; size?: 'md' | 'pc' }) {
  const [left, setLeft] = useState(CODE_SECONDS);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  // onResend: 새 코드를 보냈으면 true, 실패했으면 false (실패 안내는 호출한 쪽이 함). 성공한 경우에만 처음으로 되돌림.
  const resend = async () => {
    let ok = false;
    try { ok = await onResend(); } catch { ok = false; }
    if (!ok) return;
    setLeft(CODE_SECONDS); onChange(''); ref.current?.focus();
  };
  const box = size === 'pc' ? 'h-[60px] text-[24px]' : 'h-14 text-[24px]';
  return (
    <div className="flex flex-col gap-3">
      <label className="relative flex gap-2">
        <span className="sr-only">6자리 코드</span>
        <input ref={ref} autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="absolute inset-0 z-10 opacity-0" aria-describedby="code-left" />
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className={cx('flex flex-1 items-center justify-center rounded-xl bg-field font-semibold', box,
            i === value.length && 'bg-white shadow-[inset_0_0_0_1.5px_#2479c8]')}>{value[i] ?? ''}</span>
        ))}
      </label>
      <div className="flex items-center gap-1.5 text-[14px]">
        <Clock size={16} />
        <span id="code-left" className="text-sub">남은 시간</span>
        <b className={left === 0 ? 'text-danger-text' : ''}>{left === 0 ? '입력 시간이 지났습니다' : mss(left)}</b>
        <span className="flex-1" />
        <TextButton className="!text-[14px]" onClick={resend}>코드 다시 받기</TextButton>
      </div>
    </div>
  );
}

/* 입력칸 */
export function Field({ label, className, ...input }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[14px] font-semibold text-sub">{label}</span>
      <input
        className={cx('h-[52px] rounded-xl bg-field px-4 text-[16px] text-navy outline-none placeholder:text-muted focus:bg-white focus:shadow-[inset_0_0_0_1.5px_#2479c8]', className)}
        {...input}
      />
    </label>
  );
}

/* 확인 대화상자 */
export function Dialog({ open, title, children, onClose, wide }: Children & { open: boolean; title: string; onClose?: () => void; wide?: boolean }) {
  const panel = useRef<HTMLDivElement>(null);
  useEscape(open, onClose);
  useFocusTrap(open, panel);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(15,30,45,0.5)] p-5" onClick={onClose}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          <motion.div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.94, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className={cx('flex w-full outline-none flex-col gap-4 rounded-[20px] bg-white p-7 shadow-[0_12px_32px_rgba(15,30,45,0.25)]', wide ? 'max-w-[460px]' : 'max-w-[340px] p-6')}>
            <h2 className="text-[20px] font-semibold leading-[30px]">{title}</h2>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* 알림 상자: 로그인 오류(A7) 등 */
export const AlertBox = ({ tone = 'danger', title, children }: Children & { tone?: 'danger' | 'done'; title?: ReactNode }) => (
  <div className={cx('flex flex-col gap-0.5 rounded-[14px] px-4 py-3', tone === 'done' ? 'bg-done text-done-text' : 'bg-danger text-danger-text')} role={tone === 'danger' ? 'alert' : 'status'}>
    {title && <div className="text-[15px] font-semibold">{title}</div>}
    {children && <div className="text-[14px]">{children}</div>}
  </div>
);

/* 빈 화면 / 실패 화면: 3D 아이콘 + 제목 + 설명 + 버튼 */
// icon: public/assets/ 아래 3D 아이콘 이름 (document, calendar, qr …)
export function StateView({ icon, title, body, action, className }: WithClass & { icon?: string; title: ReactNode; body?: ReactNode; action?: ReactNode }) {
  return (
    <div data-reveal className={cx('flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center', className)}>
      {icon && <Img name={icon} three size={72} />}
      <div className="mt-1 text-[20px] font-semibold leading-7">{title}</div>
      {body && <div className="text-[15px] leading-[23px] text-sub">{body}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export const ErrorView = ({ error, onRetry, icon = 'document', title = '불러오지 못했습니다' }: { error?: { message?: string } | null; onRetry?: () => void; icon?: string; title?: ReactNode }) => (
  <StateView icon={icon} title={title} body={error?.message ?? '인터넷 연결을 확인하고 다시 시도해 주세요.'}
    action={onRetry && <Button size="md" className="px-8" onClick={onRetry}>다시 시도</Button>} />
);

/* 불러오는 중: 반짝이는 회색 줄 */
// 반짝임은 CSS(.cc-skel). 빨리 끝나는 로딩에서 깜빡이지 않게 0.15초 뒤에 나타남
export const Skeleton = ({ className, style }: WithClass & { style?: CSSProperties }) => (
  <motion.div className={cx('cc-skel rounded-lg', className)} style={style} aria-hidden="true"
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, duration: 0.2 }} />
);
// ListRow 모양 그대로: 제목 + 보조 줄 + 오른쪽 날짜
export const SkeletonRows = ({ rows = 3, right = true }: { rows?: number; right?: boolean }) => (
  <div className="flex flex-col" aria-label="불러오는 중" role="status">
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="flex min-h-16 items-center gap-3 border-b border-line py-2">
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-[18px]" style={{ width: `${70 - (i % 3) * 12}%` }} />
          <Skeleton className="h-[14px] w-1/3" />
        </div>
        {right && <Skeleton className="h-[14px] w-12" />}
      </div>
    ))}
  </div>
);

/* 움직임 (framer-motion). 줄이기 설정은 App의 MotionConfig와 lib/reveal.js가 처리 */

// 불러온 내용이 스켈레톤 자리에 부드럽게 나타남
// 묶음 표시만 함. 안의 블록들은 MobileShell/PcPage의 reveal로 차례로 떠오름
export const FadeIn = ({ className, children }: Children & WithClass) => <div data-reveal className={className}>{children}</div>;

/* 목록이 길 때: 처음 size개만 보여 주고 "더 보기"로 늘림 (기록·공유 내역이 수백 건이어도 한 번에 그리지 않음) */
export function usePaged<T>(list: T[], size = 10): [T[], ReactNode] {
  const [n, setN] = useState(size);
  const more = list.length > n
    ? <button type="button" onClick={() => setN(n + size)} className="flex h-10 items-center justify-center gap-1 text-[15px] font-semibold text-primary">더 보기<ChevronDown /></button>
    : null;
  return [list.slice(0, n), more];
}

// 목록: 줄이 위에서부터 차례로 나타남. 화면이 나올 때 한 번만: 나중에 끼어든 줄(더 보기, 필터, 갱신)은 그 자리에 바로 보임
const StaggerShown = createContext<RefObject<boolean> | null>(null);
const STAGGER: Variants = { show: { transition: { staggerChildren: REVEAL.step } } };
const ITEM: Variants = { hidden: { opacity: 0, y: REVEAL.distance }, show: { opacity: 1, y: 0, transition: { duration: REVEAL.duration, ease: REVEAL.ease as [number, number, number, number] } } };
export const Stagger = ({ className, children }: Children & WithClass) => {
  const shown = useRef(false);
  useEffect(() => { shown.current = true; }, []);
  return (
    <StaggerShown.Provider value={shown}>
      <motion.div data-no-reveal className={className} variants={STAGGER} initial="hidden" animate="show">{children}</motion.div>
    </StaggerShown.Provider>
  );
};
export const StaggerItem = ({ className, children }: Children & WithClass) => {
  const shown = useContext(StaggerShown);
  const [late] = useState(() => !!shown?.current); // 목록이 처음 나온 뒤에 생긴 줄
  return <motion.div className={className} variants={ITEM} initial={late ? false : undefined}>{children}</motion.div>;
};
