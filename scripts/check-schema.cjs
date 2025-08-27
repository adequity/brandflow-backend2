const sqlite3 = require('sqlite3').verbose();

const dbPath = './database.sqlite';
const db = new sqlite3.Database(dbPath);

function getTableInfo(tableName) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${tableName})`, [], (err, rows) => {
      if (err) {
        console.log(`❌ ${tableName}: 테이블 없음`);
        resolve([]);
      } else {
        console.log(`\n📋 ${tableName} 테이블 구조:`);
        console.table(rows);
        resolve(rows);
      }
    });
  });
}

async function checkSchema() {
  console.log('🔍 데이터베이스 스키마 확인 중...\n');
  
  const tables = ['Users', 'Products', 'Campaigns', 'WorkTypes', 'PurchaseRequests', 'Sales'];
  
  for (const table of tables) {
    await getTableInfo(table);
  }
  
  // 현재 데이터 확인
  console.log('\n📊 현재 데이터:');
  db.all('SELECT name, email, role, company FROM Users LIMIT 10', [], (err, rows) => {
    if (err) {
      console.error('❌ 사용자 데이터 조회 실패:', err.message);
    } else {
      console.table(rows);
    }
    db.close();
  });
}

checkSchema();