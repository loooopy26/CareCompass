// 증상 기록: 08 안전 확인 준비 중 (41:2) → 09-a 증상 종류 직접 입력 (43:2) → 10 시작한 날 (44:2, 10-a 날짜 45:2, 10-b 시간 417:52) → 11 위치 (46:2)
// → 12 시간과 빈도 (47:2) → 13 아픈 정도와 메모 (48:2, 13-a 나가기 확인 49:2) → 14 입력 확인 (52:2) → 14-a 요약 만드는 중 (53:2)
// → 15 증상 요약 (54:2) / 16 요약 수정 (55:2) / 17 요약 실패 (56:2) → 19 저장 완료 (57:2) / 19-b 다음 진료가 있을 때 (58:2)
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { createSymptom, getFollowups, summarizeSymptom } from '../../api';
import { Check, Img } from '../../components/icons.jsx';
import { DateField, PainSlider, SegmentPick, Stepper, TextArea, TimeField, ToggleChip } from '../../components/inputs.jsx';
import { BottomBar, Button, Chips, Confirm, FadeIn, Field, KV, MobileShell, PageHeader, Segmented, StepHeader, useToast } from '../../components/ui';
import { fullDateTime } from '../../lib/format.js';
import { DATE_UNKNOWN, FREQUENCIES, SIDES, duration, emptyInput, inputRows, oftenShort, part, pain, profile, shortSummaryRows, since, start, steps, summaryRows, title, whenFreq } from '../../lib/symptom.js';

