// P1-a 첫 로그인 비밀번호 바꾸기 (84:2): 관리자가 만든 임시 비밀번호로 로그인했을 때
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { confirmNewPassword, logout } from '../../api';
import { AlertBox, Button, Field, NewPasswordFields, newPasswordOk } from '../../components/ui';
import { safeNext } from '../../lib/redirect.js';
import { AuthCard } from './Layout.jsx';

export default function NewPassword() {
  const navigate = useNavigate();
  const { state: from } = useLocation(); // 로그인 화면에서 { email, next }
  const email = from?.email ?? '';
  const [pw, setPw] = useState({ password: '', confirm: '' });
  const [state, setState] = useState({ loading: false, error: null });

  const submit = async (e) => {
    e.preventDefault();
    setState({ loading: true, error: null });
    try {
      const res = await confirmNewPassword({ newPassword: pw.password });
      if (res.step !== 'DONE' || res.role !== 'clinician') {
        await logout();
        return navigate('/clinician/login', { replace: true, state: { email } });
      }
      navigate(safeNext(from?.next, 'clinician') ?? '/clinician/scan', { replace: true });
    } catch (error) {
      setState({ loading: false, error });
    }
  };

  // 비밀번호 규칙 오류가 아니면 로그인 진행이 끊긴 것(새로고침 등): 처음부터 다시
  const lost = state.error && state.error.code !== 'InvalidPasswordException' && state.error.code !== 'NETWORK';
  return (
    <AuthCard onSubmit={submit}>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[24px] font-semibold leading-[34px]">새 비밀번호를 정해 주세요</h1>
        <p className="text-[15px] leading-[22px] text-sub">관리자가 만든 임시 비밀번호는 이번 한 번만 쓸 수 있습니다.</p>
      </div>
      <Field label="이메일" type="email" value={email} readOnly className="text-sub" />
      <NewPasswordFields value={pw} onChange={setPw} labels={['새 비밀번호', '새 비밀번호 확인']} />
      {state.error && (
        <AlertBox title={lost ? '로그인을 처음부터 다시 해 주세요' : '비밀번호를 바꾸지 못했습니다'}>
          {lost ? <Link to="/clinician/login" replace className="font-semibold underline">로그인으로 가기</Link> : state.error.message}
        </AlertBox>
      )}
      <Button type="submit" size="md" disabled={!newPasswordOk(pw)} loading={state.loading}>저장하고 시작하기</Button>
    </AuthCard>
  );
}
