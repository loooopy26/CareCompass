// P4 진료 기록 쓰기 (95:2), P4-a 처방 추가 (96:2), P5 저장 확인 (97:2, ?confirm). 실패한 경우: P7 (99:2) 토스트.
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { createVisit } from '../../api';
import { Back, CheckCircle, Close, Clock, Plus, Radio } from '../../components/icons.jsx';
import { Button, Dialog, Field, InfoCard, useToast } from '../../components/ui';
import { fullDateShortWeek, time } from '../../lib/format.js';
import { clinicianRows } from '../../lib/symptom.js';
import { PcPage, useClinician } from './Layout.jsx';
import { useShareTimeLeft } from './SharedRecords.jsx';

const EMPTY = { title: '', note: '', diagnoses: [], tests: [], prescriptions: [], nextVisit: '', showNextVisit: true };
const input = 'w-full rounded-xl bg-field px-4 text-[16px] outline-none placeholder:text-muted focus:bg-white focus:shadow-[inset_0_0_0_1.5px_#2479c8]';

export default function VisitWrite() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { shared, draft, setDraft, setSaved } = useClinician();
  const left = useShareTimeLeft();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (shared && !draft) setDraft(EMPTY);
  }, [shared, draft, setDraft]);

  if (!shared) return <Navigate to="/clinician/blocked" replace />;

  const set = (patch) => setDraft({ ...draft, ...patch });
  // 날짜 정하기를 고른 경우: 날짜가 있어야 함 (null은 날짜 미정)
  const ready = draft && draft.title.trim() && draft.note.trim() && draft.nextVisit !== '';
  const confirmOpen = params.has('confirm') && !!ready;

  const save = async () => {
    setSaving(true);
    try {
      const { lastDate: _lastDate, ...body } = draft; // lastDate는 날짜 미정을 눌렀다 돌아올 때 쓰는 화면 값
      const res = await createVisit({ grantId: shared.grantId, ...body });
      setSaved({ ...body, ...res, patient: shared.patient });
      setDraft(null);
      navigate('/clinician/visit/done', { replace: true });
    } catch (e) {
      setSaving(false);
      toast({ tone: 'danger', title: '저장하지 못했습니다', body: e.code === 'NETWORK' ? '인터넷 연결을 확인하고 다시 저장해 주세요.' : e.message, action: { label: '다시 저장', onClick: save } });
    }
  };

  const symptom = shared.records.find((r) => r.kind === 'symptom');

  return (
    <PcPage>
      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col gap-5 px-8 py-7">
          <div className="flex items-center gap-3">
            <button type="button" aria-label="뒤로 가기" onClick={() => navigate(-1)} className="-m-2 p-2"><Back /></button>
            <h1 className="text-[24px] font-semibold">진료 기록 쓰기</h1>
            <span className="text-[15px] text-sub">{shared.patient.name}</span>
          </div>

          {draft && (
            <form className="flex flex-1 flex-col gap-4 rounded-2xl bg-white p-6" onSubmit={(e) => { e.preventDefault(); if (ready) setParams({ confirm: '1' }); }}>
              <label className="flex flex-col gap-2">
                <span className="text-[14px] font-semibold text-sub">제목</span>
                <input className={`${input} h-11`} value={draft.title} placeholder="예: 무릎 정기 진료" onChange={(e) => set({ title: e.target.value })} />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-[14px] font-semibold text-sub">진료 내용</span>
                <textarea className={`${input} min-h-24 resize-y py-3 text-[15px] leading-6`} rows={3} value={draft.note} placeholder="주호소, 현병력, 검사 소견" onChange={(e) => set({ note: e.target.value })} />
              </label>

              <div className="grid grid-cols-3 gap-4">
                <ItemList label="진단" items={draft.diagnoses} onChange={(diagnoses) => set({ diagnoses })} detailPlaceholder="예: 치료 중" />
                <ItemList label="검사" items={draft.tests} onChange={(tests) => set({ tests })} detailPlaceholder="예: 특이 소견 없음" />
                <ItemList label="처방" items={draft.prescriptions} onChange={(prescriptions) => set({ prescriptions })} dialog />
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[14px] font-semibold text-sub">다음 진료</span>
                <div className="flex gap-6 text-[15px]" role="radiogroup">
                  {[[true, '날짜 정하기'], [false, '날짜 미정 (필요할 때 다시 진료)']].map(([v, label]) => {
                    const on = (draft.nextVisit !== null) === v;
                    return (
                      <button key={label} type="button" role="radio" aria-checked={on} className={`flex items-center gap-2 ${on ? 'font-semibold' : ''}`}
                        onClick={() => set({ nextVisit: v ? (draft.lastDate ?? '') : null, lastDate: draft.nextVisit ?? draft.lastDate })}>
                        <Radio on={on} />{label}
                      </button>
                    );
                  })}
                </div>
                {draft.nextVisit !== null && (
                  <label className="relative mt-0.5 flex h-11 w-1/2 items-center rounded-xl bg-field px-4 text-[16px]">
                    <span className={draft.nextVisit ? '' : 'text-muted'}>{draft.nextVisit ? fullDateShortWeek(draft.nextVisit) : '날짜를 골라 주세요'}</span>
                    <input type="date" aria-label="다음 진료 날짜" value={draft.nextVisit} onChange={(e) => set({ nextVisit: e.target.value })}
                      onClick={(e) => e.currentTarget.showPicker?.()} className="absolute inset-0 cursor-pointer opacity-0" />
                  </label>
                )}
              </div>

              <div className="flex-1" />
              <div className="flex items-center gap-3">
                <button type="button" role="checkbox" aria-checked={draft.showNextVisit} onClick={() => set({ showNextVisit: !draft.showNextVisit })}
                  className="flex flex-1 items-center gap-2.5 text-[15px]">
                  <CheckCircle on={draft.showNextVisit} />환자 앱에 다음 진료 일정 보여주기
                </button>
                <Button size="pc" variant="secondary" className="w-[120px]" onClick={() => navigate(-1)}>취소</Button>
                <Button type="submit" size="pc" className="w-40" disabled={!ready}>저장</Button>
              </div>
            </form>
          )}
        </main>

        <aside className="flex w-[360px] shrink-0 flex-col gap-4 border-l border-line-bar bg-white px-6 py-7">
          <h2 className="text-[15px] font-semibold">환자가 쓴 내용</h2>
          {left === 0 ? (
            <p className="rounded-xl bg-warn p-4 text-[14px] leading-[21px] text-warn-text">
              열람 시간이 {time(shared.expiresAt)}에 끝났습니다. 환자 기록은 다시 볼 수 없지만, 쓰던 진료 기록은 저장할 수 있습니다.
            </p>
          ) : symptom ? (
            <>
              <InfoCard size="sm" className="rounded-xl" rows={clinicianRows(symptom.symptom)} />
              {symptom.symptom.memo && <p className="text-[15px] leading-[23px]">“{symptom.symptom.memo}”</p>}
              <div className="h-px bg-line-bar" />
              <p className="flex items-start gap-2 text-[13px] leading-[19px] text-sub">
                <span className="flex h-[19px] items-center"><Clock /></span>
                {time(shared.expiresAt)}에 열람이 끝나도 쓰던 기록은 저장할 수 있습니다.
              </p>
            </>
          ) : (
            <p className="text-[14px] text-sub">환자가 쓴 증상 기록은 공유받지 않았습니다.</p>
          )}
        </aside>
      </div>

      {draft && (
        <Dialog wide open={confirmOpen} title="이 진료 기록을 저장하시겠습니까?" onClose={() => !saving && navigate(-1)}>
          <InfoCard size="sm" className="rounded-xl" rows={[
            ['환자', shared.patient.name],
            ['제목', draft.title],
            ['진단', draft.diagnoses.map((d) => d.name).join(', ') || '없음'],
            ['검사', draft.tests.map((d) => d.name).join(', ') || '없음'],
            ...(draft.prescriptions.length ? [['처방', draft.prescriptions.map((d) => d.name).join(', ')]] : []),
            ['다음 진료', draft.nextVisit ? fullDateShortWeek(draft.nextVisit) : '날짜 미정'],
          ]} />
          <p className="text-[15px] leading-[23px] text-sub">저장하면 {shared.patient.name}님 앱에 곧 보이고, 이후에는 수정할 수 없습니다.</p>
          <div className="mt-1 flex gap-2.5">
            <Button size="pc" variant="secondary" className="flex-1" disabled={saving} onClick={() => navigate(-1)}>돌아가기</Button>
            <Button size="pc" className="flex-1" loading={saving} onClick={save}>저장</Button>
          </div>
        </Dialog>
      )}
    </PcPage>
  );
}