export default function SymptomNew() {
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(0); // 0 안내, 1~5 입력, 'confirm', 'summarizing', 'summary', 'editSummary', 'failed', 'saved'
  const [input, setInput] = useState(emptyInput);
  const [dateUnknown, setDateUnknown] = useState(false);
  const [summary, setSummary] = useState(null);
  const [saved, setSaved] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (patch) => setInput((i) => ({ ...i, ...patch }));
  const p = profile(input.area);
  const order = steps(input.area); // 증상에 따라 4~5단계 (기침·열처럼 위치가 없는 증상은 위치를 건너뜀)
  const last = order[order.length - 1];
  const at = order.indexOf(step);

  const dirty = !!input.area;
  const exit = () => (dirty && step !== 'saved' ? setLeaving(true) : navigate(-1));
  const back = () => (step === 1 ? exit() : step === 'confirm' ? setStep(last) : setStep(order[at - 1]));

  const summarize = async () => {
    setStep('summarizing');
    try {
      setSummary(await summarizeSymptom(input));
      setStep('summary');
    } catch {
      setStep('failed');
    }
  };
  const save = async (withSummary) => {
    setSaving(true);
    try {
      const record = await createSymptom({ input, summary: withSummary ? summary : null });
      const next = await getFollowups().then((f) => f[0], () => null);
      setSaved({ record, next });
      setStep('saved');
    } catch (e) {
      toast({ tone: 'danger', title: '저장하지 못했습니다', body: e.message, action: { label: '다시 저장', onClick: () => save(withSummary) } });
    }
    setSaving(false);
  };

  const canNext = {
    1: !!input.area.trim(),
    2: !!input.startDate || dateUnknown,
    3: !p.sided || !!input.side,
    4: !!input.frequency,
    5: true,
  }[step];

  let body;
  if (step === 0) {
    body = (
      <>
        <PageHeader title="증상 기록" back="/app/home" />
        <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <Img name="clipboard" three size={72} />
          <h1 className="mt-2 text-[24px] font-semibold leading-8">안전 확인 질문을<br />준비하고 있습니다</h1>
          <p className="text-[15px] leading-[23px] text-sub">의료진 검토를 마치면 기록 전에 몇 가지를 먼저 여쭤보겠습니다. 지금은 바로 증상을 기록할 수 있습니다.</p>
          <p className="mt-2 text-[13px] leading-[19px] text-muted">숨쉬기 힘들거나 가슴이 심하게 아프면 기록하지 말고 바로 119에 전화하세요.</p>
        </main>
        <BottomBar><Button className="flex-1" onClick={() => setStep(1)}>증상 기록 시작</Button></BottomBar>
      </>
    );
  } else if (typeof step === 'number') {
    body = (
      <>
        <StepHeader title="증상 기록" step={at + 1} total={order.length} onBack={back} />
        <FadeIn key={step} className="flex flex-1 flex-col">
          <main className="flex flex-1 flex-col gap-4 px-5 pb-5 pt-6">
            {step === 1 && (
              <>
                <h2 className="text-[24px] font-semibold leading-[34px]">어디가, 어떻게<br />불편하십니까?</h2>
                {/* 증상이 바뀌면 그 증상에 맞지 않는 쪽·때 선택은 지움 */}
                <Field label="불편한 곳이나 증상" autoFocus maxLength={20} placeholder="예: 무릎, 두통, 기침" value={input.area}
                  onChange={(e) => set({ area: e.target.value, side: '', when: profile(e.target.value).whens.includes(input.when) ? input.when : '' })} />
                <p className="-mt-2 text-[13px] text-sub">한두 단어로 적어 주세요. 적은 내용에 맞춰 다음 질문이 바뀝니다.</p>
              </>
            )}
            {step === 2 && (
              <>
                <h2 className="text-[24px] font-semibold leading-[34px]">언제부터 불편하셨습니까?</h2>
                {/* 모른다고 고르면 날짜 칸은 흐리게 하고 누를 수 없게 함. 바깥 div는 등장 애니메이션이 opacity를 덮어써서 안쪽에 줌 */}
                <div inert={dateUnknown}>
                  <div className={dateUnknown ? 'opacity-40' : undefined}><DateField label="날짜" value={input.startDate} onChange={(startDate) => set({ startDate })} /></div>
                </div>
                <ToggleChip on={dateUnknown} onToggle={() => { setDateUnknown(!dateUnknown); set({ startDate: '', startTime: '' }); }}>{DATE_UNKNOWN}</ToggleChip>
                {!dateUnknown && <TimeField label="시간 (선택)" value={input.startTime} onChange={(startTime) => set({ startTime })} />}
                {!dateUnknown && !input.startTime && <p className="-mt-2 text-[13px] text-sub">기억나지 않으면 비워 두세요.</p>}
              </>
            )}
            {step === 3 && (
              <>
                <div className="flex flex-col gap-1">
                  <h2 className="text-[24px] font-semibold leading-[34px]">{p.whereQ}</h2>
                  <p className="text-[14px] text-sub">{since(input)}</p>
                </div>
                {p.sided && <SegmentPick label="어느 쪽" options={SIDES} value={input.side} onChange={(side) => set({ side })} />}
                <Field label="자세한 위치 (선택)" maxLength={30} placeholder={p.detail} value={input.detail} onChange={(e) => set({ detail: e.target.value })} />
              </>
            )}
            {step === 4 && (
              <>
                <div className="flex flex-col gap-1">
                  <h2 className="text-[24px] font-semibold leading-[34px]">한 번 {p.onset}<br />얼마나 이어집니까?</h2>
                  <p className="text-[14px] text-sub">{p.located ? part(input) : since(input)}</p>
                </div>
                <Stepper value={input.minutes} onChange={(minutes) => set({ minutes })} />
                <h3 className="mt-1 text-[15px] font-semibold">{p.oftenQ}</h3>
                <SegmentPick label="얼마나 자주" options={FREQUENCIES} value={input.frequency} onChange={(frequency) => set({ frequency })} />
                <h3 className="mt-1 text-[15px] font-semibold">{p.whenQ}</h3>
                <Chips size="lg" className="flex-wrap overflow-visible" options={p.whens.map((w) => ({ value: w, label: w }))}
                  value={input.when} onChange={(w) => set({ when: w === input.when ? '' : w })} />
              </>
            )}
            {step === 5 && (
              <>
                <div className="flex flex-col gap-1">
                  <h2 className="text-[24px] font-semibold leading-[34px]">{p.howQ}</h2>
                  <p className="text-[14px] text-sub">{oftenShort(input)}, {duration(input).replace('약 ', '')}쯤</p>
                </div>
                <PainSlider value={input.pain} onChange={(v) => set({ pain: v })} label={p.painLabel} zero={p.zero} />
                <TextArea label="메모 (선택)" maxLength={300} placeholder={p.memo} value={input.memo} onChange={(e) => set({ memo: e.target.value })} />
              </>
            )}
          </main>
          <BottomBar>
            <Button variant="secondary" className="w-[100px]" onClick={back}>이전</Button>
            <Button className="flex-1" disabled={!canNext} onClick={() => setStep(step === last ? 'confirm' : order[at + 1])}>{step === last ? '입력 확인' : '다음'}</Button>
          </BottomBar>
        </FadeIn>
      </>
    );
  } else if (step === 'confirm') {
    body = (
      <>
        <PageHeader title="입력 확인" back={() => setStep(last)} right={<button type="button" className="text-[15px] font-semibold text-primary" onClick={() => setStep(1)}>수정</button>} />
        <FadeIn className="flex flex-1 flex-col">
          <main className="flex flex-1 flex-col gap-4 px-5 pb-5 pt-4">
            <h2 className="text-[24px] font-semibold leading-[34px]">이렇게 기록하겠습니다</h2>
            <div className="flex flex-col gap-3 rounded-2xl bg-panel p-5">
              <KV label="증상" value={title(input)} />
              {summaryRows(input).filter(([k]) => k !== '위치' || input.detail).map(([k, v]) => <KV key={k} label={k} value={v} />)}
              {input.memo && (
                <div className="flex flex-col gap-1 border-t border-line-strong pt-3">
                  <span className="text-[15px] text-sub">메모</span>
                  <p className="text-[15px] leading-[23px]">{input.memo}</p>
                </div>
              )}
            </div>
          </main>
          <BottomBar className="flex-col">
            <Button onClick={summarize}>요약 보기</Button>
            <Button variant="secondary" loading={saving} onClick={() => save(false)}>요약 없이 저장</Button>
          </BottomBar>
        </FadeIn>
      </>
    );
  } else if (step === 'summarizing') {
    body = (
      <>
        <PageHeader title="증상 요약" />
        <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center" role="status">
          <Img name="ai" three size={72} />
          <p className="text-[17px] font-semibold leading-7">진료 때 보여주기 좋게<br />정리하고 있습니다</p>
        </main>
      </>
    );
  } else if (step === 'summary') {
    body = <SummaryView input={input} summary={summary} saving={saving} onBack={() => setStep('confirm')} onEdit={() => setStep('editSummary')} onSave={() => save(true)} />;
  } else if (step === 'editSummary') {
    body = <SummaryEditor input={input} summary={summary} onCancel={() => setStep('summary')} onSave={(s) => { setSummary(s); setStep('summary'); }} />;
  } else if (step === 'failed') {
    body = (
      <>
        <PageHeader title="증상 요약" back={() => setStep('confirm')} />
        <FadeIn className="flex flex-1 flex-col">
          <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <Img name="ai" three size={72} />
            <h1 className="mt-2 text-[20px] font-semibold leading-7">요약을 만들지 못했습니다</h1>
            <p className="text-[15px] leading-[23px] text-sub">다시 시도하거나 요약 없이 저장할 수 있습니다.</p>
            <div className="mt-4 flex w-full flex-col gap-0.5 rounded-2xl bg-panel px-5 py-4 text-left">
              <span className="text-[16px] font-semibold">{title(input)}</span>
              <span className="text-[13px] text-sub">{since(input)}, {oftenShort(input)}, {pain(input)}</span>
            </div>
          </main>
          <BottomBar className="flex-col">
            <Button onClick={summarize}>다시 요약하기</Button>
            <Button variant="secondary" loading={saving} onClick={() => save(false)}>요약 없이 저장</Button>
          </BottomBar>
        </FadeIn>
      </>
    );
  } else {
    const { record, next } = saved;
    body = (
      <FadeIn className="flex flex-1 flex-col">
        <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <motion.span className="flex size-[88px] items-center justify-center rounded-full bg-done"
            initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 16 }}>
            <Check size={44} width={2.6} />
          </motion.span>
          <h1 className="mt-2 text-[24px] font-semibold leading-[30px]">저장했습니다</h1>
          <p className="text-[15px] leading-[23px] text-sub">다음 진료 때 사용하실 수 있습니다.</p>
          <Link to={`/app/records/${record.id}`} className="mt-4 flex w-full flex-col gap-0.5 rounded-2xl bg-panel px-5 py-4 text-left">
            <span className="text-[16px] font-semibold">{record.title}</span>
            <span className="text-[13px] text-sub">{fullDateTime(record.date)} 저장</span>
          </Link>
        </main>
        <BottomBar className="flex-col">
          {next?.kind === 'APPOINTMENT'
            ? <Button to={`/app/prep/${next.id}`} replace state={{ add: record.id }}>진료 준비에 담기</Button>
            : <Button to="/app/share/new" replace state={{ recordIds: [record.id], includeMedication: false, ttlMinutes: 5 }}>QR로 공유하기</Button>}
          <Button variant="secondary" to="/app/home" replace>홈으로</Button>
        </BottomBar>
      </FadeIn>
    );
  }

  return (
    <MobileShell>
      {body}
      <Confirm open={leaving} title="작성을 멈추고 나가시겠습니까?" body="작성 중인 내용이 사라집니다." cancel="나가기" ok="계속 쓰기"
        onCancel={() => navigate('/app/home', { replace: true })} onOk={() => setLeaving(false)} />
    </MobileShell>
  );
}

