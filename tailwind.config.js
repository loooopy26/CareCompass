/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Noto Sans KR"', 'sans-serif'] },
      // B1 브랜드와 컴포넌트 (Figma 103:2)
      colors: {
        primary: { DEFAULT: '#2479C8', dark: '#1D64A8', soft: '#E5F1FC', tint: '#F5F9FE', wash: '#DCEAF8' }, // 누르는 것
        navy: '#183B5B', // 글자, 선택한 칩
        done: { DEFAULT: '#E6F6D8', text: '#2F6B1E', sub: '#3D5A2C', icon: '#3F9E2F', bar: '#5FB33A' }, // 다음 진료, 완료
        field: '#F3F5F8', // 입력칸, 정보 묶음
        panel: '#F5F7FA', // 카드 안 정보 묶음
        chip: '#F1F4F7',
        page: '#F3F6F9', // 의료진 PC 바탕
        line: { DEFAULT: '#EEF1F5', strong: '#E5EAF0', bar: '#E9EDF2', card: '#E3E8F0', input: '#C9D6E3' },
        side: '#F7F9FB', // 의료진 왼쪽 목록
        scan: { frame: '#8ED46A', text: '#A8DD8A', link: '#9FD0FF' }, // P2 남색 판 위 글자
        warn: { DEFAULT: '#FFF6D9', text: '#5A4610' }, // 주의, 일부만 불러옴
        danger: { DEFAULT: '#FDECEC', text: '#9E2F2F' }, // 오류
        disabled: { DEFAULT: '#EDF0F3', text: '#8B97A3' },
        sub: '#52667A', // 보조 글자
        muted: '#627080', // 흐린 글자
        chevron: '#9AA7B4',
        radio: '#B5C2CF',
      },
    },
  },
  plugins: [],
};
