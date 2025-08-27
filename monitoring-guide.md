
# 🚀 BrandFlow 모니터링 실행 가이드

## 즉시 실행

### 헬스체크 실행
```bash
node scripts/health-check.cjs
```

### 데이터 검증 실행  
```bash
node scripts/validate-data.cjs
```

### 백업 실행
```bash
node scripts/backup.cjs
```

## 자동화 설정

### Windows 작업 스케줄러
```batch
# 매시간 헬스체크
schtasks /create /tn "BrandFlow-HealthCheck" /tr "node C:\path\to\brandflow-backend\scripts\health-check.cjs" /sc hourly

# 매일 백업
schtasks /create /tn "BrandFlow-Backup" /tr "node C:\path\to\brandflow-backend\scripts\backup.cjs" /sc daily /st 02:00
```

### Linux/macOS cron
```cron
# 매시간 헬스체크
0 * * * * cd /path/to/brandflow-backend && node scripts/health-check.cjs

# 매일 새벽 2시 백업
0 2 * * * cd /path/to/brandflow-backend && node scripts/backup.cjs
```

## 알림 설정

### 이메일 알림 (선택사항)
- 에러 발생시 관리자 이메일 발송
- 일일/주간 리포트 자동 발송

### Slack/Discord 웹훅 (선택사항)  
- 실시간 상태 알림
- 성능 지표 대시보드 연동
