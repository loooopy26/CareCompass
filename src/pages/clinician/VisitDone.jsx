// P6 저장 완료 (98:2)
import { Navigate } from 'react-router-dom';
import { Check, Img } from '../../components/icons.jsx';
import { Button, KV } from '../../components/ui';
import { fullDateTime, nextVisitText } from '../../lib/format.js';
import { PcPage, useClinician } from './Layout.jsx';

export default function VisitDone() {
  const { saved: v } = useClinician();
  if (!v) return <Navigate to="/clinician/scan" replace />;

  return (
    <PcPage>
      <main className="flex flex-1 justify-center px-8 py-12">
        <div className="flex w-[640px] flex-col gap-5">
          <div className="flex items-center gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-done"><Check size={30} /></div>
            <div className="flex flex-col gap-0.5">
              <h1 className="text-[24px] font-semibold">{v.patient.name}님께 보냈습니다</h1>
              <span className="text-[14px] text-sub">{fullDateTime(v.savedAt)} 저장</span>
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl bg-white p-6">
            <h2 className="text-[17px] font-semibold">{v.title}</h2>
            <div className="text-[15px] leading-6">{v.note.split('\n').map((l) => <p key={l}>{l}</p>)}</div>
            {(v.diagnoses.length > 0 || v.tests.length > 0 || v.prescriptions.length > 0) && (
              <div className="flex flex-col gap-2 border-t border-line pt-4">
                {v.diagnoses.length > 0 && <KV label="진단" value={v.diagnoses.map((d) => d.name).join(', ')} />}
                {v.tests.length > 0 && <KV label="검사" value={v.tests.map((d) => d.name).join(', ')} />}
                {v.prescriptions.length > 0 && <KV label="처방" value={v.prescriptions.map((d) => d.name).join(', ')} />}
              </div>
            )}
          </div>

          {v.nextVisit && (
            <div className="flex items-center gap-4 rounded-2xl bg-done px-6 py-5">
              <Img name="calendar" size={44} />
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="text-[13px] font-semibold text-done-text">다음 진료</span>
                <span className="text-[17px] font-semibold">{nextVisitText(v.nextVisit)}</span>
              </div>
              <span className="text-[13px] text-done-sub">{v.showNextVisit ? '환자 앱에 보입니다' : '환자 앱에는 보이지 않습니다'}</span>
            </div>
          )}

          <div className="flex justify-end">
            <Button size="pc" variant="secondary" to="/clinician/patients">환자 목록으로</Button>
          </div>
        </div>
      </main>
    </PcPage>
  );
}
