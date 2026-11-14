// P3 공유받은 기록 (92:2), P3-c AI 요약 탭 (93:2), P3-d 진료 기록 상세 (244:720), P3-b 다른 병원 기록 (94:2)
import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { now } from '../../api';
import { Clock, Plus, Search } from '../../components/icons.jsx';
import { Segmented } from '../../components/ui';
import { birth, fullDateTime, looseDate, looseFullDate, monthDay, mmss, nextVisitText, time } from '../../lib/format.js';
import { clinicianRows, shortSummaryRows } from '../../lib/symptom.js';
import { items } from '../app/RecordDetail.jsx';
import { PcPage, useClinician } from './Layout.jsx';

// 열람 시간이 남았는지 1초마다 확인
export function useShareTimeLeft() {
  const { shared } = useClinician();
  const [clock, setClock] = useState(now());
  useEffect(() => {
    const id = setInterval(() => setClock(now()), 1000);
    return () => clearInterval(id);
  }, []);
  return shared ? Math.max(0, Math.round((new Date(shared.expiresAt).getTime() - clock) / 1000)) : 0;
}

// 환자 기록(증상)을 먼저, 그다음 진료 기록
const ordered = (records) => [...records].sort((a, b) => (a.kind === 'visit') - (b.kind === 'visit'));

export function SharedRecordsIndex() {
  const { shared } = useClinician();
  const left = useShareTimeLeft();
  if (!shared || left === 0 || !shared.records.length) return <Navigate to="/clinician/blocked" replace />;
  return <Navigate to={`/clinician/records/${ordered(shared.records)[0].id}`} replace />;
}

export default function SharedRecords({ view }) {
  const { recordId } = useParams();
  const { shared } = useClinician();
  const left = useShareTimeLeft();
  const [query, setQuery] = useState('');

  if (!shared || left === 0) return <Navigate to="/clinician/blocked" replace />;
  const record = shared.records.find((r) => r.id === recordId);
  if (!record) return <Navigate to="/clinician/blocked" replace />;
  if (record.kind === 'visit' && view === 'ai') return <Navigate to={`/clinician/records/${record.id}`} replace />;

  const p = shared.patient;
  const showPatient = p.name.includes(query.trim());

  return (
    <PcPage>
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[280px] shrink-0 flex-col gap-4 border-r border-line-bar bg-side px-4 py-6">
          <h2 className="px-1 text-[15px] font-semibold">공유받은 환자</h2>
          <label className="flex h-11 items-center gap-2 rounded-[10px] bg-white px-3 shadow-[inset_0_0_0_1px_#e5eaf0] focus-within:shadow-[inset_0_0_0_1.5px_#2479c8]">
            <Search />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="이름 검색" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted" />
          </label>
          {showPatient ? (
            <div className="flex flex-col gap-1 rounded-xl bg-primary-soft p-4">
              <div className="flex items-center justify-between">
                <span className="text-[16px] font-semibold">{p.name}</span>
                <span className="text-[13px] font-semibold text-primary-dark" role="timer">{mmss(left)} 남았습니다</span>
              </div>
              <span className="text-[13px] text-sub">{birth(p.birth)}</span>
            </div>
          ) : (
            <p className="px-1 text-[14px] text-sub">찾는 환자가 없습니다</p>
          )}
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-5 px-8 py-7">
          <div className="flex items-end justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-[28px] font-semibold leading-9">{p.name}</h1>
              <span className="text-[14px] text-sub">{birth(p.birth)}</span>
            </div>
            <Link to="/clinician/visit/new" className="flex h-12 items-center gap-2 rounded-xl bg-primary px-5 text-[15px] font-semibold text-white hover:bg-primary-dark">
              <Plus />진료 기록 쓰기
            </Link>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-panel px-5 py-4 text-[14px] text-sub shadow-[inset_0_0_0_1px_#e5eaf0]">
            <Clock />
            <span className="flex-1">
              {time(shared.expiresAt)}까지 한 번 볼 수 있습니다.{shared.excluded.length > 0 && ` ${shared.excluded.join(', ')} 정보는 받지 않았습니다.`}
            </span>
          </div>

          <div className="grid min-h-[540px] flex-1 grid-cols-[320px_minmax(0,1fr)] gap-5">
            <section className="flex flex-col gap-3 rounded-2xl bg-white p-5">
              <h2 className="text-[15px] font-semibold">받은 기록 {shared.records.length}건</h2>
              {ordered(shared.records).map((r) => {
                const on = r.id === record.id;
                return (
                  <Link key={r.id} to={`/clinician/records/${r.id}`} replace
                    className={`flex flex-col gap-1 rounded-xl border-[1.5px] p-4 ${on ? 'border-primary bg-primary-tint' : 'border-line-card bg-white hover:border-line-input'}`}>
                    <span className="text-[13px] font-semibold text-sub">{r.kind === 'symptom' ? '환자 기록' : r.external ? '다른 병원 기록' : '진료 기록'}</span>
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="text-[16px] font-semibold">{r.title}</span>
                      <span className="shrink-0 text-[13px] text-sub">{r.kind === 'symptom' ? `${monthDay(r.date)} ${time(r.date)}` : looseDate(r.date)}</span>
                    </span>
                    <span className="text-[13px] text-sub">{r.kind === 'symptom' ? r.source : r.clinic}</span>
                  </Link>
                );
              })}
            </section>

            <section className="flex min-w-0 flex-col gap-4 rounded-2xl bg-white p-6">
              {record.kind === 'symptom' ? <SymptomPanel r={record} view={view} /> : <VisitPanel r={record} includeMedication={shared.includeMedication} />}
            </section>
          </div>
        </main>
      </div>
    </PcPage>
  );
}

const Tile = ({ label, value }) => (
  <div className="flex flex-col gap-1 rounded-xl bg-panel p-4">
    <span className="text-[13px] text-sub">{label}</span>
    <span className="text-[16px] font-semibold">{value}</span>
  </div>
);

const Block = ({ label, children, muted }) => (
  <div className="flex flex-col gap-2">
    <span className="text-[14px] font-semibold text-sub">{label}</span>
    <div className={`text-[16px] leading-6 ${muted ? 'text-sub' : ''}`}>{children}</div>
  </div>
);

function SymptomPanel({ r, view }) {
  const s = r.symptom;
  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[20px] font-semibold">{r.title}</h2>
        <Segmented size="sm" className="w-[280px]" value={view} options={[
          { value: 'original', label: '환자 원문', to: `/clinician/records/${r.id}` },
          { value: 'ai', label: 'AI 요약', to: `/clinician/records/${r.id}/ai` },
        ]} />
      </div>
      {view === 'ai' ? (
        r.summary ? (
          <>
            <div className="flex flex-col gap-2 rounded-[14px] bg-primary-soft px-5 py-5">
              <span className="text-[13px] font-semibold text-primary-dark">환자가 진료 때 할 말</span>
              <p className="text-[17px] font-semibold leading-7">“{r.summary.say}”</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {shortSummaryRows(s, r.summary).map(([k, v]) => <Tile key={k} label={k} value={v} />)}
            </div>
            <p className="text-[13px] text-sub">AI가 환자 원문을 정리했습니다. 의사가 확인한 내용은 아닙니다.</p>
          </>
        ) : (
          <p className="rounded-[14px] bg-panel px-5 py-5 text-[15px] text-sub">환자가 AI 요약 없이 저장한 기록입니다. 환자 원문을 확인해 주세요.</p>
        )
      ) : (
        <>
          <div className="grid grid-cols-4 gap-3">
            {clinicianRows(s).map(([k, v]) => <Tile key={k} label={k} value={v} />)}
          </div>
          <Block label="환자 메모">{s.memo ? `“${s.memo}”` : <span className="text-muted">쓴 메모가 없습니다</span>}</Block>
          <Block label="주로 아픈 때">{s.when || <span className="text-muted">고르지 않았습니다</span>}</Block>
        </>
      )}
    </>
  );
}

