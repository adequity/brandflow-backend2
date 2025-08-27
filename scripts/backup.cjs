#!/usr/bin/env node

/**
 * BrandFlow Database Backup System
 * 정기적인 데이터베이스 백업 및 복원 스크립트
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class DatabaseBackup {
  constructor() {
    this.backupDir = path.join(__dirname, '../backups');
    this.maxBackups = 30; // Keep 30 days of backups
    this.timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  }

  async ensureBackupDirectory() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      console.log('📁 백업 디렉토리 생성:', this.backupDir);
    }
  }

  async createBackup() {
    try {
      await this.ensureBackupDirectory();
      
      // SQLite 데이터베이스 백업
      const dbPath = process.env.NODE_ENV === 'production' 
        ? './database.sqlite' 
        : './database.sqlite';
        
      const backupPath = path.join(this.backupDir, `brandflow-backup-${this.timestamp}.db`);
      
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, backupPath);
        console.log('✅ 데이터베이스 백업 완료:', backupPath);
        
        // 백업 파일 크기 확인
        const stats = fs.statSync(backupPath);
        console.log('📊 백업 파일 크기:', (stats.size / 1024).toFixed(2), 'KB');
        
        // 오래된 백업 파일 정리
        await this.cleanupOldBackups();
        
        return backupPath;
      } else {
        console.log('⚠️ 데이터베이스 파일을 찾을 수 없습니다:', dbPath);
        return null;
      }
    } catch (error) {
      console.error('❌ 백업 실패:', error.message);
      throw error;
    }
  }

  async cleanupOldBackups() {
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('brandflow-backup-') && file.endsWith('.db'))
        .map(file => ({
          name: file,
          path: path.join(this.backupDir, file),
          time: fs.statSync(path.join(this.backupDir, file)).mtime
        }))
        .sort((a, b) => b.time - a.time);

      if (files.length > this.maxBackups) {
        const filesToDelete = files.slice(this.maxBackups);
        
        for (const file of filesToDelete) {
          fs.unlinkSync(file.path);
          console.log('🗑️ 오래된 백업 파일 삭제:', file.name);
        }
      }
      
      console.log('📋 현재 백업 파일 수:', Math.min(files.length, this.maxBackups));
    } catch (error) {
      console.error('⚠️ 백업 정리 실패:', error.message);
    }
  }

  async restoreBackup(backupFileName) {
    try {
      const backupPath = path.join(this.backupDir, backupFileName);
      
      if (!fs.existsSync(backupPath)) {
        throw new Error(`백업 파일을 찾을 수 없습니다: ${backupFileName}`);
      }
      
      const dbPath = process.env.NODE_ENV === 'production' 
        ? './database.db' 
        : './brandflow.db';
        
      // 현재 DB 백업 (복원 전)
      const preRestoreBackup = `${dbPath}.pre-restore-${this.timestamp}`;
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, preRestoreBackup);
        console.log('🔄 복원 전 현재 DB 백업:', preRestoreBackup);
      }
      
      // 백업에서 복원
      fs.copyFileSync(backupPath, dbPath);
      console.log('✅ 데이터베이스 복원 완료:', backupPath);
      
    } catch (error) {
      console.error('❌ 복원 실패:', error.message);
      throw error;
    }
  }

  async listBackups() {
    try {
      await this.ensureBackupDirectory();
      
      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('brandflow-backup-') && file.endsWith('.db'))
        .map(file => {
          const filePath = path.join(this.backupDir, file);
          const stats = fs.statSync(filePath);
          return {
            name: file,
            size: (stats.size / 1024).toFixed(2) + ' KB',
            date: stats.mtime.toLocaleString('ko-KR')
          };
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      console.log('📋 사용 가능한 백업 파일:');
      files.forEach((file, index) => {
        console.log(`${index + 1}. ${file.name}`);
        console.log(`   크기: ${file.size}, 날짜: ${file.date}`);
      });
      
      return files;
    } catch (error) {
      console.error('❌ 백업 목록 조회 실패:', error.message);
      return [];
    }
  }
}

// CLI 명령어 처리
if (require.main === module) {
  const backup = new DatabaseBackup();
  const command = process.argv[2];

  switch (command) {
    case 'create':
      backup.createBackup()
        .then(path => console.log('백업 완료:', path))
        .catch(error => {
          console.error('백업 실패:', error.message);
          process.exit(1);
        });
      break;
      
    case 'list':
      backup.listBackups();
      break;
      
    case 'restore':
      const backupFile = process.argv[3];
      if (!backupFile) {
        console.error('사용법: node backup.js restore <백업파일명>');
        process.exit(1);
      }
      backup.restoreBackup(backupFile)
        .then(() => console.log('복원 완료'))
        .catch(error => {
          console.error('복원 실패:', error.message);
          process.exit(1);
        });
      break;
      
    default:
      console.log('사용법:');
      console.log('  node backup.js create    - 새 백업 생성');
      console.log('  node backup.js list      - 백업 목록 조회');
      console.log('  node backup.js restore <파일명> - 백업에서 복원');
  }
}

module.exports = DatabaseBackup;