// A1 로그인 (1:2) → 로그인 중 (8:2). 오류는 A7, 의료진 계정은 A8 안내, 미인증 계정은 A3로.
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { getSession, login, logout } from '../../api';
import { AlertBox, Button, Dialog, Field, MobileShell } from '../../components/ui';
import { safeNext } from '../../lib/redirect.js';
import useAsync from '../../lib/useAsync.js';

// 오류 코드 → 제목/설명 (A7)
const ERRORS = {
  NETWORK: (e) => ['로그인하지 못했습니다', e.message],
  STEP: () => ['로그인을 마치지 못했습니다', '병원 관리자에게 계정 상태를 문의해 주세요.'],
  NotAuthorizedException: () => ['이메일 또는 비밀번호가 맞지 않습니다', '다시 입력하거나 비밀번호를 찾아 주세요.'],
};
const errorText = (e) => (ERRORS[e.code] ?? ((x) => ['로그인하지 못했습니다', x.message]))(e);

export default function Login() {
  const navigate = useNavigate();
  const { state: from } = useLocation(); // 인증·비밀번호 찾기에서 돌아오면 { email, notice }
  const [form, setForm] = useState({ email: from?.email ?? '', password: '' });
  const [state, setState] = useState({ loading: false, error: null });
  const [roleError, setRoleError] = useState(false);
  // 로그인 뒤 갈 곳: 가려던 화면(?next=)이 앱 안의 주소면 그곳, 아니면 홈
  const [params] = useSearchParams();
  const home = safeNext(params.get('next'), 'patient') ?? '/app/home';
  const session = useAsync(getSession);

  const submit = async (e) => {
    e.preventDefault();
    setState({ loading: true, error: null });
    try {
      const res = await login(form);
      if (res.step === 'CONFIRM_SIGN_UP') return navigate('/app/verify', { state: { email: form.email } });
      if (res.step !== 'DONE') throw { code: 'STEP' };
      if (res.role !== 'patient') { await logout(); setRoleError(true); return setState({ loading: false, error: null }); }
      navigate(home, { replace: true });
    } catch (error) {
      setState({ loading: false, error });
    }
  };

  // 이미 환자로 로그인한 경우: 폼 없이 바로 보냄. 확인하는 동안에는 폼을 그대로 보여 줌.
  if (session.data?.role === 'patient') return <Navigate to={home} replace />;
  const [title, body] = state.error ? errorText(state.error) : [];
  return (
    <MobileShell>
      <form onSubmit={submit} className="flex flex-1 flex-col">
        <div data-reveal className="flex flex-1 flex-col gap-7 px-5 pb-5 pt-9">
          <div className="flex flex-col gap-5">
            <img src="/assets/cc-icon.png" alt="CareCompass" width="56" height="56" />
            <h1 className="text-[28px] font-semibold leading-9">로그인</h1>
          </div>
          <div className="flex flex-col gap-4">
            {from?.notice && !state.error && <AlertBox tone="done" title={from.notice} />}
            <Field label="이메일" type="email" autoComplete="email" placeholder="이메일 주소" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Field label="비밀번호" type="password" autoComplete="current-password" placeholder="비밀번호" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <Link to="/app/forgot" state={{ email: form.email }} className="self-end text-[14px] font-medium text-primary">비밀번호를 잊으셨습니까?</Link>
            {state.error && <AlertBox title={title}>{body}</AlertBox>}
          </div>
        </div>
        <div className="flex flex-col gap-4 px-5 pb-7 pt-3">
          <Button type="submit" loading={state.loading}>{state.loading ? '로그인 중' : '로그인'}</Button>          <p className="mt-1.5 flex justify-center gap-2 text-[15px]">
            <span className="text-sub">처음이십니까?</span>
            <Link to="/app/signup" className="font-semibold text-primary">회원가입</Link>
          </p>
        </div>
      </form>
      <Dialog open={roleError} title="의료진은 PC에서 로그인해 주세요" onClose={() => setRoleError(false)}>
        <p className="text-[15px] leading-[23px] text-sub">의료진 계정은 앱에서 쓸 수 없습니다. PC에서 CareCompass 의료진 화면으로 로그인해 주세요.</p>
        <Button size="pc" className="mt-1" onClick={() => setRoleError(false)}>확인</Button>
      </Dialog>
    </MobileShell>
  );
}
