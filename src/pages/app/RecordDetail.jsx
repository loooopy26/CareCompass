// 진료 기록: 04 쉬운 설명 (16:2), 04-a 생성 중/실패 (17:2, 18:2), 04-b 일부 연결 기록 없음 (19:2), 39 다시 만들기 확인 (20:2),
// 05 원문 기록 (21:2), 05-c 진료 내용 글 없음 (22:2), 05-b 다른 병원 원문 (23:2), 05-a 찾을 수 없음 (27:2)
// 내 증상 기록: 06 요약 (28:2), 06-b 내가 쓴 내용 (29:2), 06-a 삭제 확인 (30:2)
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteSymptom, getRecord, regenerateEasy, summarizeSymptom, updateSymptom } from '../../api';
import { ChevronRight, Img } from '../../components/icons.jsx';
import { BottomBar, Button, Confirm, ErrorView, FadeIn, KV, MobileShell, PageHeader, Segmented, Skeleton, StateView, useToast } from '../../components/ui';
import { fullDateTime, looseFullDate, monthDay, nextVisitText, precision, specialtyName, time, yearMonth } from '../../lib/format.js';
import { inputRows, summaryRows } from '../../lib/symptom.js';
import useAsync from '../../lib/useAsync.js';

// 진단·검사는 한 건이거나 여러 건으로 옴
export const items = (x) => (x ? (Array.isArray(x) ? x : [x]) : []);
const POLL_MS = 2000;

export default function RecordDetail({ view }) {
  const { id } = useParams();
  const { data, error, loading, reload } = useAsync(() => getRecord(id), [id]);
  const [record, setRecord] = useState(null);
  useEffect(() => setRecord(data ?? null), [data]);
  const r = record;

  // 쉬운 설명을 만드는 중인 경우: 다 될 때까지 다시 받아 옴
  useEffect(() => {
    if (r?.easyStatus !== 'pending') return;
    const t = setTimeout(() => getRecord(id).then(setRecord, () => {}), POLL_MS);
    return () => clearTimeout(t);
  }, [r, id]);

  const symptom = r?.kind === 'symptom';
  return (
    <MobileShell>
      <PageHeader title={symptom ? '내 기록' : '진료 기록'} back="/app/home" />
      {loading && !r ? (
        <div className="flex flex-col gap-4 px-5 pt-2"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-11 w-1/2" /><Skeleton className="h-12 rounded-xl" /><Skeleton className="h-24" /></div>
      ) : error?.status === 404 ? (
        <StateView icon="document" title="기록을 찾을 수 없습니다" body="삭제됐거나 볼 수 없는 기록입니다." action={<Button size="md" className="px-8" to="/app/home" replace>목록으로</Button>} />
      ) : error ? (
        <ErrorView error={error} onRetry={reload} title="기록을 불러오지 못했습니다" />
      ) : !r ? null : symptom ? (
        <FadeIn key={view} className="flex flex-1 flex-col"><SymptomView r={r} view={view} onChange={setRecord} /></FadeIn>
      ) : (
        <FadeIn key={view} className="flex flex-1 flex-col"><VisitView r={r} view={view} onChange={setRecord} /></FadeIn>
      )}
    </MobileShell>
  );
}

const none = <span className="font-medium text-muted">받은 기록이 없습니다</span>;

// 진단·검사·처방 한 줄: 누르면 35/36/37 상세
function ItemRow({ label, r, type, list, text }) {
  if (!list.length) return <KV label={label} value={none} />;
  return list.map((x, i) => (
    <Link key={i} to={`/app/records/${r.id}/${type}/${i}`} className="flex items-center justify-between gap-3 text-[15px] leading-[22px]">
      <span className="shrink-0 text-sub">{i === 0 ? label : ''}</span>
      <span className="flex items-center gap-1 text-right font-semibold">{text(x)}<ChevronRight /></span>
    </Link>
  ));
}

