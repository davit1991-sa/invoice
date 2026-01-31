import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';

export async function hashText(value: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(value, salt);
}

export async function verifyHash(value: string, hash: string): Promise<boolean> {
  return bcrypt.compare(value, hash);
}

export function generateOtpCode(): string {
  // 6 digits
  const n = Math.floor(100000 + Math.random() * 900000);
  return String(n);
}

export function randomId(bytes = 16): string {
  return randomBytes(bytes).toString('hex');
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function randomTokenBase64Url(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}
