// src/models/purchaseRequest.js
import { DataTypes } from 'sequelize';

export default function(sequelize) {
  const PurchaseRequest = sequelize.define('PurchaseRequest', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    
    // 기본 정보
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: '구매요청 제목'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '상세 설명'
    },
    
    // 금액 정보
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      comment: '요청 금액'
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'KRW',
      comment: '통화'
    },
    
    // 리소스 종류
    resourceType: {
      type: DataTypes.ENUM(
        '광고비',           // 네이버, 구글, 메타 등 광고 플랫폼 비용
        '콘텐츠 제작비',     // 영상, 이미지, 텍스트 제작
        '도구 구독료',       // 디자인 툴, 분석 툴 등
        '외부 용역비',       // 프리랜서, 에이전시 등
        '소재 구매비',       // 스톡 이미지, 음원 등
        '기타'
      ),
      allowNull: false,
      comment: '리소스 종류'
    },
    
    // 긴급도
    priority: {
      type: DataTypes.ENUM('낮음', '보통', '높음', '긴급'),
      allowNull: false,
      defaultValue: '보통',
      comment: '긴급도'
    },
    
    // 상태 관리
    status: {
      type: DataTypes.ENUM(
        '승인 대기',         // 직원이 요청서 제출 후 대기
        '검토 중',           // 어드민이 검토 시작
        '승인됨',           // 어드민이 승인
        '거절됨',           // 어드민이 거절
        '보류',             // 추가 정보 필요
        '구매 완료',        // 실제 구매 완료
        '정산 완료'         // 클라이언트 청구 완료
      ),
      allowNull: false,
      defaultValue: '승인 대기',
      comment: '요청 상태'
    },
    
    // 날짜 정보
    requestedDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: '요청일'
    },
    dueDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '희망 완료일'
    },
    approvedDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '승인일'
    },
    completedDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '구매 완료일'
    },
    
    // 승인/거절 관련
    approverComment: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '승인자 코멘트'
    },
    rejectReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '거절 사유'
    },
    
    // 첨부 파일
    attachments: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: '첨부 파일 목록 (견적서, 참고자료 등)'
    },
    
    // 실제 지출 정보
    actualAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: '실제 지출 금액'
    },
    receiptUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '영수증/증빙서류 URL'
    },
    
    // 클라이언트 청구 정보
    billedToClient: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: '클라이언트 청구 여부'
    },
    clientBillAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: '클라이언트 청구 금액'
    },
    
    // 외래키 (관계 설정)
    requesterId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '요청자 ID (직원)'
    },
    approverId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '승인자 ID (대행사 어드민)'
    },
    campaignId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '연관된 캠페인 ID'
    },
    postId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '연관된 포스트 ID'
    }
    
  }, {
    tableName: 'purchase_requests',
    timestamps: true,
    
    indexes: [
      { fields: ['requesterId'] },
      { fields: ['approverId'] },
      { fields: ['campaignId'] },
      { fields: ['postId'] },
      { fields: ['status'] },
      { fields: ['requestedDate'] },
      { fields: ['resourceType'] }
    ]
  });

  return PurchaseRequest;
}