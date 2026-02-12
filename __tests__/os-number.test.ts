import { extractOsNumber, extractOsNumberFromParts } from '@/lib/orders/os-number';

describe('os number extraction', () => {
  it('extracts canonical OS number from standard format', () => {
    expect(extractOsNumber('(OS-01115463)')).toBe('OS-01115463');
  });

  it('extracts OS number even without parentheses or hyphen', () => {
    expect(extractOsNumber('配送先末尾 OS01115463')).toBe('OS-01115463');
  });

  it('extracts OS number from full-width mixed text', () => {
    expect(extractOsNumber('（ｏｓ－０１１１５４６３）')).toBe('OS-01115463');
  });

  it('returns null when OS number does not exist', () => {
    expect(extractOsNumber('千葉県 白井市中 149-1MT2F バース16')).toBeNull();
  });

  it('picks OS number from first matching part', () => {
    expect(extractOsNumberFromParts([null, '住所', 'OS 01115463'])).toBe('OS-01115463');
  });
});
