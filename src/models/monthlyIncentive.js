// src/models/monthlyIncentive.js
import { DataTypes } from 'sequelize';

export default function(sequelize) {
  const MonthlyIncentive = sequelize.define('MonthlyIncentive', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    
    // 기간 정보
    year: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '정산 연도'
    },
    month: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '정산 월 (1-12)'
    },
    
    // 직원 정보
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '직원 ID'
    },
    
    // 인센티브 계산 기초 데이터
    totalSales: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
      comment: '총 매출액'
    },
    totalCost: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
      comment: '총 원가'
    },
    totalMargin: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
      comment: '총 이익 (매출액 - 원가)'
    },
    
    // 인센티브 계산
    incentiveRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      comment: '적용된 인센티브율 (%)'
    },
    incentiveAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      comment: '계산된 인센티브 금액'
    },
    
    // 보정 및 조정
    adjustmentAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      comment: '수동 조정 금액 (보너스, 차감 등)'
    },
    adjustmentReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '조정 사유'
    },
    
    // 최종 지급액
    finalAmount: {
      type: DataTypes.VIRTUAL,
      get() {
        return parseFloat(this.incentiveAmount) + parseFloat(this.adjustmentAmount || 0);
      }
    },
    
    // 상태 관리
    status: {
      type: DataTypes.ENUM(
        '계산중',        // 자동 계산 진행 중
        '검토대기',      // 관리자 검토 대기
        '승인완료',      // 관리자 승인 완료
        '지급완료',      // 실제 지급 완료
        '보류',          // 지급 보류
        '취소'           // 인센티브 취소
      ),
      allowNull: false,
      defaultValue: '계산중',
      comment: '인센티브 처리 상태'
    },
    
    // 지급 정보
    paymentDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '실제 지급일'
    },
    paymentMethod: {
      type: DataTypes.ENUM('급여합산', '별도지급', '상품권', '기타'),
      allowNull: true,
      comment: '지급 방법'
    },
    paymentMemo: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '지급 관련 메모'
    },
    
    // 승인자 정보
    approvedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '승인자 ID'
    },
    approvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '승인 일시'
    },
    
    // 생성자 정보
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '생성자 ID (자동 계산 시스템 또는 관리자)'
    },
    
    // 매출 건수 참고용
    salesCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: '해당 월 매출 건수'
    }
    
  }, {
    tableName: 'monthly_incentives',
    timestamps: true,
    
    indexes: [
      { fields: ['userId', 'year', 'month'], unique: true },
      { fields: ['status'] },
      { fields: ['year', 'month'] },
      { fields: ['approvedBy'] },
      { fields: ['createdBy'] }
    ],
    
    // 기간 유효성 검증
    validate: {
      validMonth() {
        if (this.month < 1 || this.month > 12) {
          throw new Error('월은 1~12 사이의 값이어야 합니다.');
        }
      },
      validYear() {
        const currentYear = new Date().getFullYear();
        if (this.year < 2020 || this.year > currentYear + 1) {
          throw new Error('유효하지 않은 연도입니다.');
        }
      }
    }
  });

  return MonthlyIncentive;
}