// 비밀번호 찾기. 환자 A6 1/3 이메일 (10:2) → 2/3 코드 (11:2) → 3/3 새 비밀번호 (12:2).
// 의료진 P12 (86:2)는 한 카드에서 코드와 새 비밀번호를 같이 받음.
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { confirmResetPassword, resetPassword } from '../api';
import { Back } from '../components/icons.jsx';
import { AlertBox, BottomBar, Button, CodeInput, Field, FadeIn, MobileShell, NewPasswordFields, StepHeader, newPasswordOk, useToast } from '../components/ui';
import { AuthCard } from './clinician/Layout.jsx';

export default function ForgotPassword({ pc }) {
  const navigate = useNavigate();
  const toast = useToast();
  const loginPath = pc ? '/clinician/login' : '/app/login';
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ email: useLocation().state?.email ?? '', code: '', pw: { password: '', confirm: '' } });
  const [state, setState] = useState({ loading: false, error: null });

  const run = async (fn) => {
    setState({ loading: true, error: null });
    try { await fn(); setState({ loading: false, error: null }); } catch (error) { setState({ loading: false, error }); }
  };
  const sendCode = (e) => { e.preventDefault(); run(async () => { await resetPassword({ email: form.email.trim() }); setStep(2); }); };
  const resend = () => resetPassword({ email: form.email.trim() }).then(
    () => { toast({ title: pc ? '코드를 다시 보냈습니다' : `${form.email} 주소로 코드를 다시 보냈습니다` }); return true; },
    (error) => { toast({ tone: 'danger', title: '코드를 보내지 못했습니다', body: error.message }); return false; },
  );
  const change = (e) => {
    e.preventDefault();
    run(async () => {
      try {
        await confirmResetPassword({ email: form.email.trim(), code: form.code, newPassword: form.pw.password });
      } catch (error) {
        // 코드가 틀린 경우: 코드 입력 단계로 돌아감
        if (!pc && ['CodeMismatchException', 'ExpiredCodeException'].includes(error.code)) setStep(2);
        throw error;
      }
      navigate(loginPath, { replace: true, state: { email: form.email, notice: '비밀번호를 바꿨습니다. 새 비밀번호로 로그인해 주세요.' } });
    });
  };
  const error = state.error && <AlertBox title="요청을 처리하지 못했습니다">{state.error.message}</AlertBox>;

  if (pc) {
    return (
      <AuthCard onSubmit={step === 1 ? sendCode : change}>
        <Link to={loginPath} className="-mt-1 flex items-center gap-1 self-start text-[14px] font-semibold text-sub hover:text-navy"><Back size={18} color="#52667a" />로그인으로</Link>
        <h1 className="text-[28px] font-semibold leading-9">비밀번호 찾기</h1>
        {step === 1 ? (
          <>
            <p className="text-[15px] leading-[23px] text-sub">가입한 이메일로 6자리 코드를 보내 드립니다.</p>
            <Field label="이메일" type="email" autoComplete="email" placeholder="이메일 주소" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </>
        ) : (
          <>
            <p className="text-[15px] leading-[23px] text-sub">{form.email} 주소로 6자리 코드를 보냈습니다.</p>
            <CodeInput size="pc" value={form.code} onChange={(code) => setForm({ ...form, code })} onResend={resend} />
            <NewPasswordFields value={form.pw} onChange={(pw) => setForm({ ...form, pw })} labels={['새 비밀번호', '새 비밀번호 확인']} />
          </>
        )}
        {error}
        <Button type="submit" size="md" loading={state.loading} disabled={step === 1 ? !form.email : form.code.length < 6 || !newPasswordOk(form.pw)}>
          {step === 1 ? '코드 받기' : '비밀번호 바꾸기'}
        </Button>
      </AuthCard>
    );
  }

  return (
    <MobileShell>
      <StepHeader title="비밀번호 찾기" step={step} total={3} onBack={() => (step === 1 ? navigate(loginPath) : setStep(step - 1))} />
      <FadeIn key={step} className="flex flex-1 flex-col">
        <form onSubmit={step === 1 ? sendCode : step === 2 ? (e) => { e.preventDefault(); setStep(3); } : change} className="flex flex-1 flex-col">
          <main className="flex flex-1 flex-col gap-4 px-5 pb-5 pt-6">
            {step === 1 && (
              <>
                <h2 className="text-[24px] font-semibold leading-[34px]">가입한 이메일을<br />입력해 주세요</h2>
                <Field label="이메일" type="email" autoComplete="email" placeholder="이메일 주소" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <p className="-mt-1 text-[13px] text-sub">이 이메일로 6자리 코드를 보내 드립니다.</p>
              </>
            )}
            {step === 2 && (
              <>
                <h2 className="text-[24px] font-semibold leading-[34px]">이메일로 받은 코드를<br />입력해 주세요</h2>
                <p className="text-[15px] leading-[23px] text-sub">{form.email} 주소로 6자리 코드를 보냈습니다.</p>
                <CodeInput value={form.code} onChange={(code) => setForm({ ...form, code })} onResend={resend} />
                <p className="text-[13px] text-muted">메일이 오지 않았다면 스팸함도 확인해 주세요.</p>
              </>
            )}
            {step === 3 && (
              <>
                <h2 className="text-[24px] font-semibold leading-[34px]">새 비밀번호를<br />정해 주세요</h2>
                <NewPasswordFields value={form.pw} onChange={(pw) => setForm({ ...form, pw })} labels={['새 비밀번호', '새 비밀번호 확인']} />
              </>
            )}
            {error}
          </main>
          <BottomBar>
            <Button type="submit" className="flex-1" loading={state.loading}
              disabled={step === 1 ? !/\S+@\S+\.\S+/.test(form.email) : step === 2 ? form.code.length < 6 : !newPasswordOk(form.pw)}>
              {step === 1 ? '코드 받기' : step === 2 ? '다음' : '비밀번호 바꾸기'}
            </Button>
          </BottomBar>
        </form>
      </FadeIn>
    </MobileShell>
  );
}
