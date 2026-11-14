// 24 공유 QR (68:2). 의사가 열면 28로 넘어감. 25 공유 취소 확인 (72:2), 26 시간 끝남 (74:2), 27 공유 취소함 (73:2), 43 QR 크게 보기 (69:2)
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { getShareGrant, now, revokeShareGrant, rotateShareGrant } from '../../api';
import { Img } from '../../components/icons.jsx';
import { Button, CloseButton, Confirm, ErrorView, InfoCard, MobileShell, PageHeader, Skeleton, useToast } from '../../components/ui';
import { fullDateTime, mss } from '../../lib/format.js';
import useWakeLock from '../../lib/useWakeLock.js';

const POLL_MS = 2000;
const ROTATE_MS = 30000; // 공유 중 QR을 새 토큰으로 바꾸는 간격 (캡처한 QR을 나중에 못 쓰게)

// QR 그림: 토큰이 바뀔 때마다 살짝 새로 그려지는 느낌으로
const LiveQr = ({ token, size }) => (
  <AnimatePresence mode="popLayout" initial={false}>
    <motion.div key={token} initial={{ opacity: 0.2, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
      <QRCodeSVG value={token} size={size} fgColor="#183b5b" title="공유 QR" />
    </motion.div>
  </AnimatePresence>
);

export default function ShareQr() {
  const { grantId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [grant, setGrant] = useState(null);
  const [error, setError] = useState(null);
  const [clock, setClock] = useState(now());
  const [confirm, setConfirm] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [big, setBig] = useState(false);

  // 의사가 열었는지 2초마다 확인 (GET /share-grants/{id})
  useEffect(() => {
    let alive = true;
    const load = () => getShareGrant(grantId).then(
      (g) => alive && (setGrant(g), setError(null)),
      (e) => alive && setError((prev) => prev ?? e),
    );
    load();
    const poll = setInterval(load, POLL_MS);
    const tick = setInterval(() => setClock(now()), 1000);
    return () => { alive = false; clearInterval(poll); clearInterval(tick); };
  }, [grantId]);

  useEffect(() => {
    if (grant?.status === 'opened') navigate(`/app/share/${grantId}/viewed`, { replace: true });
  }, [grant?.status, grantId, navigate]);

  const revoke = async () => {
    setRevoking(true);
    try {
      await revokeShareGrant(grantId);
      setGrant(await getShareGrant(grantId)); // 27 공유 취소함
      setRevoking(false);
      setConfirm(false);
    } catch (e) {
      setRevoking(false);
      setConfirm(false);
      toast({ tone: 'danger', title: '공유를 취소하지 못했습니다', body: e.message, action: { label: '다시 시도', onClick: () => setConfirm(true) } });
    }
  };

  const left = grant ? Math.max(0, Math.round((new Date(grant.expiresAt).getTime() - clock) / 1000)) : 0;
  const expired = grant && (grant.status === 'expired' || (grant.status === 'active' && left === 0));
  const count = grant ? grant.visitCount + grant.symptomCount : 0;
  const live = grant?.status === 'active' && !expired;

  // QR을 보여주는 동안 화면이 꺼지지 않음
  useWakeLock(live);

  // 30초마다 새 토큰으로 바꿈. 실패한 경우: 다음 차례에 다시 (상태는 2초 확인이 따로 챙김)
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => rotateShareGrant(grantId).then((r) => setGrant((g) => g && { ...g, ...r }), () => {}), ROTATE_MS);
    return () => clearInterval(id);
  }, [live, grantId]);

  return (
    <MobileShell>
      <PageHeader title="공유 QR" right={grant?.status === 'active' && !expired
        ? <CloseButton label="공유 취소" onClick={() => setConfirm(true)} />
        : <CloseButton onClick={() => navigate('/app/home')} />} />

      {!grant && error ? (
        <ErrorView icon="qr" title="공유 정보를 불러오지 못했습니다" error={error} onRetry={() => window.location.reload()} />
      ) : !grant ? (
        <div className="flex flex-col items-center gap-4 px-5 pt-6"><Skeleton className="h-7 w-2/3" /><Skeleton className="size-[200px] rounded-2xl" /></div>
      ) : expired || grant.status === 'revoked' ? (
        <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <Img name="qr" three size={88} />
          <div className="mt-2 text-[20px] font-semibold leading-7">{expired ? '공유 시간이 끝났습니다' : '공유를 취소했습니다'}</div>
          <div className="text-[15px] leading-[23px] text-sub">{expired ? `${grant.ttlMinutes}분이 지나 이 QR은 더 이상 쓸 수 없습니다.` : '이 QR로는 더 이상 기록을 볼 수 없습니다.'}</div>
          <InfoCard size="sm" className="mt-2 self-stretch text-left" rows={[
            [expired ? '끝난 시각' : '취소한 시각', fullDateTime(expired ? grant.expiresAt : grant.revokedAt)],
            ['공유하려던 기록', `기록 ${count}건`],
          ]} />
          {expired
            ? <Button className="mt-4 self-stretch" to="/app/share/select" state={{ recordIds: grant.recordIds, includeMedication: grant.includeMedication, ttlMinutes: grant.ttlMinutes }}>다시 공유하기</Button>
            : <Button className="mt-4 self-stretch" to="/app/share" replace>확인</Button>}
        </main>
      ) : (
        <>
          <main className="flex flex-1 flex-col items-center gap-4 px-5 pb-3 pt-2">
            <div className="flex flex-col gap-1 text-center">
              <h1 className="text-[20px] font-semibold leading-7">의사에게 이 QR을 보여주세요</h1>
              <p className="text-[14px] text-sub">로그인한 의료진만 열 수 있습니다</p>
            </div>
            <button type="button" onClick={() => setBig(true)} aria-label="QR 크게 보기" className="rounded-2xl bg-white p-3 shadow-[inset_0_0_0_1px_#e5eaf0] transition-transform active:scale-[0.98]">
              <LiveQr token={grant.qrToken} size={176} />
            </button>
            <p className="-mt-1 text-[13px] text-muted">보안을 위해 QR은 30초마다 바뀝니다</p>
            <p className="text-[14px] text-sub">공유 코드 <b className="tracking-[1px] text-navy">{grant.shareCode}</b></p>
            <div className="flex w-full flex-col items-center gap-2.5">
              <div className="text-[32px] font-semibold leading-10" role="timer" aria-live="off">
                {mss(left)}<span className="ml-1.5 text-[15px] font-medium text-sub">남았습니다</span>
              </div>
              <div className="h-2 w-full rounded bg-line">
                <div className="h-2 rounded bg-done-bar transition-[width] duration-1000 ease-linear" style={{ width: `${(left / (grant.ttlMinutes * 60)) * 100}%` }} />
              </div>
            </div>
          </main>
          <div className="flex flex-col gap-3 px-5 pb-7 pt-3">
            <Button variant="secondary" onClick={() => setConfirm(true)}>공유 취소</Button>
          </div>
        </>
      )}

      <Confirm open={confirm} title="공유를 취소하시겠습니까?" body="취소하면 이 QR로는 더 이상 기록을 볼 수 없습니다."
        cancel="계속 공유" ok="공유 취소" loading={revoking} onCancel={() => setConfirm(false)} onOk={revoke} />

      {/* 43 QR 크게 보기 */}
      <AnimatePresence>
        {big && grant?.status === 'active' && !expired && (
          <motion.div className="fixed inset-0 z-40 mx-auto flex max-w-[480px] flex-col bg-white" role="dialog" aria-modal="true" aria-label="QR 크게 보기"
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.2 }}>
            <PageHeader title="공유 QR" right={<CloseButton onClick={() => setBig(false)} />} />
            <main className="flex flex-1 flex-col items-center justify-center gap-5 px-5 pb-10">
              <LiveQr token={grant.qrToken} size={280} />
              <p className="text-[15px] text-sub">공유 코드 <b className="tracking-[1px] text-navy">{grant.shareCode}</b></p>
              <div className="text-[32px] font-semibold leading-10" role="timer" aria-live="off">{mss(left)}<span className="ml-1.5 text-[15px] font-medium text-sub">남았습니다</span></div>
              <p className="text-[14px] text-sub">화면 밝기를 높이면 더 잘 읽힙니다.</p>
            </main>
          </motion.div>
        )}
      </AnimatePresence>
    </MobileShell>
  );
}
