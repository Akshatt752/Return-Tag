import { customAlphabet } from "nanoid";

// No 0/O, 1/I/L or U, so codes survive being read aloud or typed from a worn sticker
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
export const TAG_CODE_LENGTH = 10; // 30^10 ≈ 5.9e14 combinations, too many to enumerate
export const CLAIM_CODE_LENGTH = 8;

export const newTagCode = customAlphabet(CODE_ALPHABET, TAG_CODE_LENGTH);
export const newClaimCode = customAlphabet(CODE_ALPHABET, CLAIM_CODE_LENGTH);

// Accepts "k7xq2-m9pra", "K7XQ2 M9PRA", etc.
export function normalizeCode(value) {
  return typeof value === "string" ? value.toUpperCase().replace(/[^A-Z0-9]/g, "") : "";
}

export function publicAppUrl() {
  const base = process.env.PUBLIC_APP_URL || (process.env.CLIENT_URL || "http://localhost:5173").split(",")[0];
  return base.trim().replace(/\/+$/, "");
}

// The URL printed inside every QR code
export const tagUrl = (code) => `${publicAppUrl()}/t/${code}`;
