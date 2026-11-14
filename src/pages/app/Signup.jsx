// 회원가입: A2 약관 동의 (2:2) → A4 계정 만들기 (3:2, 이미 가입된 이메일 4:2) → A3 이메일 인증 (5:2) → A5 가입 완료
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { confirmSignUp, resendSignUpCode, signUp } from '../../api';
import { Check, ChevronRight } from '../../components/icons.jsx';
import { DateField, PhoneField } from '../../components/inputs.jsx';
import { AlertBox, BottomBar, Button, CodeInput, Field, FadeIn, Hint, MobileShell, NewPasswordFields, StepHeader, newPasswordOk, useToast } from '../../components/ui';
import { phoneOk, toE164 } from '../../lib/format.js';
import { TERMS } from '../../lib/terms.js';

export default function Signup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [agreed, setAgreed] = useState(new Set());
  const [form, setForm] = useState({ email: '', pw: { password: '', confirm: '' }, name: '', birthdate: '', phone: '' });
  const back = () => (step === 1 ? navigate('/app/login') : setStep(step - 1));

  return (
    <MobileShell>
      <StepHeader title="회원가입" step={step} total={3} onBack={back} />
      <FadeIn key={step} className="flex flex-1 flex-col">
        {step === 1 && <Agree agreed={agreed} setAgreed={setAgreed} onNext={() => setStep(2)} />}
        {step === 2 && <Account form={form} setForm={setForm} consents={[...agreed]} onNext={() => setStep(3)} />}
        {step === 3 && <VerifyStep email={form.email} password={form.pw.password} />}
      </FadeIn>
    </MobileShell>
  );
}

/* A2 약관 동의 */
function Agree({ agreed, setAgreed, onNext }) {
  const all = agreed.size === TERMS.length;
  const toggle = (id) => { const s = new Set(agreed); s.has(id) ? s.delete(id) : s.add(id); setAgreed(s); };
  return (
    <>
      <main className="flex flex-1 flex-col gap-5 px-5 pb-5 pt-6">
        <h2 className="text-[24px] font-semibold leading-[34px]">약관에 동의해 주세요</h2>
        <button type="button" role="checkbox" aria-checked={all} onClick={() => setAgreed(all ? new Set() : new Set(TERMS.map((t) => t.id)))}
          className="flex h-[60px] items-center gap-3 rounded-[14px] bg-field px-4 text-left text-[17px] font-semibold">
          <CheckDot on={all} />모두 동의
        </button>
        <ul className="flex flex-col">
          {TERMS.map((t) => (
            <li key={t.id} className="flex h-[52px] items-center gap-2">
              <button type="button" role="checkbox" aria-checked={agreed.has(t.id)} onClick={() => toggle(t.id)} className="flex flex-1 items-center gap-3 text-left text-[15px]">
                <Check size={20} color={agreed.has(t.id) ? '#2479c8' : '#b5c2cf'} />
                <span><b className="text-primary">필수</b> {t.title}</span>
              </button>
              <Link to={`/app/terms/${t.id}`} aria-label={`${t.title} 보기`} className="-m-2 p-2"><ChevronRight /></Link>
            </li>
          ))}
        </ul>
        <p className="text-[13px] leading-[19px] text-sub">건강 기록은 내가 공유할 때만 의료진에게 전달됩니다.</p>
      </main>
      <BottomBar><Button className="flex-1" disabled={!all} onClick={onNext}>다음</Button></BottomBar>
    </>
  );
}

const CheckDot = ({ on }) => (
  <span className={`flex size-6 items-center justify-center rounded-full ${on ? 'bg-primary' : 'bg-white shadow-[inset_0_0_0_1.6px_#b5c2cf]'}`}>
    {on && <Check size={15} color="#ffffff" width={3} />}
  </span>
);

