// 41 내가 쓴 내용 수정 (51:2), 16 요약 수정 (55:2, 저장한 기록), 40 내 증상 기록 모아보기 (50:2)
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getRecord, getRecords, updateSymptom } from '../../api';
import { DateField, SegmentPick, TextArea, ToggleChip } from '../../components/inputs.jsx';
import RecordRow from '../../components/RecordRow.jsx';
import { BottomBar, Button, Chips, ErrorView, FadeIn, Field, MobileShell, PageHeader, Skeleton, SkeletonRows, Stagger, StaggerItem, StateView, usePaged, useToast } from '../../components/ui';
import { DATE_UNKNOWN, FREQUENCIES, SIDES, pain, profile, whenFreq } from '../../lib/symptom.js';
import useAsync from '../../lib/useAsync.js';
import { SummaryEditor } from './SymptomNew.jsx';

const PAINS = Array.from({ length: 11 }, (_, i) => i);

function useSymptom() {
  const { id } = useParams();
  const state = useAsync(() => getRecord(id), [id]);
  return { id, ...state };
}

const Loading = ({ title }) => (
  <MobileShell>
    <PageHeader title={title} back />
    <div className="flex flex-col gap-4 px-5 pt-3"><Skeleton className="h-[52px]" /><Skeleton className="h-[52px]" /><Skeleton className="h-[52px]" /></div>
  </MobileShell>
);

/* 41 내가 쓴 내용 수정 */
export function SymptomEdit() {
  const navigate = useNavigate();
  const toast = useToast();
  const { id, data: r, error, loading, reload } = useSymptom();
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dateUnknown, setDateUnknown] = useState(false);
  useEffect(() => { if (r?.symptom) { setS(r.symptom); setDateUnknown(!r.symptom.startDate); } }, [r]);
  const set = (patch) => setS((x) => ({ ...x, ...patch }));

  if (loading || (!error && !s)) return <Loading title="내가 쓴 내용 수정" />;
  if (error || r.kind !== 'symptom') {
    return (
      <MobileShell>
        <PageHeader title="내가 쓴 내용 수정" back />
        {error && error.status !== 404 ? <ErrorView error={error} onRetry={reload} /> : <StateView icon="document" title="기록을 찾을 수 없습니다" body="삭제됐거나 볼 수 없는 기록입니다." />}
      </MobileShell>
    );
  }

  const p = profile(s.area);
  const save = async () => {
    setSaving(true);
    try {
      await updateSymptom(id, { input: s });
      toast({ title: '수정한 내용을 저장했습니다' });
      navigate(`/app/records/${id}/original`, { replace: true });
    } catch (e) {
      setSaving(false);
      toast({ tone: 'danger', title: '저장하지 못했습니다', body: e.message, action: { label: '다시 저장', onClick: save } });
    }
  };

  return (
    <MobileShell>
      <PageHeader title="내가 쓴 내용 수정" back close />
      <FadeIn className="flex flex-1 flex-col">
        <main className="flex flex-1 flex-col gap-4 px-5 pb-5 pt-3">
          {/* 증상이 바뀌면 맞지 않는 쪽·때 선택은 지움 (새 기록과 같은 규칙) */}
          <Field label="불편한 곳이나 증상" maxLength={20} value={s.area}
            onChange={(e) => { const n = profile(e.target.value); set({ area: e.target.value, side: n.sided ? s.side : '', when: n.whens.includes(s.when) ? s.when : '' }); }} />
          {p.sided && <SegmentPick label="어느 쪽" options={SIDES} value={s.side} onChange={(side) => set({ side })} />}
          {p.located && <Field label="자세한 위치" maxLength={30} placeholder={p.detail} value={s.detail} onChange={(e) => set({ detail: e.target.value })} />}
          <div inert={dateUnknown}>
            <div className={dateUnknown ? 'opacity-40' : undefined}><DateField label="시작한 날" value={s.startDate} onChange={(startDate) => set({ startDate })} /></div>
          </div>
          <ToggleChip on={dateUnknown} onToggle={() => { setDateUnknown(!dateUnknown); set({ startDate: '', startTime: '' }); }}>{DATE_UNKNOWN}</ToggleChip>
          <div className="flex flex-col gap-2">
            <span className="text-[14px] font-semibold text-sub">얼마나 자주</span>
            <SegmentPick label="얼마나 자주" options={FREQUENCIES} value={s.frequency} onChange={(frequency) => set({ frequency })} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[14px] font-semibold text-sub">{p.whenLabel}</span>
            <Chips size="lg" className="flex-wrap overflow-visible" options={p.whens.map((w) => ({ value: w, label: w }))}
              value={s.when} onChange={(w) => set({ when: w === s.when ? '' : w })} />
          </div>
          <label className="flex flex-col gap-2">
            <span className="text-[14px] font-semibold text-sub">{p.painLabel}</span>
            <select value={s.pain} onChange={(e) => set({ pain: Number(e.target.value) })} className="h-[52px] rounded-xl bg-field px-4 text-[16px] outline-none focus:shadow-[inset_0_0_0_1.5px_#2479c8]">
              {PAINS.map((p) => <option key={p} value={p}>{p} / 10</option>)}
            </select>
          </label>
          <TextArea label="메모" maxLength={300} value={s.memo} onChange={(e) => set({ memo: e.target.value })} />
        </main>
        <BottomBar>
          <Button variant="secondary" className="w-[100px]" onClick={() => navigate(-1)}>취소</Button>
          <Button className="flex-1" disabled={!s.area.trim() || (!s.startDate && !dateUnknown) || (p.sided && !s.side)} loading={saving} onClick={save}>저장</Button>
        </BottomBar>
      </FadeIn>
    </MobileShell>
  );
}

