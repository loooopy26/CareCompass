// A5 가입 완료 (6:2)
import { motion } from 'framer-motion';
import { Check } from '../../components/icons.jsx';
import { BottomBar, Button, MobileShell } from '../../components/ui';

export default function Welcome() {
  return (
    <MobileShell>
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <motion.span className="flex size-[88px] items-center justify-center rounded-full bg-done"
          initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 16 }}>
          <Check size={44} width={2.6} />
        </motion.span>
        <h1 className="mt-2 text-[24px] font-semibold leading-[30px]">가입을 마쳤습니다</h1>
        <p className="text-[15px] leading-[23px] text-sub">진료 기록은 관리자가 환자 정보를 연결한 뒤 볼 수 있습니다. 먼저 주변 병원을 찾아보세요.</p>
      </main>
      <BottomBar className="flex-col">
        <Button to="/app/clinics" replace>병원 찾기</Button>
        <Button variant="secondary" to="/app/home" replace>홈으로</Button>
      </BottomBar>
    </MobileShell>
  );
}
