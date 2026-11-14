// 콘텐츠가 한꺼번에 나타나지 않고 위에서부터 차례로 아래 → 위로 떠오르며 나타남.
// MobileShell·PcPage가 씀. 화면이 나올 때 한 번만: 처음 열릴 때 + 틀 바로 아래 블록이 통째로 바뀔 때(다음 단계·완료 화면처럼 새 화면).
// 화면 안에서 로딩이 끝나거나, 목록·상태가 갱신돼 끼어드는 블록은 움직이지 않음 (기다리는 동안 계속 떠오르지 않게).
// 블록 = 틀의 자식, <main>의 자식, data-reveal 묶음의 자식. 고정 위치(시트·대화상자), header·nav, data-no-reveal(자체 모션 목록)은 건너뜀.
import { useLayoutEffect } from 'react';
import { animate } from 'framer-motion';

// 하나씩 또렷하게 보이도록 천천히. 목록(ui.tsx Stagger)도 같은 값을 씀.
export const REVEAL = {
  step: 0.12, // 블록 사이 간격 (초): 앞 블록이 반쯤 올라왔을 때 다음 블록이 출발
  duration: 0.7, // 블록 하나가 올라오는 시간
  distance: 24, // 올라오는 거리 (px)
  maxDelay: 1.2, // 블록이 아주 많아도 마지막 블록이 이보다 늦게 출발하지 않음
  ease: [0.22, 1, 0.36, 1], // 빠르게 출발해서 부드럽게 멈춤
};

const isGroup = (el) => el.tagName === 'MAIN' || el.tagName === 'FORM' || el.hasAttribute('data-reveal');
const skip = (el) => el.tagName === 'HEADER' || el.tagName === 'NAV' || el.hasAttribute('data-no-reveal') || getComputedStyle(el).position === 'fixed';

function blocks(nodes) {
  return nodes.flatMap((el) => {
    if (el.nodeType !== 1 || skip(el)) return [];
    return isGroup(el) ? blocks([...el.children]) : [el];
  });
}

// 기기의 "움직임 줄이기"가 켜져 있는지. animate를 직접 부르므로 App의 MotionConfig가 닿지 않아 따로 확인함.
const reduced = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export function reveal(nodes) {
  if (reduced()) return; // 움직이지 않고 원래 모습 그대로 보임
  const els = blocks(nodes);
  if (!els.length) return;
  const { step, duration, distance, maxDelay, ease } = REVEAL;
  els.forEach((el, i) => animate(el, { opacity: [0, 1], y: [distance, 0] }, { duration, ease, delay: Math.min(i * step, maxDelay) }));
}

export function useReveal(ref) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    reveal([...root.children]); // 그리기 전에 시작해서 한 번 번쩍이지 않음
    const mo = new MutationObserver((muts) => {
      reveal(muts.flatMap((m) => [...m.addedNodes]).filter((n) => n.isConnected));
    });
    mo.observe(root, { childList: true }); // 틀 바로 아래만 봄
    return () => mo.disconnect();
  }, [ref]);
}
