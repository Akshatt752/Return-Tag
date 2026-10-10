import rateLimit from "express-rate-limit";

const limiter = (windowMs, limit, message) =>
  rateLimit({ windowMs, limit, standardHeaders: "draft-8", legacyHeaders: false, message: { message } });

const MINUTE = 60 * 1000;

// Generous: a whole school can sit behind one IP, and chat pages poll every 10 seconds
export const apiLimiter = limiter(15 * MINUTE, 1500, "Too many requests, please slow down");

// Slows down password guessing
export const authLimiter = limiter(15 * MINUTE, 20, "Too many attempts, please try again in a few minutes");

// Scans of public tag pages. Codes can't be guessed, and this stops anyone trying.
export const scanLimiter = limiter(15 * MINUTE, 60, "Too many lookups, please try again later");

// Finder reports. Per-tag and per-day limits are enforced in the database (see publicController).
export const reportLimiter = limiter(60 * MINUTE, 10, "Too many reports from this network, please try again later");

// Reading a conversation (the finder's page polls), and sending into one
export const finderReadLimiter = limiter(15 * MINUTE, 300, "Too many requests, please slow down");
export const finderMessageLimiter = limiter(15 * MINUTE, 40, "You're sending messages too quickly");

// Claim codes are only 8 characters, so guessing must be expensive
export const claimLimiter = limiter(15 * MINUTE, 10, "Too many claim attempts, please try again later");