/* 16 요약 수정 (저장한 기록) */
export function SummaryEdit() {
  const navigate = useNavigate();
  const toast = useToast();
  const { id, data: r, error, loading, reload } = useSymptom();
  const [saving, setSaving] = useState(false);
  if (loading) return <Loading title="요약 수정" />;
  if (error || !r.summary) {
    return (
      <MobileShell>
        <PageHeader title="요약 수정" back />
        {error && error.status !== 404 ? <ErrorView error={error} onRetry={reload} /> : <StateView icon="ai" title="수정할 요약이 없습니다" />}
      </MobileShell>
    );
  }
  const save = async (summary) => {
    setSaving(true);
    try {
      await updateSymptom(id, { summary });
      toast({ title: '요약을 수정했습니다' });
      navigate(`/app/records/${id}`, { replace: true });
    } catch (e) {
      setSaving(false);
      toast({ tone: 'danger', title: '저장하지 못했습니다', body: e.message });
    }
  };
  return (
    <MobileShell>
      <SummaryEditor input={r.symptom} summary={r.summary} saving={saving} onCancel={() => navigate(-1)} onSave={save} />
    </MobileShell>
  );
}

/* 40 내 증상 기록 모아보기 */
export function Symptoms() {
  const { data, error, loading, reload } = useAsync(() => getRecords({ kind: 'symptom' }));
  const list = (data?.records ?? []).filter((r) => r.kind === 'symptom');
  const [shown, more] = usePaged(list);
  return (
    <MobileShell>
      <PageHeader title="내 증상 기록" back="/app/me" />
      <main className="flex flex-1 flex-col px-5">
        {loading ? <SkeletonRows rows={3} /> : error ? (
          <ErrorView error={error} onRetry={reload} title="기록을 불러오지 못했습니다" />
        ) : list.length === 0 ? (
          <StateView icon="pencil" title="아직 쓴 증상 기록이 없습니다" body="불편한 곳이 생기면 기록해 두고 진료 때 보여주세요." />
        ) : (
          <Stagger className="flex flex-col">
            {shown.map((r) => <StaggerItem key={r.id}><RecordRow r={r} sub={`${whenFreq(r.symptom)}, ${pain(r.symptom)}`} /></StaggerItem>)}
            {more}
          </Stagger>
        )}
      </main>
      <BottomBar><Button className="flex-1" to="/app/symptoms/new">새 증상 기록하기</Button></BottomBar>
    </MobileShell>
  );
}
