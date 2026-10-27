// Amounts are stored in Rial, but people in Iran think and type in Toman (10 Rial).

export const RIAL_PER_TOMAN = 10;

/** Digits typed on a Persian or Arabic keyboard, as ASCII digits. Everything else is kept. */
export function toLatinDigits(text: string) {
  return text
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

/** A whole number typed in any digits, with or without separators; null when there is none. */
export function parseWholeNumber(text: string): number | null {
  const digits = toLatinDigits(text).replace(/[\s,٬،'_.]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  const value = Number(digits);
  return Number.isSafeInteger(value) ? value : null;
}

export function tomanToRial(toman: number) {
  return toman * RIAL_PER_TOMAN;
}

export function rialToToman(rial: number) {
  return Math.round(rial / RIAL_PER_TOMAN);
}

// A member card's QR code holds whenue://member/<id>; a USB scanner types it into the search box.
const MEMBER_CODE = /^whenue:\/\/member\/(\d+)\/?$/i;

export function memberIdFromCode(text: string): string | null {
  return MEMBER_CODE.exec(toLatinDigits(text.trim()))?.[1] ?? null;
}

/** ASCII digits shown as Persian digits, for text Intl does not format, like phone numbers. */
export function toPersianDigits(text: string) {
  return text.replace(/[0-9]/g, (d) => String.fromCharCode(0x06f0 + Number(d)));
}

/** A stored +98 mobile number the way people in Iran write it: 0912 123 4567. */
export function nationalMobile(mobile: string) {
  if (!mobile.startsWith('+98') || mobile.length !== 13) return mobile;
  const n = '0' + mobile.slice(3);
  return `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7)}`;
}
