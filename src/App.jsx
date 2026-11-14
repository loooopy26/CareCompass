import { useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { SESSION_EXPIRED, cachedRole, getSession } from './api';
import useAsync from './lib/useAsync.js';
import { loginPath } from './lib/redirect.js';
import { Button, Dialog, ToastProvider } from './components/ui';
import Login from './pages/app/Login.jsx';
import Signup from './pages/app/Signup.jsx';
import Verify from './pages/app/Verify.jsx';
import Welcome from './pages/app/Welcome.jsx';
import Terms from './pages/app/Terms.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import Home from './pages/app/Home.jsx';
import Schedule from './pages/app/Schedule.jsx';
import Prep from './pages/app/Prep.jsx';
import RecordDetail from './pages/app/RecordDetail.jsx';
import ItemDetail from './pages/app/ItemDetail.jsx';
import SymptomNew from './pages/app/SymptomNew.jsx';
import { SummaryEdit, SymptomEdit, Symptoms } from './pages/app/SymptomEdit.jsx';
import Clinics from './pages/app/Clinics.jsx';
import ClinicDetail from './pages/app/ClinicDetail.jsx';
import Share, { ShareHistory } from './pages/app/Share.jsx';
import ShareSelect from './pages/app/ShareSelect.jsx';
import ShareCreating from './pages/app/ShareCreating.jsx';
import ShareQr from './pages/app/ShareQr.jsx';
import ShareViewed from './pages/app/ShareViewed.jsx';
import Me, { ChangePassword, DeleteAccount, EditProfile, Policies } from './pages/app/Me.jsx';
import ClinicianLayout from './pages/clinician/Layout.jsx';
import ClinicianLogin from './pages/clinician/Login.jsx';
import NewPassword from './pages/clinician/NewPassword.jsx';
import Scan from './pages/clinician/Scan.jsx';
import CodeEntry from './pages/clinician/CodeEntry.jsx';
import Patients from './pages/clinician/Patients.jsx';
import SharedRecords, { SharedRecordsIndex } from './pages/clinician/SharedRecords.jsx';
import Blocked from './pages/clinician/Blocked.jsx';
import VisitWrite from './pages/clinician/VisitWrite.jsx';
import VisitDone from './pages/clinician/VisitDone.jsx';

// 로그인 안 했거나 역할(cognito:groups)이 다른 경우: 그 주소의 로그인 화면으로.
// 화면을 넘길 때마다 다시 확인함. 이미 확인된 역할인 경우: 기다리지 않고 바로 그림 (전환 중 빈 화면 방지)
// 원래 가려던 주소는 ?next=로 넘겨 로그인 뒤 그 화면으로 돌아감.
function RequireRole({ role, children }) {
  const session = useAsync(getSession);
  const { pathname, search } = useLocation();
  if (session.loading) return cachedRole() === role ? children : null;
  if (session.data?.role !== role) return <Navigate to={loginPath(role, pathname + search)} replace />;
  return children;
}

// 화면 전환. 앞으로 갈 때: 오른쪽에서 밀려 들어옴. 뒤로 갈 때: 왼쪽에서 들어옴.
// 바꿔치기(replace, 탭 바)는 미끄러지지 않고 살짝 겹쳐 바뀜.
const EASE = [0.22, 1, 0.36, 1];
const PAGE = {
  enter: (dir) => ({ x: dir === 'fade' ? 0 : dir === 'back' ? '-30%' : '100%', opacity: dir === 'fade' ? 0 : 1 }),
  center: { x: 0, opacity: 1, transition: { x: { duration: 0.5, ease: EASE }, opacity: { duration: 0.3 } } },
  exit: (dir) => ({
    x: dir === 'fade' ? 0 : dir === 'back' ? '100%' : '-30%', opacity: dir === 'fade' ? 0 : dir === 'back' ? 1 : 0.6,
    transition: { x: { duration: 0.5, ease: EASE }, opacity: { duration: dir === 'fade' ? 0.2 : 0.5 } },
  }),
};
// 의료진 화면은 메모리에 공유받은 기록을 들고 있는 레이아웃이 다시 만들어지면 안 되므로 한 묶음으로 둠 (안쪽 전환은 PcPage)
const pageKey = (path) => (/^\/clinician\/(?!login|new-password|forgot)/.test(path) ? 'clinician' : path);

function AnimatedRoutes({ children }) {
  const location = useLocation();
  const type = useNavigationType();
  const dir = type === 'POP' ? 'back' : type === 'REPLACE' || location.state?.transition === 'fade' ? 'fade' : 'forward';
  // 새 화면은 맨 위부터 (뒤로 가기는 브라우저가 위치를 기억하도록 둠)
  useEffect(() => { if (type !== 'POP') window.scrollTo(0, 0); }, [location.pathname, type]);
  // 환자 앱은 가운데 휴대폰 화면(480px) 안에서만 미끄러짐. 바깥 회색 배경은 가만히 있음.
  const mobile = location.pathname.startsWith('/app');
  return (
    <div className={mobile ? 'min-h-dvh bg-[#e9edf2]' : ''}>
      <div className={`relative min-h-dvh overflow-x-clip ${mobile ? 'mx-auto max-w-[480px] bg-white' : ''}`}>
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div key={pageKey(location.pathname)} custom={dir} variants={PAGE} initial="enter" animate="center" exit="exit"
            className={dir === 'back' ? 'z-0' : 'z-10'} style={{ position: 'relative' }}>
            <Routes location={location}>{children}</Routes>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// 공통 로그인 만료 (40:2). API가 401을 준 경우: 지금 화면 위에 띄움
function SessionExpiredDialog() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const pc = useLocation().pathname.startsWith('/clinician');
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener(SESSION_EXPIRED, on);
    return () => window.removeEventListener(SESSION_EXPIRED, on);
  }, []);
  return (
    <Dialog open={open} wide={pc} title="다시 로그인해 주세요">
      <p className="text-[15px] leading-[23px] text-sub">로그인이 만료됐습니다. 기록을 보려면 다시 로그인해 주세요.</p>
      <Button size="pc" className="mt-1" onClick={() => { setOpen(false); navigate(pc ? '/clinician/login' : '/app/login', { replace: true }); }}>로그인</Button>
    </Dialog>
  );
}

