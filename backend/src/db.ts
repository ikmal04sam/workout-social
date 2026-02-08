import { Pool } from 'pg';

const connectionString =
  process.env.DATABASE_URL ||
  (process.env.DB_USER || process.env.DB_NAME
    ? `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'workout_social'}`
    : 'postgresql://tommycomeau@localhost:5432/workout_social');

const pool = new Pool({ connectionString });

// Test the connection
pool.query('SELECT NOW()', (err: any, res: any) => {
  if (err) {
    console.error('❌ Database connection failed:', err);
  } else {
    console.log('✅ Database connected at:', res.rows[0].now);
  }
});

export default pool;