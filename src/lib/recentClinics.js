// 02 기록 필터의 "최근 찾은 병원": 최근에 고른 병원 4곳까지. 새로 고르면 맨 앞에 넣고, 넘치면 가장 먼저 고른 병원부터 빠짐 (큐).
// 이 기기에만 저장함 (localStorage). 저장소를 못 쓰는 경우(사생활 보호 모드 등): 이번 화면에서만 기억함.
export const MAX_RECENT = 4;
const KEY = 'cc-recent-clinics';

// 이미 있던 병원을 다시 고르면 맨 앞으로 옮김 (같은 병원이 두 번 들어가지 않게)
export const pushRecent = (list, name) => [name, ...list.filter((c) => c !== name)].slice(0, MAX_RECENT);

export function loadRecent() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((c) => typeof c === 'string').slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function saveRecent(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* 저장하지 못해도 화면은 그대로 동작 */ }
}
