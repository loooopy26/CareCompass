// 28 의사가 기록을 확인함 (70:2)
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { getShareGrant } from '../../api';
import { motion } from 'framer-motion';
import { Check } from '../../components/icons.jsx';
import { Button, CloseButton, ErrorView, FadeIn, InfoCard, MobileShell, PageHeader, SkeletonRows } from '../../components/ui';
import { fullDateTime } from '../../lib/format.js';
import useAsync from '../../lib/useAsync.js';

export default function ShareViewed() {
  const { grantId } = useParams();
  const navigate = useNavigate();
  const { data: g, error, loading, reload } = useAsync(() => getShareGrant(grantId), [grantId]);

  if (g && g.status !== 'opened') return <Navigate to={`/app/share/${grantId}`} replace />;

  return (
    <MobileShell>
      <PageHeader title="공유 QR" right={<CloseButton onClick={() => navigate('/app/home')} />} />
      {loading ? (
        <div className="px-6 pt-10"><SkeletonRows rows={3} /></div>
      ) : error ? (
        <ErrorView icon="qr" error={error} onRetry={reload} title="공유 정보를 불러오지 못했습니다" />
      ) : (
        <FadeIn className="flex flex-1 flex-col">
          <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 pb-8 pt-5 text-center">
            <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 14, delay: 0.1 }}
              className="flex size-16 items-center justify-center rounded-full bg-done"><Check size={34} /></motion.div>
            <h1 className="text-[24px] font-semibold leading-[34px]">{g.openedBy} 의사가<br />기록을 확인했습니다</h1>
            <p className="text-[16px] leading-[26px] text-sub">한 번 열린 QR이라 이제 쓸 수 없습니다.</p>
            <InfoCard className="mt-2 self-stretch px-5 py-4 text-left" rows={[
              ['확인한 시각', fullDateTime(g.openedAt)],
              ['공유한 기록', [g.visitCount && `진료 기록 ${g.visitCount}건`, g.symptomCount && `내 기록 ${g.symptomCount}건`].filter(Boolean).join(', ')],
              ['제외한 기록', g.excluded.join(', ') || '없음'],
            ]} />
          </main>
          <div className="flex flex-col gap-3 px-5 pb-7 pt-3">
            <Button to="/app/home" replace>홈으로</Button>
            <Button variant="secondary" to={`/app/shares/${grantId}`} replace>공유 내역</Button>
          </div>
        </FadeIn>
      )}
    </MobileShell>
  );
}
