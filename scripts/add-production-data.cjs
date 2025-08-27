const sqlite3 = require('sqlite3').verbose();

const dbPath = './database.sqlite';
const db = new sqlite3.Database(dbPath);

async function addProductionData() {
  try {
    console.log('🔧 프로덕션 기본 데이터 추가 중...\n');

    // 1. WorkTypes 테이블 생성 및 데이터 추가
    await new Promise((resolve, reject) => {
      const createWorkTypesSQL = `
        CREATE TABLE IF NOT EXISTS WorkTypes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          isActive TINYINT(1) DEFAULT 1,
          createdBy INTEGER,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `;
      
      db.run(createWorkTypesSQL, (err) => {
        if (err) reject(err);
        else {
          console.log('✅ WorkTypes 테이블 생성 완료');
          resolve();
        }
      });
    });

    // 2. 기본 업무 타입 데이터 추가
    await new Promise((resolve, reject) => {
      const workTypesData = `
        INSERT OR IGNORE INTO WorkTypes (name, description, isActive, createdBy)
        VALUES 
          ('콘텐츠 기획', '마케팅 콘텐츠 기획 및 전략 수립', 1, 1),
          ('디자인 작업', '그래픽 디자인 및 시각 자료 제작', 1, 1),
          ('촬영 작업', '제품 및 브랜드 촬영', 1, 1),
          ('영상 편집', '홍보 영상 편집 및 후반 작업', 1, 1),
          ('광고 운영', 'SNS 및 디지털 광고 운영', 1, 1);
      `;
      
      db.run(workTypesData, (err) => {
        if (err) reject(err);
        else {
          console.log('✅ 기본 업무 타입 추가 완료');
          resolve();
        }
      });
    });

    // 3. 기본 상품 데이터 추가
    await new Promise((resolve, reject) => {
      const productsData = `
        INSERT OR IGNORE INTO Products (name, description, category, costPrice, sellingPrice, unit, isActive, createdBy)
        VALUES 
          ('SNS 마케팅 패키지', '인스타그램, 페이스북 통합 마케팅', '마케팅', 300000, 500000, '건', 1, 1),
          ('블로그 컨텐츠 제작', '기업 블로그 포스팅 제작 서비스', '컨텐츠', 100000, 200000, '건', 1, 1),
          ('상품 촬영 패키지', '제품 사진 촬영 및 편집', '제작', 150000, 300000, '건', 1, 1),
          ('영상 제작 서비스', '홍보 영상 기획부터 편집까지', '영상', 500000, 1000000, '건', 1, 1);
      `;
      
      db.run(productsData, (err) => {
        if (err) reject(err);
        else {
          console.log('✅ 기본 상품 데이터 추가 완료');
          resolve();
        }
      });
    });

    // 4. 데이터 확인
    console.log('\n📊 추가된 데이터 확인:');
    
    await new Promise((resolve) => {
      db.all('SELECT COUNT(*) as count FROM Products', [], (err, rows) => {
        console.log(`상품: ${rows[0].count}개`);
        resolve();
      });
    });

    await new Promise((resolve) => {
      db.all('SELECT COUNT(*) as count FROM WorkTypes', [], (err, rows) => {
        console.log(`업무 타입: ${rows[0].count}개`);
        resolve();
      });
    });

    console.log('\n✅ 프로덕션 기본 데이터 추가 완료');

  } catch (error) {
    console.error('❌ 데이터 추가 실패:', error.message);
  } finally {
    db.close();
  }
}

addProductionData();