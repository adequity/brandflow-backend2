import { Notification, User, Campaign, Post } from '../models/index.js';

class NotificationService {
  
  /**
   * 알림 생성 및 저장
   * @param {Object} params - 알림 생성 파라미터
   * @param {number} params.userId - 알림 받을 사용자 ID
   * @param {string} params.title - 알림 제목
   * @param {string} params.message - 알림 내용
   * @param {string} params.type - 알림 타입
   * @param {Object} params.relatedData - 관련 데이터 (campaignId, postId 등)
   * @param {number} params.createdBy - 알림 생성자 ID
   * @param {string} params.priority - 우선순위 (high, medium, low)
   */
  static async createNotification({
    userId,
    title,
    message,
    type,
    relatedData = {},
    createdBy = null,
    priority = 'medium'
  }) {
    try {
      const notification = await Notification.create({
        userId,
        title,
        message,
        type,
        relatedData,
        createdBy,
        priority
      });

      console.log(`알림 생성됨: ${title} -> User ${userId}`);
      return notification;
    } catch (error) {
      console.error('알림 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 새 업무 등록 알림
   */
  static async notifyTaskCreated(post, creatorId) {
    console.log('📋 notifyTaskCreated 호출됨:', { postId: post.id, campaignId: post.campaignId, creatorId });
    try {
      // 캠페인 정보와 매니저 정보 가져오기
      const campaign = await Campaign.findByPk(post.campaignId, {
        include: [{ model: User, as: 'User' }] // 매니저 정보
      });

      console.log('캠페인 정보 조회:', { 
        campaignId: campaign?.id, 
        managerId: campaign?.managerId, 
        hasManager: !!campaign?.User 
      });

      if (!campaign || !campaign.User) {
        console.log('❌ 캠페인 또는 매니저 정보 없음');
        return;
      }

      // 매니저에게 알림
      if (campaign.managerId !== creatorId) { // 자신이 등록한 경우는 제외
        console.log('✅ 매니저에게 알림 발송:', { managerId: campaign.managerId, creatorId });
        
        const notification = await this.createNotification({
          userId: campaign.managerId,
          title: '새로운 업무가 등록되었습니다',
          message: `"${campaign.name}" 캠페인에 새로운 ${post.workType} 업무가 등록되었습니다: ${post.title}`,
          type: 'task_created',
          relatedData: {
            campaignId: campaign.id,
            postId: post.id,
            campaignName: campaign.name,
            workType: post.workType
          },
          createdBy: creatorId,
          priority: 'medium'
        });
        
        console.log('📨 업무 등록 알림 생성 완료:', notification.id);
      } else {
        console.log('⏭️ 자신이 등록한 업무라서 알림 건너뜀');
      }
    } catch (error) {
      console.error('❌ 업무 등록 알림 실패:', error);
    }
  }

  /**
   * 업무 승인/반려 알림
   */
  static async notifyTaskStatusChanged(post, newStatus, reviewerId) {
    console.log('⚡ notifyTaskStatusChanged 호출됨:', { postId: post.id, newStatus, reviewerId });
    try {
      const campaign = await Campaign.findByPk(post.campaignId, {
        include: [{ model: User, as: 'Client' }] // 클라이언트 정보
      });

      console.log('캠페인 정보 조회:', { 
        campaignId: campaign?.id, 
        userId: campaign?.userId, 
        hasClient: !!campaign?.Client 
      });

      if (!campaign || !campaign.Client) {
        console.log('❌ 캠페인 또는 클라이언트 정보 없음');
        return;
      }

      const isApproved = newStatus.includes('승인');
      const isRejected = newStatus.includes('반려');

      if (campaign.userId !== reviewerId) { // 자신이 승인한 경우는 제외
        console.log('✅ 클라이언트에게 알림 발송:', { userId: campaign.userId, reviewerId });
        
        const notification = await this.createNotification({
          userId: campaign.userId,
          title: `업무가 ${isApproved ? '승인' : '반려'}되었습니다`,
          message: `"${campaign.name}" 캠페인의 "${post.title}" 업무가 ${newStatus}되었습니다.`,
          type: isApproved ? 'task_approved' : 'task_rejected',
          relatedData: {
            campaignId: campaign.id,
            postId: post.id,
            campaignName: campaign.name,
            status: newStatus
          },
          createdBy: reviewerId,
          priority: isRejected ? 'high' : 'medium'
        });
        
        console.log('📨 업무 상태 변경 알림 생성 완료:', notification.id);
      } else {
        console.log('⏭️ 자신이 승인한 업무라서 알림 건너뜀');
      }
    } catch (error) {
      console.error('❌ 업무 상태 변경 알림 실패:', error);
    }
  }

  /**
   * 세부사항 제출 알림
   */
  static async notifyOutlineSubmitted(post, submitterId) {
    try {
      const campaign = await Campaign.findByPk(post.campaignId, {
        include: [{ model: User, as: 'User' }] // 매니저 정보
      });

      if (!campaign || !campaign.User) return;

      // 매니저에게 알림
      if (campaign.managerId !== submitterId) {
        await this.createNotification({
          userId: campaign.managerId,
          title: '세부사항이 제출되었습니다',
          message: `"${campaign.name}" 캠페인의 "${post.title}" 업무에 세부사항이 제출되었습니다.`,
          type: 'outline_submitted',
          relatedData: {
            campaignId: campaign.id,
            postId: post.id,
            campaignName: campaign.name
          },
          createdBy: submitterId,
          priority: 'medium'
        });
      }
    } catch (error) {
      console.error('세부사항 제출 알림 실패:', error);
    }
  }

  /**
   * 세부사항 승인/반려 알림
   */
  static async notifyOutlineStatusChanged(post, newStatus, reviewerId) {
    try {
      const campaign = await Campaign.findByPk(post.campaignId, {
        include: [{ model: User, as: 'Client' }] // 클라이언트 정보
      });

      if (!campaign || !campaign.Client) return;

      const isApproved = newStatus.includes('승인');
      const isRejected = newStatus.includes('반려');

      if (campaign.userId !== reviewerId) {
        await this.createNotification({
          userId: campaign.userId,
          title: `세부사항이 ${isApproved ? '승인' : '반려'}되었습니다`,
          message: `"${campaign.name}" 캠페인의 "${post.title}" 세부사항이 ${newStatus}되었습니다.`,
          type: isApproved ? 'outline_approved' : 'outline_rejected',
          relatedData: {
            campaignId: campaign.id,
            postId: post.id,
            campaignName: campaign.name,
            status: newStatus
          },
          createdBy: reviewerId,
          priority: isRejected ? 'high' : 'medium'
        });
      }
    } catch (error) {
      console.error('세부사항 상태 변경 알림 실패:', error);
    }
  }

  /**
   * 결과물 제출 알림
   */
  static async notifyResultSubmitted(post, submitterId) {
    try {
      const campaign = await Campaign.findByPk(post.campaignId, {
        include: [
          { model: User, as: 'User' }, // 매니저
          { model: User, as: 'Client' } // 클라이언트
        ]
      });

      if (!campaign) return;

      // 매니저와 클라이언트 모두에게 알림 (제출자 제외)
      const notifyUsers = [campaign.managerId, campaign.userId].filter(
        id => id && id !== submitterId
      );

      for (const userId of notifyUsers) {
        await this.createNotification({
          userId,
          title: '결과물이 제출되었습니다',
          message: `"${campaign.name}" 캠페인의 "${post.title}" 업무 결과물이 제출되었습니다.`,
          type: 'result_submitted',
          relatedData: {
            campaignId: campaign.id,
            postId: post.id,
            campaignName: campaign.name,
            publishedUrl: post.publishedUrl
          },
          createdBy: submitterId,
          priority: 'high'
        });
      }
    } catch (error) {
      console.error('결과물 제출 알림 실패:', error);
    }
  }

  /**
   * 새 캠페인 생성 알림
   */
  static async notifyCampaignCreated(campaign, creatorId) {
    try {
      // 클라이언트에게 알림
      if (campaign.userId && campaign.userId !== creatorId) {
        await this.createNotification({
          userId: campaign.userId,
          title: '새로운 캠페인이 생성되었습니다',
          message: `"${campaign.name}" 캠페인이 생성되었습니다. 담당 매니저가 배정되었습니다.`,
          type: 'campaign_created',
          relatedData: {
            campaignId: campaign.id,
            campaignName: campaign.name
          },
          createdBy: creatorId,
          priority: 'medium'
        });
      }

      // 매니저에게 알림 (생성자가 아닌 경우)
      if (campaign.managerId && campaign.managerId !== creatorId) {
        await this.createNotification({
          userId: campaign.managerId,
          title: '새로운 캠페인이 배정되었습니다',
          message: `"${campaign.name}" 캠페인의 담당 매니저로 배정되었습니다.`,
          type: 'campaign_assigned',
          relatedData: {
            campaignId: campaign.id,
            campaignName: campaign.name
          },
          createdBy: creatorId,
          priority: 'medium'
        });
      }
    } catch (error) {
      console.error('캠페인 생성 알림 실패:', error);
    }
  }

  /**
   * 사용자의 알림 목록 조회
   */
  static async getUserNotifications(userId, { page = 1, limit = 20, unreadOnly = false } = {}) {
    try {
      const where = { userId };
      if (unreadOnly) {
        where.isRead = false;
      }

      const offset = (page - 1) * limit;

      const { count, rows } = await Notification.findAndCountAll({
        where,
        include: [
          { model: User, as: 'creator', attributes: ['id', 'name'] }
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset
      });

      return {
        notifications: rows,
        total: count,
        page,
        totalPages: Math.ceil(count / limit),
        unreadCount: unreadOnly ? count : await this.getUnreadCount(userId)
      };
    } catch (error) {
      console.error('알림 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 미읽음 알림 개수 조회
   */
  static async getUnreadCount(userId) {
    try {
      return await Notification.count({
        where: {
          userId,
          isRead: false
        }
      });
    } catch (error) {
      console.error('미읽음 알림 개수 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 알림 읽음 처리
   */
  static async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOne({
        where: {
          id: notificationId,
          userId
        }
      });

      if (!notification) {
        throw new Error('알림을 찾을 수 없습니다.');
      }

      if (!notification.isRead) {
        await notification.update({
          isRead: true,
          readAt: new Date()
        });
      }

      return notification;
    } catch (error) {
      console.error('알림 읽음 처리 실패:', error);
      throw error;
    }
  }

  /**
   * 모든 알림 읽음 처리
   */
  static async markAllAsRead(userId) {
    try {
      const [updatedCount] = await Notification.update(
        { 
          isRead: true, 
          readAt: new Date() 
        },
        {
          where: {
            userId,
            isRead: false
          }
        }
      );

      return updatedCount;
    } catch (error) {
      console.error('모든 알림 읽음 처리 실패:', error);
      throw error;
    }
  }
}

export default NotificationService;