function VisitView({ r, view, onChange }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  // 서버에 쉬운 설명 기능이 없는 경우: 탭 없이 원문 기록만 보여 줌
  const noEasy = r.easyStatus === 'unavailable';
  const easy = view === 'easy' && !noEasy;
  const pending = r.easyStatus === 'pending';

  // 04-b 연결된 기록 일부를 못 찾은 경우: 위쪽 주황 토스트
  useEffect(() => {
    if (easy && r.missingLinks) toast({ tone: 'warn', title: '연결된 기록 중 일부를 찾지 못했습니다', body: '이 진료에서 받은 기록만으로 설명했습니다.' });
  }, [easy, r.missingLinks, r.id, toast]);

  const regenerate = async () => {
    setBusy(true);
    try {
      onChange(await regenerateEasy(r.id));
    } catch (e) {
      toast({ tone: 'danger', title: '쉬운 설명을 다시 만들지 못했습니다', body: e.message, action: { label: '다시 시도', onClick: () => setConfirm(true) } });
    }
    setBusy(false);
    setConfirm(false);
  };

  return (
    <main className={`flex flex-1 flex-col px-5 pb-5 pt-2 ${easy ? 'gap-5' : 'gap-4'}`}>
      <div className="flex items-start gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          {r.external && <span className="text-[13px] font-semibold text-sub">다른 병원 기록</span>}
          <h1 className="text-[24px] font-semibold leading-8">{r.title}</h1>
          <p className="text-[15px] leading-[22px]">{looseFullDate(r.date)}<br />{r.clinic}</p>
          {easy && (r.author || !r.external) && (
            <p className="text-[13px] text-sub">
              {r.author ? `${r.author} 의사 작성` : `${specialtyName(r.specialty)} 기록`}
              {r.easyStatus === 'ready' && r.receivedAt && ` · ${monthDay(r.receivedAt)} ${time(r.receivedAt)}에 받음`}
            </p>
          )}
        </div>
        <Img name="document" size={40} />
      </div>

      {!noEasy && <Segmented value={view} options={[
        { value: 'easy', label: '쉬운 설명', to: `/app/records/${r.id}` },
        { value: 'original', label: '원문 기록', to: `/app/records/${r.id}/original` },
      ]} />}

      {easy ? (
        pending ? (
          <div className="flex flex-col gap-4" role="status">
            <div className="flex flex-col items-center gap-3 py-3">
              <Img name="ai" three size={64} />
              <span className="text-[16px] font-semibold">쉬운 설명을 만들고 있습니다</span>
            </div>
            <Skeleton className="h-4" /><Skeleton className="h-4" /><Skeleton className="h-4 w-2/3" />
            <Skeleton className="mt-3 h-4 w-1/3" />
            {[0, 1, 2].map((i) => <div key={i} className="flex justify-between"><Skeleton className="h-4 w-16" /><Skeleton className="h-4 w-24" /></div>)}
          </div>
        ) : r.easyStatus === 'failed' || !r.easy?.length ? (
          <StateView icon="ai" title="쉬운 설명을 만들지 못했습니다" body="원문 기록을 확인해 주세요."
            action={<Button size="md" className="px-8" to={`/app/records/${r.id}/original`} replace>원문 기록 보기</Button>} />
        ) : (
          <>
            <div className="text-[16px] leading-[26px] [text-wrap:pretty]">{r.easy.map((p) => <p key={p}>{p}</p>)}</div>
            {!r.missingLinks && (
              <div className="-mt-2 flex items-start justify-between gap-3">
                <p className="text-[13px] leading-[19px] text-sub">원문을 쉽게 풀어 쓴 설명입니다. 원문과 다른 내용이 있으면 원문을 기준으로 해 주세요.</p>
                <button type="button" onClick={() => setConfirm(true)} className="shrink-0 text-[13px] font-semibold leading-[19px] text-primary">다시 만들기</button>
              </div>
            )}
            <section className="flex flex-col gap-2.5">
              <h2 className="text-[15px] font-semibold">이번 진료 내용</h2>
              <ItemRow label="진단" r={r} type="diagnosis" list={items(r.diagnosis)} text={(x) => x.easy ?? x.original} />
              <ItemRow label="검사" r={r} type="test" list={items(r.test)} text={(x) => x.easy ?? x.original} />
              <ItemRow label="처방" r={r} type="prescription" list={items(r.prescription)} text={(x) => x.name} />
            </section>
            {(r.nextVisit || r.plan) && (
              <Link to="/app/schedule" className="flex flex-col gap-0.5 rounded-2xl bg-done px-5 py-4">
                <span className="text-[13px] font-semibold text-done-text">{r.nextVisit ? '다음 진료' : '진료 계획'}</span>
                <span className="text-[17px] font-semibold leading-6">
                  {r.nextVisit ? nextVisitText(r.nextVisit) : precision(r.plan.date) === 'month' ? `${yearMonth(r.plan.date)} ${r.plan.text}` : r.plan.text}
                </span>
                <span className="text-[13px] text-done-sub">예약은 병원에 한 번 더 확인해 주세요.</span>
              </Link>
            )}
          </>
        )
      ) : r.external ? (
        <ExternalOriginal r={r} />
      ) : (
        <>
          {r.note?.length ? (
            <div className="flex flex-col gap-1.5 rounded-[14px] bg-panel px-4 py-4">
              <span className="text-[13px] font-semibold text-sub">진료 내용</span>
              <div className="text-[15px] leading-[23px]">{r.note.map((l, i) => <p key={i}>{l}</p>)}</div>
            </div>
          ) : (
            <p className="rounded-[14px] bg-panel px-4 py-4 text-[15px] text-muted">진료 내용이 기록되지 않았습니다.</p>
          )}
          <section className="flex flex-col gap-2.5">
            <h2 className="text-[15px] font-semibold">진료 항목</h2>
            <ItemRow label="진단" r={r} type="diagnosis" list={items(r.diagnosis)} text={(x) => x.original} />
            <ItemRow label="검사" r={r} type="test" list={items(r.test)} text={(x) => x.original} />
            <ItemRow label="처방" r={r} type="prescription" list={items(r.prescription)} text={(x) => x.name} />
            <KV label="다음 진료" value={r.nextVisit ? looseFullDate(r.nextVisit) : <span className="font-medium text-muted">정하지 않았습니다</span>} />
          </section>
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <KV className="text-[14px] leading-[21px]" label="작성" value={r.author ? (specialtyName(r.specialty) ? `${r.author} (${specialtyName(r.specialty)})` : r.author) : `${specialtyName(r.specialty)} (의사 정보 없음)`} />
            {r.receivedAt && <KV className="text-[14px] leading-[21px]" label="받은 시각" value={fullDateTime(r.receivedAt)} />}
          </div>
        </>
      )}

      <Confirm open={confirm} title="쉬운 설명을 다시 만드시겠습니까?" body="지금 설명은 지우고 원문 기록으로 새로 만듭니다."
        ok="다시 만들기" loading={busy} onCancel={() => setConfirm(false)} onOk={regenerate} />
    </main>
  );
}

