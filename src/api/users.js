// src/api/users.js
import express from 'express';
import { User, Campaign, Post } from '../models/index.js';

const router = express.Router();

// (공통) 호출자 정보
async function getViewer(req) {
  const viewerId = Number(req.query.viewerId || req.query.adminId);
  const viewerRole = req.query.viewerRole || req.query.adminRole;
  let viewerCompany = null;

  if (viewerId) {
    const v = await User.findByPk(viewerId, {
      attributes: ['id', 'company', 'role']
    });
    viewerCompany = v?.company || null;
  }
  return { viewerId, viewerRole, viewerCompany };
}

/** GET /api/users  — 역할/회사별 필터 */
router.get('/', async (req, res) => {
  try {
    const { viewerId, viewerRole, viewerCompany } = await getViewer(req);
    let where = {};

    if (viewerRole === '대행사 어드민') {
      if (!viewerCompany) {
        return res.status(400).json({ message: '대행사 정보가 없습니다.' });
      }
      where.company = viewerCompany; // 같은 회사만
    } else if (viewerRole === '클라이언트') {
      where.id = viewerId; // 본인만
    }
    // 슈퍼 어드민은 제한 없음

    const users = await User.findAll({
      where,
      attributes: ['id', 'name', 'email', 'role', 'company', 'createdAt', 'updatedAt']
    });
    res.json(users);
  } catch (err) {
    console.error('사용자 조회 실패:', err);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/** GET /api/users/:id/campaigns — 특정 유저의 캠페인 (권한 체크) */
router.get('/:id/campaigns', async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    const { viewerId, viewerRole, viewerCompany } = await getViewer(req);

    // 본인 확인
    const targetUser = await User.findByPk(targetId, {
      attributes: ['id', 'company', 'role']
    });
    if (!targetUser) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

    if (viewerRole === '대행사 어드민') {
      if (!viewerCompany || targetUser.company !== viewerCompany) {
        return res.status(403).json({ message: '권한이 없습니다.' });
      }
    } else if (viewerRole === '클라이언트') {
      if (viewerId !== targetId) return res.status(403).json({ message: '권한이 없습니다.' });
    }
    // 슈퍼 어드민은 제한 없음

    const campaigns = await Campaign.findAll({
      where: { userId: targetId },
      include: [
        { model: User, as: 'User',   attributes: ['id', 'name', 'email', 'company'] },
        { model: User, as: 'Client', attributes: ['id', 'name', 'email', 'company'] },
        { model: Post,  as: 'posts' }
      ],
      order: [['updatedAt', 'DESC']]
    });

    res.json(campaigns);
  } catch (err) {
    console.error('사용자 캠페인 조회 실패:', err);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/** (선택) POST/PUT에서도 회사 강제하고 싶으면 여기에 추가 */

export default router;
