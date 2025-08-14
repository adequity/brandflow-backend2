// src/models/index.js
import sequelize from '../config/db.js';
import User from './user.js';
import Campaign from './campaign.js';
import Post from './post.js';

const db = {};
db.sequelize = sequelize;
db.User = User;
db.Campaign = Campaign;
db.Post = Post;

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

export { User, Campaign, Post };
export default db;
