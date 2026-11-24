import { createMigrationPool } from './src/db/pool.js';

const pool = createMigrationPool();
const result = await pool.query('SELECT email, email_verified, avatar_initials FROM users WHERE email = $1', ['admin@pdoclasses.in']);
console.log('User:', result.rows);
await pool.end();