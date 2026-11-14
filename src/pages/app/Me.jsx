// 30 내 정보 (75:2), 30-b 비밀번호를 바꾼 뒤 (77:2), 33 로그아웃 확인 (80:2), 31 비밀번호 바꾸기 (76:2),
// 32 약관과 정책 (78:2), 34 계정 삭제 (81:2), 34-a 계정 삭제 완료 (82:2), 프로필 수정 (Figma에 없음: 같은 모양으로 만듦)
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { changePassword, deleteAccount, getMe, logout, updateMe } from '../../api';
import { Check, ChevronRight, Img } from '../../components/icons.jsx';
import { DateField, PhoneField, SegmentPick, TextArea, UnitField, unitOk } from '../../components/inputs.jsx';
import { AlertBox, BottomBar, Button, CheckRow, Confirm, ErrorView, Field, FadeIn, InfoCard, MobileShell, NewPasswordFields, PageHeader, Skeleton, newPasswordOk, useToast } from '../../components/ui';
import { birth, phoneOk, phoneText, toE164 } from '../../lib/format.js';
import { isProfileChanged, profileForm } from '../../lib/profile.js';
import { TERMS } from '../../lib/terms.js';
import useAsync from '../../lib/useAsync.js';

const HEALTH_KEYS = ['gender', 'height', 'weight', 'conditions', 'medications'];
const healthCount = (p) => HEALTH_KEYS.filter((k) => p[k] != null && p[k] !== '').length;

const MENU = [['프로필 수정', '/app/me/profile'], ['건강 정보', '/app/me/health'], ['내 증상 기록', '/app/symptoms'], ['공유 내역', '/app/share'], ['비밀번호 바꾸기', '/app/me/password'], ['약관과 정책', '/app/me/terms']];

export default function Me() {
  const navigate = useNavigate();
  const toast = useToast();
  const notice = useLocation().state?.notice;
  const me = useAsync(getMe);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  // 30-b 비밀번호를 바꾼 뒤
  useEffect(() => { if (notice) toast({ title: notice }); }, [notice, toast]);

  const signOut = async () => {
    setBusy(true);
    await logout().catch(() => {});
    navigate('/app/login', { replace: true });
  };

  return (
    <MobileShell>
      <PageHeader title="내 정보" back="/app/home" />
      <main className="flex flex-1 flex-col gap-5 px-5 pb-6 pt-3">
        <Link to="/app/me/profile" className="flex items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft"><Img name="profile" size={32} /></span>
          {me.data ? (
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-[20px] font-semibold">{me.data.name || me.data.email}</span>
              {me.data.name && <span className="text-[14px] text-sub">{me.data.email}</span>}
            </span>
          ) : <span className="flex flex-1 flex-col gap-2"><Skeleton className="h-6 w-24" /><Skeleton className="h-4 w-40" /></span>}
          <ChevronRight />
        </Link>
        <InfoCard rows={[['생년월일', me.data?.birth ? birth(me.data.birth) : '—'], ['휴대폰 번호', phoneText(me.data?.phone) || '—']]} />
        <nav className="flex flex-col">
          {MENU.map(([label, to]) => (
            <Link key={to} to={to} className="flex h-14 items-center justify-between border-b border-line text-[16px] font-medium">
              {label}
              <span className="flex items-center gap-2">
                {to === '/app/me/health' && me.data && <span className="text-[14px] font-normal text-sub">{healthCount(me.data) ? `${healthCount(me.data)}개 항목` : '비어 있음'}</span>}
                <ChevronRight />
              </span>
            </Link>
          ))}
        </nav>
      </main>
      <BottomBar>
        <Button className="flex-1" onClick={() => setConfirm(true)}>로그아웃</Button>
        <Button variant="dangerLine" className="flex-1" to="/app/me/delete">계정 삭제</Button>
      </BottomBar>
      <Confirm open={confirm} title="로그아웃하시겠습니까?" body="다시 로그인하면 모은 기록을 볼 수 있습니다." ok="로그아웃" loading={busy} onCancel={() => setConfirm(false)} onOk={signOut} />
    </MobileShell>
  );
}

/* 프로필 수정: 가입 때 넣은 이름·생년월일·휴대폰 번호. 이메일은 로그인 아이디라 바꾸지 않음.
   health: 건강 정보 (모두 선택: 성별, 키, 몸무게, 질환·증상, 복용 중인 약).
   두 화면 모두 PATCH /me에 전체 값을 보냄 (보이지 않는 칸은 저장된 값 그대로) */
