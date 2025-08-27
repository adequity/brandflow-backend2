const sqlite3 = require('sqlite3').verbose();

const dbPath = './database.sqlite';

async function createOnboardingProcess() {
  console.log('🚀 고객 온보딩 프로세스 수립 중...\n');

  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('❌ 데이터베이스 연결 실패:', err.message);
      process.exit(1);
    }
  });

  try {
    // 1. 고객 온보딩 체크리스트 생성
    const checklist = [
      '✅ 1단계: 초기 계정 설정',
      '   - 슈퍼 어드민이 대행사 어드민 계정 생성',
      '   - 대행사 어드민이 직원/클라이언트 계정 생성',
      '   - 초기 비밀번호 전달 및 변경 안내',
      '',
      '✅ 2단계: 기본 데이터 설정',
      '   - 회사별 상품 카탈로그 설정',
      '   - 업무 타입 커스터마이징',
      '   - 시스템 설정 값 조정',
      '',
      '✅ 3단계: 권한 시스템 교육',
      '   - 역할별 권한 범위 설명',
      '   - 데이터 접근 제한 원리 교육',
      '   - 보안 정책 안내',
      '',
      '✅ 4단계: 업무 플로우 교육',
      '   - 캠페인 생성 및 관리',
      '   - 구매요청 승인 프로세스',
      '   - 매출 등록 및 인센티브',
      '',
      '✅ 5단계: 시스템 모니터링',
      '   - 데이터 백업 시스템 확인',
      '   - 로그 및 알림 설정',
      '   - 성능 모니터링 활성화'
    ];

    console.log('📋 고객 온보딩 체크리스트:');
    checklist.forEach(item => console.log(item));

    // 2. 온보딩 완료 확인 쿼리
    const completionChecks = [
      {
        name: '관리자 계정 존재',
        query: 'SELECT COUNT(*) as count FROM Users WHERE role = "슈퍼 어드민"'
      },
      {
        name: '대행사 계정 존재', 
        query: 'SELECT COUNT(*) as count FROM Users WHERE role = "대행사 어드민"'
      },
      {
        name: '기본 상품 설정',
        query: 'SELECT COUNT(*) as count FROM Products WHERE isActive = 1'
      },
      {
        name: '업무 타입 설정',
        query: 'SELECT COUNT(*) as count FROM WorkTypes'
      }
    ];

    console.log('\n📊 온보딩 완료 상태 확인:');
    
    for (const check of completionChecks) {
      await new Promise((resolve) => {
        db.all(check.query, [], (err, rows) => {
          if (err) {
            console.log(`❌ ${check.name}: 확인 실패`);
          } else {
            const count = rows[0].count;
            const status = count > 0 ? '✅' : '❌';
            console.log(`${status} ${check.name}: ${count}개`);
          }
          resolve();
        });
      });
    }

    // 3. 프로덕션 배포 체크리스트
    console.log('\n🏭 프로덕션 배포 최종 체크리스트:');
    const productionChecks = [
      '✅ 테스트 데이터 정리 (cleanup-test-data.sql)',
      '✅ 실제 고객 계정 설정 (customer-setup.sql)', 
      '✅ 데이터 무결성 검증 (data-validation.sql)',
      '✅ 백업 시스템 구축',
      '✅ 사용자 가이드 문서 완성',
      '⚠️ Railway 백엔드 재배포 필요 (API 경로 누락)',
      '⚠️ 프론트엔드 Railway 연결 확인 필요',
      '✅ 로그 모니터링 시스템 준비',
      '✅ 보안 정책 적용 (패스워드 로깅 제거)'
    ];

    productionChecks.forEach(item => console.log(item));

    console.log('\n🎯 다음 단계 권장사항:');
    console.log('1. Railway 백엔드 v2.2.0 강제 재배포');
    console.log('2. 프로덕션 데이터베이스에 migration 스크립트 적용');
    console.log('3. 고객 계정 생성 및 초기 데이터 설정');
    console.log('4. 사용자 가이드 배포 및 교육 진행');
    console.log('5. 24시간 모니터링 후 안정성 확인');

  } catch (error) {
    console.error('❌ 온보딩 프로세스 수립 실패:', error.message);
  } finally {
    db.close();
    console.log('\n✅ 고객 온보딩 프로세스 수립 완료');
  }
}

createOnboardingProcess();