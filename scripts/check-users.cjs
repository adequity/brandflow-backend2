const sqlite3 = require('sqlite3').verbose();

const dbPath = './database.sqlite';
const db = new sqlite3.Database(dbPath);

db.all('SELECT id, name, email, role, company FROM Users ORDER BY id', [], (err, rows) => {
  if (err) {
    console.error('❌ 사용자 조회 실패:', err.message);
  } else {
    console.log('📊 현재 사용자 목록:');
    console.table(rows);
  }
  db.close();
});