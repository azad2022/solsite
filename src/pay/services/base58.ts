/** Minimal Base58 codec used by SolMint Pay for Solana addresses/signatures. */
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const LOOKUP = new Map(ALPHABET.split('').map((char, index) => [char, index]));

export function decodeBase58(value: string): Uint8Array {
  if (!value || !/^[1-9A-HJ-NP-Za-km-z]+$/.test(value)) throw new Error('Invalid base58 string.');
  const bytes: number[] = [];
  for (const char of value) {
    const digit = LOOKUP.get(char);
    if (digit === undefined) throw new Error('Invalid base58 character.');
    let carry = digit;
    for (let i = 0; i < bytes.length; i++) {
      const next = bytes[i] * 58 + carry;
      bytes[i] = next & 0xff;
      carry = next >>> 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>>= 8;
    }
  }
  let leadingZeroes = 0;
  for (const char of value) {
    if (char !== '1') break;
    leadingZeroes++;
  }
  return Uint8Array.from([...new Array(leadingZeroes).fill(0), ...bytes.reverse()]);
}

export function encodeBase58(value: Uint8Array): string {
  if (value.length === 0) return '';
  const digits: number[] = [];
  for (const byte of value) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      const next = digits[i] * 256 + carry;
      digits[i] = next % 58;
      carry = Math.floor(next / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let leadingZeroes = 0;
  for (const byte of value) {
    if (byte !== 0) break;
    leadingZeroes++;
  }
  return '1'.repeat(leadingZeroes) + (digits.length ? digits.reverse().map((digit) => ALPHABET[digit]).join('') : '');
}
