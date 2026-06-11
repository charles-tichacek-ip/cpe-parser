import type { FastifyInstance } from 'fastify';
import { query, queryOne } from '../lib/db.js';
import { basicAuth } from '../middleware/auth.js';
import { getSignedDownloadUrl } from '../lib/storage.js';

export async function recordsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', basicAuth);

  // GET /records — all accepted records with designations
  app.get('/records', async (_request, reply) => {
    const records = await query(
      `SELECT r.*,
        COALESCE(
          json_agg(json_build_object(
            'designation', d.designation,
            'category', d.category,
            'hours_claimed', d.hours_claimed
          )) FILTER (WHERE d.id IS NOT NULL),
          '[]'
        ) AS designations
       FROM cpe_records r
       LEFT JOIN cpe_designations d ON d.cpe_record_id = r.id
       GROUP BY r.id
       ORDER BY r.completion_date DESC NULLS LAST`
    );
    return reply.send(records);
  });

  // GET /records/summary — compliance summary by designation + year
  app.get('/records/summary', async (_request, reply) => {
    const currentYear = new Date().getFullYear();

    const rows = await query(
      `SELECT
        d.designation,
        EXTRACT(YEAR FROM r.completion_date)::int AS year,
        COUNT(*)::int AS course_count,
        SUM(d.hours_claimed)::numeric AS total_hours,
        SUM(CASE WHEN r.is_verifiable THEN d.hours_claimed ELSE 0 END)::numeric AS verifiable_hours
       FROM cpe_designations d
       JOIN cpe_records r ON r.id = d.cpe_record_id
       WHERE r.completion_date IS NOT NULL
       GROUP BY d.designation, year
       ORDER BY designation, year DESC`
    );

    // Compliance targets
    const targets: Record<string, { annual: number; verifiable?: number }> = {
      CIA:  { annual: 40 },
      CISA: { annual: 20 },
      CPA:  { annual: 20, verifiable: 10 },
      CITP: { annual: 20 },
      BABL: { annual: 20 },
    };

    // Build compliance flags for current year
    const summary = rows.map(row => {
      const target = targets[row.designation];
      const isCurrentYear = row.year === currentYear;
      return {
        ...row,
        target_hours: target?.annual ?? null,
        target_verifiable: target?.verifiable ?? null,
        on_track: isCurrentYear && target
          ? Number(row.total_hours) >= target.annual &&
            (!target.verifiable || Number(row.verifiable_hours) >= target.verifiable)
          : null,
      };
    });

    return reply.send(summary);
  });

  // GET /records/:id — single record with designations
  app.get<{ Params: { id: string } }>('/records/:id', async (request, reply) => {
    const record = await queryOne(
      `SELECT r.*,
        COALESCE(
          json_agg(json_build_object(
            'id', d.id,
            'designation', d.designation,
            'category', d.category,
            'hours_claimed', d.hours_claimed
          )) FILTER (WHERE d.id IS NOT NULL),
          '[]'
        ) AS designations
       FROM cpe_records r
       LEFT JOIN cpe_designations d ON d.cpe_record_id = r.id
       WHERE r.id = $1
       GROUP BY r.id`,
      [request.params.id]
    );
    if (!record) return reply.code(404).send({ error: 'Not found' });
    return reply.send(record);
  });

  // PATCH /records/:id — update a record
  app.patch<{ Params: { id: string }; Body: any }>(
    '/records/:id',
    async (request, reply) => {
      const fields = request.body as Record<string, any>;
      const allowed = ['provider','course_title','completion_date','credit_hours',
                       'delivery_method','is_verifiable','notes'];
      const updates = Object.entries(fields).filter(([k]) => allowed.includes(k));
      if (!updates.length) return reply.code(400).send({ error: 'No valid fields to update' });

      const setClauses = updates.map(([k], i) => `${k} = $${i + 2}`).join(', ');
      const values = [request.params.id, ...updates.map(([, v]) => v)];

      await query(`UPDATE cpe_records SET ${setClauses} WHERE id = $1`, values);
      return reply.send({ updated: true });
    }
  );

  // GET /certificate/:id — redirect to signed PDF URL
  app.get<{ Params: { id: string } }>('/certificate/:id', async (request, reply) => {
    const record = await queryOne<{ certificate_url: string }>(
      'SELECT certificate_url FROM cpe_records WHERE id = $1',
      [request.params.id]
    );
    if (!record?.certificate_url) return reply.code(404).send({ error: 'Not found' });
    const url = await getSignedDownloadUrl(record.certificate_url);
    return reply.redirect(url);
  });
}
