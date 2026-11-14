// A3 이메일 인증: 인증하지 않은 계정으로 로그인했을 때 (가입 중이면 Signup.jsx 3/3)
import { Navigate, useLocation } from 'react-router-dom';
import { MobileShell, PageHeader } from '../../components/ui';
import { VerifyStep } from './Signup.jsx';

export default function Verify() {
  const email = useLocation().state?.email;
  if (!email) return <Navigate to="/app/login" replace />; // 새로고침으로 이메일을 잃은 경우: 다시 로그인부터
  return (
    <MobileShell>
      <PageHeader title="이메일 인증" back="/app/login" />
      <VerifyStep email={email} />
    </MobileShell>
  );
}
