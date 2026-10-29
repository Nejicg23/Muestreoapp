import { config } from 'dotenv';
config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

function decodeSafe(val: string): string {
  try {
    return decodeURIComponent(val);
  } catch {
    return val;
  }
}

function sanitizeDatabaseUrl(rawUrl?: string): string {
  if (!rawUrl) return '';
  let str = rawUrl.trim();

  // 1. Eliminar comillas envolventes si fueron pegadas en las variables de entorno
  if (
    (str.startsWith('"') && str.endsWith('"')) ||
    (str.startsWith("'") && str.endsWith("'"))
  ) {
    str = str.slice(1, -1).trim();
  }

  // 2. Eliminar prefijo "DATABASE_URL=" si se pegó la línea completa en Vercel
  if (/^DATABASE_URL\s*=/i.test(str)) {
    str = str.replace(/^DATABASE_URL\s*=\s*/i, '').trim();
  }

  // 3. Sanitizar credenciales (quitar corchetes [PASSWORD] de plantilla Supabase y codificar caracteres especiales como @, #, ?)
  const protoMatch = str.match(/^(postgres(?:ql)?:\/\/)(.+)$/i);
  if (protoMatch) {
    const proto = protoMatch[1];
    const rest = protoMatch[2];
    const slashIdx = rest.indexOf('/');
    const authority = slashIdx !== -1 ? rest.slice(0, slashIdx) : rest;
    const pathAndQuery = slashIdx !== -1 ? rest.slice(slashIdx) : '/postgres';

    const lastAtIdx = authority.lastIndexOf('@');
    if (lastAtIdx !== -1) {
      const userPass = authority.slice(0, lastAtIdx);
      let hostPort = authority.slice(lastAtIdx + 1).trim();
      // Quitar corchetes si se dejaron en el host por error
      hostPort = hostPort.replace(/^\[|\]$/g, '');

      const colonIdx = userPass.indexOf(':');
      if (colonIdx !== -1) {
        const rawUser = userPass.slice(0, colonIdx);
        let rawPass = userPass.slice(colonIdx + 1);

        // Si se dejaron los corchetes de la plantilla de Supabase: [TU_PASSWORD] -> TU_PASSWORD
        if (rawPass.startsWith('[') && rawPass.endsWith(']')) {
          rawPass = rawPass.slice(1, -1);
        }

        const safeUser = encodeURIComponent(decodeSafe(rawUser));
        const safePass = encodeURIComponent(decodeSafe(rawPass));
        str = `${proto}${safeUser}:${safePass}@${hostPort}${pathAndQuery}`;
      }
    }
  }

  // 4. Comprobar validez con new URL() para evitar que el build de Next.js falle con TypeError: Invalid URL
  try {
    new URL(str);
    return str;
  } catch {
    console.warn(
      '⚠️ [db] DATABASE_URL no tiene un formato de URL válido. Revisa la variable en Vercel.'
    );
    return '';
  }
}

const connectionString = sanitizeDatabaseUrl(process.env.DATABASE_URL);

// Desactiva prefetch para compatibilidad total con pooling serverless / Supabase Transaction pooler
const client = postgres(connectionString, {
  prepare: false,
  ssl: 'require',
});

export const db = drizzle(client, { schema });
