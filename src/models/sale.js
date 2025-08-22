// src/models/sale.js
import { DataTypes } from 'sequelize';

export default function(sequelize) {
  const Sale = sequelize.define('Sale', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    
    // 기본 정보
    saleNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: '매출 번호 (자동 생성)'
    },
    
    // 수량 및 금액
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: '판매 수량'
    },
    
    // 실제 판매 금액 (상품 기본가에서 조정 가능)
    actualCostPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      comment: '실제 원가 (조정 가능)'
    },
    actualSellingPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      comment: '실제 판매가 (조정 가능)'
    },
    
    // 계산된 필드들
    totalCost: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.actualCostPrice * this.quantity;
      }
    },
    totalSales: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.actualSellingPrice * this.quantity;
      }
    },
    totalMargin: {
      type: DataTypes.VIRTUAL,
      get() {
        return (this.actualSellingPrice - this.actualCostPrice) * this.quantity;
      }
    },
    marginRate: {
      type: DataTypes.VIRTUAL,
      get() {
        if (this.actualCostPrice === 0) return 0;
        return (((this.actualSellingPrice - this.actualCostPrice) / this.actualCostPrice) * 100).toFixed(2);
      }
    },
    
    // 인센티브 계산 (직원의 인센티브율 기반)
    incentiveAmount: {
      type: DataTypes.VIRTUAL,
      get() {
        // 직원(salesperson)의 인센티브율을 기반으로 계산
        if (this.salesperson && this.salesperson.incentiveRate) {
          return (this.totalMargin * this.salesperson.incentiveRate / 100).toFixed(0);
        }
        return 0;
      }
    },
    
    // 상태 관리
    status: {
      type: DataTypes.ENUM(
        '등록',           // 직원이 매출 등록
        '검토중',         // 본사에서 검토
        '승인',           // 매출 확정
        '거절',           // 매출 거절
        '정산완료'        // 인센티브 지급 완료
      ),
      allowNull: false,
      defaultValue: '등록',
      comment: '매출 상태'
    },
    
    // 날짜 정보
    saleDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: '매출 발생일'
    },
    contractStartDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '계약 시작일 (월 단위 상품)'
    },
    contractEndDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '계약 종료일 (월 단위 상품)'
    },
    
    // 클라이언트 정보
    clientName: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: '클라이언트 회사명'
    },
    clientContact: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '클라이언트 담당자'
    },
    clientEmail: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '클라이언트 이메일'
    },
    
    // 메모 및 특이사항
    memo: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '매출 관련 메모'
    },
    
    // 승인/거절 정보
    reviewedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '검토자 ID (본사 관리자)'
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '검토 일시'
    },
    reviewComment: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '검토 의견'
    },
    
    // 외래키
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '상품 ID'
    },
    salesPersonId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '영업 담당자 ID (직원)'
    },
    campaignId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '연관 캠페인 ID (선택)'
    }
    
  }, {
    tableName: 'sales',
    timestamps: true,
    
    indexes: [
      { fields: ['saleNumber'], unique: true },
      { fields: ['productId'] },
      { fields: ['salesPersonId'] },
      { fields: ['campaignId'] },
      { fields: ['status'] },
      { fields: ['saleDate'] },
      { fields: ['clientName'] }
    ]
  });

  return Sale;
}