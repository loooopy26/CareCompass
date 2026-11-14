// 22 공유 (64:2): 공유 탭 첫 화면 + 공유 내역, 42 공유 내역 상세 (65:2)
import { Link, useParams } from 'react-router-dom';
import { getShareGrant, getShareGrants } from '../../api';
import { Img } from '../../components/icons.jsx';
import RecordRow from '../../components/RecordRow.jsx';
import { BottomBar, Button, ErrorView, FadeIn, InfoCard, MobileShell, PageHeader, Skeleton, SkeletonRows, Stagger, StaggerItem, TabBar, usePaged } from '../../components/ui';
import { fullDateTime, monthDay, specialtyName, time } from '../../lib/format.js';
import useAsync from '../../lib/useAsync.js';

// 공유 상태 글자 (B1 상태 글자: 확인했습니다는 연두)
export const GRANT_STATUS = {
  active: { label: '공유 중', cls: 'text-primary' },
  opened: { label: '확인했습니다', cls: 'text-done-text' },
  expired: { label: '시간이 끝났습니다', cls: 'text-sub' },
  revoked: { label: '취소했습니다', cls: 'text-sub' },
};

// "증상 기록 1건", "치과 기록 1건", "기록 3건"
export function grantTitle(g) {
  const recs = g.records ?? [];
  if (recs.length && recs.every((r) => r.kind === 'symptom')) return `증상 기록 ${recs.length}건`;
  const specs = [...new Set(recs.map((r) => r.specialty))];
  if (specs.length === 1 && recs.every((r) => r.kind === 'visit')) return `${specialtyName(specs[0])} 기록 ${recs.length}건`;
  return `기록 ${recs.length || g.visitCount + g.symptomCount}건`;
}
const grantSub = (g) => (g.status === 'opened' ? `${g.openedBy} 의사가 ${time(g.openedAt)}에 확인했습니다` : g.status === 'active' ? `${time(g.expiresAt)}까지 볼 수 있습니다` : g.status === 'revoked' ? '공유를 취소했습니다' : '아무도 확인하지 않았습니다');

export default function Share() {
  const { data, error, loading, reload } = useAsync(getShareGrants);
  const [shown, more] = usePaged(data ?? []);
  return (
    <MobileShell>
      <PageHeader title="공유" size="lg" />
      <main className="flex flex-1 flex-col gap-6 px-5 pb-6 pt-2">
        <div className="flex flex-col gap-4 rounded-[20px] bg-primary-soft p-5">
          <div className="flex items-start gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <h1 className="text-[20px] font-semibold leading-7">QR로 기록 공유하기</h1>
              <p className="text-[14px] leading-[21px] text-sub">고른 기록만, 정해진 시간 동안 의료진이 볼 수 있습니다.</p>
            </div>
            <Img name="qr" size={40} />
          </div>
          <Button size="md" to="/app/share/select">기록 고르기</Button>
        </div>

        <section className="flex flex-col">
          <h2 className="pb-1 text-[17px] font-semibold">공유 내역</h2>
          {loading ? <SkeletonRows rows={2} right={false} /> : error ? (
            <ErrorView error={error} onRetry={reload} title="공유 내역을 불러오지 못했습니다" />
          ) : data.length === 0 ? (
            <p className="py-4 text-[14px] text-sub">아직 공유한 기록이 없습니다.</p>
          ) : (
            <Stagger className="flex flex-col">
              {shown.map((g) => {
                const s = GRANT_STATUS[g.status];
                return (
                  <StaggerItem key={g.grantId ?? g.id}>
                    <Link to={g.status === 'active' ? `/app/share/${g.id}` : `/app/shares/${g.id}`} className="flex flex-col gap-1 border-b border-line py-4">
                      <span className="flex justify-between text-[13px]">
                        <span className="text-sub">{monthDay(g.createdAt)} {time(g.createdAt)}</span>
                        <span className={`font-semibold ${s.cls}`}>{s.label}</span>
                      </span>
                      <span className="text-[17px] font-semibold">{grantTitle(g)}</span>
                      <span className="text-[13px] text-sub">{grantSub(g)}</span>
                    </Link>
                  </StaggerItem>
                );
              })}
              {more}
            </Stagger>
          )}
        </section>
      </main>
      <TabBar active="share" />
    </MobileShell>
  );
}

/* 42 공유 내역 상세 */
export function ShareHistory() {
  const { grantId } = useParams();
  const { data: g, error, loading, reload } = useAsync(() => getShareGrant(grantId), [grantId]);
  const s = g && GRANT_STATUS[g.status];
  return (
    <MobileShell>
      <PageHeader title="공유 내역" back="/app/share" />
      {loading ? (
        <div className="flex flex-col gap-4 px-5 pt-2"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-40" /></div>
      ) : error ? (
        <ErrorView icon="qr" error={error} onRetry={reload} title="공유 내역을 불러오지 못했습니다" />
      ) : (
        <FadeIn className="flex flex-1 flex-col">
          <main className="flex flex-1 flex-col gap-5 px-5 pb-5 pt-2">
            <div className="flex flex-col gap-1">
              <h1 className="text-[24px] font-semibold leading-8">{grantTitle(g)}</h1>
              <span className={`text-[14px] font-semibold ${s.cls}`}>{s.label}</span>
            </div>
            <InfoCard rows={[
              ['공유한 시각', fullDateTime(g.createdAt)],
              ...(g.status === 'opened' ? [['확인한 의사', `${g.openedBy} 의사`], ['확인한 시각', fullDateTime(g.openedAt)]] : []),
              ...(g.status === 'revoked' ? [['취소한 시각', fullDateTime(g.revokedAt)]] : []),
              ...(g.status === 'expired' ? [['끝난 시각', fullDateTime(g.expiresAt)]] : []),
              ['공유 조건', `${g.ttlMinutes}분 동안 한 번만`],
              ['민감한 정보', g.includeMedication ? '처방받은 약도 공유했습니다' : '공유하지 않았습니다'],
            ]} />
            <section className="flex flex-col">
              <h2 className="text-[15px] font-semibold">공유한 기록</h2>
              {g.records.length === 0 ? <p className="py-3 text-[14px] text-sub">삭제됐거나 더 이상 볼 수 없는 기록입니다.</p> : g.records.map((r) => <RecordRow key={r.id} r={r} />)}
            </section>
          </main>
          <BottomBar>
            <Button variant="secondary" className="flex-1" to="/app/share/select" state={{ recordIds: g.recordIds, includeMedication: g.includeMedication, ttlMinutes: g.ttlMinutes }}>같은 기록 다시 공유하기</Button>
          </BottomBar>
        </FadeIn>
      )}
    </MobileShell>
  );
}
