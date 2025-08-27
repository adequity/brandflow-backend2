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
import notificationRoutes from './api/notifications.js';
import purchaseRequestRoutes from './api/purchaseRequests.js';
import productRoutes from './api/products.js';
import salesRoutes from './api/sales.js';
import systemSettingRoutes from './api/systemSettings.js';
import monthlyIncentiveRoutes from './api/monthlyIncentives.js';
import workTypeRoutes from './api/workTypes.js';
import companyRoutes from './api/company.js';
import healthRoutes from './api/health.js';

const app = express();
const PORT = process.env.PORT || 5004;
const corsOptions = {
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'https://singular-peony-ea66d2.netlify.app',
    'http://localhost:4173'
  ],
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());

// 업로드된 파일들을 정적 파일로 서빙
app.use('/uploads', express.static('uploads'));

// API 라우트 연결
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/purchase-requests', purchaseRequestRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/system-settings', systemSettingRoutes);
app.use('/api/monthly-incentives', monthlyIncentiveRoutes);
app.use('/api/work-types', workTypeRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/health', healthRoutes);

app.get('/', (req, res) => {
  res.send('BrandFlow 백엔드 서버가 정상적으로 동작하고 있습니다. v2.2.0');
});

async function startServer() {
  try {
    // ⭐️ [수정] 서버 시작 시, DB 연결 테스트를 먼저 실행합니다.
    console.log('데이터베이스 연결을 시도합니다...');
    await testDbConnection();

    await sequelize.sync({ alter: true }); // 스키마 업데이트 (데이터 보존하며 구조 변경)
    console.log('✅ 데이터베이스 모델 동기화 완료.');

    const { User } = sequelize.models;
    const userCount = await User.count();
    if (userCount === 0) {
        console.log('초기 계정들을 생성합니다...');
        
        // 슈퍼 어드민 계정
        const hashedPassword1 = await bcrypt.hash('tjdgus66!', 10);
        await User.create({ 
            name: '슈퍼 어드민',
            email: 'sjim@sh-system.co.kr', 
            password: hashedPassword1, 
            role: '슈퍼 어드민',
            incentiveRate: 0
        });
        
        // 대행사 어드민 계정
        const hashedPassword2 = await bcrypt.hash('1234', 10);
        await User.create({
            name: '김대행',
            email: 'agency@test.com',
            password: hashedPassword2,
            role: '대행사 어드민',
            company: '테스트대행사',
            incentiveRate: 10
        });
        
        // 직원(클라이언트) 계정
        const hashedPassword3 = await bcrypt.hash('1234', 10);
        await User.create({
            name: '이직원',
            email: 'staff@test.com',
            password: hashedPassword3,
            role: '클라이언트',
            company: '테스트회사',
            incentiveRate: 5
        });
        
        // 추가 테스트 계정들 (대행사 분리 테스트용)
        const hashedPassword4 = await bcrypt.hash('1234', 10);
        await User.create({
            name: '김대행2',
            email: 'agency2@test.com',
            password: hashedPassword4,
            role: '대행사 어드민',
            company: '테스트대행사2',
            incentiveRate: 12
        });
        
        const hashedPassword5 = await bcrypt.hash('1234', 10);
        await User.create({
            name: '이직원2',
            email: 'staff2@test.com',
            password: hashedPassword5,
            role: '직원',
            company: '테스트대행사2',
            incentiveRate: 8
        });
        
        const hashedPassword6 = await bcrypt.hash('1234', 10);
        await User.create({
            name: '박클라2',
            email: 'client2@test.com',
            password: hashedPassword6,
            role: '클라이언트',
            company: '테스트대행사2',
            incentiveRate: 0
        });
        
        console.log('✅ 초기 계정 생성 완료:');
        console.log('  - 슈퍼 어드민: sjim@sh-system.co.kr / tjdgus66!');
        console.log('  - 대행사 어드민1: agency@test.com / 1234 (테스트대행사)');
        console.log('  - 직원1: staff@test.com / 1234 (테스트대행사)');
        console.log('  - 대행사 어드민2: agency2@test.com / 1234 (테스트대행사2)');
        console.log('  - 직원2: staff2@test.com / 1234 (테스트대행사2)');
        console.log('  - 클라이언트2: client2@test.com / 1234 (테스트대행사2)');
        
        // 초기 상품 데이터 생성
        const { Product } = sequelize.models;
        const productCount = await Product.count();
        if (productCount === 0) {
            console.log('초기 상품들을 생성합니다...');
            
            await Product.create({
                name: 'SNS 마케팅 패키지',
                description: '소셜미디어 마케팅 서비스',
                category: '마케팅',
                costPrice: 50000,
                sellingPrice: 80000,
                unit: '건',
                isActive: true,
                createdBy: 1,
                company: null // 공용 상품
            });
            
            await Product.create({
                name: '블로그 포스팅',
                description: '블로그 컨텐츠 작성 서비스',
                category: '콘텐츠',
                costPrice: 30000,
                sellingPrice: 50000,
                unit: '개',
                isActive: true,
                createdBy: 1,
                company: null // 공용 상품
            });
            
            await Product.create({
                name: '로고 디자인',
                description: '브랜드 로고 디자인 서비스',
                category: '디자인',
                costPrice: 100000,
                sellingPrice: 150000,
                unit: '건',
                isActive: true,
                createdBy: 1,
                company: null // 공용 상품
            });
            
            console.log('✅ 초기 상품 생성 완료');
        }
    }

    app.listen(PORT, () => {
      console.log(`✅ 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
    });
  } catch (error) {
    console.error('❌ 서버 시작에 실패했습니다:', error.message);
    console.error('Full error:', error);
    process.exit(1); // 실패 시 프로세스 종료
  }
}

startServer();