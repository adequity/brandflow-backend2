// routes/campaigns.js
import express from 'express';
import { Campaign, User, Post } from '../models/index.js';
import { Op } from 'sequelize';
import NotificationService from '../services/notificationService.js';

const router = express.Router();

/**
 * 호출자 정보 파싱:
 * - viewerId / viewerRole 은 쿼리에서 받고
 * - company 는 DB(User)에서 확정
 */
async function getViewer(req) {
  // 파라미터가 배열로 올 경우 첫 번째 값만 사용
  const rawViewerId = req.query.viewerId || req.query.adminId;
  const rawViewerRole = req.query.viewerRole || req.query.adminRole || '';
  
  const viewerId = Number(Array.isArray(rawViewerId) ? rawViewerId[0] : rawViewerId);
  const viewerRole = String(Array.isArray(rawViewerRole) ? rawViewerRole[0] : rawViewerRole).trim();
  
  console.log('Raw params:', { rawViewerId, rawViewerRole });
  console.log('Parsed params:', { viewerId, viewerRole });
  
  let viewerCompany = null;

  if (viewerId && !isNaN(viewerId)) {
    const v = await User.findByPk(viewerId, { attributes: ['id', 'company', 'role'] });
    viewerCompany = v?.company ?? null;
  }
  return { viewerId, viewerRole, viewerCompany };
}

// posts는 별도 쿼리(separate)로 최신순 정렬
const postsInclude = {
  model: Post,
  as: 'posts',
  attributes: [
    'id',
    'title',
    'outline',
    'topicStatus',
    'outlineStatus',
    'publishedUrl',
    'workType',
    'images',
    'createdAt',
    'updatedAt',
  ],
  separate: true,
  order: [['createdAt', 'DESC']],
};

// 조인 공통 정의 (alias 주의!)
const commonInclude = [
  { model: User, as: 'User',   attributes: ['id', 'name', 'email', 'company'], required: false }, // 담당자(매니저)
  { model: User, as: 'Client', attributes: ['id', 'name', 'email', 'company'], required: false }, // 클라이언트
  postsInclude,
];

/**
 * GET /api/campaigns
 * 테넌트/역할별 스코프 적용:
 * - 슈퍼 어드민: 제한 없음
 * - 대행사 어드민: User.company 또는 Client.company 가 본인 company 인 것만
 * - 클라이언트: 본인이 userId 인 캠페인만
 */