/* 05-b 다른 병원에서 받은 원문: 항목별 목록 */
function ExternalOriginal({ r }) {
  const group = (title, type, list, text) => (
    <section className="flex flex-col gap-2">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {list.length === 0 ? <p className="text-[15px] text-muted">받은 기록이 없습니다</p> : list.map((x, i) => (
        <Link key={i} to={`/app/records/${r.id}/${type}/${i}`} className="flex items-center justify-between gap-3 text-[15px] leading-[23px]">
          <span>{text(x)}</span><ChevronRight />
        </Link>
      ))}
    </section>
  );
  return (
    <>
      {group('진단', 'diagnosis', items(r.diagnosis), (x) => x.original)}
      {group('검사', 'test', items(r.test), (x) => x.original)}
      {group('처방', 'prescription', items(r.prescription), (x) => x.name)}
      {r.plan && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[15px] font-semibold">진료 계획</h2>
          <KV label={r.plan.text} value={r.plan.date ? looseFullDate(r.plan.date) : '날짜 미정'} className="text-[15px] leading-[23px] [&>span:first-child]:text-navy" />
        </section>
      )}
      {r.receivedAt && <div className="border-t border-line pt-4"><KV className="text-[14px] leading-[21px]" label="받은 시각" value={fullDateTime(r.receivedAt)} /></div>}
    </>
  );
}