const GENDERS = ['남성', '여성'];
const H = [30, 250], W = [2, 300]; // 키 cm, 몸무게 kg
const num = (v) => (v === '' ? null : Number(v));

export function EditProfile({ health }) {
  const navigate = useNavigate();
  const me = useAsync(getMe);
  const [form, setForm] = useState(null);
  const [state, setState] = useState({ loading: false, error: null });
  useEffect(() => { if (me.data && !form) setForm(profileForm(me.data)); }, [me.data, form]);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const changed = form && me.data && isProfileChanged(form, me.data);
  const valid = form && (health ? unitOk(form.height, ...H) && unitOk(form.weight, ...W) : form.name.trim() && form.birthdate && phoneOk(form.phone));
  const submit = async (e) => {
    e.preventDefault();
    setState({ loading: true, error: null });
    try {
      await updateMe({
        name: form.name.trim(), birthdate: form.birthdate, phone: toE164(form.phone), gender: form.gender,
        height: num(form.height), weight: num(form.weight), conditions: form.conditions.trim(), medications: form.medications.trim(),
      });
      navigate('/app/me', { replace: true, state: { notice: health ? '건강 정보를 저장했습니다' : '프로필을 저장했습니다' } });
    } catch (error) {
      setState({ loading: false, error });
    }
  };

  return (
    <MobileShell>
      <PageHeader title={health ? '건강 정보' : '프로필 수정'} back="/app/me" />
      {me.error ? <ErrorView error={me.error} onRetry={me.reload} title="내 정보를 불러오지 못했습니다" /> : !form ? (
        <div className="flex flex-col gap-4 px-5 pt-3"><Skeleton className="h-[52px]" /><Skeleton className="h-[52px]" /><Skeleton className="h-[52px]" /></div>
      ) : (
        <form onSubmit={submit} className="flex flex-1 flex-col">
          <main className="flex flex-1 flex-col gap-4 px-5 pb-5 pt-3">
            {health ? (
              <>
                <div className="flex flex-col gap-2">
                  <span className="text-[14px] font-semibold text-sub">성별</span>
                  {/* 같은 버튼을 다시 누르면 선택을 지움 */}
                  <SegmentPick label="성별" options={GENDERS} value={form.gender} onChange={(g) => setForm({ ...form, gender: g === form.gender ? '' : g })} />
                </div>
                <div className="flex items-start gap-3">
                  <UnitField label="키" unit="cm" min={H[0]} max={H[1]} value={form.height} onChange={(height) => setForm({ ...form, height })} />
                  <UnitField label="몸무게" unit="kg" min={W[0]} max={W[1]} value={form.weight} onChange={(weight) => setForm({ ...form, weight })} />
                </div>
                <TextArea label="앓고 있는 질환이나 증상" maxLength={300} placeholder="예: 천식, 고혈압, 타고난 심장 질환" value={form.conditions} onChange={set('conditions')} />
                <TextArea label="복용 중인 약" maxLength={300} placeholder="예: 혈압약 하루 1번 아침" value={form.medications} onChange={set('medications')} />
              </>
            ) : (
              <>
                <Field label="이름" autoComplete="name" maxLength={30} value={form.name} onChange={set('name')} />
                <DateField label="생년월일" value={form.birthdate} onChange={(birthdate) => setForm({ ...form, birthdate })} />
                <PhoneField value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
                {/* 이메일은 바꿀 수 없어서 입력칸이 아닌 글자로 보여 줌 */}
                <div className="flex flex-col gap-1">
                  <span className="text-[14px] font-semibold text-sub">이메일</span>
                  <span className="py-2 text-[16px]">{me.data.email}</span>
                  <span className="text-[13px] text-sub">로그인 아이디라 바꿀 수 없습니다</span>
                </div>
              </>
            )}
            {state.error && <AlertBox title="저장하지 못했습니다">{state.error.message}</AlertBox>}
          </main>
          <BottomBar><Button type="submit" className="flex-1" disabled={!changed || !valid} loading={state.loading}>저장</Button></BottomBar>
        </form>
      )}
    </MobileShell>
  );
}

