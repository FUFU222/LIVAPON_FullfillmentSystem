import { cn, getAvatarInitial, getDeterministicGradient } from './utils';

describe('cn utility', () => {
  it('merges class names and removes duplicates', () => {
    expect(cn('px-2', 'px-2', ['font-bold'], { hidden: false, block: true })).toBe('px-2 font-bold block');
  });

  it('handles falsy values gracefully', () => {
    expect(cn('px-2', null, undefined, false && 'hidden')).toBe('px-2');
  });
});

describe('avatar utilities', () => {
  it('returns deterministic gradients for identical seeds', () => {
    const first = getDeterministicGradient('Example Company');
    const second = getDeterministicGradient('Example Company');
    expect(first).toEqual(second);
  });

  it('falls back to default initial when label missing', () => {
    expect(getAvatarInitial('')).toBe('L');
    expect(getAvatarInitial(null)).toBe('L');
  });
});
