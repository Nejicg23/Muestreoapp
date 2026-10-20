import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// Desactiva prefetch para compatibilidad total con pooling serverless
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });