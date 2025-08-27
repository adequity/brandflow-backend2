
const axios = require('axios');
const fs = require('fs');

const BACKEND_URL = 'https://brandflow-backend-production.up.railway.app';
const FRONTEND_URL = 'https://brandflow.netlify.app';

async function healthCheck() {
  const timestamp = new Date().toISOString();
  const results = {
    timestamp,
    backend: { status: 'unknown', responseTime: 0 },
    frontend: { status: 'unknown', responseTime: 0 },
    database: { status: 'unknown' }
  };

  try {
    // 백엔드 헬스체크
    const backendStart = Date.now();
    const backendResponse = await axios.get(`${BACKEND_URL}/api/health`, { timeout: 5000 });
    results.backend = {
      status: backendResponse.status === 200 ? 'healthy' : 'error',
      responseTime: Date.now() - backendStart,
      data: backendResponse.data
    };
  } catch (error) {
    results.backend = {
      status: 'error',
      error: error.message
    };
  }

  try {
    // 프론트엔드 헬스체크
    const frontendStart = Date.now();
    const frontendResponse = await axios.get(FRONTEND_URL, { timeout: 5000 });
    results.frontend = {
      status: frontendResponse.status === 200 ? 'healthy' : 'error',
      responseTime: Date.now() - frontendStart
    };
  } catch (error) {
    results.frontend = {
      status: 'error', 
      error: error.message
    };
  }

  // 결과 출력
  console.log('🏥 시스템 헬스체크 결과:');
  console.table(results);

  // 로그 파일에 기록
  const logEntry = `${timestamp} - Backend: ${results.backend.status} (${results.backend.responseTime}ms), Frontend: ${results.frontend.status} (${results.frontend.responseTime}ms)\n`;
  fs.appendFileSync('./logs/health-check.log', logEntry);

  return results;
}

healthCheck().catch(console.error);