const MED_HIDDEN = '환자가 처방 정보를 공유하지 않았습니다';

function VisitPanel({ r, includeMedication }) {
  const names = (x, f) => items(x).map(f).join(', ');
  const meds = !includeMedication ? MED_HIDDEN : items(r.prescription).length ? names(r.prescription, (x) => (x.dose ? `${x.name} (${x.dose})` : x.name)) : '처방이 없습니다';
  if (r.external) {
    return (
      <>
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-semibold text-sub">다른 병원 기록</span>
          <h2 className="text-[20px] font-semibold">{r.title}</h2>
          <span className="text-[14px] text-sub">{looseFullDate(r.date)}  {r.clinic}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Tile label="진단" value={names(r.diagnosis, (x) => x.original) || '받은 기록 없음'} />
          <Tile label="검사" value={names(r.test, (x) => x.original) || '받은 기록 없음'} />
          <Tile label="처방" value={<span className={!includeMedication ? 'font-medium text-sub' : ''}>{meds}</span>} />
          <Tile label="진료 계획" value={r.plan ? <span className="flex justify-between gap-2"><span>{r.plan.text}</span><span>{r.plan.date ? looseFullDate(r.plan.date) : '날짜 미정'}</span></span> : '진료 계획이 없습니다'} />
        </div>
        {r.receivedAt && <p className="text-[13px] text-sub">받은 시각 <b className="text-navy">{fullDateTime(r.receivedAt)}</b></p>}
      </>
    );
  }
  return (
    <>
      <div className="flex flex-col">
        <h2 className="text-[20px] font-semibold">{r.title}</h2>
        <span className="text-[13px] text-sub">{r.clinic} · {r.author ? `${r.author} 의사 작성` : '작성 의사 정보 없음'} · 원문</span>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <Tile label="진료일" value={looseDate(r.date)} />
        <Tile label="진단" value={names(r.diagnosis, (x) => x.original) || '없음'} />
        <Tile label="검사" value={names(r.test, (x) => x.original) || '없음'} />
        <Tile label="다음 진료" value={r.nextVisit ? nextVisitText(r.nextVisit, { weekday: false }) : '미정'} />
      </div>
      <Block label="진료 내용">{r.note?.length ? r.note.map((l, i) => <p key={i}>{l}</p>) : <span className="text-muted">진료 내용은 받지 않았습니다</span>}</Block>
      {items(r.test).some((t) => t.result) && <Block label="검사 결과">{items(r.test).filter((t) => t.result).map((t) => <p key={t.original}>{t.original}: {t.result}</p>)}</Block>}
      <Block label="처방" muted={!includeMedication || !items(r.prescription).length}>{meds}</Block>
    </>
  );
}
