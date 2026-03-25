import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastContainer } from '../components/Toast';
import { getToastDurationMs, useToastQueue } from '../hooks/useToastQueue';

function ToastHarness() {
  const { toasts, addToast, removeToast } = useToastQueue();

  return (
    <div>
      <button type="button" onClick={() => addToast('success', 'Nhập dữ liệu', 'Sản phẩm: đã lưu 28 dòng.')}>
        Add success toast
      </button>
      <button type="button" onClick={() => addToast('error', 'Nhập dữ liệu', 'Sản phẩm: có lỗi import.')}>
        Add error toast
      </button>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}

describe('Toast UI', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('auto dismisses success toasts after 4 seconds', async () => {
    render(<ToastHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Add success toast' }));

    expect(screen.getByText('Nhập dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Sản phẩm: đã lưu 28 dòng.')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(getToastDurationMs('success'));
    });

    expect(screen.queryByText('Sản phẩm: đã lưu 28 dòng.')).not.toBeInTheDocument();
  });

  it('auto dismisses error toasts after 7 seconds', async () => {
    render(<ToastHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Add error toast' }));

    expect(screen.getByText('Sản phẩm: có lỗi import.')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(getToastDurationMs('error'));
    });

    expect(screen.queryByText('Sản phẩm: có lỗi import.')).not.toBeInTheDocument();
  });

  it('closes a toast immediately when the close button is clicked', async () => {
    render(<ToastHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Add success toast' }));
    expect(screen.getByText('Sản phẩm: đã lưu 28 dòng.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Đóng thông báo' }));

    expect(screen.queryByText('Sản phẩm: đã lưu 28 dòng.')).not.toBeInTheDocument();
  });

  it('does not remove another toast when one toast is manually closed before its timeout', async () => {
    render(<ToastHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Add success toast' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add error toast' }));

    const closeButtons = screen.getAllByRole('button', { name: 'Đóng thông báo' });
    fireEvent.click(closeButtons[0]);

    expect(screen.queryByText('Sản phẩm: đã lưu 28 dòng.')).not.toBeInTheDocument();
    expect(screen.getByText('Sản phẩm: có lỗi import.')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(getToastDurationMs('success'));
    });

    expect(screen.getByText('Sản phẩm: có lỗi import.')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(getToastDurationMs('error') - getToastDurationMs('success'));
    });

    expect(screen.queryByText('Sản phẩm: có lỗi import.')).not.toBeInTheDocument();
  });
});
