import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL не задан');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sql = await fs.readFile(path.join(__dirname, '..', 'db', '001_init.sql'), 'utf8');
try {
  await pool.query(sql);
  console.log('Migration completed.');
} finally {
  await pool.end();
}
