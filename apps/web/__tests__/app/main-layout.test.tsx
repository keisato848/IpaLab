import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import DashboardLayout from '@/app/(main)/layout';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { role: 'user' } } }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/exam',
}));

vi.mock('@/components/features/auth/UserMenu', () => ({
  UserMenu: () => <div>ユーザーメニュー</div>,
}));

describe('DashboardLayout', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('デスクトップのサイドナビを閉じて再表示できる', () => {
    render(
      <DashboardLayout>
        <div>本文</div>
      </DashboardLayout>
    );

    const sidebar = screen.getByRole('complementary');
    const hideButton = screen.getByRole('button', { name: 'サイドナビを隠す' });

    expect(sidebar).toHaveAttribute('id', 'main-sidebar');
    fireEvent.click(hideButton);

    const showButton = screen.getByRole('button', { name: 'サイドナビを表示' });
    expect(showButton).toHaveAttribute('aria-expanded', 'false');
    expect(window.localStorage.getItem('ipalab_main_sidebar_collapsed_v1')).toBe('true');

    fireEvent.click(showButton);

    expect(screen.getByRole('button', { name: 'サイドナビを隠す' })).toHaveAttribute('aria-expanded', 'true');
    expect(window.localStorage.getItem('ipalab_main_sidebar_collapsed_v1')).toBe('false');
  });
});