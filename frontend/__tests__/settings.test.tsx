/**
 * Tests for app/(authenticated)/settings/page.tsx
 *
 * Covers:
 *  - Initial render with profile data
 *  - Save profile — success, error, loading states
 *  - Home currency select
 *  - Sign out flow
 *  - Delete account — confirmation gate, happy path, error path, cancel
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import Settings from '@/app/(authenticated)/settings/page';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/components/ui/ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

jest.mock('@/components/ui/Card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
}));

jest.mock('@/components/ui/Input', () => ({
  Input: ({
    label,
    placeholder,
    value,
    onChange,
  }: {
    label?: string;
    placeholder?: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  }) => (
    <div>
      {label && <label>{label}</label>}
      <input
        aria-label={label ?? placeholder}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
    </div>
  ),
}));

jest.mock('@/components/ui/Button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant}>
      {children}
    </button>
  ),
}));

// ThemeContext
jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark' }),
}));

// AuthContext
const mockGetAccessToken = jest.fn();
const mockSignOut = jest.fn();

const DEFAULT_PROFILE = {
  display_name: 'Jordan Calloway',
  home_currency: 'CAD',
};

let mockProfile: typeof DEFAULT_PROFILE | null = DEFAULT_PROFILE;

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    getAccessToken: mockGetAccessToken,
    signOut: mockSignOut,
    profile: mockProfile,
  }),
}));

// Fetch mock
global.fetch = jest.fn();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderSettings() {
  return render(<Settings />);
}

function mockFetchOk() {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
}

function mockFetchFail() {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
}

function mockFetchThrow() {
  (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Settings page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProfile = { ...DEFAULT_PROFILE };
    mockGetAccessToken.mockResolvedValue('mock-token');
  });

  // ── Initial render ─────────────────────────────────────────────────────────

  describe('initial render', () => {
    it('renders the page heading', () => {
      renderSettings();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('pre-fills display name from profile', () => {
      renderSettings();
      const input = screen.getByDisplayValue('Jordan Calloway');
      expect(input).toBeInTheDocument();
    });

    it('pre-selects home currency from profile', () => {
      renderSettings();
      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('CAD');
    });

    it('renders with empty display name when profile has none', () => {
      mockProfile = { display_name: '', home_currency: 'CAD' };
      renderSettings();
      const input = screen.getByRole('textbox', { name: /display name/i });
      expect(input).toHaveValue('');
    });

    it('renders the theme toggle', () => {
      renderSettings();
      expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
    });

    it('shows the current theme in the appearance section', () => {
      renderSettings();
      expect(screen.getByText(/dark mode/i)).toBeInTheDocument();
    });

    it('renders the Sign Out button', () => {
      renderSettings();
      expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
    });

    it('renders the Delete Account button initially', () => {
      renderSettings();
      expect(screen.getByRole('button', { name: /delete account/i })).toBeInTheDocument();
    });
  });

  // ── Save profile ───────────────────────────────────────────────────────────

  describe('save profile', () => {
    it('calls PATCH /auth/me with the correct payload on save', async () => {
      mockFetchOk();
      renderSettings();

      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/auth/me'),
          expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify({
              display_name: 'Jordan Calloway',
              home_currency: 'CAD',
            }),
          })
        );
      });
    });

    it('includes the Bearer token in the Authorization header', async () => {
      mockFetchOk();
      renderSettings();

      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer mock-token',
            }),
          })
        );
      });
    });

    it('shows "Saving…" while the request is in flight', async () => {
      (global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}));
      renderSettings();

      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
      });
    });

    it('shows success message after a successful save', async () => {
      mockFetchOk();
      renderSettings();

      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(screen.getByText(/profile updated/i)).toBeInTheDocument();
      });
    });

    it('shows error message when the save request fails', async () => {
      mockFetchFail();
      renderSettings();

      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(screen.getByText(/failed to save/i)).toBeInTheDocument();
      });
    });

    it('shows error message when fetch throws a network error', async () => {
      mockFetchThrow();
      renderSettings();

      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(screen.getByText(/failed to save/i)).toBeInTheDocument();
      });
    });

    it('sends updated display name when the user edits the field', async () => {
      mockFetchOk();
      renderSettings();

      const input = screen.getByDisplayValue('Jordan Calloway');
      await userEvent.clear(input);
      await userEvent.type(input, 'Alex Smith');

      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            body: JSON.stringify({
              display_name: 'Alex Smith',
              home_currency: 'CAD',
            }),
          })
        );
      });
    });

    it('sends updated currency when the user changes the select', async () => {
      mockFetchOk();
      renderSettings();

      const select = screen.getByRole('combobox');
      await userEvent.selectOptions(select, 'USD');

      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            body: JSON.stringify({
              display_name: 'Jordan Calloway',
              home_currency: 'USD',
            }),
          })
        );
      });
    });
  });

  // ── Currency select options ────────────────────────────────────────────────

  describe('home currency select', () => {
    it('renders all currency options', () => {
      renderSettings();
      const select = screen.getByRole('combobox');
      const options = Array.from(select.querySelectorAll('option')).map(
        (o) => o.textContent
      );
      expect(options).toEqual(
        expect.arrayContaining(['CAD', 'USD', 'EUR', 'GBP', 'AUD'])
      );
    });
  });

  // ── Sign out ───────────────────────────────────────────────────────────────

  describe('sign out', () => {
    it('calls signOut and redirects to /login', async () => {
      mockSignOut.mockResolvedValue(undefined);
      renderSettings();

      fireEvent.click(screen.getByRole('button', { name: /sign out/i }));

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalledTimes(1);
        expect(mockPush).toHaveBeenCalledWith('/login');
      });
    });
  });

  // ── Delete account ─────────────────────────────────────────────────────────

  describe('delete account', () => {
    it('shows the confirmation input after clicking Delete Account', () => {
      renderSettings();

      fireEvent.click(screen.getByRole('button', { name: /delete account/i }));

      expect(screen.getByPlaceholderText('delete my account')).toBeInTheDocument();
    });

    it('keeps the Confirm Delete button disabled until the exact phrase is typed', async () => {
      renderSettings();
      fireEvent.click(screen.getByRole('button', { name: /delete account/i }));

      const confirmBtn = screen.getByRole('button', { name: /confirm delete/i });
      expect(confirmBtn).toBeDisabled();

      const input = screen.getByPlaceholderText('delete my account');
      await userEvent.type(input, 'delete my accoun'); // one char short
      expect(confirmBtn).toBeDisabled();
    });

    it('enables the Confirm Delete button only when the exact phrase is typed', async () => {
      renderSettings();
      fireEvent.click(screen.getByRole('button', { name: /delete account/i }));

      const input = screen.getByPlaceholderText('delete my account');
      await userEvent.type(input, 'delete my account');

      expect(screen.getByRole('button', { name: /confirm delete/i })).not.toBeDisabled();
    });

    it('sends DELETE /auth/me and redirects to /login on success', async () => {
      mockFetchOk();
      mockSignOut.mockResolvedValue(undefined);
      renderSettings();

      fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
      const input = screen.getByPlaceholderText('delete my account');
      await userEvent.type(input, 'delete my account');
      fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/auth/me'),
          expect.objectContaining({ method: 'DELETE' })
        );
        expect(mockSignOut).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith('/login');
      });
    });

    it('shows an error message when the DELETE request fails', async () => {
      mockFetchFail();
      renderSettings();

      fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
      const input = screen.getByPlaceholderText('delete my account');
      await userEvent.type(input, 'delete my account');
      fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }));

      await waitFor(() => {
        expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
      });
    });

    it('does not redirect when the DELETE request fails', async () => {
      mockFetchFail();
      renderSettings();

      fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
      const input = screen.getByPlaceholderText('delete my account');
      await userEvent.type(input, 'delete my account');
      fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }));

      await waitFor(() => {
        expect(mockPush).not.toHaveBeenCalled();
      });
    });

    it('cancels the delete flow and hides the confirmation UI', () => {
      renderSettings();
      fireEvent.click(screen.getByRole('button', { name: /delete account/i }));

      expect(screen.getByPlaceholderText('delete my account')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(screen.queryByPlaceholderText('delete my account')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete account/i })).toBeInTheDocument();
    });

    it('clears the confirmation input text when cancel is clicked', async () => {
      renderSettings();
      fireEvent.click(screen.getByRole('button', { name: /delete account/i }));

      const input = screen.getByPlaceholderText('delete my account');
      await userEvent.type(input, 'delete my');

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      // Re-open and check the field is empty
      fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
      expect(screen.getByPlaceholderText('delete my account')).toHaveValue('');
    });
  });
});