import { createMigrationPool } from './src/db/pool.js';

const pool = createMigrationPool();
const tables = ['batches', 'students', 'attendance_sessions', 'attendance_logs', 'escalation_tasks', 'leads', 'users'];

for (const table of tables) {
  const result = await pool.query(`SELECT COUNT(*) FROM ${table}`);
  console.log(`${table}: ${result.rows[0].count}`);
}
await pool.end();