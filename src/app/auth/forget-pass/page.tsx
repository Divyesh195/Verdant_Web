'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft } from 'lucide-react';
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
import { requestPasswordReset } from './actions';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('sending');
    setError(null);

    const result = await requestPasswordReset(email);

    if (result.error) {
      setStatus('error');
      setError(result.error);
      return;
    }

    setStatus('sent');
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
              <Mail className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle className="font-display text-2xl">Reset your password</CardTitle>
            <CardDescription>We’ll send a recovery link to your email address.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {status === 'sent' ? (
              <div className="space-y-4 text-sm text-muted-foreground">
                <p>
                  If an account exists for {email}, a password reset link has been sent.
                  Check your inbox and spam folder.
                </p>
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
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
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
                  disabled={status === 'sending'}
                >
                  {status === 'sending' ? 'Sending…' : 'Send reset link'}
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