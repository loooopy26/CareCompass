// @vitest-environment jsdom
import { StrictMode } from 'react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api', () => ({
  createShareGrant: vi.fn(),
  revokeShareGrant: vi.fn(),
}));

import { createShareGrant, revokeShareGrant } from '../../api';
import ShareCreating from './ShareCreating.jsx';

const REQUEST = { recordIds: ['r1'], ttlMinutes: 60 };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

const Detail = () => <div>DETAIL {useParams().id}</div>;
const renderCreating = () => render(
  <StrictMode>
    <MemoryRouter initialEntries={['/app/share/select', { pathname: '/app/share/creating', state: REQUEST }]} initialIndex={1}>
      <Routes>
        <Route path="/app/share/select" element={<div>SELECT</div>} />
        <Route path="/app/share/creating" element={<ShareCreating />} />
        <Route path="/app/share/:id" element={<Detail />} />
      </Routes>
    </MemoryRouter>
  </StrictMode>,
);

beforeEach(() => {
  vi.mocked(createShareGrant).mockReset();
  vi.mocked(revokeShareGrant).mockReset().mockResolvedValue({ ok: true });
});
afterEach(cleanup);

describe('Fix checking (1.5)', () => {
  it('떠난 뒤 성공하면 이동하지 않고 revokeShareGrant를 1회 부른다', async () => {
    const d = deferred();
    vi.mocked(createShareGrant).mockReturnValue(d.promise);
    renderCreating();
    expect(createShareGrant).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '만들기 취소' }));
    expect(screen.getByText('SELECT')).toBeTruthy();

    d.resolve({ grantId: 'g1' });
    await flush();
    expect(screen.queryByText(/DETAIL/)).toBeNull();
    expect(screen.getByText('SELECT')).toBeTruthy();
    expect(revokeShareGrant).toHaveBeenCalledTimes(1);
    expect(revokeShareGrant).toHaveBeenCalledWith('g1');
  });

  it('떠난 뒤 revoke가 실패해도 오류를 내지 않는다', async () => {
    const d = deferred();
    vi.mocked(createShareGrant).mockReturnValue(d.promise);
    vi.mocked(revokeShareGrant).mockRejectedValue(new Error('network'));
    renderCreating();
    fireEvent.click(screen.getByRole('button', { name: '만들기 취소' }));
    d.resolve({ grantId: 'g2' });
    await flush();
    expect(revokeShareGrant).toHaveBeenCalledWith('g2');
  });

  it('떠난 뒤 실패하면 상태를 바꾸지 않고 revoke도 부르지 않는다', async () => {
    const d = deferred();
    vi.mocked(createShareGrant).mockReturnValue(d.promise);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderCreating();
    fireEvent.click(screen.getByRole('button', { name: '만들기 취소' }));
    d.reject(new Error('boom'));
    await flush();
    expect(screen.getByText('SELECT')).toBeTruthy();
    expect(revokeShareGrant).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('Preservation (3.5)', () => {
  it('떠나지 않으면 StrictMode에서도 1회 호출 후 /app/share/{grantId}로 이동', async () => {
    const d = deferred();
    vi.mocked(createShareGrant).mockReturnValue(d.promise);
    renderCreating();
    expect(screen.getByText('QR을 만들고 있습니다')).toBeTruthy();
    d.resolve({ grantId: 'g3' });
    await flush();
    expect(screen.getByText('DETAIL g3')).toBeTruthy();
    expect(createShareGrant).toHaveBeenCalledTimes(1);
    expect(revokeShareGrant).not.toHaveBeenCalled();
  });

  it('실패하면 오류 문구와 다시 시도 버튼, 다시 시도하면 한 번 더 요청', async () => {
    const d = deferred();
    vi.mocked(createShareGrant).mockReturnValueOnce(d.promise);
    renderCreating();
    d.reject(new Error('서버가 바빠요'));
    await flush();
    expect(screen.getByText('QR을 만들지 못했습니다')).toBeTruthy();
    expect(screen.getByText('서버가 바빠요')).toBeTruthy();

    const d2 = deferred();
    vi.mocked(createShareGrant).mockReturnValueOnce(d2.promise);
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(createShareGrant).toHaveBeenCalledTimes(2);
    d2.resolve({ grantId: 'g4' });
    await flush();
    expect(screen.getByText('DETAIL g4')).toBeTruthy();
  });
});
