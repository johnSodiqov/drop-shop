import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './AuthPages';

const login = vi.fn();

vi.mock('./AuthProvider', () => ({
  useAuth: () => ({ user: null, login }),
}));

describe('LoginPage', () => {
  beforeEach(() => login.mockReset());

  it('validates phone format before sending credentials', async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><LoginPage /></MemoryRouter></QueryClientProvider>);
    fireEvent.change(screen.getByPlaceholderText('+998901234567'), { target: { value: '123' } });
    fireEvent.change(screen.getByPlaceholderText('Ваш пароль'), { target: { value: 'a-secure-password' } });
    fireEvent.click(screen.getByRole('button', { name: /войти/i }));

    expect(await screen.findByText('Введите номер в формате +998XXXXXXXXX')).toBeInTheDocument();
    await waitFor(() => expect(login).not.toHaveBeenCalled());
  });
});
