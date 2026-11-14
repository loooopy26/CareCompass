// P8 볼 수 없는 기록 (100:2)
import { Img } from '../../components/icons.jsx';
import { Button } from '../../components/ui';
import { PcPage } from './Layout.jsx';

export default function Blocked() {
  return (
    <PcPage>
      <main className="flex flex-1 items-center justify-center">
        <div className="flex w-[480px] flex-col items-center gap-4 text-center">
          <Img name="lock" three size={72} />
          <h1 className="text-[28px] font-semibold leading-9">이 기록은 볼 수 없습니다</h1>
          <p className="text-[16px] leading-[26px] text-sub">공유 시간이 끝났거나 공유받지 않은 기록입니다.<br />환자에게 새 QR을 요청해 주세요.</p>
          <div className="mt-3 flex gap-3">
            <Button size="pc" variant="secondary" to="/clinician/patients" replace>받은 기록으로 돌아가기</Button>
            <Button size="pc" to="/clinician/scan" replace>QR 다시 확인</Button>
          </div>
        </div>
      </main>
    </PcPage>
  );
}
