// P2 QR 확인 (87:2), P2-b QR 인식 실패 (89:2), P2-c 이미 사용된 QR (90:2).
// PC 카메라로 환자 앱의 공유 QR을 읽음. 카메라가 없거나 막혀 있는 경우: 공유 코드 입력(P2-a)으로 안내.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import jsQR from 'jsqr';
import { previewShareGrant } from '../../api';
import { Button, KV, Skeleton, useToast } from '../../components/ui';
import { birth, time } from '../../lib/format.js';
import { PcPage, useOpenShared } from './Layout.jsx';

const SCAN_MS = 250;
// 오류 코드 → 제목 (P2-c 이미 사용된 QR, 환자 화면에서 QR이 바뀐 뒤 예전 QR을 읽은 경우)
const ERROR_TITLE = { ALREADY_USED: '이미 사용된 QR입니다', ROTATED: 'QR이 바뀌었습니다' };
const ERROR_STATUS = { ALREADY_USED: '이미 사용된 QR', ROTATED: '바뀌기 전 QR' };
const FAIL_AFTER_MS = 20000; // 이만큼 비춰도 못 읽은 경우: P2-b

// 카메라 → <video> → 캔버스로 한 장씩 떠서 jsQR로 읽음
function useQrScanner(active, onRead, onFail, attempt) {
  const video = useRef(null);
  const [camera, setCamera] = useState('starting'); // starting | on | none | denied
  useEffect(() => {
    if (!active) return;
    let stream, timer, failTimer, stopped = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    (async () => {
      setCamera('starting');
      if (!navigator.mediaDevices?.getUserMedia) return setCamera('none');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false });
      } catch (e) {
        return setCamera(e.name === 'NotAllowedError' ? 'denied' : 'none');
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop());
      video.current.srcObject = stream;
      await video.current.play().catch(() => {});
      setCamera('on');
      failTimer = setTimeout(onFail, FAIL_AFTER_MS);
      timer = setInterval(() => {
        const v = video.current;
        if (!v || v.readyState < 2) return;
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        ctx.drawImage(v, 0, 0);
        const code = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
        if (code?.data) { clearInterval(timer); clearTimeout(failTimer); onRead(code.data.trim()); }
      }, SCAN_MS);
    })();
    return () => { stopped = true; clearInterval(timer); clearTimeout(failTimer); stream?.getTracks().forEach((t) => t.stop()); };
  }, [active, onRead, onFail, attempt]);
  return { video, camera };
}

