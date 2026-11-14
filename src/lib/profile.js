import { phoneText } from './format.js';
// 저장된 내 정보 → 프로필 수정 폼 값. 비어 있는 값(null): 빈 글자
export const profileForm = (s) => ({
  name: s.name ?? '', birthdate: s.birth ?? '', phone: phoneText(s.phone), gender: s.gender ?? '',
  height: s.height == null ? '' : String(s.height), weight: s.weight == null ? '' : String(s.weight),
  conditions: s.conditions ?? '', medications: s.medications ?? '',
});

// 프로필 수정 폼이 저장된 값과 달라졌는지 확인 (폼에 있는 칸만, 앞뒤 공백은 무시)
export const isProfileChanged = (form, saved) => {
  const s = profileForm(saved);
  return Object.keys(form).some((k) => String(form[k]).trim() !== s[k]);
};
