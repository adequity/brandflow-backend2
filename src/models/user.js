import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const User = sequelize.define('User', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  contact: {
    type: DataTypes.STRING,
  },
  company: {
    type: DataTypes.STRING,
  },
  role: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // ⭐️ [추가] 생성자 ID를 저장하기 위한 필드
  // 어떤 관리자가 이 사용자를 생성했는지 추적합니다.
  creatorId: {
    type: DataTypes.INTEGER,
    allowNull: true, // 최초의 슈퍼 어드민은 생성자가 없으므로 NULL을 허용
  }
}, {
  timestamps: true,
});

export default User;