router.get('/', async (req, res) => {
  try {
    const { viewerId, viewerRole, viewerCompany } = await getViewer(req);
    console.log('Campaign query - viewerId:', viewerId, 'viewerRole:', viewerRole, 'viewerCompany:', viewerCompany);

    let whereClause;
    if (viewerRole === '슈퍼 어드민') {
      // 슈퍼 어드민은 모든 캠페인 조회 가능 (기존과 동일)
      whereClause = undefined;
    } else if (viewerRole === '대행사 어드민') {
      if (!viewerCompany) {
        // company가 없는 대행사 어드민은 자신이 담당자인 캠페인만 조회
        whereClause = { managerId: viewerId };
      } else {
        whereClause = {
          [Op.or]: [
            { '$User.company$':   { [Op.eq]: viewerCompany } },
            { '$Client.company$': { [Op.eq]: viewerCompany } },
            { managerId: viewerId }, // 자신이 담당자인 캠페인도 포함
          ],
        };
      }
    } else if (viewerRole === '클라이언트') {
      // 클라이언트는 자신의 캠페인만 조회 (userId 기준)
      if (!viewerId || isNaN(viewerId)) {
        console.error('Invalid viewerId for client:', viewerId);
        return res.json([]);
      }
      whereClause = { userId: Number(viewerId) };
      console.log('Client where clause:', whereClause, 'viewerId type:', typeof viewerId);
    } else {
      // 알 수 없는 역할인 경우 빈 결과 반환
      console.error('Unknown viewer role:', viewerRole);
      return res.json([]);
    }
    
    console.log('Final where clause:', whereClause);

    const campaigns = await Campaign.findAll({
      where: whereClause,
      include: commonInclude,
      order: [['updatedAt', 'DESC']],
      subQuery: false, // include 컬럼을 where에서 참조할 때 안전
    });

    console.log('Found campaigns count:', campaigns.length);
    console.log('Campaign userIds:', campaigns.map(c => ({ id: c.id, name: c.name, userId: c.userId })));
    console.log('Campaign posts:', campaigns.map(c => ({ 
      id: c.id, 
      name: c.name, 
      postsCount: c.posts?.length || 0,
      posts: c.posts?.map(p => ({ id: p.id, title: p.title })) || []
    })));

    res.json(campaigns);
  } catch (error) {
    console.error('캠페인 조회 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * GET /api/campaigns/:id
 * 단건 조회 (상세용)
 */
router.get('/:id', async (req, res) => {
  try {
    const campaign = await Campaign.findByPk(req.params.id, {
      include: commonInclude,
    });
    if (!campaign) return res.status(404).json({ message: '캠페인을 찾을 수 없습니다.' });
    res.json(campaign);
  } catch (error) {
    console.error('캠페인 상세 조회 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * POST /api/campaigns
 * 캠페인 생성 (대행사 어드민이면 같은 company 소속 유저들만 허용)
 * 생성 후 include 붙여서 반환
 */
router.post('/', async (req, res) => {
  try {
    console.log('Campaign creation request body:', req.body);
    console.log('Query params:', req.query);
    
    const name = String(req.body?.name || '').trim();
    const client = String(req.body?.client || '').trim();
    const userId = Number(req.body?.userId);
    const managerId = Number(req.body?.managerId);

    console.log('Parsed values:', { name, client, userId, managerId });

    if (!name || !userId || !managerId || isNaN(userId) || isNaN(managerId)) {
      console.log('Missing required fields:', { 
        name: !!name, 
        client: !!client,
        userId: !!userId, 
        managerId: !!managerId,
        userIdValid: !isNaN(userId),
        managerIdValid: !isNaN(managerId)
      });
      return res.status(400).json({ 
        message: '필수 필드가 누락되었거나 잘못되었습니다.',
        details: { 
          name: !!name, 
          client: !!client,
          userId: !!userId && !isNaN(userId), 
          managerId: !!managerId && !isNaN(managerId)
        }
      });
    }

    const { viewerRole, viewerCompany } = await getViewer(req);
    if (viewerRole === '대행사 어드민' && viewerCompany) {
      const [manager, clientUser] = await Promise.all([
        User.findByPk(managerId, { attributes: ['id', 'company'] }),
        User.findByPk(userId,    { attributes: ['id', 'company'] }),
      ]);
      if (!manager || !clientUser || manager.company !== viewerCompany || clientUser.company !== viewerCompany) {
        return res.status(403).json({ message: '권한이 없습니다.' });
      }
    }
    // 슈퍼 어드민은 권한 체크 건너뛰기

    const created = await Campaign.create({ name, client, userId, managerId });
    const full = await Campaign.findByPk(created.id, { include: commonInclude });
    
    // 캠페인 생성 알림 발송
    await NotificationService.notifyCampaignCreated(full, viewerId);
    
    res.status(201).json(full);
  } catch (error) {
    console.error('캠페인 생성 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * POST /api/campaigns/:campaignId/posts
 * 주제 등록 (권한/테넌트 체크)
 */
router.post('/:campaignId/posts', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const title = String(req.body?.title || '').trim();
    const workType = String(req.body?.workType || '블로그').trim();
    const images = req.body?.images || [];
    
    if (!title) return res.status(400).json({ message: 'title은 필수입니다.' });

    const { viewerId, viewerRole, viewerCompany } = await getViewer(req);

    const campaign = await Campaign.findByPk(campaignId, {
      include: [
        { model: User, as: 'User',   attributes: ['id', 'company'] },
        { model: User, as: 'Client', attributes: ['id', 'company'] },
      ],
    });
    if (!campaign) return res.status(404).json({ message: '캠페인을 찾을 수 없습니다.' });

    // 권한/테넌트 검증
    console.log('Topic registration permission check:');
    console.log('- viewerId:', viewerId, 'viewerRole:', viewerRole, 'viewerCompany:', viewerCompany);
    console.log('- campaign.managerId:', campaign.managerId, 'campaign.userId:', campaign.userId);
    console.log('- campaign.User:', campaign.User);
    console.log('- campaign.Client:', campaign.Client);
    
    if (viewerRole === '대행사 어드민') {
      // 대행사 어드민은 자신이 담당자이거나, 같은 회사 클라이언트의 캠페인에 주제 등록 가능
      const isManager = campaign.managerId === viewerId;
      const isSameCompanyClient = viewerCompany && campaign.Client?.company === viewerCompany;
      const isSuperAdminCampaign = campaign.User?.role === '슈퍼 어드민'; // 슈퍼 어드민 캠페인도 허용
      
      console.log('Permission checks:');
      console.log('- isManager:', isManager);
      console.log('- isSameCompanyClient:', isSameCompanyClient);
      console.log('- isSuperAdminCampaign:', isSuperAdminCampaign);
      
      if (!isManager && !isSameCompanyClient && !isSuperAdminCampaign) {
        console.log('Permission denied for agency admin');
        return res.status(403).json({ message: '권한이 없습니다.' });
      }
      console.log('Permission granted for agency admin');
    } else if (viewerRole === '클라이언트' && campaign.userId !== viewerId) {
      return res.status(403).json({ message: '권한이 없습니다.' });
    }

    const newPost = await Post.create({
      title,
      workType,
      images: images.length > 0 ? images : null,
      campaignId: Number(campaignId),
      topicStatus: '주제 승인 대기',
    });

    // 새 업무 등록 알림 발송
    await NotificationService.notifyTaskCreated(newPost, viewerId);

    res.status(201).json(newPost);
  } catch (error) {
    console.error('주제 등록 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * DELETE /api/campaigns/:id
 * 캠페인 삭제 (슈퍼 어드민만 가능)
 */
router.delete('/:id', async (req, res) => {
  try {
    const campaignId = Number(req.params.id);
    const { viewerId, viewerRole } = await getViewer(req);
    
    console.log('Campaign deletion request:', { campaignId, viewerId, viewerRole });
    
    // 슈퍼 어드민만 삭제 가능
    if (viewerRole !== '슈퍼 어드민') {
      return res.status(403).json({ message: '권한이 없습니다. 슈퍼 어드민만 캠페인을 삭제할 수 있습니다.' });
    }
    
    // 캠페인 존재 확인
    const campaign = await Campaign.findByPk(campaignId);
    if (!campaign) {
      return res.status(404).json({ message: '캠페인을 찾을 수 없습니다.' });
    }
    
    // 연관된 posts도 함께 삭제 (CASCADE)
    await Post.destroy({ where: { campaignId } });
    
    // 캠페인 삭제
    await campaign.destroy();
    
    console.log('Campaign deleted successfully:', campaignId);
    res.json({ message: '캠페인이 성공적으로 삭제되었습니다.' });
    
  } catch (error) {
    console.error('캠페인 삭제 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

export default router;
