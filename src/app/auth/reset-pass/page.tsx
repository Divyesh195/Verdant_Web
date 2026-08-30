'use client';

import { useState } from 'react';
import Link from 'next/link';
import { KeyRound, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setStatus('error');
      setError('Passwords do not match.');
      return;
    }

    setStatus('loading');

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus('error');
      setError(error.message);
      return;
    }

    setStatus('done');
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="absolute inset-0 bg-hero-gradient" />
      <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-primary-glow/20 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-site items-center justify-center px-4">
        <Card className="w-full max-w-md border-border/60 shadow-glow backdrop-blur-sm">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary-gradient shadow-glow">
              <KeyRound className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle className="font-display text-2xl">Set a new password</CardTitle>
            <CardDescription>Create a new password for your account recovery session.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {status === 'done' ? (
              <div className="space-y-4 text-sm text-muted-foreground">
                <p>Your password has been updated. You can now sign in with the new password.</p>
                <Button asChild className="w-full bg-primary-gradient hover:opacity-90">
                  <Link href="/auth">
                    <ArrowLeft className="h-4 w-4" />
                    Back to sign in
                  </Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    required
                  />
                </div>

                {status === 'error' && error ? (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                ) : null}

                <Button
                  type="submit"
                  className="w-full bg-primary-gradient hover:opacity-90"
                  disabled={status === 'loading'}
                >
                  {status === 'loading' ? 'Updating…' : 'Update password'}
                </Button>

                <div className="flex items-center justify-center">
                  <Link href="/auth" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                    Back to sign in
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}