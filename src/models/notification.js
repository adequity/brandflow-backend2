import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Notification = sequelize.define('Notification', {
  // 알림을 받는 사용자 ID
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '알림을 받는 사용자 ID'
  },
  // 알림 제목
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: '알림 제목'
  },
  // 알림 내용
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '알림 상세 내용'
  },
  // 알림 타입
  type: {
    type: DataTypes.ENUM(
      'task_created',      // 새 업무 등록
      'task_approved',     // 업무 승인
      'task_rejected',     // 업무 반려
      'outline_submitted', // 세부사항 제출
      'outline_approved',  // 세부사항 승인
      'outline_rejected',  // 세부사항 반려
      'result_submitted',  // 결과물 제출
      'campaign_created',  // 새 캠페인 생성
      'campaign_assigned'  // 캠페인 배정
    ),
    allowNull: false,
    comment: '알림 타입'
  },
  // 관련된 리소스 정보 (JSON)
  relatedData: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '관련된 캠페인, 포스트 등의 정보 (campaignId, postId, etc.)'
  },
  // 읽음 여부
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '읽음 여부'
  },
  // 읽은 시간
  readAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '읽은 시간'
  },
  // 알림 생성자 (누가 이 액션을 했는지)
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '알림을 발생시킨 사용자 ID'
  },
  // 우선순위 (높음, 보통, 낮음)
  priority: {
    type: DataTypes.ENUM('high', 'medium', 'low'),
    defaultValue: 'medium',
    comment: '알림 우선순위'
  }
}, {
  timestamps: true,
  // 인덱스 설정
  indexes: [
    {
      fields: ['userId', 'isRead'] // 사용자별 미읽음 알림 조회를 위한 인덱스
    },
    {
      fields: ['createdAt'] // 최신 알림 조회를 위한 인덱스  
    },
    {
      fields: ['type'] // 알림 타입별 조회를 위한 인덱스
    }
  ]
});

export default Notification;