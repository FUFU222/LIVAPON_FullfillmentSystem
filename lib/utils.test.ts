import { cn } from './utils';

describe('cn utility', () => {
  it('merges class names and removes duplicates', () => {
    expect(cn('px-2', 'px-2', ['font-bold'], { hidden: false, block: true })).toBe('px-2 font-bold block');
  });

  it('handles falsy values gracefully', () => {
    expect(cn('px-2', null, undefined, false && 'hidden')).toBe('px-2');
  });
});
