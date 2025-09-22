import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../db';

const ProjectRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  owner_id: z.string().uuid(),
  bpm: z.number(),
  time_signature_num: z.number(),
  time_signature_den: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

function serializeProject(row: unknown) {
  const parsed = ProjectRowSchema.parse(row);
  return {
    id: parsed.id,
    name: parsed.name,
    ownerId: parsed.owner_id,
    bpm: parsed.bpm,
    timeSignature: [parsed.time_signature_num, parsed.time_signature_den] as [number, number],
    createdAt: parsed.created_at.toISOString(),
    updatedAt: parsed.updated_at.toISOString(),
  };
}

const CreateProjectSchema = z.object({
  name: z.string().min(1),
  ownerId: z.string().uuid(),
  bpm: z.number().min(40).max(300).default(128),
  timeSignature: z.tuple([z.number().positive(), z.number().positive()]).default([4, 4]),
});

const UpdateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  bpm: z.number().min(40).max(300).optional(),
  timeSignature: z.tuple([z.number().positive(), z.number().positive()]).optional(),
});

export function registerProjectRoutes(server: FastifyInstance) {
  server.get('/projects', async () => {
    const rows = await query('SELECT * FROM projects ORDER BY updated_at DESC');
    return rows.map((row) => serializeProject(row));
  });

  server.get('/projects/:id', async (request, reply) => {
    const id = z.string().uuid().parse((request.params as { id: string }).id);
    const rows = await query('SELECT * FROM projects WHERE id = $1', [id]);
    if (!rows[0]) {
      reply.code(404);
      return { message: 'Project not found' };
    }
    return serializeProject(rows[0]);
  });

  server.post('/projects', async (request, reply) => {
    const body = CreateProjectSchema.parse(request.body);
    const [numerator, denominator] = body.timeSignature;
    const rows = await query(
      `INSERT INTO projects (name, owner_id, bpm, time_signature_num, time_signature_den)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [body.name, body.ownerId, body.bpm, numerator, denominator],
    );
    reply.code(201);
    return serializeProject(rows[0]);
  });

  server.put('/projects/:id', async (request, reply) => {
    const id = z.string().uuid().parse((request.params as { id: string }).id);
    const body = UpdateProjectSchema.parse(request.body ?? {});
    const projectRows = await query('SELECT * FROM projects WHERE id = $1', [id]);
    if (!projectRows[0]) {
      reply.code(404);
      return { message: 'Project not found' };
    }
    const project = projectRows[0] as Record<string, unknown>;
    const [num, den] = (body.timeSignature ?? [project.time_signature_num, project.time_signature_den]) as [
      number,
      number,
    ];
    const rows = await query(
      `UPDATE projects
       SET name = $1,
           bpm = $2,
           time_signature_num = $3,
           time_signature_den = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [body.name ?? project.name, body.bpm ?? project.bpm, num, den, id],
    );
    return serializeProject(rows[0]);
  });

  server.delete('/projects/:id', async (request, reply) => {
    const id = z.string().uuid().parse((request.params as { id: string }).id);
    await query('DELETE FROM projects WHERE id = $1', [id]);
    reply.code(204);
  });
}
