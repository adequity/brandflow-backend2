// src/models/product.js
import { DataTypes } from 'sequelize';

export default function(sequelize) {
  const Product = sequelize.define('Product', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    
    // 기본 정보
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: '상품명'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '상품 상세 설명'
    },
    sku: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      comment: '상품 코드 (SKU)'
    },
    
    // 카테고리
    category: {
      type: DataTypes.ENUM(
        'SNS 광고',
        '검색 광고', 
        '크리에이티브',
        '웹사이트',
        '브랜딩',
        '컨설팅',
        '기타'
      ),
      allowNull: false,
      comment: '상품 카테고리'
    },
    
    // 가격 정보
    costPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      comment: '원가 (실제 비용)'
    },
    sellingPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      comment: '판매가 (클라이언트 청구 금액)'
    },
    
    // 자동 계산 필드
    marginAmount: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.sellingPrice - this.costPrice;
      }
    },
    marginRate: {
      type: DataTypes.VIRTUAL,
      get() {
        if (this.costPrice === 0) return 0;
        return ((this.sellingPrice - this.costPrice) / this.costPrice * 100).toFixed(2);
      }
    },
    
    // 단위 및 주기
    unit: {
      type: DataTypes.ENUM('건', '월', '년', '일', '시간', '개'),
      allowNull: false,
      defaultValue: '건',
      comment: '판매 단위'
    },
    
    // 상태 관리
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: '판매 활성화 여부'
    },
    
    // 인센티브 설정
    incentiveRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
      comment: '직원 인센티브율 (%)'
    },
    
    // 최소/최대 수량
    minQuantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: '최소 주문 수량'
    },
    maxQuantity: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '최대 주문 수량'
    },
    
    // 태그 및 메타
    tags: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: '상품 태그 (배열)'
    },
    
    // 생성자 정보
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '상품 등록자 (본사 관리자)'
    }
    
  }, {
    tableName: 'products',
    timestamps: true,
    
    indexes: [
      { fields: ['category'] },
      { fields: ['isActive'] },
      { fields: ['createdBy'] },
      { fields: ['sku'], unique: true }
    ],
    
    // 가격 유효성 검증
    validate: {
      pricesValid() {
        if (this.sellingPrice <= this.costPrice) {
          throw new Error('판매가는 원가보다 높아야 합니다.');
        }
      },
      quantityValid() {
        if (this.maxQuantity && this.minQuantity > this.maxQuantity) {
          throw new Error('최소 수량은 최대 수량보다 작아야 합니다.');
        }
      }
    }
  });

  return Product;
}