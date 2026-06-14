import type { FastifyInstance } from 'fastify';
import { query, queryOne } from '../lib/db.js';
import { getSignedDownloadUrl } from '../lib/storage.js';
import { basicAuth } from '../middleware/auth.js';

export async function stagingRoutes(app: FastifyInstance) {
  app.addHook('preHandler', basicAuth);

  // GET /staging — all pending rows
  app.get('/staging', async (_request, reply) => {
    const rows = await query(
      `SELECT id, original_filename, confidence, low_conf_fields,
              is_duplicate, duplicate_of, status, created_at,
              certificate_url, parsed_data
       FROM cpe_staging
       WHERE status = 'pending'
       ORDER BY created_at DESC`
    );

    // Attach duplicate source title if flagged
    for (const row of rows) {
      if (row.is_duplicate && row.duplicate_of) {
        const src = await queryOne<{ course_title: string }>(
          'SELECT course_title FROM cpe_records WHERE id = $1',
          [row.duplicate_of]
        );
        row.duplicate_title = src?.course_title ?? null;
      }
    }

    return reply.send(rows);
  });

  // GET /staging/:id — single staging row with full parsed_data
  app.get<{ Params: { id: string } }>('/staging/:id', async (request, reply) => {
    const row = await queryOne(
      'SELECT * FROM cpe_staging WHERE id = $1',
      [request.params.id]
    );
    if (!row) return reply.code(404).send({ error: 'Not found' });
    return reply.send(row);
  });

  // POST /staging/:id/accept — promote to cpe_records
  app.post<{ Params: { id: string }; Body: any }>(
    '/staging/:id/accept',
    async (request, reply) => {
      const staged = await queryOne<any>(
        'SELECT * FROM cpe_staging WHERE id = $1 AND status = $2',
        [request.params.id, 'pending']
      );
      if (!staged) return reply.code(404).send({ error: 'Staging row not found or already processed' });
      if (staged.is_duplicate) return reply.code(409).send({ error: 'Duplicate — cannot accept' });

      // Allow overriding parsed fields from request body
      const data = { ...(staged.parsed_data as Record<string, unknown>), ...(request.body as Record<string, unknown>) };

      // Insert into cpe_records
      const [record] = await query<{ id: string }>(
        `INSERT INTO cpe_records
          (provider, course_title, completion_date, credit_hours,
           delivery_method, is_verifiable, notes, raw_input,
           file_hash, certificate_url, original_filename, confidence)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING id`,
        [
          data.provider,
          data.course_title,
          data.completion_date || null,
          data.credit_hours,
          data.delivery_method,
          data.is_verifiable ?? true,
          data.notes,
          staged.raw_extract,
          staged.file_hash,
          staged.certificate_url,
          staged.original_filename,
          staged.confidence,
        ]
      );

      // Insert designation rows
      const designations: string[] = (data.designations as string[]) ?? [];
      const categories = (data.categories as Record<string, string> | undefined) ?? {};
      for (const desig of designations) {
        const category = categories[desig] ?? null;
        const hours = data.credit_hours ?? null;
        await query(
          `INSERT INTO cpe_designations (cpe_record_id, designation, category, hours_claimed)
           VALUES ($1,$2,$3,$4)`,
          [record.id, desig, category, hours]
        );
      }

      // Mark staging row accepted
      await query(
        `UPDATE cpe_staging SET status = 'accepted', reviewed_at = now() WHERE id = $1`,
        [staged.id]
      );

      return reply.send({ accepted: true, record_id: record.id });
    }
  );

  // POST /staging/:id/reject
  app.post<{ Params: { id: string }; Body: { reason?: string } }>(
    '/staging/:id/reject',
    async (request, reply) => {
      const result = await query(
        `UPDATE cpe_staging
         SET status = 'rejected', rejection_reason = $2, reviewed_at = now()
         WHERE id = $1 AND status = 'pending'
         RETURNING id`,
        [request.params.id, request.body?.reason ?? null]
      );
      if (!result.length) return reply.code(404).send({ error: 'Not found or already processed' });
      return reply.send({ rejected: true });
    }
  );

  // GET /staging/:id/certificate — redirect to signed PDF URL
  app.get<{ Params: { id: string } }>('/staging/:id/certificate', async (request, reply) => {
    const row = await queryOne<{ certificate_url: string }>(
      'SELECT certificate_url FROM cpe_staging WHERE id = $1',
      [request.params.id]
    );
    if (!row?.certificate_url) return reply.code(404).send({ error: 'Not found' });
    const url = await getSignedDownloadUrl(row.certificate_url);
    return reply.redirect(url);
  });
}
