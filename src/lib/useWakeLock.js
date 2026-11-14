import { useEffect } from 'react';

// on인 동안 화면이 꺼지지 않음 (Screen Wake Lock API). 다른 앱에 갔다 오면 풀리므로 돌아올 때 다시 걸어 둠.
// 지원하지 않는 브라우저(일부 iOS 등): 아무 일도 하지 않음.
export default function useWakeLock(on) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return;
    let lock = null;
    let alive = true;
    const request = () => navigator.wakeLock.request('screen').then(
      (l) => (alive ? (lock = l) : l.release()),
      () => {}, // 배터리 절약 모드 등으로 거절된 경우: 그냥 둠
    );
    const onVisible = () => document.visibilityState === 'visible' && request();
    request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [on]);
}
