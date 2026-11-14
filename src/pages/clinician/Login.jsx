// P1 의료진 로그인 (83:2). 첫 로그인은 P1-a, 환자 계정은 P1-b 역할 오류.
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { getSession, login, logout } from '../../api';
import { AlertBox, Button, Field } from '../../components/ui';
import { safeNext } from '../../lib/redirect.js';
import useAsync from '../../lib/useAsync.js';
import { AuthCard } from './Layout.jsx';

const ERRORS = {
  NETWORK: (e) => ['로그인하지 못했습니다', e.message],
  ROLE: () => ['의료진 계정이 아닙니다', '환자는 CareCompass 앱을 이용해 주세요.'], // P1-b
  NotAuthorizedException: () => ['이메일 또는 비밀번호가 맞지 않습니다', '다시 입력하거나 비밀번호를 찾아 주세요.'],
};
const errorText = (e) => (ERRORS[e.code] ?? ((x) => ['로그인하지 못했습니다', x.message]))(e);

export default function ClinicianLogin() {
  const navigate = useNavigate();
  const { state: from } = useLocation();
  const [form, setForm] = useState({ email: from?.email ?? '', password: '' });
  const [state, setState] = useState({ loading: false, error: null });
  // 로그인 뒤 갈 곳: 가려던 화면(?next=)이 의료진 화면 주소면 그곳, 아니면 QR 확인
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'), 'clinician');
  const home = next ?? '/clinician/scan';
  const session = useAsync(getSession);

  const submit = async (e) => {
    e.preventDefault();
    setState({ loading: true, error: null });
    try {
      const res = await login(form);
      if (res.step === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') return navigate('/clinician/new-password', { state: { email: form.email, next } });
      if (res.step !== 'DONE' || res.role !== 'clinician') { await logout(); throw { code: 'ROLE' }; }
      navigate(home, { replace: true });
    } catch (error) {
      setState({ loading: false, error });
    }
  };

  // 이미 의료진으로 로그인한 경우: 폼 없이 바로 보냄. 확인하는 동안에는 폼을 그대로 보여 줌.
  if (session.data?.role === 'clinician') return <Navigate to={home} replace />;
  const [title, body] = state.error ? errorText(state.error) : [];
  return (
    <AuthCard onSubmit={submit}>
      <h1 className="text-[28px] font-semibold leading-9">의료진 로그인</h1>
      {from?.notice && !state.error && <AlertBox tone="done" title={from.notice} />}
      <Field label="이메일" type="email" autoComplete="username" placeholder="이메일 주소" value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <Field label="비밀번호" type="password" autoComplete="current-password" placeholder="비밀번호" value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })} />
      {state.error && <AlertBox title={title}>{body}</AlertBox>}
      <Button type="submit" size="md" className="mt-1.5" loading={state.loading}>{state.loading ? '로그인 중' : '로그인'}</Button>
      <Link to="/clinician/forgot" state={{ email: form.email }} className="-mt-1 self-center text-[14px] font-semibold text-primary">비밀번호를 잊으셨습니까?</Link>
    </AuthCard>
  );
}
