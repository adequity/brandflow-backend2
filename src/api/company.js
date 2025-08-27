import express from 'express';
import { getViewer } from '../utils/permissionUtils.js';

const router = express.Router();

// 임시로 메모리에서 관리하는 회사 로고들 (나중에 데이터베이스로 마이그레이션 가능)
let companyLogos = new Map();

/**
 * GET /api/company/logo - 회사 로고 조회
 */
router.get('/logo', async (req, res) => {
  try {
    const { viewerId, viewerRole, viewerCompany } = await getViewer(req);
    
    if (!viewerId || !viewerRole) {
      return res.status(401).json({ message: '인증이 필요합니다.' });
    }
    
    // 회사별 로고 조회
    const companyKey = viewerCompany || 'default';
    const logo = companyLogos.get(companyKey);
    
    if (logo) {
      res.json(logo);
    } else {
      res.status(404).json({ message: '로고를 찾을 수 없습니다.' });
    }
    
  } catch (error) {
    console.error('로고 조회 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * POST /api/company/logo - 회사 로고 업로드
 */
router.post('/logo', async (req, res) => {
  try {
    const { viewerId, viewerRole, viewerCompany } = await getViewer(req);
    
    // 관리자만 로고 업로드 가능
    if (viewerRole !== '슈퍼 어드민' && viewerRole !== '대행사 어드민') {
      return res.status(403).json({ message: '로고 업로드 권한이 없습니다.' });
    }
    
    const { logoUrl, logoData } = req.body;
    
    if (!logoUrl && !logoData) {
      return res.status(400).json({ message: '로고 URL 또는 데이터가 필요합니다.' });
    }
    
    const companyKey = viewerCompany || 'default';
    const logoInfo = {
      logoUrl: logoUrl || logoData,
      uploadedAt: new Date(),
      uploadedBy: viewerId,
      companyId: viewerCompany
    };
    
    companyLogos.set(companyKey, logoInfo);
    
    res.status(201).json(logoInfo);
    
  } catch (error) {
    console.error('로고 업로드 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * DELETE /api/company/logo - 회사 로고 삭제
 */
router.delete('/logo', async (req, res) => {
  try {
    const { viewerId, viewerRole, viewerCompany } = await getViewer(req);
    
    // 관리자만 로고 삭제 가능
    if (viewerRole !== '슈퍼 어드민' && viewerRole !== '대행사 어드민') {
      return res.status(403).json({ message: '로고 삭제 권한이 없습니다.' });
    }
    
    const companyKey = viewerCompany || 'default';
    
    if (companyLogos.has(companyKey)) {
      companyLogos.delete(companyKey);
      res.json({ message: '로고가 삭제되었습니다.' });
    } else {
      res.status(404).json({ message: '삭제할 로고를 찾을 수 없습니다.' });
    }
    
  } catch (error) {
    console.error('로고 삭제 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

export default router;