import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Campaign = sequelize.define('Campaign', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  client: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // ⭐️ [수정/추가된 부분] ⭐️
  // managerId와 userId 필드를 명시적으로 정의합니다.
  // 이 필드들은 User 모델과의 관계(Foreign Key)를 맺는 데 사용됩니다.
  managerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users', // 'Users' 테이블을 참조합니다.
      key: 'id',
    }
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users', // 'Users' 테이블을 참조합니다.
      key: 'id',
    }
  }
}, {
  timestamps: true,
});

export default Campaign;
