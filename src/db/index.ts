import { config } from 'dotenv';
config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || '';

// Desactiva prefetch para compatibilidad total con pooling serverless / Supabase Transaction pooler
const client = postgres(connectionString, {
  prepare: false,
  ssl: 'require',
});

export const db = drizzle(client, { schema });
