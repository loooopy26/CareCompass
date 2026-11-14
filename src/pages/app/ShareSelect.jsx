// 23 공유할 기록 고르기 (66:2). state로 미리 고를 수 있음: { recordIds, includeMedication, ttlMinutes } 또는 { clinic } (21 병원 정보)
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getFollowups, getRecords, now } from '../../api';
import { Button, CheckRow, ErrorView, MobileShell, PageHeader, Segmented, SkeletonRows, Stagger, StaggerItem, StateView } from '../../components/ui';
import { looseDate, monthDay, specialtyName } from '../../lib/format.js';
import { fitsSpecialty, visitSpecialty } from '../../lib/symptom.js';
import useAsync from '../../lib/useAsync.js';

const TTL = [5, 10, 30].map((m) => ({ value: m, label: `${m}분` }));
const YEAR_MS = 365 * 24 * 3600 * 1000;

export default function ShareSelect() {
  const navigate = useNavigate();
  const preset = useLocation().state ?? {};
  const res = useAsync(() => getRecords());
  const records = { ...res, data: res.data?.records };
  const followups = useAsync(getFollowups);
  const next = followups.data?.[0];

  // 공유할 진료과: 고른 병원(21 병원 정보) 또는 다음 진료 병원의 기록에서 찾음. 못 찾으면 진료과로 거르지 않음.
  const specialty = useMemo(() => visitSpecialty(records.data ?? [], preset.clinic ?? next?.clinic, preset.clinic ? null : next?.fromRecordId),
    [records.data, preset.clinic, next]);

  // 최근 1년 기록만 (잘못 입력된 기록은 빼고), 그 진료과 기록과 그 진료과에 맞는 내 기록만 (두통 → 신경과, 기침 → 내과·이비인후과 …). 진료과·병원별로 묶고 내 기록은 맨 아래.
  // 미리 고른 기록은 오래되거나 다른 진료과여도 넣음.
  const groups = useMemo(() => {
    const recent = (records.data ?? []).filter((r) => !r.status && (preset.recordIds?.includes(r.id)
      || (r.date && now() - new Date(r.date).getTime() < YEAR_MS && fitsSpecialty(r, specialty))));
    const map = new Map();
    for (const r of recent) {
      const key = r.kind === 'symptom' ? '내 기록' : [specialtyName(r.specialty), r.clinic].filter(Boolean).join(' · ');
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map].sort(([a], [b]) => (a === '내 기록') - (b === '내 기록'));
  }, [records.data, preset.recordIds, specialty]);

  const [selected, setSelected] = useState(null);
  const [includeMedication, setIncludeMedication] = useState(!!preset.includeMedication);
  const [ttl, setTtl] = useState(preset.ttlMinutes ?? 5);

  // 처음 상태: 다른 화면에서 사용자가 고른 기록만 넘겨받아 체크. 그 밖에는 아무것도 고르지 않음 (사용자가 직접 고름)
  useEffect(() => {
    if (selected || !records.data) return;
    const all = groups.flatMap(([, rs]) => rs);
    setSelected(new Set(all.filter((r) => preset.recordIds?.includes(r.id)).map((r) => r.id)));
  }, [records.data, groups, selected, preset.recordIds]);

  const picked = selected ?? new Set();
  const toggle = (id) => {
    const s = new Set(picked);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const create = () => navigate('/app/share/new', { state: { recordIds: [...picked], includeMedication, ttlMinutes: ttl } });

  return (
    <MobileShell>
      <PageHeader title="기록 공유" back="/app/share" />
      <main className="flex flex-1 flex-col gap-4 px-5 pb-3 pt-1">
        <div className="flex flex-col gap-1">
          <h1 className="text-[24px] font-semibold leading-8">어떤 기록을 공유하시겠습니까?</h1>
          {preset.clinic ? <p className="text-[16px] text-sub">{preset.clinic}에 공유할 기록</p>
            : next?.date?.length >= 10 && <p className="text-[16px] text-sub">{monthDay(next.date)} {next.clinic} 진료</p>}
        </div>

        {records.loading || followups.loading ? (
          <SkeletonRows rows={3} right={false} />
        ) : records.error ? (
          <ErrorView error={records.error} onRetry={records.reload} title="기록을 불러오지 못했습니다" />
        ) : groups.length === 0 ? (
          <StateView icon="tray" title="공유할 기록이 없습니다" body="병원 기록이 오거나 증상을 기록하면 여기서 고를 수 있습니다." />
        ) : (
          <>
            <Stagger className="flex flex-col">
              {groups.map(([label, rs]) => (
                <StaggerItem key={label} className="flex flex-col">
                  <div className="pb-0.5 pt-2 text-[13px] font-semibold text-sub">{label}</div>
                  {rs.map((r) => (
                    <CheckRow key={r.id} on={picked.has(r.id)} onToggle={() => toggle(r.id)}>
                      <span className="flex flex-1 flex-col gap-px">
                        <span className="text-[16px] font-semibold">{r.title}</span>
                        <span className="text-[13px] text-sub">{looseDate(r.date)}</span>
                      </span>
                    </CheckRow>
                  ))}
                </StaggerItem>
              ))}
            </Stagger>

            <div className="flex flex-col gap-2.5 rounded-2xl bg-panel px-4 py-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold">민감한 정보는 따로 고릅니다</span>
                <span className="text-[13px] text-sub">진료에 필요할 때만 켜 주세요.</span>
              </div>
              <CheckRow on={includeMedication} onToggle={() => setIncludeMedication(!includeMedication)} compact>
                <span className="text-[15px]">처방받은 약</span>
              </CheckRow>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[14px] font-semibold text-sub">QR 유효 시간</span>
              <Segmented options={TTL} value={ttl} onChange={setTtl} />
            </div>
          </>
        )}
      </main>

      <div className="sticky bottom-0 flex flex-col gap-2.5 border-t border-line bg-white px-5 pb-7 pt-3">
        <p className="text-center text-[13px] text-sub">
          {picked.size ? `의료진이 기록 ${picked.size}건을 ${ttl}분 동안 한 번 볼 수 있습니다` : '공유할 기록을 골라 주세요'}
        </p>
        <Button disabled={!picked.size} onClick={create}>QR 만들기</Button>
      </div>
    </MobileShell>
  );
}
