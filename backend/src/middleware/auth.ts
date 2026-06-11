import type { FastifyRequest, FastifyReply } from 'fastify';

export async function basicAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    reply.header('WWW-Authenticate', 'Basic realm="CPE Parser"');
    reply.code(401).send({ error: 'Authentication required' });
    return;
  }

  const base64 = authHeader.slice(6);
  const decoded = Buffer.from(base64, 'base64').toString('utf-8');
  const [user, pass] = decoded.split(':');

  const expectedUser = process.env.AUTH_USER ?? 'admin';
  const expectedPass = process.env.AUTH_PASS;

  if (!expectedPass) {
    // No password set — open in dev
    return;
  }

  if (user !== expectedUser || pass !== expectedPass) {
    reply.header('WWW-Authenticate', 'Basic realm="CPE Parser"');
    reply.code(401).send({ error: 'Invalid credentials' });
  }
}
