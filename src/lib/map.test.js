import { describe, expect, it } from 'vitest';
import { directionsUrl } from './map.js';

describe('directionsUrl', () => {
  it('좌표가 있으면 그 위치 중심으로 네이버 지도에서 병원 검색', () => {
    expect(directionsUrl({ name: '가톨릭정형외과의원', address: '서울', lat: 37.51, lng: 127.03 }))
      .toBe(`https://map.naver.com/p/search/${encodeURIComponent('가톨릭정형외과의원')}?c=127.03,37.51,17,0,0,0,dh`);
  });

  it('좌표가 없으면 주소로 검색, 둘 다 없으면 null', () => {
    expect(directionsUrl({ name: 'A', address: '서울특별시 강남구 언주로 601', lat: null, lng: undefined }))
      .toBe(`https://map.naver.com/p/search/${encodeURIComponent('서울특별시 강남구 언주로 601')}`);
    expect(directionsUrl({ name: 'A', address: null })).toBeNull();
  });
});
