// src/models/index.js
import sequelize from '../config/db.js';
import User from './user.js';
import Campaign from './campaign.js';
import Post from './post.js';
import Notification from './notification.js';
import PurchaseRequestModel from './purchaseRequest.js';

const db = {};
db.sequelize = sequelize;
db.User = User;
db.Campaign = Campaign;
db.Post = Post;
db.Notification = Notification;

// PurchaseRequest 모델 초기화
const PurchaseRequest = PurchaseRequestModel(sequelize);
db.PurchaseRequest = PurchaseRequest;

/** ====== Associations (프론트 코드와 alias 맞춤) ====== **/

// 담당자(User) — Campaign
// 프론트가 campaign.User 를 쓰므로 alias를 'User'로!
Campaign.belongsTo(User, { foreignKey: 'managerId', as: 'User' });

// (선택) 클라이언트 사용자
Campaign.belongsTo(User, { foreignKey: 'userId', as: 'Client' });

// 역방향
User.hasMany(Campaign, { foreignKey: 'managerId', as: 'managedCampaigns' });
User.hasMany(Campaign, { foreignKey: 'userId', as: 'clientCampaigns' });

// Campaign — Post
// 프론트가 campaign.posts 를 쓰므로 alias를 'posts'로!
Campaign.hasMany(Post, {
  foreignKey: 'campaignId',
  as: 'posts',
  onDelete: 'CASCADE',
  hooks: true,
});
Post.belongsTo(Campaign, { foreignKey: 'campaignId' });

// User — Notification 관계
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications', onDelete: 'CASCADE' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// 알림 생성자와의 관계 (optional)
User.hasMany(Notification, { foreignKey: 'createdBy', as: 'createdNotifications', onDelete: 'SET NULL' });
Notification.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

// PurchaseRequest 관계 설정
// 요청자 (직원)
User.hasMany(PurchaseRequest, { foreignKey: 'requesterId', as: 'purchaseRequests' });
PurchaseRequest.belongsTo(User, { foreignKey: 'requesterId', as: 'requester' });

// 승인자 (대행사 어드민)
User.hasMany(PurchaseRequest, { foreignKey: 'approverId', as: 'approvedRequests' });
PurchaseRequest.belongsTo(User, { foreignKey: 'approverId', as: 'approver' });

// 캠페인 연결
Campaign.hasMany(PurchaseRequest, { foreignKey: 'campaignId', as: 'purchaseRequests' });
PurchaseRequest.belongsTo(Campaign, { foreignKey: 'campaignId', as: 'campaign' });

// 포스트 연결
Post.hasMany(PurchaseRequest, { foreignKey: 'postId', as: 'purchaseRequests' });
PurchaseRequest.belongsTo(Post, { foreignKey: 'postId', as: 'post' });

export { User, Campaign, Post, Notification, PurchaseRequest };
export default db;
