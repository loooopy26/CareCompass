// @vitest-environment jsdom
import { StrictMode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  getSession: vi.fn(),
}));

import { getSession, login } from '../../api';
import Login from './Login.jsx';

const renderLogin = (entry) => render(
  <StrictMode>
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/app/login" element={<Login />} />
        <Route path="/app/home" element={<div>HOME</div>} />
        <Route path="/app/records/:id" element={<div>RECORD</div>} />
      </Routes>
    </MemoryRouter>
  </StrictMode>,
);

const submit = async () => {
  fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'a1@example.com' } });
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'pw' } });
  fireEvent.click(screen.getByRole('button', { name: '로그인' }));
};

beforeEach(() => {
  vi.mocked(getSession).mockReset().mockResolvedValue(null);
  vi.mocked(login).mockReset().mockResolvedValue({ step: 'DONE', role: 'patient' });
});
afterEach(cleanup);

describe('로그인 딥링크', () => {
  it('로그인하면 ?next=의 화면으로 간다', async () => {
    renderLogin('/app/login?next=%2Fapp%2Frecords%2Fr1');
    await submit();
    expect(await screen.findByText('RECORD')).toBeTruthy();
  });

  it('next가 없으면 홈으로 간다', async () => {
    renderLogin('/app/login');
    await submit();
    expect(await screen.findByText('HOME')).toBeTruthy();
  });

  it('바깥 주소(//evil.com)는 무시하고 홈으로 간다', async () => {
    renderLogin('/app/login?next=%2F%2Fevil.com');
    await submit();
    expect(await screen.findByText('HOME')).toBeTruthy();
  });

  it('이미 환자로 로그인했으면 폼 없이 next(없으면 홈)로 보낸다', async () => {
    vi.mocked(getSession).mockResolvedValue({ role: 'patient' });
    renderLogin('/app/login?next=%2Fapp%2Frecords%2Fr1');
    expect(await screen.findByText('RECORD')).toBeTruthy();
    expect(login).not.toHaveBeenCalled();
  });

  it('로그인하지 않았거나 다른 역할이면 폼을 그대로 보여 준다', async () => {
    vi.mocked(getSession).mockResolvedValue({ role: 'clinician' });
    renderLogin('/app/login');
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByRole('button', { name: '로그인' })).toBeTruthy();
    expect(screen.queryByText('HOME')).toBeNull();
  });
});