/* 15 증상 요약 (요약 | 내가 쓴 내용) */
export function SummaryView({ input, summary, saving, onBack, onEdit, onSave, saveLabel = '이 요약으로 저장' }) {
  const [tab, setTab] = useState('summary');
  return (
    <>
      <PageHeader title="증상 요약" back={onBack} />
      <FadeIn className="flex flex-1 flex-col">
        <main className="flex flex-1 flex-col gap-5 px-5 pb-5 pt-2">
          <div className="flex items-start gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <h1 className="text-[24px] font-semibold leading-8">{title(input)}</h1>
              <p className="text-[13px] text-sub">{fullDateTime(summary.at)} 요약</p>
            </div>
            <Img name="ai" size={36} />
          </div>
          <Segmented value={tab} onChange={setTab} options={[{ value: 'summary', label: '요약' }, { value: 'input', label: '내가 쓴 내용' }]} />
          {tab === 'summary' ? (
            <FadeIn key="s" className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5 rounded-2xl bg-primary-soft px-5 py-4">
                <span className="text-[13px] font-semibold text-primary-dark">진료 때 이렇게 말해 보세요</span>
                <p className="text-[17px] font-semibold leading-7">“{summary.say}”</p>
              </div>
              <div className="flex flex-col gap-3">{shortSummaryRows(input, summary).map(([k, v]) => <KV key={k} label={k} value={v} />)}</div>
              <p className="text-[13px] text-sub">의사가 확인한 내용은 아닙니다.</p>
            </FadeIn>
          ) : (
            <FadeIn key="i" className="flex flex-col gap-3">
              {inputRows(input).map(([k, v]) => <KV key={k} label={k} value={v} />)}
              {input.memo && <KV label="메모" value={input.memo} />}
            </FadeIn>
          )}
        </main>
        <BottomBar>
          <Button variant="secondary" className="w-[100px]" onClick={onEdit}>수정하기</Button>
          <Button className="flex-1" loading={saving} onClick={onSave}>{saveLabel}</Button>
        </BottomBar>
      </FadeIn>
    </>
  );
}

