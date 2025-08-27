
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
