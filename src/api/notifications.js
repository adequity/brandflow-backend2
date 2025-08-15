import express from 'express';
import NotificationService from '../services/notificationService.js';
import { User } from '../models/index.js';

const router = express.Router();

/**
 * 호출자 정보 파싱
 */
async function getViewer(req) {
  const rawViewerId = req.query.viewerId || req.query.adminId;
  const rawViewerRole = req.query.viewerRole || req.query.adminRole || '';
  
  const viewerId = Number(Array.isArray(rawViewerId) ? rawViewerId[0] : rawViewerId);
  const viewerRole = String(Array.isArray(rawViewerRole) ? rawViewerRole[0] : rawViewerRole).trim();
  
  let viewerCompany = null;

  if (viewerId && !isNaN(viewerId)) {
    const v = await User.findByPk(viewerId, { attributes: ['id', 'company', 'role'] });
    viewerCompany = v?.company ?? null;
  }
  return { viewerId, viewerRole, viewerCompany };
}

/**
 * GET /api/notifications
 * 사용자의 알림 목록 조회
 */
router.get('/', async (req, res) => {
  try {
    const { viewerId } = await getViewer(req);
    console.log('알림 목록 요청 - viewerId:', viewerId);
    
    if (!viewerId || isNaN(viewerId)) {
      console.log('인증 실패 - viewerId:', viewerId);
      return res.status(401).json({ message: '인증이 필요합니다.' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const unreadOnly = req.query.unreadOnly === 'true';

    console.log('알림 조회 파라미터:', { viewerId, page, limit, unreadOnly });

    const result = await NotificationService.getUserNotifications(viewerId, {
      page,
      limit,
      unreadOnly
    });

    console.log('알림 조회 결과:', { 
      count: result.notifications.length, 
      unreadCount: result.unreadCount,
      totalPages: result.totalPages 
    });

    res.json(result);
  } catch (error) {
    console.error('알림 목록 조회 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * GET /api/notifications/unread-count
 * 미읽음 알림 개수 조회
 */
router.get('/unread-count', async (req, res) => {
  try {
    const { viewerId } = await getViewer(req);
    
    if (!viewerId || isNaN(viewerId)) {
      return res.status(401).json({ message: '인증이 필요합니다.' });
    }

    const unreadCount = await NotificationService.getUnreadCount(viewerId);
    res.json({ unreadCount });
  } catch (error) {
    console.error('미읽음 알림 개수 조회 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * PUT /api/notifications/:id/read
 * 특정 알림 읽음 처리
 */
router.put('/:id/read', async (req, res) => {
  try {
    const { viewerId } = await getViewer(req);
    const notificationId = parseInt(req.params.id);
    
    if (!viewerId || isNaN(viewerId)) {
      return res.status(401).json({ message: '인증이 필요합니다.' });
    }

    if (!notificationId || isNaN(notificationId)) {
      return res.status(400).json({ message: '유효하지 않은 알림 ID입니다.' });
    }

    const notification = await NotificationService.markAsRead(notificationId, viewerId);
    res.json(notification);
  } catch (error) {
    console.error('알림 읽음 처리 실패:', error);
    if (error.message === '알림을 찾을 수 없습니다.') {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * PUT /api/notifications/read-all
 * 모든 알림 읽음 처리
 */
router.put('/read-all', async (req, res) => {
  try {
    const { viewerId } = await getViewer(req);
    
    if (!viewerId || isNaN(viewerId)) {
      return res.status(401).json({ message: '인증이 필요합니다.' });
    }

    const updatedCount = await NotificationService.markAllAsRead(viewerId);
    res.json({ 
      message: `${updatedCount}개의 알림을 모두 읽음으로 처리했습니다.`,
      updatedCount 
    });
  } catch (error) {
    console.error('모든 알림 읽음 처리 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * POST /api/notifications/test
 * 테스트용 알림 생성 (개발 환경에서만 활성화)
 */
if (process.env.NODE_ENV !== 'production') {
  router.post('/test', async (req, res) => {
    try {
      const { viewerId } = await getViewer(req);
      
      if (!viewerId || isNaN(viewerId)) {
        return res.status(401).json({ message: '인증이 필요합니다.' });
      }

      const { title, message, type = 'task_created', priority = 'medium' } = req.body;

      if (!title || !message) {
        return res.status(400).json({ message: 'title과 message는 필수입니다.' });
      }

      const notification = await NotificationService.createNotification({
        userId: viewerId,
        title,
        message,
        type,
        relatedData: { test: true },
        createdBy: viewerId,
        priority
      });

      res.status(201).json(notification);
    } catch (error) {
      console.error('테스트 알림 생성 실패:', error);
      res.status(500).json({ message: '서버 에러가 발생했습니다.' });
    }
  });
}

export default router;