export default function Scan() {
  const toast = useToast();
  const openShared = useOpenShared();
  const [token, setToken] = useState(null);
  const [failed, setFailed] = useState(false); // P2-b
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState({ data: null, error: null, loading: false });
  const [opening, setOpening] = useState(false);

  const onRead = useCallback((t) => setToken(t), []);
  const onFail = useCallback(() => setFailed(true), []);
  const { video, camera } = useQrScanner(!token && !failed, onRead, onFail, attempt);

  useEffect(() => {
    if (!token) return;
    setPreview({ data: null, error: null, loading: true });
    previewShareGrant({ qrToken: token }).then(
      (data) => setPreview({ data, error: null, loading: false }),
      // CareCompass QR이 아닌 경우(찾을 수 없음): 읽지 못한 것으로 봄
      (error) => (error.status === 404 ? (setToken(null), setFailed(true), setPreview({ data: null, error: null, loading: false })) : setPreview({ data: null, error, loading: false })),
    );
  }, [token]);

  const retry = () => { setToken(null); setFailed(false); setAttempt(attempt + 1); setPreview({ data: null, error: null, loading: false }); };
  const open = async () => {
    setOpening(true);
    try {
      await openShared({ qrToken: token });
    } catch (e) {
      setOpening(false);
      setPreview({ data: null, error: e, loading: false });
      toast({ tone: 'danger', title: '기록을 열지 못했습니다', body: e.message });
    }
  };

  const p = preview.data;
  const found = token && !preview.error;
  const bad = failed || preview.error;
  const frame = bad ? 'border-[#f08c8c]' : 'border-scan-frame';
  const status = failed ? 'QR을 읽지 못했습니다' : preview.error ? (ERROR_STATUS[preview.error.code] ?? 'QR을 열 수 없습니다')
    : found ? 'QR을 확인했습니다' : camera === 'on' ? 'QR을 화면에 비춰 주세요' : camera === 'starting' ? '카메라를 켜고 있습니다' : '카메라를 쓸 수 없습니다';

  return (
    <PcPage>
      <main className="flex flex-1 items-center justify-center gap-8 p-10">
        <div className="relative flex h-[520px] w-[440px] shrink-0 flex-col items-center justify-center gap-6 overflow-hidden rounded-3xl bg-navy">
          <div className="relative flex size-[240px] items-center justify-center overflow-hidden rounded-lg">
            <video ref={video} muted playsInline aria-label="카메라 화면" className={`absolute inset-0 size-full object-cover ${camera === 'on' && !found && !bad ? '' : 'opacity-0'}`} />
            {camera === 'on' && !found && !bad && <div className="cc-scanline" />}
            {['left-0 top-0 border-l-4 border-t-4 rounded-tl-[10px]', 'right-0 top-0 border-r-4 border-t-4 rounded-tr-[10px]',
              'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-[10px]', 'bottom-0 right-0 border-b-4 border-r-4 rounded-br-[10px]'].map((c) => (
              <span key={c} className={`absolute size-11 ${frame} ${c}`} />
            ))}
          </div>
          <div className={`text-[17px] font-semibold ${bad ? 'text-[#f5a3a3]' : 'text-scan-text'}`} role="status">{status}</div>
          <Link to="/clinician/code" className="text-[15px] font-semibold text-scan-link hover:underline">카메라가 없습니까? 공유 코드 입력</Link>
        </div>

        <div className="flex w-[440px] shrink-0 flex-col gap-6 rounded-3xl bg-white p-8">
          {failed ? (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-[14px] font-semibold text-sub">QR 확인</span>
                <h1 className="text-[24px] font-semibold leading-[34px]">QR을 읽지 못했습니다</h1>
              </div>
              <p className="text-[15px] leading-[23px] text-sub">QR 전체가 카메라에 보이도록 비춰 주세요. 계속 안 되면 공유 코드를 입력해 주세요.</p>
              <div className="flex gap-2.5">
                <Button size="pc" className="flex-1" onClick={retry}>다시 읽기</Button>
                <Button size="pc" variant="secondary" className="flex-1" to="/clinician/code">공유 코드 입력</Button>
              </div>
            </>
          ) : preview.error ? (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-[14px] font-semibold text-sub">QR 확인</span>
                <h1 className="text-[24px] font-semibold leading-[34px]">{ERROR_TITLE[preview.error.code] ?? 'QR을 열 수 없습니다'}</h1>
              </div>
              <p className="text-[15px] leading-[23px] text-sub">{preview.error.message}</p>
              <Button size="md" onClick={retry}>{preview.error.code === 'ROTATED' ? '다시 읽기' : '다른 QR 확인'}</Button>
            </>
          ) : token ? (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-[14px] font-semibold text-sub">공유 요청</span>
                <h1 className="text-[24px] font-semibold leading-[34px]">{p ? `${p.patient.name}님이 기록을 공유했습니다` : <Skeleton className="h-[34px] w-3/4" />}</h1>
              </div>
              {p ? (
                <div className="flex flex-col gap-4">
                  <KV label="환자" value={`${p.patient.name} (${birth(p.patient.birth)})`} />
                  <KV label="받은 기록" value={[p.visitCount && `진료 기록 ${p.visitCount}건`, p.symptomCount && `증상 기록 ${p.symptomCount}건`].filter(Boolean).join(', ')} />
                  <KV label="제외된 정보" value={p.excluded.join(', ') || '없음'} />
                  <KV label="볼 수 있는 시간" value={`${time(p.expiresAt)}까지 한 번 볼 수 있습니다`} />
                </div>
              ) : (
                <div className="flex flex-col gap-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[22px]" />)}</div>
              )}
              <Button size="md" className="mt-1" disabled={!p} loading={opening} onClick={open}>기록 열기</Button>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-[14px] font-semibold text-sub">공유 요청</span>
                <h1 className="text-[24px] font-semibold leading-[34px]">{camera === 'denied' ? '카메라 사용을 허용해 주세요' : camera === 'none' ? '카메라를 찾지 못했습니다' : 'QR을 기다리고 있습니다'}</h1>
              </div>
              <p className="text-[15px] leading-[23px] text-sub">
                {camera === 'denied' ? '브라우저 주소창의 카메라 아이콘에서 허용으로 바꾼 뒤 다시 읽어 주세요. 카메라 없이도 공유 코드로 열 수 있습니다.'
                  : camera === 'none' ? '이 PC에 연결된 카메라가 없습니다. 환자 앱의 공유 QR 아래에 있는 8자리 코드를 입력해 주세요.'
                  : '환자 앱의 공유 QR을 카메라에 비춰 주세요. 카메라가 없으면 QR 아래의 공유 코드를 입력해 주세요.'}
              </p>
              <div className="flex gap-2.5">
                {(camera === 'denied' || camera === 'none') && <Button size="pc" className="flex-1" onClick={retry}>다시 읽기</Button>}
                <Button size="pc" variant="secondary" className="flex-1" to="/clinician/code">공유 코드 입력</Button>
              </div>
            </>
          )}
        </div>
      </main>
    </PcPage>
  );
}
