import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth-shell';
import { TextLink } from '@/components/text-link';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Sign in · Meeting Brain',
};

export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to see your meetings.">
      <LoginForm />
      <p className="mt-8 text-center text-sm text-muted">
        Don&apos;t have an account? <TextLink href="/register">Create one</TextLink>
      </p>
    </AuthShell>
  );
}
