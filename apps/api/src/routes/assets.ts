import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../db';

const AssetRowSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  owner_id: z.string().uuid(),
  filename: z.string(),
  url: z.string().url(),
  size_bytes: z.number(),
  created_at: z.coerce.date(),
});

function serializeAsset(row: unknown) {
  const parsed = AssetRowSchema.parse(row);
  return {
    id: parsed.id,
    projectId: parsed.project_id,
    ownerId: parsed.owner_id,
    filename: parsed.filename,
    url: parsed.url,
    sizeBytes: parsed.size_bytes,
    createdAt: parsed.created_at.toISOString(),
  };
}

const CreateAssetSchema = z.object({
  projectId: z.string().uuid(),
  ownerId: z.string().uuid(),
  filename: z.string().min(1),
  url: z.string().url(),
  sizeBytes: z.number().positive(),
});

export function registerAssetRoutes(server: FastifyInstance) {
  server.get('/projects/:projectId/assets', async (request, reply) => {
    const projectId = z.string().uuid().parse((request.params as { projectId: string }).projectId);
    const rows = await query('SELECT * FROM assets WHERE project_id = $1 ORDER BY created_at DESC', [projectId]);
    return rows.map((row) => serializeAsset(row));
  });

  server.post('/projects/:projectId/assets', async (request, reply) => {
    const projectId = z.string().uuid().parse((request.params as { projectId: string }).projectId);
    const body = CreateAssetSchema.parse({ ...request.body, projectId });
    const rows = await query(
      `INSERT INTO assets (project_id, owner_id, filename, url, size_bytes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [body.projectId, body.ownerId, body.filename, body.url, body.sizeBytes],
    );
    reply.code(201);
    return serializeAsset(rows[0]);
  });

  server.delete('/projects/:projectId/assets/:assetId', async (request, reply) => {
    const params = request.params as { projectId: string; assetId: string };
    const projectId = z.string().uuid().parse(params.projectId);
    const assetId = z.string().uuid().parse(params.assetId);
    await query('DELETE FROM assets WHERE id = $1 AND project_id = $2', [assetId, projectId]);
    reply.code(204);
  });
}