/* 31 비밀번호 바꾸기 */
export function ChangePassword() {
  const navigate = useNavigate();
  const [old, setOld] = useState('');
  const [pw, setPw] = useState({ password: '', confirm: '' });
  const [state, setState] = useState({ loading: false, error: null });
  const submit = async (e) => {
    e.preventDefault();
    setState({ loading: true, error: null });
    try {
      await changePassword({ oldPassword: old, newPassword: pw.password });
      navigate('/app/me', { replace: true, state: { notice: '비밀번호를 바꿨습니다' } });
    } catch (error) {
      setState({ loading: false, error });
    }
  };
  const wrongOld = state.error?.code === 'NotAuthorizedException';
  return (
    <MobileShell>
      <PageHeader title="비밀번호 바꾸기" back="/app/me" />
      <form onSubmit={submit} className="flex flex-1 flex-col">
        <main className="flex flex-1 flex-col gap-4 px-5 pb-5 pt-3">
          <Field label="현재 비밀번호" type="password" autoComplete="current-password" value={old} onChange={(e) => setOld(e.target.value)} />
          {wrongOld && <p className="-mt-2 text-[13px] text-danger-text">현재 비밀번호가 맞지 않습니다</p>}
          <NewPasswordFields value={pw} onChange={setPw} labels={['새 비밀번호', '새 비밀번호 확인']} />
          {state.error && !wrongOld && <AlertBox title="비밀번호를 바꾸지 못했습니다">{state.error.message}</AlertBox>}
        </main>
        <BottomBar><Button type="submit" className="flex-1" disabled={!old || !newPasswordOk(pw)} loading={state.loading}>저장</Button></BottomBar>
      </form>
    </MobileShell>
  );
}

/* 32 약관과 정책 */
export function Policies() {
  return (
    <MobileShell>
      <PageHeader title="약관과 정책" back="/app/me" />
      <nav className="flex flex-col px-5 pt-2">
        {TERMS.map((t) => (
          <Link key={t.id} to={`/app/terms/${t.id}`} className="flex min-h-[72px] items-center justify-between border-b border-line">
            <span className="flex flex-col gap-0.5">
              <span className="text-[16px] font-medium">{t.title}</span>
              <span className="text-[13px] text-sub">동의했습니다</span>
            </span>
            <ChevronRight />
          </Link>
        ))}
      </nav>
    </MobileShell>
  );
}

/* 34 계정 삭제 → 34-a 완료 */
export function DeleteAccount() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [done, setDone] = useState(false);
  const [state, setState] = useState({ loading: false, error: null });

  const submit = async (e) => {
    e.preventDefault();
    setState({ loading: true, error: null });
    try {
      await deleteAccount({ password });
      setDone(true);
    } catch (error) {
      setState({ loading: false, error });
    }
  };

  if (done) {
    return (
      <MobileShell>
        <FadeIn className="flex flex-1 flex-col">
          <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="flex size-[88px] items-center justify-center rounded-full bg-panel"><Check size={44} width={2.6} color="#52667a" /></span>
            <h1 className="mt-2 text-[24px] font-semibold leading-[30px]">계정을 삭제했습니다</h1>
            <p className="text-[15px] leading-[23px] text-sub">그동안 CareCompass를 이용해 주셔서 감사합니다.</p>
          </main>
          <BottomBar><Button className="flex-1" onClick={() => navigate('/app/login', { replace: true })}>처음으로</Button></BottomBar>
        </FadeIn>
      </MobileShell>
    );
  }

  const wrong = state.error?.code === 'NotAuthorizedException';
  return (
    <MobileShell>
      <PageHeader title="계정 삭제" back="/app/me" />
      <form onSubmit={submit} className="flex flex-1 flex-col">
        <main className="flex flex-1 flex-col gap-4 px-5 pb-5 pt-6">
          <h1 className="text-[24px] font-semibold leading-[34px]">계정을 삭제하시겠습니까?</h1>
          <p className="text-[15px] leading-[23px] text-sub">삭제하면 모은 진료 기록, 내 증상 기록, 공유 내역이 모두 지워지고 되돌릴 수 없습니다.</p>
          <Field label="비밀번호" type="password" autoComplete="current-password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} />
          {wrong && <p className="-mt-2 text-[13px] text-danger-text">비밀번호가 맞지 않습니다</p>}
          <CheckRow compact on={agree} onToggle={() => setAgree(!agree)}><span className="py-2 text-[15px]">위 내용을 확인했습니다</span></CheckRow>
          {state.error && !wrong && <AlertBox title="계정을 삭제하지 못했습니다">{state.error.message}</AlertBox>}
        </main>
        <BottomBar className="flex-col">
          <Button type="submit" variant="danger" disabled={!password || !agree} loading={state.loading}>계정 삭제</Button>
          <Button variant="secondary" to="/app/me" replace>취소</Button>
        </BottomBar>
      </form>
    </MobileShell>
  );
}