/* A4 계정 만들기. 이미 가입된 이메일인 경우: 이메일 칸 아래에 안내 (4:2) */
function Account({ form, setForm, consents, onNext }) {
  const [state, setState] = useState({ loading: false, error: null });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const exists = state.error?.code === 'UsernameExistsException';
  const ok = /\S+@\S+\.\S+/.test(form.email) && newPasswordOk(form.pw) && form.name.trim() && form.birthdate && phoneOk(form.phone);

  const submit = async (e) => {
    e.preventDefault();
    setState({ loading: true, error: null });
    try {
      await signUp({ email: form.email.trim(), password: form.pw.password, name: form.name.trim(), birthdate: form.birthdate, phone: toE164(form.phone), consents });
      onNext();
    } catch (error) {
      setState({ loading: false, error });
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col">
      <main className="flex flex-1 flex-col gap-4 px-5 pb-5 pt-6">
        <h2 className="text-[24px] font-semibold leading-[34px]">계정 만들기</h2>
        <Field label="이메일" type="email" autoComplete="email" placeholder="이메일 주소" value={form.email}
          onChange={(e) => { set('email')(e); if (exists) setState({ loading: false, error: null }); }}
          className={exists ? '!bg-danger !shadow-[inset_0_0_0_1.5px_#9e2f2f]' : ''} />
        {exists && (
          <div className="-mt-1 flex flex-col gap-1">
            <Hint ok={false}>이미 가입된 이메일입니다</Hint>
            <p className="text-[13px] text-sub">이미 가입하셨습니까? <Link to="/app/login" state={{ email: form.email }} className="font-semibold text-primary">로그인하기</Link></p>
          </div>
        )}
        <NewPasswordFields value={form.pw} onChange={(pw) => setForm({ ...form, pw })} />
        <Field label="이름" autoComplete="name" placeholder="이름" value={form.name} onChange={set('name')} />
        <DateField label="생년월일" value={form.birthdate} onChange={(birthdate) => setForm({ ...form, birthdate })} />
        <PhoneField value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
        {state.error && !exists && <AlertBox title="가입하지 못했습니다">{state.error.message}</AlertBox>}
      </main>
      <BottomBar><Button type="submit" className="flex-1" disabled={!ok} loading={state.loading}>다음</Button></BottomBar>
    </form>
  );
}

/* A3 이메일 인증 (가입 3/3). 로그인 화면에서 미인증 계정으로 들어온 경우: Verify.jsx */
export function VerifyStep({ email, password }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [state, setState] = useState({ loading: false, error: null });

  const submit = async (e) => {
    e.preventDefault();
    setState({ loading: true, error: null });
    try {
      const signedIn = await confirmSignUp({ email, code, password });
      if (signedIn?.step === 'DONE') navigate('/app/welcome', { replace: true });
      else navigate('/app/login', { replace: true, state: { email, notice: '이메일 인증을 마쳤습니다. 로그인해 주세요.' } });
    } catch (error) {
      setState({ loading: false, error });
    }
  };
  const resend = () => resendSignUpCode({ email }).then(
    () => { toast({ title: `${email} 주소로 코드를 다시 보냈습니다` }); return true; },
    (error) => { toast({ tone: 'danger', title: '코드를 보내지 못했습니다', body: error.message }); return false; },
  );

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col">
      <main className="flex flex-1 flex-col gap-4 px-5 pb-5 pt-6">
        <h2 className="text-[24px] font-semibold leading-[34px]">이메일로 받은 코드를<br />입력해 주세요</h2>
        <p className="text-[15px] leading-[23px] text-sub">{email} 주소로 6자리 코드를 보냈습니다.</p>
        <CodeInput value={code} onChange={setCode} onResend={resend} />
        <p className="text-[13px] text-muted">메일이 오지 않았다면 스팸함도 확인해 주세요.</p>
        {state.error && <AlertBox title="인증하지 못했습니다">{state.error.message}</AlertBox>}
      </main>
      <BottomBar><Button type="submit" className="flex-1" disabled={code.length < 6} loading={state.loading}>인증하기</Button></BottomBar>
    </form>
  );
}
