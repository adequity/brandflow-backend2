import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Post = sequelize.define('Post', {
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  topicStatus: {
    type: DataTypes.STRING,
    defaultValue: '주제 승인 대기',
  },
  outline: {
    type: DataTypes.TEXT,
  },
  outlineStatus: {
    type: DataTypes.STRING,
  },
  publishedUrl: {
    type: DataTypes.STRING,
  },
  // ⭐️ [새로 추가된 필드] ⭐️
  // 클라이언트가 콘텐츠를 반려할 때 사유를 저장하기 위한 필드입니다.
  rejectReason: {
    type: DataTypes.TEXT, // 반려 사유는 길 수 있으므로 TEXT 타입으로 설정
    allowNull: true,      // 반려되지 않은 경우 값은 비어있을 수 있음 (NULL)
  },
  // 업무 타입 필드 (범용 업무 관리를 위한 확장)
  workType: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: '블로그',
    comment: '업무 타입 (블로그, 디자인, 마케팅, 개발, 기타 등)'
  },
  // 이미지 첨부 필드
  images: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '첨부된 이미지 데이터 (JSON 배열)'
  },
  // 상품 연결 필드
  productId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Products',
      key: 'id',
    },
    comment: '연결된 상품 ID'
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 1,
    comment: '상품 수량'
  },
  // 업무 일정 필드
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: '업무 시작일'
  },
  dueDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: '업무 마감일'
  },
  creationTime: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  timestamps: true,
});

export default Post;
