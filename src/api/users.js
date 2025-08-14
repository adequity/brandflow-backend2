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

/** POST /api/users — 새 사용자 생성 */
router.post('/', async (req, res) => {
  try {
    const { viewerId, viewerRole } = await getViewer(req);
    
    // 권한 확인: 슈퍼 어드민 또는 대행사 어드민만 사용자 생성 가능
    if (viewerRole !== '슈퍼 어드민' && viewerRole !== '대행사 어드민') {
      return res.status(403).json({ message: '권한이 없습니다. 관리자만 사용자를 생성할 수 있습니다.' });
    }

    // 대행사 어드민은 클라이언트만 생성 가능
    if (viewerRole === '대행사 어드민' && role !== '클라이언트') {
      return res.status(403).json({ message: '대행사 어드민은 클라이언트 계정만 생성할 수 있습니다.' });
    }

    const { name, email, password, role, company, contact } = req.body;

    // 필수 필드 검증
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: '필수 필드가 누락되었습니다.' });
    }

    // 이메일 중복 확인
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: '이미 존재하는 이메일입니다.' });
    }

    // 비밀번호 해싱
    const bcrypt = await import('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 10);

    // 대행사 어드민이 생성하는 클라이언트는 자동으로 같은 회사 배정
    let finalCompany = company;
    if (viewerRole === '대행사 어드민') {
      const viewer = await User.findByPk(viewerId, { attributes: ['company'] });
      finalCompany = viewer?.company || company;
    }

    // 사용자 생성
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      company: finalCompany || null,
      contact: contact || null,
      creatorId: viewerId
    });

    // 비밀번호 제외하고 응답
    const { password: _, ...userResponse } = newUser.toJSON();
    res.status(201).json(userResponse);

  } catch (err) {
    console.error('사용자 생성 실패:', err);
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ message: '입력 데이터가 올바르지 않습니다.' });
    }
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/** PUT /api/users/:id — 사용자 정보 수정 */
router.put('/:id', async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    const { viewerId, viewerRole } = await getViewer(req);
    const { name, email, role, company, contact } = req.body;

    // 권한 확인
    if (viewerRole !== '슈퍼 어드민' && viewerId !== targetId) {
      return res.status(403).json({ message: '권한이 없습니다.' });
    }

    const user = await User.findByPk(targetId);
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    // 이메일 중복 확인 (다른 사용자와)
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ message: '이미 존재하는 이메일입니다.' });
      }
    }

    // 업데이트할 필드만 추가
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (company !== undefined) updateData.company = company;
    if (contact !== undefined) updateData.contact = contact;

    await user.update(updateData);

    // 비밀번호 제외하고 응답
    const { password: _, ...userResponse } = user.toJSON();
    res.json(userResponse);

  } catch (err) {
    console.error('사용자 수정 실패:', err);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/** DELETE /api/users/:id — 사용자 삭제 */
router.delete('/:id', async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    const { viewerId, viewerRole } = await getViewer(req);

    // 권한 확인: 슈퍼 어드민만 삭제 가능
    if (viewerRole !== '슈퍼 어드민') {
      return res.status(403).json({ message: '권한이 없습니다. 슈퍼 어드민만 사용자를 삭제할 수 있습니다.' });
    }

    // 자기 자신 삭제 방지
    if (viewerId === targetId) {
      return res.status(400).json({ message: '자기 자신은 삭제할 수 없습니다.' });
    }

    const user = await User.findByPk(targetId);
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    await user.destroy();
    res.json({ message: '사용자가 삭제되었습니다.' });

  } catch (err) {
    console.error('사용자 삭제 실패:', err);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/** GET /api/users/clients — 클라이언트 목록 조회 (캠페인 생성용) */
router.get('/clients', async (req, res) => {
  try {
    const { viewerId, viewerRole, viewerCompany } = await getViewer(req);
    let where = { role: '클라이언트' };

    // 대행사 어드민은 같은 회사 클라이언트만
    if (viewerRole === '대행사 어드민') {
      if (!viewerCompany) {
        return res.status(400).json({ message: '대행사 정보가 없습니다.' });
      }
      where.company = viewerCompany;
    }
    // 슈퍼 어드민은 모든 클라이언트 조회 가능
    // 클라이언트는 자기 자신만
    else if (viewerRole === '클라이언트') {
      where.id = viewerId;
    }

    const clients = await User.findAll({
      where,
      attributes: ['id', 'name', 'email', 'company'],
      order: [['name', 'ASC']]
    });

    res.json(clients);
  } catch (err) {
    console.error('클라이언트 목록 조회 실패:', err);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

export default router;
