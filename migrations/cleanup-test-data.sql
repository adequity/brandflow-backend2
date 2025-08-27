
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
