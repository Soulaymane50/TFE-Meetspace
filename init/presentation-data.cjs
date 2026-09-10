// Outil explicite de préparation de la présentation MeetSpace. Jamais lancé au démarrage.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const repo = path.resolve(__dirname, '..');
const mysql = path.join(repo, 'tools/mysql-8.0.45-winx64/bin/mysql.exe');
const mode = process.argv[2] || 'inspect';
const jdbc = process.env.DB_URL;
if (!jdbc || !process.env.DB_USERNAME || !process.env.DB_PASSWORD) throw new Error('Variables DB_URL, DB_USERNAME et DB_PASSWORD requises.');
const db = new URL(jdbc.replace(/^jdbc:/, ''));
function sql(query) {
  const result = spawnSync(mysql, ['--protocol=TCP', `--host=${db.hostname}`, `--port=${db.port || 3306}`, `--user=${process.env.DB_USERNAME}`, `--database=${db.pathname.slice(1)}`, '--default-character-set=utf8mb4', '--batch', '--raw', '--skip-column-names'], {
    input: query, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD },
  });
  if (result.status !== 0) throw new Error((result.stderr || 'Échec MySQL').replaceAll(process.env.DB_PASSWORD, '[masqué]'));
  return result.stdout.trim();
}
if (mode === 'schema') {
  console.log(sql("SELECT table_name,column_name,column_type FROM information_schema.columns WHERE table_schema=DATABASE() AND (data_type='enum' OR column_name IN ('status','type','action','tone')) ORDER BY table_name,column_name; SELECT version,description,success FROM flyway_schema_history ORDER BY installed_rank; SELECT 'import-events',COUNT(*) FROM event WHERE id BETWEEN 16000 AND 16099; SELECT 'import-users',COUNT(*) FROM utilisateur WHERE id BETWEEN 12000 AND 12201;"));
} else if (mode === 'inspect') {
  console.log(sql(`SELECT 'users',role,status,COUNT(*) FROM utilisateur GROUP BY role,status;
    SELECT 'events',status,COUNT(*) FROM event WHERE start_date_time >= '2026-09-01' AND start_date_time < '2026-12-01' GROUP BY status;
    SELECT 'registrations',r.status,COUNT(*),SUM(r.number_of_participants) FROM event_registration r JOIN event e ON e.id=r.event_id WHERE e.start_date_time >= '2026-09-01' AND e.start_date_time < '2026-12-01' GROUP BY r.status;
    SELECT 'room',id,name,capacity,base_price,status FROM espace;
    SELECT 'schedule',id,title,space_id,start_date_time,end_date_time,status,created_by FROM event WHERE start_date_time >= '2026-09-01' AND start_date_time < '2026-12-01' ORDER BY start_date_time;
    SELECT 'room-booking',id,espace_id,start_date_time,end_date_time,status FROM espace_reservation WHERE start_date_time >= '2026-09-01' AND start_date_time < '2026-12-01';
    SELECT 'payment-config',COUNT(*) FROM event WHERE deposit_paid_at IS NOT NULL;
    SELECT 'demo-users',id,email,role FROM utilisateur WHERE email LIKE '%meetspace-demo.test' OR email LIKE '%meetspace.local';
    SELECT 'max-ids',(SELECT MAX(id) FROM utilisateur),(SELECT MAX(id) FROM event),(SELECT MAX(id) FROM event_registration),(SELECT MAX(id) FROM parking_reservation);
  `));
} else {
  throw new Error('Mode inconnu.');
}
