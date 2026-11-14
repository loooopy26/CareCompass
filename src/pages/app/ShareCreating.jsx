// 24-a QR 만드는 중 (67:2). 실패한 경우: 24-b 문구.
import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { createShareGrant, revokeShareGrant } from '../../api';
import { Img } from '../../components/icons.jsx';
import { Button, CloseButton, MobileShell, PageHeader } from '../../components/ui';

export default function ShareCreating() {
  const navigate = useNavigate();
  const { state: request } = useLocation();
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const started = useRef(-1); // StrictMode에서 두 번 만들지 않음

  const alive = useRef(true); // 화면에 떠 있는 동안만 true (StrictMode의 가짜 언마운트 뒤에는 다시 true)

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    if (!request || started.current === attempt) return;
    started.current = attempt;
    setError(null);
    createShareGrant(request).then(
      (g) => {
        if (alive.current) navigate(`/app/share/${g.grantId}`, { replace: true });
        else revokeShareGrant(g.grantId).catch(() => {}); // 떠난 뒤 만들어진 공유는 바로 취소
      },
      (e) => { if (alive.current) setError(e); },
    );
  }, [request, attempt, navigate]);

  if (!request) return <Navigate to="/app/share/select" replace />;

  return (
    <MobileShell>
      <PageHeader title="공유 QR" right={<CloseButton label="만들기 취소" onClick={() => navigate(-1)} />} />
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 pb-10 pt-2 text-center">
        {error ? (
          <>
            <Img name="qr" three size={88} />
            <div className="mt-2 text-[20px] font-semibold leading-7">QR을 만들지 못했습니다</div>
            <div className="text-[15px] leading-[23px] text-sub">{error.message}</div>
            <div className="mt-4 flex w-full flex-col gap-3">
              <Button onClick={() => setAttempt(attempt + 1)}>다시 시도</Button>
              <Button variant="secondary" onClick={() => navigate(-1)}>기록 다시 고르기</Button>
            </div>
          </>
        ) : (
          <>
            <div className="relative flex size-[200px] items-center justify-center overflow-hidden rounded-2xl bg-panel shadow-[inset_0_0_0_1px_#e5eaf0]">
              <img src="/assets/icons-3d/qr.svg" alt="" width="88" height="88" className="cc-qr" />
              <div className="cc-scanline" />
            </div>
            <div className="mt-2 text-[20px] font-semibold leading-7" role="status">QR을 만들고 있습니다</div>
          </>
        )}
      </main>
    </MobileShell>
  );
}
