// 07 진료 준비 (31:2), 07-a 질문 추가 (32:2). 19-b 저장 완료에서 "진료 준비에 담기"로도 옴 (state.add = 기록 id).
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getFollowups, getPrep, getRecords, now, savePrep } from '../../api';
import { followupWhen } from '../../components/Followup.jsx';
import { Close, Img, Plus } from '../../components/icons.jsx';
import { BottomBar, Button, CheckRow, ErrorView, FadeIn, MobileShell, PageHeader, Sheet, SkeletonRows, StateView, useToast } from '../../components/ui';
import { recordSub } from '../../components/RecordRow.jsx';
import { looseDate } from '../../lib/format.js';
import { fitsSpecialty, visitSpecialty } from '../../lib/symptom.js';
import useAsync from '../../lib/useAsync.js';

const RECENT_MS = 365 * 24 * 3600 * 1000;

export default function Prep() {
  const { followupId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const addId = useLocation().state?.add;
  const data = useAsync(() => Promise.all([getFollowups(), getPrep(followupId), getRecords()]), [followupId]);
  const [picked, setPicked] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const loaded = useRef(false);

  const [followups, prep, res] = data.data ?? [];
  const f = followups?.find((x) => x.id === followupId);
  // 최근 1년 기록 중 이 진료의 진료과 기록과 관련 있는 내 기록 (기록 공유와 같은 규칙). 저장해 둔 기록은 늘 넣음.
  const all = res?.records ?? [];
  const specialty = visitSpecialty(all, f?.clinic, f?.fromRecordId);
  const records = all.filter((r) => !r.status && r.date && now() - new Date(r.date).getTime() < RECENT_MS)
    .filter((r) => fitsSpecialty(r, specialty) || prep?.recordIds?.includes(r.id) || r.id === addId).slice(0, 8);

  // 처음 고른 상태: 저장해 둔 것과 방금 담은 기록만. 그 밖에는 사용자가 직접 고름
  useEffect(() => {
    if (!data.data || loaded.current) return;
    loaded.current = true;
    setPicked(new Set([...(prep.recordIds ?? []), ...(addId ? [addId] : [])]));
    setQuestions(prep.questions ?? []);
  }, [data.data, prep, addId]);

  // 아직 보내지 않은 저장 1건과 마지막으로 보낸 내용. 같은 내용은 두 번 보내지 않음.
  const pending = useRef(null);
  const sent = useRef(null);
  const flushRef = useRef(() => {});
  useEffect(() => {
    flushRef.current = () => {
      const p = pending.current;
      if (!p) return;
      pending.current = null;
      if (p.key === sent.current) return;
      sent.current = p.key;
      savePrep(p.id, p.body).catch(() => { sent.current = null; toast({ tone: 'danger', title: '진료 준비를 저장하지 못했습니다' }); });
    };
  });

  // 바뀔 때마다 저장 (다시 열어도 그대로). 타이머가 취소돼도 pending은 남아 화면을 떠날 때 보냄.
  useEffect(() => {
    if (!picked) return;
    const body = { recordIds: [...picked], questions };
    pending.current = { id: followupId, body, key: JSON.stringify([followupId, body]) };
    const t = setTimeout(() => flushRef.current(), 400);
    return () => clearTimeout(t);
  }, [picked, questions, followupId]);

  // 화면을 떠나거나(언마운트) 탭을 숨기거나 닫을 때: 남은 저장을 바로 보냄.
  // StrictMode의 가짜 언마운트는 처음 마운트 때라 picked가 아직 없어 보낼 것이 없음.
  useEffect(() => {
    const flush = () => flushRef.current();
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
      flush();
    };
  }, []);

  const toggle = (id) => { const s = new Set(picked); s.has(id) ? s.delete(id) : s.add(id); setPicked(s); };
  const add = () => { if (draft.trim()) setQuestions([...questions, draft.trim()]); setDraft(''); setAdding(false); };
  const count = picked?.size ?? 0;

  return (
    <MobileShell>
      <PageHeader title="진료 준비" back="/app/home" />
      {data.loading ? (
        <div className="px-5"><SkeletonRows rows={4} /></div>
      ) : data.error ? (
        <ErrorView error={data.error} onRetry={data.reload} title="진료 준비를 불러오지 못했습니다" />
      ) : !f ? (
        <StateView icon="calendar" title="지난 일정입니다" body="다가오는 진료 일정에서만 준비할 수 있습니다." action={<Button size="md" className="px-8" to="/app/schedule" replace>진료 일정 보기</Button>} />
      ) : (
        <FadeIn className="flex flex-1 flex-col">
          <main className="flex flex-1 flex-col gap-5 px-5 pb-5 pt-2">
            <div className="flex items-center gap-4 rounded-[20px] bg-done px-5 py-4">
              <Img name="calendar" size={44} />
              <span className="flex flex-col gap-0.5">
                <span className="text-[20px] font-semibold leading-7">{followupWhen(f)}</span>
                <span className="text-[14px]">{f.clinic}</span>
              </span>
            </div>

            <section className="flex flex-col">
              <h2 className="pb-1 text-[15px] font-semibold text-sub">의사에게 공유할 기록</h2>
              {records.length === 0 && <p className="py-2 text-[14px] text-sub">공유할 기록이 아직 없습니다.</p>}
              {records.map((r) => (
                <CheckRow key={r.id} on={picked?.has(r.id)} onToggle={() => toggle(r.id)}>
                  <span className="flex min-w-0 flex-1 flex-col gap-px">
                    <span className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-[16px] font-semibold">{r.title}</span>
                      <span className="shrink-0 text-[13px] text-sub">{looseDate(r.date)}</span>
                    </span>
                    <span className="text-[13px] text-sub">{recordSub(r)}</span>
                  </span>
                </CheckRow>
              ))}
            </section>

            <section className="flex flex-col gap-2.5">
              <h2 className="text-[15px] font-semibold text-sub">의사에게 물어볼 질문</h2>
              {questions.map((q, i) => (
                <div key={`${i}-${q}`} className="flex items-start gap-2 rounded-[14px] bg-field px-4 py-4">
                  <p className="flex-1 text-[15px] leading-[23px]">{q}</p>
                  <button type="button" aria-label="질문 지우기" className="-m-1 p-1" onClick={() => setQuestions(questions.filter((_, j) => j !== i))}><Close size={18} color="#627080" /></button>
                </div>
              ))}
              <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1.5 self-start py-1 text-[15px] font-semibold text-primary">
                <Plus color="#2479c8" />질문 추가
              </button>
            </section>
          </main>
          <BottomBar>
            <Button className="flex-1" disabled={!count}
              onClick={() => navigate('/app/share/new', { state: { recordIds: [...picked], includeMedication: false, ttlMinutes: 5 } })}>
              {count ? `기록 ${count}건 QR로 공유하기` : '공유할 기록을 골라 주세요'}
            </Button>
          </BottomBar>
        </FadeIn>
      )}

      <Sheet open={adding} title="질문 추가" onClose={() => setAdding(false)}>
        <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={200} rows={3} placeholder="예: 무릎에 찜질을 해도 되나요?"
          className="rounded-xl bg-white px-4 py-3 text-[16px] leading-6 shadow-[inset_0_0_0_1.5px_#2479c8] outline-none placeholder:text-muted" />
        <div className="flex gap-2.5">
          <Button variant="secondary" className="w-[100px]" onClick={() => setAdding(false)}>취소</Button>
          <Button className="flex-1" disabled={!draft.trim()} onClick={add}>추가</Button>
        </div>
      </Sheet>
    </MobileShell>
  );
}
