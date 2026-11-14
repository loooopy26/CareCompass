// @vitest-environment jsdom
import { StrictMode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api', () => ({
  getFollowups: vi.fn(),
  getPrep: vi.fn(),
  getRecords: vi.fn(),
  savePrep: vi.fn(),
  now: () => Date.now(),
}));

import { getFollowups, getPrep, getRecords, savePrep } from '../../api';
import Prep from './Prep.jsx';

const FOLLOWUP = { id: 'f1', kind: 'APPOINTMENT', status: 'BOOKED', date: '2099-01-10T10:00', clinic: '가나병원', title: '재진' };
const Q = '무릎 찜질해도 되나요?';
const wait = (ms) => act(() => new Promise((r) => setTimeout(r, ms)));
const calls = () => vi.mocked(savePrep).mock.calls.length;
const withQ = () => vi.mocked(savePrep).mock.calls.filter(([, body]) => body.questions.includes(Q)).length;

const renderPrep = () => render(
  <StrictMode>
    <MemoryRouter initialEntries={['/app/prep/f1']}>
      <Routes>
        <Route path="/app/prep/:followupId" element={<Prep />} />
      </Routes>
    </MemoryRouter>
  </StrictMode>,
);

// 불러오기를 기다린 뒤 질문 하나를 추가함 (400ms 저장 타이머가 돌기 전에)
const addQuestion = async () => {
  fireEvent.click(await screen.findByRole('button', { name: '질문 추가' }));
  const sheet = await screen.findByRole('dialog', { name: '질문 추가' });
  fireEvent.change(sheet.querySelector('textarea'), { target: { value: Q } });
  fireEvent.click(screen.getByRole('button', { name: '추가' }));
};

beforeEach(() => {
  vi.mocked(getFollowups).mockReset().mockResolvedValue([FOLLOWUP]);
  vi.mocked(getPrep).mockReset().mockResolvedValue({ recordIds: [], questions: [] });
  vi.mocked(getRecords).mockReset().mockResolvedValue({ records: [], partial: false, linking: false });
  vi.mocked(savePrep).mockReset().mockResolvedValue({});
});
afterEach(cleanup);

describe('진료 준비 저장', () => {
  it('불러온 뒤 400ms가 지나면 StrictMode에서도 한 번만 저장한다', async () => {
    renderPrep();
    await screen.findByRole('button', { name: '질문 추가' });
    await waitFor(() => expect(savePrep).toHaveBeenCalledTimes(1), { timeout: 2000 });
    await wait(500);
    expect(savePrep).toHaveBeenCalledTimes(1);
    expect(savePrep).toHaveBeenCalledWith('f1', { recordIds: [], questions: [] });
  });

  // 느린 환경: 질문을 추가하기 전에 처음 400ms 저장(빈 내용)이 먼저 나갈 수 있어, 추가한 뒤의 호출 수만 셈
  it('질문을 추가하고 바로 화면을 떠나면 남은 저장을 보낸다', async () => {
    const { unmount } = renderPrep();
    await addQuestion();
    const base = calls();
    expect(withQ()).toBe(0);
    unmount();
    expect(calls()).toBe(base + 1);
    expect(savePrep).toHaveBeenLastCalledWith('f1', { recordIds: [], questions: [Q] });
    await wait(500);
    expect(calls()).toBe(base + 1);
  });

  it('pagehide에서 바로 저장하고, 같은 내용은 다시 보내지 않는다', async () => {
    const { unmount } = renderPrep();
    await addQuestion();
    const base = calls();
    act(() => { window.dispatchEvent(new Event('pagehide')); });
    expect(calls()).toBe(base + 1);
    expect(savePrep).toHaveBeenLastCalledWith('f1', { recordIds: [], questions: [Q] });
    await wait(500);
    unmount();
    expect(calls()).toBe(base + 1);
  });

  it('탭이 숨겨지면(visibilitychange) 바로 저장한다', async () => {
    renderPrep();
    await addQuestion();
    const base = calls();
    const spy = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    spy.mockRestore();
    expect(calls()).toBe(base + 1);
    expect(savePrep).toHaveBeenLastCalledWith('f1', { recordIds: [], questions: [Q] });
  });

  it('바뀐 것이 없으면 떠날 때 다시 저장하지 않는다', async () => {
    const { unmount } = renderPrep();
    await screen.findByRole('button', { name: '질문 추가' });
    await waitFor(() => expect(savePrep).toHaveBeenCalledTimes(1), { timeout: 2000 });
    unmount();
    expect(savePrep).toHaveBeenCalledTimes(1);
  });

  it('저장에 실패하면 같은 내용도 다음에 다시 보낸다', async () => {
    const { unmount } = renderPrep();
    await addQuestion();
    vi.mocked(savePrep).mockRejectedValueOnce(new Error('network'));
    act(() => { window.dispatchEvent(new Event('pagehide')); });
    await wait(0);
    expect(withQ()).toBe(1);
    // 실패한 뒤에는 보낸 기록을 지우므로, 같은 내용이 다시 쌓이면 다시 보냄
    fireEvent.click(screen.getByRole('button', { name: '질문 지우기' }));
    await addQuestion();
    unmount();
    expect(withQ()).toBe(2);
    expect(savePrep).toHaveBeenLastCalledWith('f1', { recordIds: [], questions: [Q] });
  });
});
