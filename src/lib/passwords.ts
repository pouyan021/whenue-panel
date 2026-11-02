// Letters and digits that cannot be misread for each other when read out at the desk.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A random password for a new or reset staff account, long enough for whenue-api's 12-character minimum. */
export function generatePassword(length = 14) {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => ALPHABET[n % ALPHABET.length]).join('');
}

export const MIN_PASSWORD_LENGTH = 12;
