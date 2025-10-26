'use client';

import { cn, getAvatarInitial, getDeterministicGradient } from '@/lib/utils';

type AvatarProps = {
  seed: string | null | undefined;
  label: string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizeMap: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'h-8 w-8 text-sm',
  md: 'h-12 w-12 text-base',
  lg: 'h-20 w-20 text-2xl'
};

export function GradientAvatar({ seed, label, size = 'md', className }: AvatarProps) {
  const gradient = getDeterministicGradient(seed);
  const initial = getAvatarInitial(label);

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full font-semibold uppercase text-white shadow-sm ring-1 ring-black/10',
        sizeMap[size],
        className
      )}
      style={{
        backgroundImage: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`
      }}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}
