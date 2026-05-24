'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';

const CURRENCY_OPTIONS = ['CAD', 'USD', 'EUR', 'GBP', 'AUD'];

export default function Settings() {
  const { theme } = useTheme();
  const { getAccessToken, signOut, profile } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [homeCurrency, setHomeCurrency] = useState(profile?.home_currency ?? 'CAD');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [confirmText, setConfirmText] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  async function handleSaveProfile() {
    setSaveStatus('saving');
    try {
      const token = await getAccessToken();
      const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          display_name: displayName,
          home_currency: homeCurrency,
        }),
      });

      if (resp.ok) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.push('/login');
  }

  async function handleDeleteAccount() {
    if (confirmText !== 'delete my account') return;
    setDeleteError('');

    const token = await getAccessToken();
    const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (resp.ok) {
      await signOut();
      router.push('/login');
    } else {
      setDeleteError('Something went wrong. Please try again or contact support.');
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold text-text-primary mb-2">Settings</h1>
        <p className="text-text-secondary">Manage your account and preferences</p>
      </div>

      {/* Appearance */}
      <Card>
        <h3 className="font-semibold text-text-primary mb-4">Appearance</h3>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-text-primary mb-1">Theme</div>
            <div className="text-sm text-text-secondary">
              Currently using {theme} mode
            </div>
          </div>
          <ThemeToggle />
        </div>
      </Card>

      {/* Profile */}
      <Card>
        <h3 className="font-semibold text-text-primary mb-4">Profile</h3>
        <div className="space-y-4">
          <Input
            label="Display Name"
            placeholder="Your name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <div className="space-y-1">
            <label className="text-sm font-medium text-text-primary">Home Currency</label>
            <select
              value={homeCurrency}
              onChange={(e) => setHomeCurrency(e.target.value)}
              className="w-full rounded-md border border-border bg-background text-text-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary"
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="primary"
              onClick={handleSaveProfile}
              disabled={saveStatus === 'saving'}
            >
              {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
            </Button>

            {saveStatus === 'success' && (
              <span className="text-sm text-accent-success">
                ✓ Profile updated
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-sm text-accent-destructive">
                Failed to save. Please try again.
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Session */}
      <Card>
        <h3 className="font-semibold text-text-primary mb-4">Session</h3>
        <p className="text-sm text-text-secondary mb-4">
          You are signed in. This will sign you out on this device.
        </p>
        <Button variant="secondary" onClick={handleSignOut}>
          Sign Out
        </Button>
      </Card>

      {/* Danger Zone */}
      <Card className="border-accent-destructive">
        <h3 className="font-semibold text-accent-destructive mb-4">Danger Zone</h3>
        <p className="text-sm text-text-secondary mb-4">
          Once you delete your account, there is no going back. All your accounts,
          transactions, and data will be permanently removed.
        </p>

        {!showDeleteConfirm ? (
          <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
            Delete Account
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-text-primary">
              Type <span className="font-mono font-semibold">delete my account</span> to confirm.
            </p>
            <Input
              placeholder="delete my account"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
            {deleteError && (
              <p className="text-sm text-accent-destructive">{deleteError}</p>
            )}
            <div className="flex gap-3">
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={confirmText !== 'delete my account'}
              >
                Confirm Delete
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setConfirmText('');
                  setDeleteError('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}   