export default function App() {
  // 기기의 "움직임 줄이기"(Windows 애니메이션 효과 끔 등)를 켠 경우: 화면 전환·등장의 이동은 빼고 바로 바꿈
  return (
    <MotionConfig reducedMotion="user">
    <BrowserRouter>
      <ToastProvider>
        <SessionExpiredDialog />
        <AnimatedRoutes>
          <Route path="/" element={<Navigate to="/app/home" replace />} />

          <Route path="/app" element={<Navigate to="/app/home" replace />} />
          <Route path="/app/login" element={<Login />} />
          <Route path="/app/signup" element={<Signup />} />
          <Route path="/app/verify" element={<Verify />} />
          <Route path="/app/forgot" element={<ForgotPassword />} />
          <Route path="/app/terms/:id" element={<Terms />} />

          <Route element={<RequireRole role="patient"><Outlet /></RequireRole>}>
            <Route path="/app/welcome" element={<Welcome />} />
            <Route path="/app/home" element={<Home />} />
            <Route path="/app/schedule" element={<Schedule />} />
            <Route path="/app/prep/:followupId" element={<Prep />} />
            <Route path="/app/records/:id" element={<RecordDetail view="easy" />} />
            <Route path="/app/records/:id/original" element={<RecordDetail view="original" />} />
            <Route path="/app/records/:id/:type/:index" element={<ItemDetail />} />
            <Route path="/app/symptoms" element={<Symptoms />} />
            <Route path="/app/symptoms/new" element={<SymptomNew />} />
            <Route path="/app/symptoms/:id/edit" element={<SymptomEdit />} />
            <Route path="/app/symptoms/:id/summary" element={<SummaryEdit />} />
            <Route path="/app/clinics" element={<Clinics />} />
            <Route path="/app/clinics/:id" element={<ClinicDetail />} />
            <Route path="/app/share" element={<Share />} />
            <Route path="/app/share/select" element={<ShareSelect />} />
            <Route path="/app/share/new" element={<ShareCreating />} />
            <Route path="/app/share/:grantId" element={<ShareQr />} />
            <Route path="/app/share/:grantId/viewed" element={<ShareViewed />} />
            <Route path="/app/shares/:grantId" element={<ShareHistory />} />
            <Route path="/app/me" element={<Me />} />
            <Route path="/app/me/profile" element={<EditProfile />} />
            <Route path="/app/me/health" element={<EditProfile health />} />
            <Route path="/app/me/password" element={<ChangePassword />} />
            <Route path="/app/me/terms" element={<Policies />} />
            <Route path="/app/me/delete" element={<DeleteAccount />} />
          </Route>

          <Route path="/clinician/login" element={<ClinicianLogin />} />
          <Route path="/clinician/new-password" element={<NewPassword />} />
          <Route path="/clinician/forgot" element={<ForgotPassword pc />} />
          <Route path="/clinician" element={<RequireRole role="clinician"><ClinicianLayout /></RequireRole>}>
            <Route index element={<Navigate to="patients" replace />} />
            <Route path="patients" element={<Patients />} />
            <Route path="scan" element={<Scan />} />
            <Route path="code" element={<CodeEntry />} />
            <Route path="records" element={<SharedRecordsIndex />} />
            <Route path="records/:recordId" element={<SharedRecords view="original" />} />
            <Route path="records/:recordId/ai" element={<SharedRecords view="ai" />} />
            <Route path="blocked" element={<Blocked />} />
            <Route path="visit/new" element={<VisitWrite />} />
            <Route path="visit/done" element={<VisitDone />} />
          </Route>

          <Route path="*" element={<Navigate to="/app/home" replace />} />
        </AnimatedRoutes>
      </ToastProvider>
    </BrowserRouter>
    </MotionConfig>
  );
}
