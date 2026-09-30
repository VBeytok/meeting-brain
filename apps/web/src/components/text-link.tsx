import { linkVariants } from '@heroui/styles';
import NextLink from 'next/link';
import type { ComponentProps } from 'react';

// next/link with HeroUI's link styles, so in-app links navigate client-side.
// Text uses --accent-soft-foreground: --accent is 3.4:1 on --background, short
// of WCAG AA's 4.5:1 for body-size text.
export function TextLink({ className = '', ...props }: ComponentProps<typeof NextLink>) {
  return (
    <NextLink
      className={`${linkVariants().base()} font-medium text-accent-soft-foreground ${className}`}
      {...props}
    />
  );
}
