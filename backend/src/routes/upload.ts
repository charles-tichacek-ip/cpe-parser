import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import pdfParse from 'pdf-parse';
import unzipper from 'unzipper';
import { Readable } from 'stream';
import { query, queryOne } from '../lib/db.js';
import { parseCPEText, type ParsedCPE } from '../services/parser.js';
import { basicAuth } from '../middleware/auth.js';

interface StagingResult {
  staging_id: string;
  filename: string;
  clean_filename: string;
  status: 'staged' | 'duplicate';
  duplicate_of?: string;
  duplicate_title?: string;
}

// Rename on ingest: YYYY-MM_Provider_Title_Designations.pdf
function buildFilename(parsed: ParsedCPE, originalExt = '.pdf'): string {
  const date = parsed.completion_date
    ? parsed.completion_date.slice(0, 7)   // YYYY-MM
    : 'undated';

  const provider = (parsed.provider ?? 'unknown')
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);

  const title = (parsed.course_title ?? 'untitled')
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);

  const desigs = (parsed.designations ?? []).join('-') || 'unknown';

  return `${date}_${provider}_${title}_${desigs}${originalExt}`;
}

async function processPDFBuffer(
  buffer: Buffer,
  originalFilename: string
): Promise<StagingResult> {
  // 1. Checksum
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');

  // 2. Check for duplicate in committed records
  const existing = await queryOne<{ id: string; course_title: string }>(
    'SELECT id, course_title FROM cpe_records WHERE file_hash = $1',
    [hash]
  );

  // 3. Extract text from PDF
  let rawText = '';
  try {
    const parsed = await pdfParse(buffer);
    rawText = parsed.text;
  } catch {
    rawText = `[Could not extract text from ${originalFilename}]`;
  }

  // 4. Claude structured parse
  const parsed = await parseCPEText(rawText);

  // 5. Build clean filename from parsed data
  const cleanFilename = buildFilename(parsed);

  // 6. Store in Railway Storage (stubbed — swap in real storage client)
  // const certificateUrl = await uploadToStorage(buffer, cleanFilename);
  const certificateUrl = `pending/${hash}/${cleanFilename}`;

  // 7. Insert into staging
  const [row] = await query<{ id: string }>(
    `INSERT INTO cpe_staging
      (original_filename, file_hash, certificate_url, raw_extract,
       parsed_data, confidence, low_conf_fields, is_duplicate, duplicate_of)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id`,
    [
      originalFilename,           // preserve original for reference
      hash,
      certificateUrl,             // uses clean renamed path
      rawText,
      JSON.stringify(parsed),
      parsed.confidence,
      parsed.low_conf_fields,
      existing !== null,
      existing?.id ?? null,
    ]
  );

  if (existing) {
    return {
      staging_id: row.id,
      filename: originalFilename,
      clean_filename: cleanFilename,
      status: 'duplicate',
      duplicate_of: existing.id,
      duplicate_title: existing.course_title,
    };
  }

  return {
    staging_id: row.id,
    filename: originalFilename,
    clean_filename: cleanFilename,
    status: 'staged',
  };
}

export async function uploadRoutes(app: FastifyInstance) {
  app.addHook('preHandler', basicAuth);

  // POST /upload — accepts single PDF or ZIP of PDFs
  app.post('/upload', async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.code(400).send({ error: 'No file provided' });

    const filename = data.filename;
    const buffer = await data.toBuffer();
    const results: StagingResult[] = [];

    if (filename.endsWith('.zip')) {
      const stream = Readable.from(buffer);
      const zip = stream.pipe(unzipper.Parse({ forceStream: true }));

      for await (const entry of zip) {
        const entryFilename = (entry as any).path as string;
        if (!entryFilename.endsWith('.pdf')) {
          (entry as any).autodrain();
          continue;
        }
        const chunks: Buffer[] = [];
        for await (const chunk of entry as any) chunks.push(chunk);
        const pdfBuffer = Buffer.concat(chunks);
        const result = await processPDFBuffer(pdfBuffer, entryFilename);
        results.push(result);
      }
    } else if (filename.endsWith('.pdf')) {
      const result = await processPDFBuffer(buffer, filename);
      results.push(result);
    } else {
      return reply.code(400).send({ error: 'Only PDF or ZIP files are accepted' });
    }

    return reply.send({ results, count: results.length });
  });
}
