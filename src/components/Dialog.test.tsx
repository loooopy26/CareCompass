// @vitest-environment jsdom
import { StrictMode, useState } from 'react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Confirm, Dialog, Sheet } from './ui';

afterEach(cleanup);

const tab = (shift = false) => fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Tab', shiftKey: shift });
const active = () => document.activeElement as HTMLElement;

// 여는 버튼 + 대화상자. 닫으면 open=false로 바뀜.
function Harness({ render: draw }: { render: (open: boolean, close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>열기</button>
      <button type="button">바깥</button>
      {draw(open, () => setOpen(false))}
    </>
  );
}
const mount = (draw: (open: boolean, close: () => void) => ReactNode) => {
  render(<StrictMode><MemoryRouter><Harness render={draw} /></MemoryRouter></StrictMode>);
  const opener = screen.getByRole('button', { name: '열기' });
  opener.focus();
  fireEvent.click(opener);
  return opener;
};

describe('Dialog 포커스 가두기', () => {
  it('열면 첫 버튼으로, Tab·Shift+Tab은 안에서 돌고, Esc로 닫으면 연 버튼으로 돌아온다', async () => {
    const onCancel = vi.fn();
    const opener = mount((open, close) => (
      <Confirm open={open} title="지울까요?" ok="지우기" onCancel={() => { onCancel(); close(); }} onOk={() => {}} />
    ));
    const cancel = await screen.findByRole('button', { name: '취소' });
    const ok = screen.getByRole('button', { name: '지우기' });
    expect(active()).toBe(cancel);

    ok.focus();
    tab();
    expect(active()).toBe(cancel);
    tab(true);
    expect(active()).toBe(ok);

    // 안에서 바깥으로 포커스가 새어 나갔어도 Tab을 누르면 안으로 되돌림
    screen.getByRole('button', { name: '바깥' }).focus();
    tab();
    expect(active()).toBe(cancel);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(active()).toBe(opener);
  });

  it('포커스할 요소가 없으면 대화상자 자체에 포커스하고 Tab에도 그대로 둔다', async () => {
    mount((open, close) => <Dialog open={open} title="안내" onClose={close}><p>내용</p></Dialog>);
    const dialog = await screen.findByRole('dialog', { name: '안내' });
    expect(active()).toBe(dialog);
    tab();
    expect(active()).toBe(dialog);
  });

  it('aria 속성은 그대로다', async () => {
    mount((open, close) => <Dialog open={open} title="안내" onClose={close}><p>내용</p></Dialog>);
    const dialog = await screen.findByRole('dialog', { name: '안내' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('안내');
  });
});

describe('Sheet 포커스 가두기', () => {
  it('열면 닫기 버튼으로, Tab은 안에서 돌고, 닫기를 누르면 연 버튼으로 돌아온다', async () => {
    const opener = mount((open, close) => (
      <Sheet open={open} title="필터" onClose={close}><button type="button">적용</button></Sheet>
    ));
    const closeBtn = await screen.findByRole('button', { name: '닫기' });
    const apply = screen.getByRole('button', { name: '적용' });
    expect(active()).toBe(closeBtn);
    apply.focus();
    tab();
    expect(active()).toBe(closeBtn);
    tab(true);
    expect(active()).toBe(apply);

    fireEvent.click(closeBtn);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(active()).toBe(opener);
  });

  it('안에 autoFocus 입력칸이 있으면 그 칸에 포커스를 둔다', async () => {
    const opener = mount((open, close) => (
      <Sheet open={open} title="물어볼 것 추가" onClose={close}><textarea autoFocus aria-label="질문" /></Sheet>
    ));
    const area = await screen.findByRole('textbox', { name: '질문' });
    expect(active()).toBe(area);
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(active()).toBe(opener);
  });

  it('시트 위에 대화상자가 열리면 맨 위 대화상자만 Tab을 잡고, 닫히면 시트 안으로 돌아온다', async () => {
    function Stack() {
      const [sheet, setSheet] = useState(true);
      const [dialog, setDialog] = useState(false);
      return (
        <Sheet open={sheet} title="시트" onClose={() => setSheet(false)}>
          <button type="button" onClick={() => setDialog(true)}>대화상자 열기</button>
          <Dialog open={dialog} title="위" onClose={() => setDialog(false)}>
            <button type="button" onClick={() => setDialog(false)}>확인</button>
          </Dialog>
        </Sheet>
      );
    }
    render(<StrictMode><MemoryRouter><Stack /></MemoryRouter></StrictMode>);
    const inner = await screen.findByRole('button', { name: '대화상자 열기' });
    inner.focus();
    fireEvent.click(inner);
    const confirm = await screen.findByRole('button', { name: '확인' });
    expect(active()).toBe(confirm);
    tab();
    expect(active()).toBe(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '위' })).toBeNull());
    expect(active()).toBe(inner);
  });
});
