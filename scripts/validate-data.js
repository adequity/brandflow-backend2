import Database from 'sqlite3';
import fs from 'fs';

const { verbose } = Database;

const dbPath = './database.sqlite';

const db = new verbose().Database(dbPath, (err) => {
  if (err) {
    console.error('❌ 데이터베이스 연결 실패:', err.message);
    process.exit(1);
  }
  console.log('✅ 데이터베이스 연결 성공');
});

function runQuery(sql, description) {
  return new Promise((resolve, reject) => {
    db.all(sql, [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        console.log(`\n📊 ${description}`);
        console.table(rows);
        resolve(rows);
      }
    });
  });
}

async function validateData() {
  try {
    // 1. 필수 데이터 존재 확인
    await runQuery(`
      SELECT 
        'Users' as table_name,
        COUNT(*) as total_count,
        COUNT(CASE WHEN isActive = 1 THEN 1 END) as active_count
      FROM Users;
    `, '사용자 데이터 현황');

    await runQuery(`
      SELECT 
        'Products' as table_name,
        COUNT(*) as total_count,
        COUNT(CASE WHEN isActive = 1 THEN 1 END) as active_count
      FROM Products;
    `, '상품 데이터 현황');

    // 2. 권한 시스템 검증
    await runQuery(`
      SELECT 
        role,
        COUNT(*) as user_count,
        GROUP_CONCAT(DISTINCT company) as companies
      FROM Users 
      GROUP BY role;
    `, '사용자 역할별 분포');

    // 3. 데이터 관계 무결성 확인
    await runQuery(`
      SELECT 
        'Campaigns with valid users' as check_name,
        COUNT(*) as valid_count
      FROM Campaigns c 
      JOIN Users u ON c.managerId = u.id;
    `, '캠페인-사용자 관계 검증');

    await runQuery(`
      SELECT 
        'Posts with valid campaigns' as check_name,
        COUNT(*) as valid_count  
      FROM Posts p 
      JOIN Campaigns c ON p.campaignId = c.id;
    `, '게시물-캠페인 관계 검증');

    // 4. 최근 활동 확인
    await runQuery(`
      SELECT 
        'Recent user activity (7 days)' as metric,
        COUNT(*) as value
      FROM Users 
      WHERE createdAt >= datetime('now', '-7 days');
    `, '최근 7일 사용자 활동');

    console.log('\n✅ 데이터 검증 완료');
    
  } catch (error) {
    console.error('❌ 데이터 검증 실패:', error.message);
  } finally {
    db.close();
  }
}

validateData();