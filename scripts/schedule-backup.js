/**
 * BrandFlow Automated Backup Scheduler
 * 자동 백업 스케줄러 - 매일 오전 3시에 백업 실행
 */

import cron from 'node-cron';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class BackupScheduler {
  constructor() {
    this.isRunning = false;
  }

  async runBackup() {
    if (this.isRunning) {
      console.log('⚠️ 백업이 이미 실행 중입니다.');
      return;
    }

    this.isRunning = true;
    console.log('🔄 자동 백업 시작:', new Date().toLocaleString('ko-KR'));

    try {
      const { stdout, stderr } = await execAsync('node scripts/backup.cjs create');
      console.log(stdout);
      if (stderr) console.error(stderr);
      
      console.log('✅ 자동 백업 완료:', new Date().toLocaleString('ko-KR'));
    } catch (error) {
      console.error('❌ 자동 백업 실패:', error.message);
    } finally {
      this.isRunning = false;
    }
  }

  start() {
    console.log('🚀 백업 스케줄러 시작');
    console.log('📅 매일 오전 3시에 자동 백업 실행');

    // 매일 오전 3시에 백업 실행 (0 3 * * *)
    cron.schedule('0 3 * * *', () => {
      this.runBackup();
    }, {
      timezone: 'Asia/Seoul'
    });

    // 서버 시작 시 즉시 백업 한 번 실행
    setTimeout(() => {
      console.log('🔧 초기 백업 실행');
      this.runBackup();
    }, 5000);

    console.log('✅ 백업 스케줄러 활성화');
  }

  stop() {
    console.log('⏹️ 백업 스케줄러 중지');
    cron.destroy();
  }
}

const scheduler = new BackupScheduler();

// 프로덕션 환경에서만 자동 백업 활성화
if (process.env.NODE_ENV === 'production') {
  scheduler.start();
  
  // 프로세스 종료 시 스케줄러 정리
  process.on('SIGINT', () => {
    console.log('\n🛑 백업 스케줄러 종료 중...');
    scheduler.stop();
    process.exit(0);
  });
} else {
  console.log('ℹ️ 개발 환경 - 자동 백업 스케줄러 비활성화');
  console.log('💡 수동 백업: node scripts/backup.cjs create');
}

export default BackupScheduler;