import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
// ⭐️ [수정] testDbConnection 함수를 함께 import 합니다.
import sequelize, { testDbConnection } from './config/db.js';
import './models/index.js';
import 'dotenv/config';

// API 라우터 임포트
import authRoutes from './api/auth.js';
import userRoutes from './api/users.js';
import campaignRoutes from './api/campaigns.js';
import postRoutes from './api/posts.js';

const app = express();
const PORT = process.env.PORT || 5000;
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());

// API 라우트 연결
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/posts', postRoutes);

app.get('/', (req, res) => {
  res.send('BrandFlow 백엔드 서버가 정상적으로 동작하고 있습니다.');
});

async function startServer() {
  try {
    // ⭐️ [수정] 서버 시작 시, DB 연결 테스트를 먼저 실행합니다.
    console.log('데이터베이스 연결을 시도합니다...');
    await testDbConnection();

    await sequelize.sync(); 
    console.log('✅ 데이터베이스 모델 동기화 완료.');

    const { User } = sequelize.models;
    const userCount = await User.count();
    if (userCount === 0) {
        console.log('초기 슈퍼 어드민 계정을 생성합니다...');
        const hashedPassword = await bcrypt.hash('tjdgus66!', 10);
        await User.create({ 
            name: '슈퍼 어드민',
            email: 'sjim@sh-system.co.kr', 
            password: hashedPassword, 
            role: '슈퍼 어드민' 
        });
        console.log('✅ 초기 슈퍼 어드민 계정 생성 완료.');
    }

    app.listen(PORT, () => {
      console.log(`✅ 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
    });
  } catch (error) {
    console.error('❌ 서버 시작에 실패했습니다:', error.message);
    process.exit(1); // 실패 시 프로세스 종료
  }
}

startServer();