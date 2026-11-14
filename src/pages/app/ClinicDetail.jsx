// 21 병원 정보 (63:2)
import { useParams } from 'react-router-dom';
import { getClinic } from '../../api';
import { Img } from '../../components/icons.jsx';
import { Button, ErrorView, FadeIn, InfoCard, MobileShell, PageHeader, Skeleton, useToast } from '../../components/ui';
import useAsync from '../../lib/useAsync.js';
import { directionsUrl } from '../../lib/map.js';

export default function ClinicDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { data: c, error, loading, reload } = useAsync(() => getClinic(id), [id]);

  return (
    <MobileShell>
      <PageHeader title="병원 정보" back="/app/clinics" />
      {loading ? (
        <div className="flex flex-col gap-5 px-5 pt-3"><Skeleton className="h-8 w-3/4" /><Skeleton className="h-28 rounded-2xl" /></div>
      ) : error ? (
        <ErrorView icon="hospital" title={error.status === 404 ? '병원 정보를 찾지 못했습니다' : '병원 정보를 불러오지 못했습니다'} error={error} onRetry={error.status === 404 ? null : reload} />
      ) : (
        <FadeIn className="flex flex-1 flex-col">
          <main className="flex flex-1 flex-col gap-6 px-5 pb-5 pt-3">
            <div className="flex items-center gap-3">
              <h1 className="flex-1 text-[24px] font-semibold leading-8">{c.name}</h1>
              <Img name="hospital" size={40} />
            </div>
            {/* 서버가 전화번호를 주지 않는 경우: 전화 줄과 전화하기 버튼을 빼고 길찾기만 */}
            <InfoCard rows={[['주소', c.address ?? '주소 미확인'], ...(c.phone ? [['전화', c.phone]] : [])]} />
            <p className="text-[14px] leading-[21px] text-sub">{c.phone ? '진료 시간과 예약은 전화로 확인해 주세요.' : '진료 시간과 예약은 병원에 직접 확인해 주세요.'}</p>
          </main>
          <div className="flex flex-col gap-3 px-5 pb-7 pt-3">
            <Button to="/app/share/select" state={{ clinic: c.name }}>이 병원에 기록 공유하기</Button>
            <div className={c.phone ? 'grid grid-cols-2 gap-3' : 'flex flex-col'}>
              <Button variant="secondary" href={directionsUrl(c)} target="_blank" rel="noopener noreferrer" disabled={!directionsUrl(c)}>길찾기</Button>
              {c.phone && <Button variant="secondary" href={`tel:${c.phone}`} onClick={() => toast({ title: `${c.phone} 번호로 전화를 겁니다` })}>전화하기</Button>}
            </div>
          </div>
        </FadeIn>
      )}
    </MobileShell>
  );
}
