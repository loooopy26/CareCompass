// P2-a 공유 코드 입력 (88:2)
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Back } from '../../components/icons.jsx';
import { Button } from '../../components/ui';
import { PcPage, useOpenShared } from './Layout.jsx';

export default function CodeEntry() {
  const openShared = useOpenShared();
  const [code, setCode] = useState('');
  const [focused, setFocused] = useState(true);
  const [state, setState] = useState({ loading: false, error: null });

  const submit = async (e) => {
    e.preventDefault();
    setState({ loading: true, error: null });
    try {
      await openShared({ shareCode: code });
    } catch (error) {
      setState({ loading: false, error });
    }
  };

  const box = (i) => (
    <span key={i} className={`flex h-[60px] w-12 items-center justify-center rounded-xl text-[24px] font-semibold ${
      focused && i === Math.min(code.length, 7) ? 'bg-white shadow-[inset_0_0_0_1.5px_#2479c8]' : 'bg-field'}`}>
      {code[i] ?? ''}
    </span>
  );

  return (
    <PcPage>
      <main className="flex flex-1 items-center justify-center p-10">
        <form onSubmit={submit} className="flex w-[520px] flex-col gap-6 rounded-[20px] bg-white p-10 shadow-[0_8px_28px_rgba(24,59,91,0.08)]">
          <Link to="/clinician/scan" replace className="flex items-center gap-1 self-start text-[14px] font-semibold text-primary">
            <Back size={18} color="#2479c8" width={2.2} />QR로 확인하기
          </Link>
          <div className="flex flex-col gap-1.5">
            <h1 className="text-[28px] font-semibold leading-9">공유 코드 입력</h1>
            <p className="text-[15px] leading-[22px] text-sub">환자 앱의 공유 QR 아래에 있는 8자리 코드를 입력해 주세요.</p>
          </div>
          {/* 칸 8개 위에 투명한 입력칸 하나를 덮어서 붙여넣기·지우기를 그대로 씀 */}
          <label className="relative flex items-center gap-3">
            <span className="sr-only">공유 코드</span>
            <span className="flex gap-2">{[0, 1, 2, 3].map(box)}</span>
            <span className="flex gap-2">{[4, 5, 6, 7].map(box)}</span>
            <input
              autoFocus value={code} maxLength={9} autoComplete="off" spellCheck={false} inputMode="text"
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, 8))}
              className="absolute inset-0 cursor-text opacity-0"
            />
          </label>
          {state.error ? (
            <p className="text-[13px] font-semibold leading-[19px] text-danger-text" role="alert">
              {state.error.code === 'NOT_FOUND' ? '코드가 맞지 않습니다. 다시 확인해 주세요.' : state.error.message}
            </p>
          ) : (
            <p className="text-[13px] leading-[19px] text-muted">코드는 QR과 같은 시간 동안만 쓸 수 있습니다.</p>
          )}
          <Button type="submit" size="md" disabled={code.length < 8} loading={state.loading}>기록 열기</Button>
        </form>
      </main>
    </PcPage>
  );
}
