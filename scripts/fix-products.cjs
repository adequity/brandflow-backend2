const sqlite3 = require('sqlite3').verbose();

const dbPath = './database.sqlite';
const db = new sqlite3.Database(dbPath);

async function fixProducts() {
  try {
    console.log('🔧 상품 데이터 수정 중...');

    // 기본 상품 데이터를 company와 함께 추가
    const productsData = `
      INSERT OR REPLACE INTO Products (id, name, description, category, costPrice, sellingPrice, unit, isActive, createdBy, company, createdAt, updatedAt)
      VALUES 
        (1, 'SNS 마케팅 패키지', '인스타그램, 페이스북 통합 마케팅', '마케팅', 300000, 500000, '건', 1, 1, NULL, datetime('now'), datetime('now')),
        (2, '블로그 컨텐츠 제작', '기업 블로그 포스팅 제작 서비스', '컨텐츠', 100000, 200000, '건', 1, 1, NULL, datetime('now'), datetime('now')),
        (3, '상품 촬영 패키지', '제품 사진 촬영 및 편집', '제작', 150000, 300000, '건', 1, 1, NULL, datetime('now'), datetime('now')),
        (4, '영상 제작 서비스', '홍보 영상 기획부터 편집까지', '영상', 500000, 1000000, '건', 1, 1, NULL, datetime('now'), datetime('now'));
    `;
    
    await new Promise((resolve, reject) => {
      db.run(productsData, (err) => {
        if (err) reject(err);
        else {
          console.log('✅ 상품 데이터 추가 완료');
          resolve();
        }
      });
    });

    // 확인
    await new Promise((resolve) => {
      db.all('SELECT id, name, category, costPrice, sellingPrice FROM Products', [], (err, rows) => {
        console.log('\n📊 추가된 상품:');
        if (rows && rows.length > 0) {
          console.table(rows);
        } else {
          console.log('❌ 상품 데이터 없음');
        }
        resolve();
      });
    });

  } catch (error) {
    console.error('❌ 상품 데이터 수정 실패:', error.message);
  } finally {
    db.close();
  }
}

fixProducts();