// src/models/index.js
import sequelize from '../config/db.js';
import User from './user.js';
import Campaign from './Campaign.js';
import Post from './post.js';
import Notification from './notification.js';
import PurchaseRequestModel from './purchaseRequest.js';
import ProductModel from './product.js';
import SaleModel from './sale.js';
import SystemSettingModel from './systemSetting.js';
import MonthlyIncentiveModel from './monthlyIncentive.js';

const db = {};
db.sequelize = sequelize;
db.User = User;
db.Campaign = Campaign;
db.Post = Post;
db.Notification = Notification;

// 모델 초기화
const PurchaseRequest = PurchaseRequestModel(sequelize);
const Product = ProductModel(sequelize);
const Sale = SaleModel(sequelize);
const SystemSetting = SystemSettingModel(sequelize);
const MonthlyIncentive = MonthlyIncentiveModel(sequelize);

db.PurchaseRequest = PurchaseRequest;
db.Product = Product;
db.Sale = Sale;
db.SystemSetting = SystemSetting;
db.MonthlyIncentive = MonthlyIncentive;

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

// Product 관계 설정
// 상품 생성자 (본사 관리자)
User.hasMany(Product, { foreignKey: 'createdBy', as: 'createdProducts' });
Product.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

// Sale 관계 설정
// 영업 담당자 (직원)
User.hasMany(Sale, { foreignKey: 'salesPersonId', as: 'sales' });
Sale.belongsTo(User, { foreignKey: 'salesPersonId', as: 'salesperson' });

// 검토자 (본사 관리자)
User.hasMany(Sale, { foreignKey: 'reviewedBy', as: 'reviewedSales' });
Sale.belongsTo(User, { foreignKey: 'reviewedBy', as: 'reviewer' });

// 상품-매출 관계
Product.hasMany(Sale, { foreignKey: 'productId', as: 'sales' });
Sale.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

// 캠페인-매출 관계 (선택적)
Campaign.hasMany(Sale, { foreignKey: 'campaignId', as: 'sales' });
Sale.belongsTo(Campaign, { foreignKey: 'campaignId', as: 'campaign' });

// SystemSetting 관계 설정
// 마지막 수정자 (관리자)
User.hasMany(SystemSetting, { foreignKey: 'lastModifiedBy', as: 'modifiedSettings' });
SystemSetting.belongsTo(User, { foreignKey: 'lastModifiedBy', as: 'modifier' });

// MonthlyIncentive 관계 설정
// 직원 (인센티브 대상자)
User.hasMany(MonthlyIncentive, { foreignKey: 'userId', as: 'monthlyIncentives' });
MonthlyIncentive.belongsTo(User, { foreignKey: 'userId', as: 'employee' });

// 승인자 (관리자)
User.hasMany(MonthlyIncentive, { foreignKey: 'approvedBy', as: 'approvedIncentives' });
MonthlyIncentive.belongsTo(User, { foreignKey: 'approvedBy', as: 'approver' });

// 생성자 (관리자)
User.hasMany(MonthlyIncentive, { foreignKey: 'createdBy', as: 'createdIncentives' });
MonthlyIncentive.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

// Post-Product 관계 설정
Product.hasMany(Post, { foreignKey: 'productId', as: 'posts' });
Post.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

export { User, Campaign, Post, Notification, PurchaseRequest, Product, Sale, SystemSetting, MonthlyIncentive };
export default db;
