import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const failures = new Map<string, { count: number; resetAt: number }>();

function isLockedOut(ip: string): boolean {
  const entry = failures.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    failures.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

function recordFailure(ip: string) {
  const entry = failures.get(ip);
  if (!entry || Date.now() > entry.resetAt) {
    failures.set(ip, { count: 1, resetAt: Date.now() + WINDOW_MS });
  } else {
    entry.count++;
  }
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// Shared by Basic auth and POST /api/auth so both count toward the same lockout.
export function checkPassword(request: FastifyRequest, reply: FastifyReply, user: string, pass: string): boolean {
  if (isLockedOut(request.ip)) {
    reply.code(429).send({ error: 'Too many failed attempts. Try again in 15 minutes.' });
    return false;
  }
  const expectedUser = process.env.AUTH_USER ?? 'admin';
  const expectedPass = process.env.AUTH_PASS;
  if (!expectedPass) return true; // No password set — open in dev
  if (safeEqual(user, expectedUser) && safeEqual(pass, expectedPass)) return true;
  recordFailure(request.ip);
  return false;
}

export async function basicAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    reply.header('WWW-Authenticate', 'Basic realm="CPE Parser"');
    reply.code(401).send({ error: 'Authentication required' });
    return;
  }

  const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
  const idx = decoded.indexOf(':');
  const user = idx === -1 ? decoded : decoded.slice(0, idx);
  const pass = idx === -1 ? '' : decoded.slice(idx + 1);

  if (!checkPassword(request, reply, user, pass) && !reply.sent) {
    reply.header('WWW-Authenticate', 'Basic realm="CPE Parser"');
    reply.code(401).send({ error: 'Invalid credentials' });
  }
}
