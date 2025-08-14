// routes/campaigns.js
import express from 'express';
import { Campaign, User, Post } from '../models/index.js';
import { Op } from 'sequelize';

const router = express.Router();

/**
 * 호출자 정보 파싱:
 * - viewerId / viewerRole 은 쿼리에서 받고
 * - company 는 DB(User)에서 확정
 */
async function getViewer(req) {
  const viewerId = Number(req.query.viewerId || req.query.adminId);
  const viewerRole = String(req.query.viewerRole || req.query.adminRole || '').trim();
  let viewerCompany = null;

  if (viewerId) {
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

    let whereClause;
    if (viewerRole === '대행사 어드민') {
      if (!viewerCompany) {
        // 대행사 어드민인데 company가 없으면 빈 결과 반환
        return res.json([]);
      }
      whereClause = {
        [Op.or]: [
          { '$User.company$':   { [Op.eq]: viewerCompany } },
          { '$Client.company$': { [Op.eq]: viewerCompany } },
        ],
      };
    } else if (viewerRole === '클라이언트') {
      whereClause = { userId: viewerId };
    } // 슈퍼 어드민은 where 없음

    const campaigns = await Campaign.findAll({
      where: whereClause,
      include: commonInclude,
      order: [['updatedAt', 'DESC']],
      subQuery: false, // include 컬럼을 where에서 참조할 때 안전
    });

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

    if (!name || !userId || !managerId) {
      console.log('Missing required fields:', { name: !!name, userId: !!userId, managerId: !!managerId });
      return res.status(400).json({ 
        message: '필수 필드가 누락되었습니다.',
        details: { name: !!name, userId: !!userId, managerId: !!managerId }
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
    if (viewerRole === '대행사 어드민' && campaign.User?.company !== viewerCompany) {
      return res.status(403).json({ message: '권한이 없습니다.' });
    }
    if (viewerRole === '클라이언트' && campaign.userId !== viewerId) {
      return res.status(403).json({ message: '권한이 없습니다.' });
    }

    const newPost = await Post.create({
      title,
      campaignId: Number(campaignId),
      topicStatus: '주제 승인 대기',
    });

    res.status(201).json(newPost);
  } catch (error) {
    console.error('주제 등록 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

export default router;
