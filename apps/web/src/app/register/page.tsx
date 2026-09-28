import { CircleCheck } from '@gravity-ui/icons';
import type { Metadata } from 'next';
import { RegisterForm } from './register-form';

export const metadata: Metadata = {
  title: 'Create your account · Meeting Brain',
};

const highlights = [
  'Keep every meeting, its date and who was there in one place',
  'Pick up where the last conversation left off',
  'Your meetings stay private to your account',
];

export default function RegisterPage() {
  return (
    <main className="grid flex-1 lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-foreground p-12 text-background lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -left-40 size-[36rem] rounded-full bg-accent/40 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -bottom-48 size-[28rem] rounded-full bg-accent/25 blur-3xl"
        />

        <Brand className="relative" />

        <div className="relative max-w-md">
          <h2 className="text-4xl leading-tight font-semibold tracking-tight text-balance">
            Every meeting, remembered.
          </h2>
          <ul className="mt-8 flex flex-col gap-4">
            {highlights.map((text) => (
              <li key={text} className="flex items-start gap-3 text-background/80">
                <CircleCheck className="mt-0.5 size-5 shrink-0 text-accent" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-background/50">© Meeting Brain</p>
      </section>

      <section className="flex items-center justify-center px-6 py-16 sm:px-12">
        <div className="w-full max-w-sm">
          <Brand className="mb-10 lg:hidden" />
          <h1 className="text-3xl font-semibold tracking-tight">Create your account</h1>
          <p className="mt-2 mb-8 text-muted">
            Start building the memory of your meetings. It takes a few seconds.
          </p>
          <RegisterForm />
        </div>
      </section>
    </main>
  );
}

function Brand({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className="grid size-9 place-items-center rounded-xl bg-accent text-sm font-bold text-accent-foreground">
        MB
      </span>
      <span className="text-lg font-semibold tracking-tight">Meeting Brain</span>
    </div>
  );
}
