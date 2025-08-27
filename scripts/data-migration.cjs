#!/usr/bin/env node

/**
 * BrandFlow 고객 데이터 마이그레이션 시스템
 * 테스트 데이터 정리 및 실제 운영 데이터 준비
 */

const fs = require('fs');
const path = require('path');

class DataMigration {
  constructor() {
    this.backupDir = path.join(__dirname, '../backups');
    this.migrationDir = path.join(__dirname, '../migrations');
    this.ensureDirectories();
  }

  ensureDirectories() {
    [this.backupDir, this.migrationDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  // 테스트 데이터 정리 스크립트 생성
  generateCleanupScript() {
    const cleanupSQL = `
-- BrandFlow 테스트 데이터 정리 스크립트
-- 주의: 프로덕션 배포 전에 실행하세요!

BEGIN TRANSACTION;

-- 1. 테스트 게시물 및 캠페인 데이터 정리
DELETE FROM Posts WHERE id IN (
  SELECT p.id FROM Posts p 
  JOIN Campaigns c ON p.campaignId = c.id 
  WHERE c.title LIKE '%테스트%' OR c.title LIKE '%test%'
);

DELETE FROM Campaigns WHERE 
  title LIKE '%테스트%' OR 
  title LIKE '%test%' OR
  clientName LIKE '%테스트%';

-- 2. 테스트 구매요청 정리
DELETE FROM PurchaseRequests WHERE 
  description LIKE '%테스트%' OR 
  description LIKE '%test%' OR
  requesterId IN (
    SELECT id FROM Users WHERE email LIKE '%test%'
  );

-- 3. 테스트 매출 데이터 정리
DELETE FROM Sales WHERE 
  description LIKE '%테스트%' OR
  userId IN (
    SELECT id FROM Users WHERE email LIKE '%test%'
  );

-- 4. 테스트 인센티브 정리
DELETE FROM MonthlyIncentives WHERE 
  userId IN (
    SELECT id FROM Users WHERE email LIKE '%test%'
  );

-- 5. 테스트 알림 정리
DELETE FROM Notifications WHERE 
  userId IN (
    SELECT id FROM Users WHERE email LIKE '%test%'
  );

-- 6. 테스트 사용자 정리 (관리자 계정 제외)
-- 주의: 실제 관리자 계정은 유지하세요
DELETE FROM Users WHERE 
  email LIKE '%test%' OR
  company LIKE '%테스트%';

-- 7. 시퀀스 초기화 (SQLite의 경우)
UPDATE sqlite_sequence SET seq = 0 WHERE name IN (
  'Users', 'Campaigns', 'Posts', 'PurchaseRequests', 
  'Sales', 'MonthlyIncentives', 'Notifications'
);

COMMIT;

-- 정리 완료 후 데이터 확인
SELECT 'Users' as table_name, COUNT(*) as count FROM Users
UNION ALL
SELECT 'Campaigns', COUNT(*) FROM Campaigns
UNION ALL  
SELECT 'Posts', COUNT(*) FROM Posts
UNION ALL
SELECT 'PurchaseRequests', COUNT(*) FROM PurchaseRequests
UNION ALL
SELECT 'Sales', COUNT(*) FROM Sales;
`;

    const scriptPath = path.join(this.migrationDir, 'cleanup-test-data.sql');
    fs.writeFileSync(scriptPath, cleanupSQL);
    console.log('✅ 테스트 데이터 정리 스크립트 생성:', scriptPath);
    return scriptPath;
  }

  // 실제 고객 계정 생성 스크립트
  generateCustomerSetupScript() {
    const customerSQL = `
-- BrandFlow 실제 고객 계정 설정 스크립트

BEGIN TRANSACTION;

-- 1. 실제 슈퍼 어드민 계정 (이미 존재할 수 있음)
-- INSERT OR REPLACE INTO Users (name, email, password, role, company, isActive, incentiveRate) 
-- VALUES ('관리자', 'admin@your-domain.com', '$2b$10$hashedpassword', '슈퍼 어드민', NULL, 1, 0);

-- 2. 실제 대행사 계정들
INSERT OR IGNORE INTO Users (name, email, password, role, company, isActive, incentiveRate)
VALUES 
  ('홍대행', 'agency1@company.com', '$2b$10$placeholder', '대행사 어드민', '마케팅대행사1', 1, 15),
  ('김대행', 'agency2@company.com', '$2b$10$placeholder', '대행사 어드민', '마케팅대행사2', 1, 12);

-- 3. 기본 상품 카탈로그
INSERT OR IGNORE INTO Products (name, description, category, costPrice, sellingPrice, unit, isActive, createdBy)
VALUES 
  ('SNS 마케팅 패키지', '인스타그램, 페이스북 통합 마케팅', '마케팅', 300000, 500000, '건', 1, 1),
  ('블로그 컨텐츠 제작', '기업 블로그 포스팅 제작 서비스', '컨텐츠', 100000, 200000, '건', 1, 1),
  ('상품 촬영 패키지', '제품 사진 촬영 및 편집', '제작', 150000, 300000, '건', 1, 1),
  ('영상 제작 서비스', '홍보 영상 기획부터 편집까지', '영상', 500000, 1000000, '건', 1, 1);

-- 4. 기본 업무 타입
INSERT OR IGNORE INTO WorkTypes (name, description, isActive, createdBy)
VALUES 
  ('콘텐츠 기획', '마케팅 콘텐츠 기획 및 전략 수립', 1, 1),
  ('디자인 작업', '그래픽 디자인 및 시각 자료 제작', 1, 1),
  ('촬영 작업', '제품 및 브랜드 촬영', 1, 1),
  ('영상 편집', '홍보 영상 편집 및 후반 작업', 1, 1),
  ('광고 운영', 'SNS 및 디지털 광고 운영', 1, 1);

-- 5. 시스템 설정
INSERT OR IGNORE INTO SystemSettings (category, key, value, description, isActive)
VALUES 
  ('general', 'company_name', 'BrandFlow', '회사명', 1),
  ('general', 'support_email', 'support@brandflow.co.kr', '고객지원 이메일', 1),
  ('financial', 'default_tax_rate', '10', '기본 세율 (%)', 1),
  ('workflow', 'auto_approval_limit', '100000', '자동 승인 한도 (원)', 1),
  ('notification', 'email_enabled', 'true', '이메일 알림 활성화', 1);

COMMIT;

-- 설정 완료 확인
SELECT 'Setup completed at' as status, datetime('now', 'localtime') as timestamp;
SELECT 'Total users' as metric, COUNT(*) as value FROM Users;
SELECT 'Total products' as metric, COUNT(*) as value FROM Products;
`;

    const scriptPath = path.join(this.migrationDir, 'customer-setup.sql');
    fs.writeFileSync(scriptPath, customerSQL);
    console.log('✅ 고객 계정 설정 스크립트 생성:', scriptPath);
    return scriptPath;
  }

  // 데이터 검증 스크립트
  generateValidationScript() {
    const validationSQL = `
-- BrandFlow 데이터 무결성 검증 스크립트

-- 1. 필수 데이터 존재 확인
SELECT 
  'Users' as table_name,
  COUNT(*) as total_count,
  COUNT(CASE WHEN isActive = 1 THEN 1 END) as active_count
FROM Users;

SELECT 
  'Products' as table_name,
  COUNT(*) as total_count,
  COUNT(CASE WHEN isActive = 1 THEN 1 END) as active_count
FROM Products;

-- 2. 권한 시스템 검증
SELECT 
  role,
  COUNT(*) as user_count,
  GROUP_CONCAT(DISTINCT company) as companies
FROM Users 
GROUP BY role;

-- 3. 데이터 관계 무결성 확인
SELECT 
  'Campaigns with valid users' as check_name,
  COUNT(*) as valid_count
FROM Campaigns c 
JOIN Users u ON c.managerId = u.id;

SELECT 
  'Posts with valid campaigns' as check_name,
  COUNT(*) as valid_count  
FROM Posts p 
JOIN Campaigns c ON p.campaignId = c.id;

-- 4. 시스템 설정 확인
SELECT 
  category,
  COUNT(*) as setting_count
FROM SystemSettings 
WHERE isActive = 1
GROUP BY category;

-- 5. 최근 활동 확인
SELECT 
  'Recent user activity (7 days)' as metric,
  COUNT(*) as value
FROM Users 
WHERE createdAt >= datetime('now', '-7 days');
`;

    const scriptPath = path.join(this.migrationDir, 'data-validation.sql');
    fs.writeFileSync(scriptPath, validationSQL);
    console.log('✅ 데이터 검증 스크립트 생성:', scriptPath);
    return scriptPath;
  }

  // 마이그레이션 실행
  async runMigration(type) {
    console.log(`🔄 ${type} 마이그레이션 실행 중...`);
    
    try {
      switch (type) {
        case 'cleanup':
          return this.generateCleanupScript();
        case 'setup':
          return this.generateCustomerSetupScript();
        case 'validate':
          return this.generateValidationScript();
        default:
          console.log('사용 가능한 마이그레이션 타입: cleanup, setup, validate');
      }
    } catch (error) {
      console.error('❌ 마이그레이션 실패:', error.message);
      throw error;
    }
  }

  // 마이그레이션 상태 리포트
  generateMigrationReport() {
    const report = {
      timestamp: new Date().toISOString(),
      scripts: [],
      recommendations: []
    };

    // 생성된 스크립트들 확인
    const migrationFiles = fs.readdirSync(this.migrationDir);
    report.scripts = migrationFiles.map(file => ({
      name: file,
      path: path.join(this.migrationDir, file),
      size: fs.statSync(path.join(this.migrationDir, file)).size,
      created: fs.statSync(path.join(this.migrationDir, file)).mtime
    }));

    // 권장사항 생성
    report.recommendations = [
      '1. 프로덕션 배포 전 cleanup-test-data.sql 실행',
      '2. customer-setup.sql로 실제 고객 계정 생성',
      '3. data-validation.sql로 데이터 무결성 확인',
      '4. 백업 시스템으로 마이그레이션 전후 백업 생성'
    ];

    const reportPath = path.join(this.migrationDir, 'migration-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log('📊 마이그레이션 리포트 생성:', reportPath);
    return report;
  }
}

// CLI 실행
if (require.main === module) {
  const migration = new DataMigration();
  const command = process.argv[2];

  switch (command) {
    case 'cleanup':
      migration.runMigration('cleanup');
      break;
    case 'setup':
      migration.runMigration('setup');
      break;
    case 'validate':
      migration.runMigration('validate');
      break;
    case 'report':
      migration.generateMigrationReport();
      break;
    case 'all':
      console.log('🚀 전체 마이그레이션 스크립트 생성');
      migration.runMigration('cleanup');
      migration.runMigration('setup');
      migration.runMigration('validate');
      migration.generateMigrationReport();
      break;
    default:
      console.log('사용법:');
      console.log('  node data-migration.cjs cleanup  - 테스트 데이터 정리 스크립트');
      console.log('  node data-migration.cjs setup    - 고객 계정 설정 스크립트');
      console.log('  node data-migration.cjs validate - 데이터 검증 스크립트');
      console.log('  node data-migration.cjs report   - 마이그레이션 리포트');
      console.log('  node data-migration.cjs all      - 모든 스크립트 생성');
  }
}

module.exports = DataMigration;