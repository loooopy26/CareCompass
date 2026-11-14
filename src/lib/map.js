// 네이버 지도 길찾기 주소 (주변 병원 검색과 같은 네이버로 통일). 좌표가 있는 경우: 그 위치 중심으로 병원 이름 검색, 주소만 있는 경우: 주소 검색, 둘 다 없는 경우: null
// shortcut: 출발 위치가 없어 바로 경로 대신 장소 검색을 엶. 사용자가 네이버에서 '길찾기'를 한 번 더 누름. 지역별 목록에도 출발 위치를 받게 되면 주변 병원 검색의 경로 링크로 바꿈
export function directionsUrl({ name, address, lat, lng }) {
  if (Number.isFinite(lat) && Number.isFinite(lng)) return `https://map.naver.com/p/search/${encodeURIComponent(name ?? '병원')}?c=${lng},${lat},17,0,0,0,dh`;
  if (address) return `https://map.naver.com/p/search/${encodeURIComponent(address)}`;
  return null;
}