/* 06 내 증상 기록: 요약 | 내가 쓴 내용 */
function SymptomView({ r, view, onChange }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const s = r.symptom;
  const summaryTab = view === 'easy';

  const remove = async () => {
    setBusy(true);
    try {
      await deleteSymptom(r.id);
      toast({ title: '증상 기록을 삭제했습니다' });
      navigate('/app/home', { replace: true });
    } catch (e) {
      setBusy(false);
      setConfirm(false);
      toast({ tone: 'danger', title: '삭제하지 못했습니다', body: e.message });
    }
  };
  // 요약 없이 저장한 기록은 여기서 요약을 만들 수 있음
  const summarize = async () => {
    setBusy(true);
    try {
      const summary = await summarizeSymptom(s);
      onChange(await updateSymptom(r.id, { summary }));
    } catch {
      toast({ tone: 'danger', title: '요약을 만들지 못했습니다', body: '잠시 뒤 다시 시도해 주세요.' });
    }
    setBusy(false);
  };

  return (
    <>
      <main className="flex flex-1 flex-col gap-5 px-5 pb-5 pt-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-sub">내 기록</span>
          <h1 className="text-[24px] font-semibold leading-8">{r.title}</h1>
          <p className="text-[13px] text-sub">{fullDateTime(r.date)} {r.source}</p>
        </div>
        <Segmented value={view} options={[
          { value: 'easy', label: '요약', to: `/app/records/${r.id}` },
          { value: 'original', label: '내가 쓴 내용', to: `/app/records/${r.id}/original` },
        ]} />
        {summaryTab ? (
          r.summary ? (
            <>
              <p className="text-[16px] leading-[26px] [text-wrap:pretty]">{r.summary.say}</p>
              <div className="flex flex-col gap-3 border-t border-line pt-4">{summaryRows(s, r.summary).map(([k, v]) => <KV key={k} label={k} value={v} />)}</div>
              <p className="text-[13px] text-sub">요약은 AI가 정리했습니다.</p>
            </>
          ) : (
            <StateView icon="ai" title="아직 요약이 없습니다" body="진료 때 보여주기 좋게 정리해 드립니다."
              action={<Button size="md" className="px-8" loading={busy} onClick={summarize}>요약 만들기</Button>} className="!py-6" />
          )
        ) : (
          <>
            <div className="flex flex-col gap-3">{inputRows(s).map(([k, v]) => <KV key={k} label={k} value={v} />)}</div>
            <div className="flex flex-col gap-2 border-t border-line pt-4">
              <span className="text-[14px] font-semibold text-sub">메모</span>
              <p className="text-[16px] leading-6">{s.memo || <span className="text-muted">메모가 없습니다</span>}</p>
            </div>
          </>
        )}
      </main>
      <BottomBar>
        <Button variant="secondary" className="w-[100px]" onClick={() => setConfirm(true)}>삭제</Button>
        <Button className="flex-1" to={summaryTab && r.summary ? `/app/symptoms/${r.id}/summary` : `/app/symptoms/${r.id}/edit`}>수정하기</Button>
      </BottomBar>
      <Confirm open={confirm} title="이 증상 기록을 삭제하시겠습니까?" body="삭제하면 되돌릴 수 없습니다. AI 요약과 처음 쓴 내용이 함께 지워집니다."
        ok="삭제" danger loading={busy} onCancel={() => setConfirm(false)} onOk={remove} />
    </>
  );
}
