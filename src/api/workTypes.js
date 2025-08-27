import express from 'express';
import { User } from '../models/index.js';
import { getViewer } from '../utils/permissionUtils.js';

const router = express.Router();

// 임시로 메모리에서 관리하는 업무타입들 (나중에 데이터베이스로 마이그레이션 가능)
let workTypes = [
  { id: 1, name: '블로그', description: '블로그 포스팅 작업', isActive: true, sortOrder: 1 },
  { id: 2, name: '디자인', description: '디자인 작업', isActive: true, sortOrder: 2 },
  { id: 3, name: '마케팅', description: '마케팅 관련 업무', isActive: true, sortOrder: 3 },
  { id: 4, name: '개발', description: '개발 관련 업무', isActive: true, sortOrder: 4 },
  { id: 5, name: '영상', description: '영상 제작 업무', isActive: true, sortOrder: 5 },
  { id: 6, name: '기획', description: '기획 관련 업무', isActive: true, sortOrder: 6 },
  { id: 7, name: '기타', description: '기타 업무', isActive: true, sortOrder: 7 }
];

let nextId = 8;

// 권한 체크 함수 (권한 유틸리티 적용)
async function checkAdminPermission(req, res, next) {
  try {
    const { viewerId, viewerRole } = await getViewer(req);
    
    if (!viewerId || !viewerRole) {
      return res.status(401).json({ message: '인증 정보가 필요합니다.' });
    }
    
    if (viewerRole !== '슈퍼 어드민' && viewerRole !== '대행사 어드민') {
      return res.status(403).json({ message: '권한이 없습니다. 어드민만 업무타입을 관리할 수 있습니다.' });
    }
    
    // 권한 정보를 req에 저장하여 다음 미들웨어에서 사용
    req.viewer = { viewerId, viewerRole };
    next();
  } catch (error) {
    console.error('권한 체크 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
}

/**
 * GET /api/work-types
 * 업무타입 목록 조회 (모든 사용자)
 */
router.get('/', async (req, res) => {
  try {
    const activeWorkTypes = workTypes
      .filter(wt => wt.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    
    res.json(activeWorkTypes);
  } catch (error) {
    console.error('업무타입 목록 조회 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * GET /api/work-types/manage
 * 업무타입 관리 목록 조회 (어드민만)
 */
router.get('/manage', checkAdminPermission, async (req, res) => {
  try {
    const allWorkTypes = workTypes.sort((a, b) => a.sortOrder - b.sortOrder);
    res.json(allWorkTypes);
  } catch (error) {
    console.error('업무타입 관리 목록 조회 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * POST /api/work-types
 * 업무타입 생성 (어드민만)
 */
router.post('/', checkAdminPermission, async (req, res) => {
  try {
    const { name, description } = req.body;
    const { viewerId } = req.viewer; // checkAdminPermission에서 설정된 값 사용
    
    if (!name || !name.trim()) {
      return res.status(400).json({ message: '업무타입명은 필수입니다.' });
    }
    
    // 중복 체크
    if (workTypes.some(wt => wt.name === name.trim())) {
      return res.status(400).json({ message: '이미 존재하는 업무타입명입니다.' });
    }
    
    const newWorkType = {
      id: nextId++,
      name: name.trim(),
      description: description?.trim() || '',
      isActive: true,
      sortOrder: Math.max(...workTypes.map(wt => wt.sortOrder), 0) + 1,
      createdBy: Number(viewerId),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    workTypes.push(newWorkType);
    
    console.log('업무타입 생성됨:', newWorkType);
    res.status(201).json(newWorkType);
  } catch (error) {
    console.error('업무타입 생성 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * PUT /api/work-types/:id
 * 업무타입 수정 (어드민만)
 */
router.put('/:id', checkAdminPermission, async (req, res) => {
  try {
    const workTypeId = Number(req.params.id);
    const { name, description, isActive, sortOrder } = req.body;
    
    const workTypeIndex = workTypes.findIndex(wt => wt.id === workTypeId);
    if (workTypeIndex === -1) {
      return res.status(404).json({ message: '업무타입을 찾을 수 없습니다.' });
    }
    
    if (name && name.trim()) {
      // 중복 체크 (자기 자신 제외)
      if (workTypes.some(wt => wt.id !== workTypeId && wt.name === name.trim())) {
        return res.status(400).json({ message: '이미 존재하는 업무타입명입니다.' });
      }
      workTypes[workTypeIndex].name = name.trim();
    }
    
    if (description !== undefined) {
      workTypes[workTypeIndex].description = description?.trim() || '';
    }
    
    if (isActive !== undefined) {
      workTypes[workTypeIndex].isActive = Boolean(isActive);
    }
    
    if (sortOrder !== undefined) {
      workTypes[workTypeIndex].sortOrder = Number(sortOrder);
    }
    
    workTypes[workTypeIndex].updatedAt = new Date();
    
    console.log('업무타입 수정됨:', workTypes[workTypeIndex]);
    res.json(workTypes[workTypeIndex]);
  } catch (error) {
    console.error('업무타입 수정 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * DELETE /api/work-types/:id
 * 업무타입 삭제 (어드민만)
 */
router.delete('/:id', checkAdminPermission, async (req, res) => {
  try {
    const workTypeId = Number(req.params.id);
    
    const workTypeIndex = workTypes.findIndex(wt => wt.id === workTypeId);
    if (workTypeIndex === -1) {
      return res.status(404).json({ message: '업무타입을 찾을 수 없습니다.' });
    }
    
    // 실제 삭제 대신 비활성화
    workTypes[workTypeIndex].isActive = false;
    workTypes[workTypeIndex].updatedAt = new Date();
    
    console.log('업무타입 비활성화됨:', workTypes[workTypeIndex]);
    res.json({ message: '업무타입이 비활성화되었습니다.' });
  } catch (error) {
    console.error('업무타입 삭제 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

export default router;