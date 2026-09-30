import { buttonVariants } from '@heroui/styles';
import NextLink from 'next/link';
import type { ComponentProps } from 'react';

type ButtonStyle = NonNullable<Parameters<typeof buttonVariants>[0]>;

// next/link that looks like a HeroUI Button, for navigation that reads as an
// action ("New meeting"). A real <a>, so it opens in a new tab and prefetches.
export function ButtonLink({
  className = '',
  size,
  variant,
  fullWidth,
  ...props
}: ComponentProps<typeof NextLink> & Pick<ButtonStyle, 'size' | 'variant' | 'fullWidth'>) {
  return (
    <NextLink className={buttonVariants({ size, variant, fullWidth, className })} {...props} />
  );
}
