const OS_NUMBER_PATTERN = /(?:^|[^A-Z0-9])O\s*S\s*[-_‐‑–—ー―−]?\s*([0-9]{4,})(?=$|[^A-Z0-9])/i;

function toHalfWidth(value: string): string {
  return value.replace(/[！-～]/g, (char) => {
    return String.fromCharCode(char.charCodeAt(0) - 0xfee0);
  });
}

export function extractOsNumber(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = toHalfWidth(value).toUpperCase();
  const match = normalized.match(OS_NUMBER_PATTERN);
  if (!match) {
    return null;
  }

  const digits = match[1];
  return digits ? `OS-${digits}` : null;
}

export function extractOsNumberFromParts(
  values: Array<string | null | undefined>
): string | null {
  for (const value of values) {
    const extracted = extractOsNumber(value);
    if (extracted) {
      return extracted;
    }
  }
  return null;
}
