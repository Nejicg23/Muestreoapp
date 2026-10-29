import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';

async function testConnection() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    console.error('❌ ERROR: DATABASE_URL no está definida en .env.local');
    process.exit(1);
  }

  console.log('🔄 Conectando a la base de datos PostgreSQL...');

  const sql = postgres(url, { max: 1 });

  try {
    const result = await sql`SELECT NOW() AS current_time, current_database() AS db_name;`;
    console.log(' Conexión exitosa!');
    console.log(` Base de datos: ${result[0].db_name}`);
    console.log(` Hora del servidor: ${result[0].current_time}`);
  } catch (error) {
    console.error('❌ Error de conexión:', error);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

testConnection();