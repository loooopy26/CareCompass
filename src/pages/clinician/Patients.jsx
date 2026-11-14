// P9 오늘 공유받은 환자 (91:2). 지금 열어 둔 공유만 다시 볼 수 있음. 나머지는 시간이 끝난 것으로 보임.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getReceivedShares, now } from '../../api';
import { ChevronRight } from '../../components/icons.jsx';
import { Button, ErrorView, Skeleton, Stagger, StaggerItem, StateView } from '../../components/ui';
import { birth, fullDate, mmss, time } from '../../lib/format.js';
import useAsync from '../../lib/useAsync.js';
import { PcPage, useClinician } from './Layout.jsx';

const COLS = 'grid grid-cols-[1.2fr_1.2fr_1fr_0.9fr_1.6fr_24px] items-center gap-4 px-5';

export default function Patients() {
  const navigate = useNavigate();
  const { shared } = useClinician();
  const { data, error, loading, reload } = useAsync(getReceivedShares);
  const [clock, setClock] = useState(now());
  useEffect(() => { const id = setInterval(() => setClock(now()), 1000); return () => clearInterval(id); }, []);

  return (
    <PcPage>
      <main className="flex flex-1 flex-col gap-5 px-10 py-8">
        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-[28px] font-semibold leading-9">오늘 공유받은 환자</h1>
            <span className="text-[14px] text-sub">{fullDate(new Date(clock).toLocaleDateString('sv-SE'))}</span>
          </div>
          <Button size="pc" to="/clinician/scan">QR 확인</Button>
        </div>
        <div className="flex flex-col rounded-2xl bg-white py-2">
          <div className={`${COLS} h-11 text-[13px] font-semibold text-sub`}>
            <span>환자</span><span>생년월일</span><span>받은 시각</span><span>받은 기록</span><span>볼 수 있는 시간</span><span />
          </div>
          {loading ? (
            <div className="flex flex-col gap-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-6" />)}</div>
          ) : error ? (
            <ErrorView error={error} onRetry={reload} title="환자 목록을 불러오지 못했습니다" />
          ) : data.length === 0 ? (
            <StateView icon="tray" title="오늘 공유받은 환자가 없습니다" body="환자 앱의 공유 QR을 확인하면 여기에 보입니다." className="!py-14" />
          ) : (
            <Stagger className="flex flex-col">
              {data.map((p) => {
                const left = Math.max(0, Math.round((new Date(p.expiresAt).getTime() - clock) / 1000));
                const open = left > 0 && shared?.grantId === p.grantId;
                return (
                  <StaggerItem key={p.grantId}>
                    <button type="button" disabled={!open} onClick={() => navigate('/clinician/records')}
                      className={`${COLS} h-14 w-full border-t border-line text-left text-[15px] ${open ? 'hover:bg-primary-tint' : 'cursor-default'}`}>
                      <span className="truncate font-semibold">{p.patient.name}</span>
                      <span className="text-sub">{p.patient.birth ? birth(p.patient.birth) : '—'}</span>
                      <span className="text-sub">{time(p.receivedAt)}</span>
                      <span>{p.count}건</span>
                      <span className={open ? 'font-semibold text-primary-dark' : 'text-sub'}>{open ? `${mmss(left)} 남았습니다` : '시간이 끝났습니다'}</span>
                      <ChevronRight />
                    </button>
                  </StaggerItem>
                );
              })}
            </Stagger>
          )}
        </div>
      </main>
    </PcPage>
  );
}
