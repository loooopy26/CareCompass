// 20 병원 찾기 (59:2), 20-a 지역 선택 (60:2), 20-b 검색 결과 없음 (61:2), 20-c 불러오기 실패 (62:2)
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getClinics } from '../../api';
import { Check, ChevronDown, ChevronRight, Pin } from '../../components/icons.jsx';
import { Button, Chips, CloseButton, ErrorView, MobileShell, PageHeader, SkeletonRows, Stagger, StaggerItem, StateView, TabBar, TextButton, useToast } from '../../components/ui';
import useAsync from '../../lib/useAsync.js';
import { SPECIALTIES as ALL } from '../../lib/format.js';
import { SIDO } from '../../lib/backendMap.js';
import NearbyClinics from './NearbyClinics.jsx';

const SPECIALTIES = [{ value: '', label: '전체' }, ...ALL.map(([value, label]) => ({ value, label }))];
const PAGE = 10;

export default function Clinics() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [area, setArea] = useState('서울'); // 시·도. 서버 병원 검색이 시·군·구를 받지 않음
  const [specialty, setSpecialty] = useState('05');
  const [shown, setShown] = useState(PAGE);
  const [nearby, setNearby] = useState(false);
  const areaName = area;
  const sheetOpen = params.get('sheet') === 'area';
  const clinics = useAsync(() => getClinics({ area: areaName, specialty }), [areaName, specialty]);
  const more = () => { const n = shown + PAGE; setShown(n); if (n >= clinics.data.length) toast({ title: '모든 병원을 불러왔습니다' }); };

  return (
    <MobileShell>
      <PageHeader title="병원 찾기" size="lg" />
      <main className="flex flex-1 flex-col gap-4 px-5 pt-2">
        <Chips size="lg" options={[
          { value: 'browse', label: '지역별 병원' },
          { value: 'nearby', label: '주변 병원 검색' },
        ]} value={nearby ? 'nearby' : 'browse'} onChange={(value) => setNearby(value === 'nearby')} />
        {nearby ? <NearbyClinics /> : <>
          <div className="flex flex-col gap-2">
            <span className="text-[14px] font-semibold text-sub">지역</span>
            <button type="button" onClick={() => setParams({ sheet: 'area' })} className="flex h-[52px] items-center gap-2.5 rounded-xl bg-field px-4 text-left text-[16px]">
              <Pin /><span className="flex-1">{areaName}</span><ChevronDown size={20} color="#52667a" width={2} />
            </button>
          </div>
          <Chips size="lg" options={SPECIALTIES} value={specialty} onChange={(v) => { setSpecialty(v); setShown(PAGE); }} />
          <p className="text-[13px] leading-[19px] text-sub">진료 시간과 예약은 병원에 직접 확인해 주세요.</p>

          {clinics.loading ? (
            <SkeletonRows rows={3} right={false} />
          ) : clinics.error ? (
            <ErrorView icon="hospital" title="병원 목록을 불러오지 못했습니다" error={{ message: '잠시 뒤 다시 시도해 주세요.' }} onRetry={clinics.reload} />
          ) : clinics.data.length === 0 ? (
            <StateView icon="search" title="조건에 맞는 병원을 찾지 못했습니다" body="지역이나 진료과를 바꿔 보세요."
              action={<TextButton onClick={() => setParams({ sheet: 'area' })}>지역 바꾸기</TextButton>} />
          ) : (
            <>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[16px] font-semibold">{SPECIALTIES.find((s) => s.value === specialty).label}</span>
                <span className="text-[13px] font-medium text-sub">이름순</span>
              </div>
              <Stagger className="-mt-1.5 flex flex-col">
                {clinics.data.slice(0, shown).map((c) => (
                  <StaggerItem key={c.id}><Link to={`/app/clinics/${encodeURIComponent(c.id)}`} className="flex items-center gap-3 border-b border-line py-4">
                    <span className="flex flex-1 flex-col gap-1">
                      <span className="text-[17px] font-semibold">{c.name}</span>
                      <span className="text-[13px] text-sub">{c.address ?? '주소 미확인'}</span>
                    </span>
                    <ChevronRight />
                  </Link></StaggerItem>
                ))}
                {shown < clinics.data.length && (
                  <button type="button" onClick={more} className="flex h-10 items-center justify-center gap-1 text-[15px] font-semibold text-primary">
                    더 보기<ChevronDown />
                  </button>
                )}
              </Stagger>
            </>
          )}
        </>}
      </main>
      <TabBar active="hospital" />

      {sheetOpen && <AreaSheet initial={area} onClose={() => navigate(-1)} onSelect={(a) => { setArea(a); setShown(PAGE); navigate(-1); }} />}
    </MobileShell>
  );
}

function AreaSheet({ initial, onClose, onSelect }) {
  const [sido, setSido] = useState(initial);
  const item = (on) => `flex h-11 items-center justify-center gap-1 rounded-[10px] text-[15px] ${on ? 'bg-primary-soft font-semibold text-primary-dark' : 'bg-panel hover:bg-field'}`;

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-end bg-[rgba(15,30,45,0.5)]" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="지역 선택" onClick={(e) => e.stopPropagation()}
        className="mx-auto flex w-full max-w-[480px] flex-col gap-4 rounded-t-3xl bg-white px-5 pb-7 pt-2.5 shadow-[0_-8px_24px_rgba(15,30,45,0.18)]">
        <div className="h-1 w-10 self-center rounded-sm bg-[#d5dde5]" />
        <div className="flex items-center"><h2 className="flex-1 text-[20px] font-semibold">지역 선택</h2><CloseButton onClick={onClose} /></div>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="시/도">
          {SIDO.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={s === sido} className={item(s === sido)} onClick={() => setSido(s)}>
              {s}{s === sido && <Check size={16} color="#1d64a8" width={2.6} />}
            </button>
          ))}
        </div>
        <Button size="md" onClick={() => onSelect(sido)}>{sido} 선택</Button>
      </div>
    </div>
  );
}
