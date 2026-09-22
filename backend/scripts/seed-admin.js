import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pg from 'pg';
const { Pool } = pg;
for (const key of ['DATABASE_URL','ADMIN_USERNAME','ADMIN_PASSWORD']) {
  if (!process.env[key]) throw new Error(`${key} не задан`);
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
try {
  const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
  await pool.query(`
    INSERT INTO admin_users (username,password_hash) VALUES ($1,$2)
    ON CONFLICT (username) DO UPDATE SET password_hash=EXCLUDED.password_hash, updated_at=NOW()
  `, [process.env.ADMIN_USERNAME, hash]);
  console.log(`Admin ${process.env.ADMIN_USERNAME} seeded.`);
} finally { await pool.end(); }
