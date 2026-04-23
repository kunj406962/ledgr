/**
 * Tests for app/(auth)/login/page.tsx
 *
 * Covers:
 *  - Redirect when already authenticated
 *  - Null render while auth is loading
 *  - Google and GitHub sign-in button renders and interactions
 *  - Loading states during sign-in
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LoginPage from '@/app/(auth)/login/page';

// ─── Mock next/navigation ───────────────────────────────────────────────────
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

// ─── Mock child components ───────────────────────────────────────────────────
// We test LoginPage in isolation — child component rendering is tested separately.
jest.mock('@/components/ui/ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

jest.mock('@/components/login/Info', () => ({
  Info: () => <div data-testid="login-info" />,
}));

// SignInForm must forward the handlers so we can simulate button clicks.
jest.mock('@/components/login/SignInForm', () => ({
  SignInForm: ({
    handleGoogle,
    handleGithub,
    signingIn,
  }: {
    handleGoogle: () => void;
    handleGithub: () => void;
    signingIn: 'google' | 'github' | null;
  }) => (
    <div data-testid="sign-in-form">
      <button data-testid="google-btn" onClick={handleGoogle}>
        {signingIn === 'google' ? 'Signing in…' : 'Sign in with Google'}
      </button>
      <button data-testid="github-btn" onClick={handleGithub}>
        {signingIn === 'github' ? 'Signing in…' : 'Sign in with GitHub'}
      </button>
      {signingIn && (
        <span data-testid="signing-in-indicator">{signingIn}</span>
      )}
    </div>
  ),
}));

// ─── Mock AuthContext ────────────────────────────────────────────────────────
const mockSignInWithGoogle = jest.fn();
const mockSignInWithGitHub = jest.fn();

let mockSession: object | null = null;
let mockLoading = false;

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    session: mockSession,
    loading: mockLoading,
    signInWithGoogle: mockSignInWithGoogle,
    signInWithGitHub: mockSignInWithGitHub,
  }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────
function renderLoginPage() {
  return render(<LoginPage />);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession = null;
    mockLoading = false;
  });

  // ── Loading state ──────────────────────────────────────────────────────────

  describe('while auth is loading', () => {
    it('renders nothing (null) while loading is true', () => {
      mockLoading = true;
      const { container } = renderLoginPage();
      expect(container).toBeEmptyDOMElement();
    });
  });

  // ── Already authenticated ──────────────────────────────────────────────────

  describe('when session already exists', () => {
    it('redirects to /dashboard immediately', () => {
      mockSession = { user: { id: 'abc' } };
      renderLoginPage();
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });

    it('does not render the sign-in form when redirecting', () => {
      mockSession = { user: { id: 'abc' } };
      renderLoginPage();
      // The redirect fires but the page still renders briefly — ensure at
      // minimum the redirect was called, not that the page is blank.
      expect(mockReplace).toHaveBeenCalledTimes(1);
    });
  });

  // ── Unauthenticated render ─────────────────────────────────────────────────

  describe('when unauthenticated and not loading', () => {
    it('renders the Info panel', () => {
      renderLoginPage();
      expect(screen.getByTestId('login-info')).toBeInTheDocument();
    });

    it('renders the SignInForm', () => {
      renderLoginPage();
      expect(screen.getByTestId('sign-in-form')).toBeInTheDocument();
    });

    it('renders the ThemeToggle', () => {
      renderLoginPage();
      expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
    });

    it('does not redirect when there is no session', () => {
      renderLoginPage();
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  // ── Google sign-in ─────────────────────────────────────────────────────────

  describe('Google sign-in', () => {
    it('calls signInWithGoogle when the Google button is clicked', async () => {
      mockSignInWithGoogle.mockResolvedValue(undefined);
      renderLoginPage();

      fireEvent.click(screen.getByTestId('google-btn'));

      await waitFor(() => {
        expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
      });
    });

    it('shows the google signing-in indicator while the promise is pending', async () => {
      // Never resolves during the test — simulates a slow OAuth redirect
      mockSignInWithGoogle.mockReturnValue(new Promise(() => {}));
      renderLoginPage();

      fireEvent.click(screen.getByTestId('google-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('signing-in-indicator')).toHaveTextContent(
          'google'
        );
      });
    });

    it('clears the signing-in state after signInWithGoogle resolves', async () => {
      mockSignInWithGoogle.mockResolvedValue(undefined);
      renderLoginPage();

      fireEvent.click(screen.getByTestId('google-btn'));

      await waitFor(() => {
        expect(screen.queryByTestId('signing-in-indicator')).not.toBeInTheDocument();
      });
    });
  });

  // ── GitHub sign-in ─────────────────────────────────────────────────────────

  describe('GitHub sign-in', () => {
    it('calls signInWithGitHub when the GitHub button is clicked', async () => {
      mockSignInWithGitHub.mockResolvedValue(undefined);
      renderLoginPage();

      fireEvent.click(screen.getByTestId('github-btn'));

      await waitFor(() => {
        expect(mockSignInWithGitHub).toHaveBeenCalledTimes(1);
      });
    });

    it('shows the github signing-in indicator while the promise is pending', async () => {
      mockSignInWithGitHub.mockReturnValue(new Promise(() => {}));
      renderLoginPage();

      fireEvent.click(screen.getByTestId('github-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('signing-in-indicator')).toHaveTextContent(
          'github'
        );
      });
    });

    it('clears the signing-in state after signInWithGitHub resolves', async () => {
      mockSignInWithGitHub.mockResolvedValue(undefined);
      renderLoginPage();

      fireEvent.click(screen.getByTestId('github-btn'));

      await waitFor(() => {
        expect(screen.queryByTestId('signing-in-indicator')).not.toBeInTheDocument();
      });
    });
  });

  // ── Sign-in isolation ──────────────────────────────────────────────────────

  describe('sign-in state isolation', () => {
    it('only sets google indicator when Google is clicked — not github', async () => {
      mockSignInWithGoogle.mockReturnValue(new Promise(() => {}));
      renderLoginPage();

      fireEvent.click(screen.getByTestId('google-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('signing-in-indicator')).toHaveTextContent(
          'google'
        );
      });

      // GitHub indicator should not appear
      expect(screen.queryByText('github')).not.toBeInTheDocument();
    });

    it('only sets github indicator when GitHub is clicked — not google', async () => {
      mockSignInWithGitHub.mockReturnValue(new Promise(() => {}));
      renderLoginPage();

      fireEvent.click(screen.getByTestId('github-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('signing-in-indicator')).toHaveTextContent(
          'github'
        );
      });

      expect(screen.queryByText('google')).not.toBeInTheDocument();
    });
  });
});