import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function normalizeSeed(seed: string | null | undefined) {
  return seed && seed.trim().length > 0 ? seed.trim().toLowerCase() : 'livapon';
}

function hashString(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getDeterministicGradient(seedInput: string | null | undefined) {
  const seed = normalizeSeed(seedInput);
  const hash = hashString(seed);

  const hueA = hash % 360;
  const hueB = (hash * 11 + 47) % 360;
  const saturation = 70;
  const lightnessA = 65;
  const lightnessB = 55;

  return {
    from: `hsl(${hueA}deg ${saturation}% ${lightnessA}%)`,
    to: `hsl(${hueB}deg ${saturation}% ${lightnessB}%)`
  } as const;
}

export function getAvatarInitial(label: string | null | undefined) {
  if (!label) {
    return 'L';
  }

  const trimmed = label.trim();
  if (trimmed.length === 0) {
    return 'L';
  }

  return trimmed[0]?.toLocaleUpperCase?.() ?? 'L';
}
