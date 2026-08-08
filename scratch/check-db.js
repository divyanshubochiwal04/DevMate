const { Pool } = require('pg');
require('dotenv').config();

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    const tableRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('--- DATABASE TABLES ---');
    const tables = tableRes.rows.map(r => r.table_name);
    console.log(tables.join(', '));

    console.log('\n--- ROW COUNTS FOR CALENDAR-RELATED TABLES ---');
    const calendarTables = tables.filter(t => t.includes('calendar') || t.includes('event'));
    if (calendarTables.length === 0) {
      console.log('No calendar or event tables found.');
    } else {
      for (const table of calendarTables) {
        const countRes = await pool.query(`SELECT COUNT(*) FROM "${table}"`);
        console.log(`Table: ${table} | Rows: ${countRes.rows[0].count}`);
      }
    }
  } catch (err) {
    console.error('Error querying database:', err);
  } finally {
    await pool.end();
  }
}

main();
