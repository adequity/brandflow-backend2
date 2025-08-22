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
  },
  // 카톡 내용 정리 관련 필드들
  chatContent: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '카카오톡 대화 내용'
  },
  chatSummary: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '카톡 내용 요약 (주요 논의사항)'
  },
  chatAttachments: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '첨부파일/링크 정보'
  },
  memo: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '캠페인 특이사항'
  },
  budget: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    comment: '캠페인 예산'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '주의사항 및 특이사항'
  },
  reminders: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '리마인드 사항'
  },
  
  // 재무 관리 필드들
  invoiceIssued: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: '계산서 발행 여부'
  },
  paymentCompleted: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: '입금 완료 여부'
  },
  invoiceDate: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '계산서 발행일'
  },
  paymentDate: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '입금 완료일'
  },
  invoiceDueDate: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '계산서 발행 예정일'
  },
  paymentDueDate: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '입금 예정일'
  },
  
  // 집행 상태 (구매요청과 연동)
  executionStatus: {
    type: DataTypes.ENUM('대기', '승인', '완료'),
    allowNull: false,
    defaultValue: '대기',
    comment: '집행 상태 (구매요청 기반)'
  },
  executionApprovedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '집행 승인일'
  },
  executionCompletedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '집행 완료일'
  }
}, {
  timestamps: true,
});

export default Campaign;
