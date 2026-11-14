// @vitest-environment jsdom
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CodeInput } from './ui';

type Resend = () => Promise<boolean>;

function Harness({ onResend, onChangeSpy }: { onResend: Resend; onChangeSpy: (v: string) => void }) {
  const [value, setValue] = useState('123');
  return <CodeInput value={value} onChange={(v) => { onChangeSpy(v); setValue(v); }} onResend={onResend} />;
}

const setup = async (onResend: Resend) => {
  const onChangeSpy = vi.fn();
  const { container } = render(<Harness onResend={onResend} onChangeSpy={onChangeSpy} />);
  await act(async () => { vi.advanceTimersByTime(10_000); }); // 5:00 → 4:50
  expect(screen.getByText('4:50')).toBeTruthy();
  const input = container.querySelector('input') as HTMLInputElement;
  const click = async () => {
    fireEvent.click(screen.getByRole('button', { name: '코드 다시 받기' }));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  };
  return { onChangeSpy, input, click };
};

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Fix checking (1.6)', () => {
  it('onResend가 false면 남은 시간과 입력값을 유지한다', async () => {
    const { onChangeSpy, input, click } = await setup(() => Promise.resolve(false));
    await click();
    expect(screen.getByText('4:50')).toBeTruthy();
    expect(input.value).toBe('123');
    expect(onChangeSpy).not.toHaveBeenCalledWith('');
  });

  it('onResend가 던져도 남은 시간과 입력값을 유지한다', async () => {
    const { onChangeSpy, input, click } = await setup(() => Promise.reject(new Error('fail')));
    await click();
    expect(screen.getByText('4:50')).toBeTruthy();
    expect(input.value).toBe('123');
    expect(onChangeSpy).not.toHaveBeenCalledWith('');
  });
});

describe('Preservation (3.6)', () => {
  it('onResend가 true면 5:00으로 되돌리고 입력을 비우고 포커스를 준다', async () => {
    const { onChangeSpy, input, click } = await setup(() => Promise.resolve(true));
    await click();
    expect(screen.getByText('5:00')).toBeTruthy();
    expect(input.value).toBe('');
    expect(onChangeSpy).toHaveBeenCalledWith('');
    expect(document.activeElement).toBe(input);
  });
});
