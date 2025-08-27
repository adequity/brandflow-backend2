const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const dbPath = './database.sqlite';

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ 데이터베이스 연결 실패:', err.message);
    process.exit(1);
  }
  console.log('✅ 데이터베이스 연결 성공');
});

async function setupProduction() {
  try {
    console.log('\n🧹 테스트 데이터 정리 중...');
    const cleanupSql = fs.readFileSync('./migrations/cleanup-test-data.sql', 'utf8');
    
    await new Promise((resolve, reject) => {
      db.exec(cleanupSql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log('✅ 테스트 데이터 정리 완료');

    console.log('\n🔧 실제 고객 데이터 설정 중...');
    const setupSql = fs.readFileSync('./migrations/customer-setup.sql', 'utf8');
    
    await new Promise((resolve, reject) => {
      db.exec(setupSql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log('✅ 고객 데이터 설정 완료');

    // 최종 데이터 확인
    console.log('\n📊 최종 데이터베이스 상태:');
    
    const tables = ['Users', 'Products', 'WorkTypes'];
    for (const table of tables) {
      await new Promise((resolve, reject) => {
        db.all(`SELECT COUNT(*) as count FROM ${table}`, [], (err, rows) => {
          if (err) {
            console.log(`❌ ${table}: 테이블 없음`);
          } else {
            console.log(`✅ ${table}: ${rows[0].count}개 레코드`);
          }
          resolve();
        });
      });
    }

  } catch (error) {
    console.error('❌ 프로덕션 설정 실패:', error.message);
  } finally {
    db.close();
  }
}

setupProduction();