/* 16 요약 수정: 처음 쓴 내용은 그대로 두고 요약만 바꿈 */
export function SummaryEditor({ input, summary, saving, onCancel, onSave }) {
  const [s, setS] = useState({ start: start(input), when: whenFreq(input), pain: pain(input), ...summary });
  const p = profile(input.area);
  const set = (k) => (e) => setS({ ...s, [k]: e.target.value });
  return (
    <>
      <PageHeader title="요약 수정" back={onCancel} close />
      <FadeIn className="flex flex-1 flex-col">
        <main className="flex flex-1 flex-col gap-4 px-5 pb-5 pt-3">
          <TextArea label="진료 때 할 말" rows={4} maxLength={300} value={s.say} onChange={set('say')} autoFocus className="!bg-white shadow-[inset_0_0_0_1.5px_#2479c8]" />
          <Field label="시작" maxLength={30} value={s.start} onChange={set('start')} />
          <Field label={p.whenLabel} maxLength={30} value={s.when} onChange={set('when')} />
          <Field label={p.painLabel} maxLength={10} value={s.pain} onChange={set('pain')} />
          <p className="text-[13px] text-sub">처음 쓴 내용은 바뀌지 않습니다.</p>
        </main>
        <BottomBar>
          <Button variant="secondary" className="w-[100px]" onClick={onCancel}>취소</Button>
          <Button className="flex-1" disabled={!s.say?.trim()} loading={saving} onClick={() => onSave(s)}>저장</Button>
        </BottomBar>
      </FadeIn>
    </>
  );
}