// 진단·검사·처방 목록: 항목 지우기 + 아래 버튼으로 바로 추가
function ItemList({ label, items, onChange, detailPlaceholder, dialog }) {
  const [adding, setAdding] = useState(null);
  const add = () => {
    if (adding.name.trim()) onChange([...items, { name: adding.name.trim(), detail: adding.detail.trim() }]);
    setAdding(null);
  };
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-[14px] font-semibold text-sub">{label} <span className="font-medium text-muted">(선택)</span></span>
      {items.map((it, i) => (
        <div key={`${it.name}-${i}`} className="flex items-center gap-2 rounded-[10px] bg-field px-3 py-2.5">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-semibold">{it.name}</span>
            {it.detail && <span className="text-[13px] text-sub">{it.detail}</span>}
          </div>
          <button type="button" aria-label={`${it.name} 지우기`} onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <Close size={16} color="#9aa7b4" />
          </button>
        </div>
      ))}
      {items.length === 0 && !adding && (
        <div className="flex h-14 items-center justify-center rounded-[10px] bg-panel text-[14px] text-muted">입력한 {label}{label === '검사' ? '가' : '이'} 없습니다</div>
      )}
      {dialog && (
        <Dialog wide open={!!adding} title={`${label} 추가`} onClose={() => setAdding(null)}>
          <div className="flex flex-col gap-4" onKeyDown={(e) => e.key === 'Enter' && adding?.name.trim() && (e.preventDefault(), add())}>
            <Field label="약 이름" autoFocus placeholder="예: 아세트아미노펜 500mg" value={adding?.name ?? ''} onChange={(e) => setAdding({ ...adding, name: e.target.value })} />
            <Field label="복용 방법 (선택)" placeholder="예: 하루 3번, 식후 30분" value={adding?.detail ?? ''} onChange={(e) => setAdding({ ...adding, detail: e.target.value })} />
            <div className="mt-1 flex gap-2.5">
              <Button size="pc" variant="secondary" className="flex-1" onClick={() => setAdding(null)}>취소</Button>
              <Button size="pc" className="flex-1" disabled={!adding?.name.trim()} onClick={add}>추가</Button>
            </div>
          </div>
        </Dialog>
      )}
      {adding && !dialog ? (
        <div className="flex flex-col gap-1.5 rounded-[10px] bg-white p-2 shadow-[inset_0_0_0_1.5px_#2479c8]">
          <input autoFocus className="h-9 rounded-lg bg-field px-3 text-[15px] outline-none focus:bg-white focus:shadow-[inset_0_0_0_1.5px_#2479c8]" placeholder={`${label} 이름`} value={adding.name}
            onChange={(e) => setAdding({ ...adding, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} />
          <input className="h-9 rounded-lg bg-field px-3 text-[14px] outline-none focus:bg-white focus:shadow-[inset_0_0_0_1.5px_#2479c8]" placeholder={detailPlaceholder} value={adding.detail}
            onChange={(e) => setAdding({ ...adding, detail: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} />
          <div className="flex justify-end gap-3 px-1 text-[14px] font-semibold">
            <button type="button" className="text-sub" onClick={() => setAdding(null)}>취소</button>
            <button type="button" className="text-primary" onClick={add}>추가</button>
          </div>
        </div>
      ) : !adding || dialog ? (
        <button type="button" onClick={() => setAdding({ name: '', detail: '' })}
          className="flex h-9 items-center justify-center gap-1.5 rounded-[10px] text-[14px] font-semibold text-primary shadow-[inset_0_0_0_1.5px_#c9d6e3] hover:bg-primary-tint">
          <Plus size={16} color="#2479c8" />{label} 추가
        </button>
      ) : null}
    </div>
  );
}
