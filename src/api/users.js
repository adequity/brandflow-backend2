// src/api/users.js
import express from 'express';
import { User, Campaign, Post } from '../models/index.js';

const router = express.Router();

// (공통) 호출자 정보
async function getViewer(req) {
  // 파라미터가 배열로 올 경우 첫 번째 값만 사용
  const rawViewerId = req.query.viewerId || req.query.adminId;
  const rawViewerRole = req.query.viewerRole || req.query.adminRole || '';
  
  const viewerId = Number(Array.isArray(rawViewerId) ? rawViewerId[0] : rawViewerId);
  // URL 디코딩 추가
  const viewerRole = decodeURIComponent(String(Array.isArray(rawViewerRole) ? rawViewerRole[0] : rawViewerRole)).trim();
  
  let viewerCompany = null;

  if (viewerId && !isNaN(viewerId)) {
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
        // 대행사 어드민인데 company가 없으면 빈 결과 반환
        return res.json([]);
      }
      where.company = viewerCompany; // 같은 회사만
    } else if (viewerRole === '직원') {
      if (!viewerCompany) {
        // 직원인데 company가 없으면 빈 결과 반환
        return res.json([]);
      }
      where.company = viewerCompany; // 같은 회사만
    } else if (viewerRole === '클라이언트') {
      where.id = viewerId; // 본인만
    }
    // 슈퍼 어드민은 제한 없음

    const users = await User.findAll({
      where,
      attributes: ['id', 'name', 'email', 'role', 'company', 'contact', 'incentiveRate', 'createdAt', 'updatedAt']
    });
    
    console.log(`GET /api/users - 사용자 ${users.length}명 반환, viewerId: ${viewerId}, viewerRole: ${viewerRole}`);
    console.log('반환된 사용자들:', users.map(u => ({ id: u.id, name: u.name, role: u.role, incentiveRate: u.incentiveRate })));
    
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
    console.log('POST /api/users - Raw params:', {
      rawViewerId: req.query.viewerId || req.query.adminId,
      rawViewerRole: req.query.viewerRole || req.query.adminRole || ''
    });
    
    const { viewerId, viewerRole } = await getViewer(req);
    
    console.log('POST /api/users - Parsed params:', { viewerId, viewerRole });
    console.log('POST /api/users - ViewerRole comparison:');
    console.log('  Received viewerRole:', JSON.stringify(viewerRole));
    console.log('  Expected "슈퍼 어드민":', JSON.stringify('슈퍼 어드민'));
    console.log('  Expected "대행사 어드민":', JSON.stringify('대행사 어드민'));
    console.log('  Match super admin:', viewerRole === '슈퍼 어드민');
    console.log('  Match agency admin:', viewerRole === '대행사 어드민');
    
    // 권한 확인: 슈퍼 어드민 또는 대행사 어드민만 사용자 생성 가능
    // Korean characters sometimes have encoding issues, so check multiple variations
    const isSuperAdmin = viewerRole === '슈퍼 어드민' || 
                        viewerRole === '슈퍼어드민' ||
                        viewerRole.includes('슈퍼') && viewerRole.includes('어드민');
    const isAgencyAdmin = viewerRole === '대행사 어드민' ||
                         viewerRole === '대행사어드민' ||
                         viewerRole.includes('대행사') && viewerRole.includes('어드민');
    
    if (!isSuperAdmin && !isAgencyAdmin) {
      console.log('POST /api/users - Permission denied for viewerRole:', JSON.stringify(viewerRole));
      return res.status(403).json({ message: '권한이 없습니다. 관리자만 사용자를 생성할 수 있습니다.' });
    }

    const { name, email, password, role, company, contact, incentiveRate } = req.body;

    // 대행사 어드민은 클라이언트와 직원만 생성 가능 (슈퍼 어드민, 다른 대행사 어드민 제외)
    if (isAgencyAdmin && (role === '슈퍼 어드민' || role === '대행사 어드민')) {
      return res.status(403).json({ message: '대행사 어드민은 클라이언트와 직원만 생성할 수 있습니다.' });
    }

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

    // 회사 소속 결정 로직
    let finalCompany = null;
    if (isSuperAdmin) {
      // 슈퍼 어드민만 새로운 회사 소속을 만들거나 임의의 회사 배정 가능
      finalCompany = company || null;
    } else if (isAgencyAdmin) {
      // 대행사 어드민은 자신의 회사 소속으로만 팀원 생성 가능
      const viewer = await User.findByPk(viewerId, { attributes: ['company'] });
      finalCompany = viewer?.company || null;
      console.log(`대행사 어드민 ${viewerId}이 팀원 생성: 회사 ${finalCompany}로 강제 배정`);
    }

    // 사용자 생성
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      company: finalCompany || null,
      contact: contact || null,
      incentiveRate: incentiveRate || 0,
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
    const { name, email, role, company, contact, incentiveRate } = req.body;
    
    console.log(`PUT /api/users/${targetId} - viewerId: ${viewerId}, viewerRole: ${viewerRole}`);
    console.log('Request body:', { name, email, role, company, contact, incentiveRate });

    // 수정 대상 사용자 정보 확인
    const targetUser = await User.findByPk(targetId);
    if (!targetUser) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    // 권한 확인
    let hasPermission = false;
    
    if (viewerRole === '슈퍼 어드민') {
      hasPermission = true;
    } else if (viewerId === targetId) {
      hasPermission = true; // 본인 수정
    } else if (viewerRole === '대행사 어드민') {
      // 대행사 어드민은 같은 회사의 직원/클라이언트 수정 가능 (슈퍼 어드민 제외)
      const viewer = await User.findByPk(viewerId, { attributes: ['company'] });
      if (viewer?.company && 
          targetUser.company === viewer.company && 
          targetUser.role !== '슈퍼 어드민') {
        hasPermission = true;
      }
    }
    
    if (!hasPermission) {
      return res.status(403).json({ message: '권한이 없습니다.' });
    }

    // targetUser를 user 변수로 재사용
    const user = targetUser;

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
    if (incentiveRate !== undefined) updateData.incentiveRate = incentiveRate;

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

    // 삭제 대상 사용자 정보 확인
    const targetUser = await User.findByPk(targetId);
    if (!targetUser) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    // 권한 확인
    let hasPermission = false;
    
    if (viewerRole === '슈퍼 어드민') {
      hasPermission = true;
    } else if (viewerRole === '대행사 어드민') {
      // 대행사 어드민은 같은 회사의 직원/클라이언트 삭제 가능 (슈퍼 어드민 제외)
      const viewer = await User.findByPk(viewerId, { attributes: ['company'] });
      if (viewer?.company && 
          targetUser.company === viewer.company && 
          targetUser.role !== '슈퍼 어드민') {
        hasPermission = true;
      }
    }
    
    if (!hasPermission) {
      return res.status(403).json({ message: '권한이 없습니다.' });
    }

    // 자기 자신 삭제 방지
    if (viewerId === targetId) {
      return res.status(400).json({ message: '자기 자신은 삭제할 수 없습니다.' });
    }

    // targetUser를 user 변수로 재사용
    const user = targetUser;

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
        // 대행사 어드민인데 company가 없으면 빈 결과 반환
        return res.json([]);
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
