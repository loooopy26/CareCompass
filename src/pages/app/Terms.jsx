// 32-a 서비스 이용약관 (79:2). 개인정보·건강 정보 문서도 같은 모양으로 보여줌.
import { useNavigate, useParams } from 'react-router-dom';
import { termById } from '../../lib/terms.js';
import { BottomBar, Button, MobileShell, PageHeader, StateView } from '../../components/ui';

export default function Terms() {
  const { id } = useParams();
  const navigate = useNavigate();
  const doc = termById(id);
  return (
    <MobileShell>
      <PageHeader title={doc?.title ?? '약관'} back="/app/login" />
      {!doc ? (
        <StateView icon="document" title="문서를 찾지 못했습니다" />
      ) : (
        <main className="flex flex-1 flex-col gap-5 px-5 pb-5 pt-2">
          {doc.sections.map(([h, p]) => (
            <section key={h} className="flex flex-col gap-1.5">
              <h2 className="text-[16px] font-semibold">{h}</h2>
              <p className="text-[15px] leading-[24px] text-sub">{p}</p>
            </section>
          ))}
        </main>
      )}
      <BottomBar><Button className="flex-1" onClick={() => navigate(-1)}>확인</Button></BottomBar>
    </MobileShell>
  );
}
