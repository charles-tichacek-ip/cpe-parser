import { HeadBucketCommand } from '@aws-sdk/client-s3';
import { db } from './db.js';
import { s3, bucket } from './storage.js';

export const CLAUDE_MODEL = process.env.CLAUDE_MODEL!;

const REQUIRED = [
  'DATABASE_URL',
  'ANTHROPIC_API_KEY',
  'CLAUDE_MODEL',
  'FRONTEND_URL',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'BUCKET_NAME',
  'BUCKET_ENDPOINT_URL',
];

async function check(name: string, fn: () => Promise<void>, errors: string[]) {
  try {
    await fn();
    console.log(`startup check ok: ${name}`);
  } catch (e: any) {
    errors.push(`${name}: ${e.message ?? e}`);
  }
}

export async function runStartupChecks() {
  const errors: string[] = [];

  const missing = REQUIRED.filter(k => !process.env[k]);
  if (process.env.NODE_ENV === 'production' && !process.env.AUTH_PASS) missing.push('AUTH_PASS');
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }

  await Promise.all([
    check('database', async () => { await db.query('SELECT 1'); }, errors),
    check('bucket', async () => { await s3.send(new HeadBucketCommand({ Bucket: bucket })); }, errors),
    check(`claude model ${CLAUDE_MODEL}`, async () => {
      const res = await fetch(`https://api.anthropic.com/v1/models/${encodeURIComponent(CLAUDE_MODEL)}`, {
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
      });
      if (!res.ok) throw new Error(`Anthropic API returned ${res.status} (bad API key or unknown/deprecated model)`);
    }, errors),
  ]);

  if (errors.length) throw new Error(`Startup checks failed:\n  ${errors.join('\n  ')}`);
}
