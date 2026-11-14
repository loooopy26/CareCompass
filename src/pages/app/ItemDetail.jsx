// 35 진단 상세 (24:2), 36 검사 결과 상세 (25:2), 37 처방 상세 (26:2)
import { useParams } from 'react-router-dom';
import { getRecord } from '../../api';
import RecordRow from '../../components/RecordRow.jsx';
import { ErrorView, FadeIn, InfoCard, MobileShell, PageHeader, Skeleton, StateView } from '../../components/ui';
import { looseFullDate } from '../../lib/format.js';
import useAsync from '../../lib/useAsync.js';
import { items } from './RecordDetail.jsx';

const TYPES = {
  diagnosis: { title: '진단', day: '진단한 날' },
  test: { title: '검사 결과', day: '검사한 날' },
  prescription: { title: '처방', day: '처방한 날' },
};

export default function ItemDetail() {
  const { id, type, index } = useParams();
  const t = TYPES[type];
  const { data: r, error, loading, reload } = useAsync(() => getRecord(id), [id]);
  const item = r && items(r[type])[Number(index)];

  return (
    <MobileShell>
      <PageHeader title={t?.title ?? '진료 항목'} back={`/app/records/${id}`} />
      {loading ? (
        <div className="flex flex-col gap-4 px-5 pt-2"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-24" /></div>
      ) : error && error.status !== 404 ? (
        <ErrorView error={error} onRetry={reload} title="기록을 불러오지 못했습니다" />
      ) : !t || !item ? (
        <StateView icon="document" title="기록을 찾을 수 없습니다" body="삭제됐거나 볼 수 없는 기록입니다." />
      ) : (
        <FadeIn className="flex flex-1 flex-col gap-5 px-5 pb-6 pt-2">
          <div className="flex flex-col gap-1">
            <h1 className="text-[24px] font-semibold leading-8">{type === 'prescription' ? item.name : item.original}</h1>
            {type === 'diagnosis' && item.status && <span className="text-[14px] font-semibold text-done-text">{item.status}</span>}
            {type !== 'prescription' && item.easy && item.easy !== item.original && <span className="text-[14px] text-sub">쉬운 말: {item.easy}</span>}
          </div>
          <InfoCard rows={[
            [t.day, looseFullDate(r.date)],
            ['병원', r.clinic],
            ...(type === 'diagnosis' && r.author ? [['진단한 의사', r.author]] : []),
            ...(type === 'prescription' && item.dose ? [['복용 방법', item.dose]] : []),
            ...(type === 'test' && item.result && !item.report ? [['결과', item.result]] : []),
          ]} />
          {type === 'test' && item.report && (
            <section className="flex flex-col gap-2">
              <h2 className="text-[15px] font-semibold">병원에서 받은 검사 보고서</h2>
              <p className="whitespace-pre-line rounded-[14px] bg-panel px-4 py-4 text-[15px] leading-[23px]">{item.report}</p>
            </section>
          )}
          <section className="flex flex-col">
            <h2 className="text-[15px] font-semibold">연결된 진료</h2>
            <RecordRow r={r} />
          </section>
        </FadeIn>
      )}
    </MobileShell>
  );
}
