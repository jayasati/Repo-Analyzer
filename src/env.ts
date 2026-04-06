import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

/** Prisma CLI expects DATABASE_URL; Nest can reuse DB_* from TypeORM. */
function ensureDatabaseUrl(): void {
  if (process.env.DATABASE_URL?.trim()) return;
  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  if (host === undefined || user === undefined) return;
  const pass = process.env.DB_PASSWORD ?? '';
  const port = process.env.DB_PORT ?? '5432';
  const name = process.env.DB_NAME ?? 'repo_analyzer';
  process.env.DATABASE_URL = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${name}`;
}
ensureDatabaseUrl();
