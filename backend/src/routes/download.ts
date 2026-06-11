import type { FastifyInstance } from 'fastify';
import { query } from '../lib/db.js';
import { getSignedDownloadUrl } from '../lib/storage.js';
import { basicAuth } from '../middleware/auth.js';
import archiver from 'archiver';

// Build folder path inside ZIP:
// certificates/YYYY/DESIGNATION/filename.pdf
function buildZipPath(record: any): string {
  const year = record.completion_date
    ? String(new Date(record.completion_date).getFullYear())
    : 'undated';

  const designations: string[] = (record.designations ?? [])
    .map((d: any) => (typeof d === 'string' ? d : d.designation))
    .filter(Boolean);

  const primaryDesig = designations[0] ?? 'uncategorized';
  const filename = record.original_filename ?? `${record.course_title ?? record.id}.pdf`;

  return `certificates/${year}/${primaryDesig}/${filename}`;
}

export async function downloadRoutes(app: FastifyInstance) {
  app.addHook('preHandler', basicAuth);

  // POST /records/download — ZIP selected certificates with folder structure
  app.post<{ Body: { ids: string[] } }>('/records/download', async (request, reply) => {
    const { ids } = request.body;
    if (!ids?.length) return reply.code(400).send({ error: 'No IDs provided' });

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');

    // Pull records with their designations in one query
    const records = await query(
      `SELECT
         r.id, r.original_filename, r.certificate_url,
         r.course_title, r.completion_date,
         COALESCE(
           json_agg(d.designation) FILTER (WHERE d.id IS NOT NULL),
           '[]'
         ) AS designations
       FROM cpe_records r
       LEFT JOIN cpe_designations d ON d.cpe_record_id = r.id
       WHERE r.id IN (${placeholders})
       GROUP BY r.id`,
      ids
    );

    const timestamp = new Date().toISOString().slice(0, 10);
    reply.header('Content-Type', 'application/zip');
    reply.header('Content-Disposition', `attachment; filename="cpe-export-${timestamp}.zip"`);

    const archive = archiver('zip', { zlib: { level: 6 } });

    // Pipe archive directly to the raw Node response stream
    archive.pipe(reply.raw);

    for (const record of records) {
      if (!record.certificate_url) continue;

      try {
        const storageUrl = await getSignedDownloadUrl(record.certificate_url);
        const res = await fetch(storageUrl);
        if (!res.ok) continue;

        const buffer = Buffer.from(await res.arrayBuffer());
        const zipPath = buildZipPath(record);
        archive.append(buffer, { name: zipPath });
      } catch {
        // Skip unfetchable files — don't abort the whole ZIP
        continue;
      }
    }

    await archive.finalize();
  });
}
