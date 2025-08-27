
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
