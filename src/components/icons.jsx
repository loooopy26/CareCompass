import { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';

const RiveIcon = lazy(() => import('./RiveIcon.jsx'));
// shortcut: .riv가 있는 아이콘 이름을 손으로 적음(없는 파일마다 404가 나지 않게). public/assets/rive/<name>.riv를 넣으면 여기에 이름 추가
const RIVE_ICONS = new Set([]);

// 평면 선 아이콘. 경로는 v2 시안(src/screens.html)과 같음.
const line = (d, { size = 24, color = 'currentColor', width = 2, ...rest } = {}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0" {...rest}>
    {d}
  </svg>
);

export const ChevronRight = (p) => line(<path d="M9 6l6 6-6 6" />, { size: 20, color: '#9aa7b4', ...p });
export const ChevronDown = (p) => line(<path d="M6 9l6 6 6-6" />, { size: 18, color: '#2479c8', width: 2.2, ...p });
export const Back = (p) => line(<path d="M15 5l-7 7 7 7" />, { color: '#183b5b', ...p });
// 화면 머리의 뒤로 가기: 막대가 있는 화살표 ←
export const ArrowBack = (p) => line(<path d="M20 12H4.5M11 5l-7 7 7 7" />, { size: 28, color: '#183b5b', width: 2.2, ...p });
export const Close = (p) => line(<path d="M6 6l12 12M18 6L6 18" />, { color: '#183b5b', ...p });
export const Check = (p) => line(<path d="M5 12.5l4.5 4.5L19 7.5" />, { color: '#3f9e2f', width: 2.4, ...p });
export const Plus = (p) => line(<path d="M12 5v14M5 12h14" />, { size: 18, color: '#ffffff', width: 2.2, ...p });
export const Search = (p) => line(<><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></>, { size: 18, color: '#627080', ...p });
export const Clock = (p) => line(<><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></>, { size: 18, color: '#52667a', ...p });
export const Pin = (p) => line(<><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.4" /></>, { size: 20, color: '#52667a', width: 1.8, ...p });
export const Filter = (p) => line(<><path d="M4 7h9M19 7h1M4 17h3M13 17h7" /><circle cx="16" cy="7" r="2.5" /><circle cx="10" cy="17" r="2.5" /></>, { size: 22, color: '#183b5b', ...p });
export const Warn = (p) => line(<><path d="M12 3.5l9.5 16.5h-19Z" /><path d="M12 10v4.5 M12 17.3v.2" /></>, { size: 20, color: '#5a4610', ...p });
export const ErrorIcon = (p) => line(<><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5 M12 16.5v.5" /></>, { size: 20, color: '#9e2f2f', ...p });
export const Info = (p) => line(<><circle cx="12" cy="12" r="9" /><path d="M12 11v5 M12 7.5v.5" /></>, { size: 20, color: '#52667a', ...p });

// 처리 중 표시: 톡 튀어나온 뒤 돌면서, 호가 늘었다 줄었다 숨 쉬듯 움직임
export const Spinner = ({ size = 20, color = '#ffffff', track = 'rgba(255,255,255,0.35)' }) => (
  <motion.svg className="shrink-0" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"
    initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1, rotate: 360 }}
    transition={{ scale: { type: 'spring', stiffness: 420, damping: 18 }, opacity: { duration: 0.15 }, rotate: { duration: 0.9, ease: 'linear', repeat: Infinity } }}>
    <circle cx="12" cy="12" r="9" stroke={track} strokeWidth="3" />
    <motion.circle cx="12" cy="12" r="9" stroke={color} strokeWidth="3" strokeLinecap="round"
      initial={{ pathLength: 0.15, pathOffset: 0 }} animate={{ pathLength: [0.15, 0.62, 0.15], pathOffset: [0, 0.18, 1] }}
      transition={{ duration: 1.4, ease: 'easeInOut', repeat: Infinity }} />
  </motion.svg>
);

export const CheckCircle = ({ on, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
    {on ? (
      <>
        <circle cx="12" cy="12" r="12" fill="#2479c8" />
        <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ) : (
      <circle cx="12" cy="12" r="11" fill="#ffffff" stroke="#b5c2cf" strokeWidth="1.6" />
    )}
  </svg>
);

export const Radio = ({ on, size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
    <circle cx="12" cy="12" r="10.5" fill="#ffffff" stroke={on ? '#2479c8' : '#b5c2cf'} strokeWidth={on ? 2 : 1.6} />
    {on && <circle cx="12" cy="12" r="5.5" fill="#2479c8" />}
  </svg>
);

// 하단 탭 아이콘: 선택되면 파랑 + 연한 파랑 채움
export const TabIcon = ({ name, active }) => {
  const c = active ? '#2479c8' : '#627080';
  const fill = active ? '#e5f1fc' : 'none';
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      {name === 'home' && <path d="M4 10.5L12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1Z" fill={fill} />}
      {name === 'hospital' && <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" fill={fill} /><circle cx="12" cy="10" r="2.4" /></>}
      {name === 'share' && (
        <>
          <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" fill={fill} />
          <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" fill={fill} />
          <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" fill={fill} />
          <path d="M14 14h2.5v2.5H14Z M17.5 17.5H20V20h-2.5Z" fill={c} stroke="none" />
        </>
      )}
    </svg>
  );
};

// 브랜드 아이콘 이미지 (public/assets). 3D는 혼자 크게 놓일 때(64px 이상), 평면은 글자와 함께(44px 이하).
export const Img = ({ name, size = 40, three = false, className = '' }) => {
  if (!three) return <img src={`/assets/icons/${name}.svg`} alt="" width={size} height={size} className={`block shrink-0 ${className}`} />;
  const motionIcon = <MotionIcon name={name} size={size} className={className} />;
  if (!RIVE_ICONS.has(name)) return motionIcon;
  return <Suspense fallback={motionIcon}><RiveIcon name={name} size={size} className={className} fallback={motionIcon} /></Suspense>;
};

const MotionIcon = ({ name, size, className }) => {
  return (
    // 바깥: 처음 나타날 때 튀어 오름. 안쪽: 아이콘마다 다른 반복 움직임
    <motion.span className={`block shrink-0 ${className}`} initial={{ opacity: 0, scale: 0.6, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 18 }}>
      <motion.img src={`/assets/icons-3d/${name}.svg`} alt="" width={size} height={size} className="block"
        style={{ transformOrigin: '50% 85%' }} {...(IDLE[name] ?? IDLE.float)} />
    </motion.span>
  );
};

// 반복 움직임: 등장 스프링이 끝난 뒤 시작
const loop = (animate, duration, repeatDelay = 0) => ({ animate, transition: { duration, repeat: Infinity, repeatDelay, ease: 'easeInOut', delay: 0.5 } });
const IDLE = {
  float: loop({ y: [0, -5, 0], rotate: [0, -2.5, 0] }, 3.4),
  lock: loop({ rotate: [0, -9, 8, -5, 3, 0] }, 0.7, 2.6), // 잠겨서 흔들림
  bell: loop({ rotate: [0, 14, -12, 8, -4, 0] }, 0.8, 2.2), // 종 울림
  heart: loop({ scale: [1, 1.12, 1, 1.08, 1] }, 1, 1.2), // 두근
  qr: loop({ scale: [1, 1.05, 1] }, 1.8),
  search: loop({ x: [0, -4, 4, 0], rotate: [0, -6, 6, 0] }, 2.6, 0.8), // 두리번
  ai: loop({ scale: [1, 1.06, 1], rotate: [0, 4, -4, 0] }, 2.4),
  settings: loop({ rotate: [0, 90] }, 1.2, 1.6),
  profile: loop({ rotate: [0, -4, 4, 0], y: [0, -2, 0] }, 2.8),
  trash: loop({ rotate: [0, -6, 6, 0] }, 0.6, 3),
};
