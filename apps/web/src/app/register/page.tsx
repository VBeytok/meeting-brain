import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth-shell';
import { TextLink } from '@/components/text-link';
import { RegisterForm } from './register-form';

export const metadata: Metadata = {
  title: 'Create your account · Meeting Brain',
};

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Start building the memory of your meetings. It takes a few seconds."
    >
      <RegisterForm />
      <p className="mt-8 text-center text-sm text-muted">
        Already have an account? <TextLink href="/login">Sign in</TextLink>
      </p>
    </AuthShell>
  );
}
