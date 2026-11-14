// 의료진 PC 공통: 위쪽 바 + 공유받은 기록/쓰던 진료 기록을 메모리에 들고 있는 상태.
// 공유받은 기록은 한 번만 열 수 있음. 새로고침한 경우: 사라지고 P8로 감.
import { createContext, useContext, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, Outlet, useNavigate, useNavigationType } from 'react-router-dom';
import { getClinicianMe, logout as signOut, redeemShareGrant } from '../../api';
import { Confirm } from '../../components/ui';
import useAsync from '../../lib/useAsync.js';
import { useReveal } from '../../lib/reveal.js';

const Ctx = createContext(null);
export const useClinician = () => useContext(Ctx);

export default function ClinicianLayout() {
  const me = useAsync(getClinicianMe);
  const [shared, setShared] = useState(null); // POST /share-grants/redeem 결과
  const [draft, setDraft] = useState(null); // P4에서 쓰던 진료 기록
  const [saved, setSaved] = useState(null); // P6에 보여줄 저장 결과
  return (
    <Ctx.Provider value={{ me: me.data, shared, setShared, draft, setDraft, saved, setSaved }}>
      <div className="min-w-[1024px]"><Outlet /></div>
    </Ctx.Provider>
  );
}

// QR이나 공유 코드로 기록 열기 (열람 1회를 씀)
export function useOpenShared() {
  const { setShared, setDraft } = useClinician();
  const navigate = useNavigate();
  return async (code) => {
    const res = await redeemShareGrant(code);
    setShared(res);
    setDraft(null);
    navigate('/clinician/records');
  };
}

// 위쪽 바. 로그아웃은 P11 확인을 거침 (열어 둔 환자 기록도 같이 닫힘)
export function TopBar({ minimal }) {
  const { me, setShared, setDraft } = useClinician();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const logout = async () => { setBusy(true); await signOut().catch(() => {}); setShared(null); setDraft(null); navigate('/clinician/login', { replace: true }); };
  return (
    <>
    <Confirm open={confirm} title="로그아웃하시겠습니까?" body="열어 둔 환자 기록 화면도 함께 닫힙니다." ok="로그아웃" loading={busy} onCancel={() => setConfirm(false)} onOk={logout} />
    <header className="flex h-[60px] shrink-0 items-center gap-2.5 border-b border-line-bar bg-white px-7">
      <Link to="/clinician/patients" className="flex items-center gap-2.5">
        <img src="/assets/cc-icon.png" alt="" width="28" height="28" />
        <span className="text-[17px] font-semibold">CareCompass</span>
      </Link>
      {!minimal && (
        <>
          <span className="text-[13px] font-semibold text-sub">의료진</span>
          <span className="flex-1" />
          <span className="text-[14px] font-semibold">{me ? `${me.name}님` : ''}</span>
          <span className="mx-1.5 h-4 w-px bg-[#dfe5eb]" />
          <button type="button" onClick={() => setConfirm(true)} className="text-[14px] font-medium text-sub hover:text-navy">로그아웃</button>
        </>
      )}
    </header>
    </>
  );
}

// 의료진 로그인 계열 화면의 가운데 카드 (P1, P1-a, 비밀번호 찾기, 로그인 만료)
export function AuthCard({ onSubmit, children }) {
  const Tag = onSubmit ? 'form' : 'div';
  const ref = useRef(null);
  useReveal(ref);
  return (
    <div className="flex min-h-dvh items-center justify-center bg-page p-6">
      <Tag ref={ref} onSubmit={onSubmit} className="flex w-[420px] flex-col gap-5 rounded-[20px] bg-white p-10 shadow-[0_8px_28px_rgba(24,59,91,0.08)]">
        <div className="flex items-center gap-2.5">
          <img src="/assets/cc-icon.png" alt="" width="36" height="36" />
          <span className="text-[17px] font-semibold">CareCompass</span>
        </div>
        {children}
      </Tag>
    </div>
  );
}

// 의료진 화면끼리 넘어갈 때: 위쪽 바는 그대로 두고 아래 내용만 옆으로 미끄러져 들어옴 (앞으로 → 오른쪽에서, 뒤로 → 왼쪽에서).
// 안의 콘텐츠는 위에서부터 차례로 떠오르며 나타남 (lib/reveal.js)
export function PcPage({ children, minimal }) {
  const ref = useRef(null);
  useReveal(ref);
  const from = useNavigationType() === 'POP' ? -48 : 48;
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip bg-page">
      <TopBar minimal={minimal} />
      <motion.div ref={ref} className="flex flex-1 flex-col" initial={{ x: from, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
        transition={{ x: { duration: 0.5, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.3 } }}>
        {children}
      </motion.div>
    </div>
  );
}
