// ⬇️ src/config/db.js
import 'dotenv/config';
import { Sequelize } from 'sequelize';

const isProd = process.env.NODE_ENV === 'production';

const baseOptions = {
  dialect: process.env.DB_DIALECT || 'sqlite',
  storage: process.env.DB_STORAGE || './database.sqlite',
  logging: false,
  // Render/Neon/Supabase 등 대부분 prod 환경에서 SSL 필요
  dialectOptions: isProd && process.env.DB_DIALECT === 'postgres'
    ? { ssl: { require: true, rejectUnauthorized: false } }
    : {},
  pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
};

const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      ...baseOptions,
      protocol: 'postgres'
    })
  : process.env.DB_DIALECT === 'postgres'
  ? new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        ...baseOptions,
        dialect: 'postgres',
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT) || 5432
      }
    )
  : new Sequelize(baseOptions); // SQLite 사용

// 재시도 포함 연결 테스트
export const testDbConnection = async () => {
  let retries = 5;
  while (retries) {
    try {
      await sequelize.authenticate();
      console.log('✅ 데이터베이스 연결에 성공했습니다.');
      return;
    } catch (error) {
      console.error('❌ 데이터베이스에 연결할 수 없습니다:', error.name, error.message);
      retries -= 1;
      if (!retries) throw new Error('여러 번의 시도 후에도 DB 연결 실패');
      console.log(`${retries}번 남음. 5초 후 재시도…`);
      await new Promise(res => setTimeout(res, 5000));
    }
  }
};

export default sequelize;
