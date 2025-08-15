// src/api/purchaseRequests.js
import express from 'express';
import { PurchaseRequest, User, Campaign, Post } from '../models/index.js';
import { Op } from 'sequelize';

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
 * GET /api/purchase-requests - 구매요청 목록 조회
 */
router.get('/', async (req, res) => {
  try {
    const { viewerId, viewerRole, viewerCompany } = await getViewer(req);
    const { status, resourceType, page = 1, limit = 20 } = req.query;
    
    // 권한별 필터
    let where = {};
    
    if (viewerRole === '슈퍼 어드민') {
      // 모든 요청 조회 가능
    } else if (viewerRole === '대행사 어드민') {
      // 같은 회사의 요청만 조회
      if (!viewerCompany) {
        return res.json({ requests: [], total: 0, pages: 0 });
      }
      
      const companyUserIds = await User.findAll({
        where: { company: viewerCompany },
        attributes: ['id']
      }).then(users => users.map(u => u.id));
      
      where.requesterId = { [Op.in]: companyUserIds };
    } else if (viewerRole === '직원') {
      // 본인이 요청한 것만 조회
      where.requesterId = viewerId;
    } else {
      // 클라이언트는 접근 불가
      return res.status(403).json({ message: '권한이 없습니다.' });
    }
    
    // 추가 필터
    if (status) where.status = status;
    if (resourceType) where.resourceType = resourceType;
    
    const offset = (page - 1) * limit;
    
    const { count, rows } = await PurchaseRequest.findAndCountAll({
      where,
      include: [
        { model: User, as: 'requester', attributes: ['id', 'name', 'email', 'role'] },
        { model: User, as: 'approver', attributes: ['id', 'name', 'email', 'role'] },
        { model: Campaign, as: 'campaign', attributes: ['id', 'name'] },
        { model: Post, as: 'post', attributes: ['id', 'title'] }
      ],
      order: [['requestedDate', 'DESC']],
      limit: parseInt(limit),
      offset
    });
    
    res.json({
      requests: rows,
      total: count,
      pages: Math.ceil(count / limit),
      currentPage: parseInt(page)
    });
    
  } catch (error) {
    console.error('구매요청 목록 조회 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * GET /api/purchase-requests/:id - 구매요청 상세 조회
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { viewerId, viewerRole, viewerCompany } = await getViewer(req);
    
    const request = await PurchaseRequest.findByPk(id, {
      include: [
        { model: User, as: 'requester', attributes: ['id', 'name', 'email', 'role', 'company'] },
        { model: User, as: 'approver', attributes: ['id', 'name', 'email', 'role'] },
        { model: Campaign, as: 'campaign', attributes: ['id', 'name'] },
        { model: Post, as: 'post', attributes: ['id', 'title'] }
      ]
    });
    
    if (!request) {
      return res.status(404).json({ message: '구매요청을 찾을 수 없습니다.' });
    }
    
    // 권한 확인
    let hasPermission = false;
    
    if (viewerRole === '슈퍼 어드민') {
      hasPermission = true;
    } else if (viewerRole === '대행사 어드민') {
      // 같은 회사의 요청만 조회 가능
      if (viewerCompany && request.requester?.company === viewerCompany) {
        hasPermission = true;
      }
    } else if (viewerRole === '직원') {
      // 본인이 요청한 것만 조회 가능
      if (request.requesterId === viewerId) {
        hasPermission = true;
      }
    }
    
    if (!hasPermission) {
      return res.status(403).json({ message: '권한이 없습니다.' });
    }
    
    res.json(request);
    
  } catch (error) {
    console.error('구매요청 상세 조회 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * POST /api/purchase-requests - 새 구매요청 생성
 */
router.post('/', async (req, res) => {
  try {
    const { viewerId, viewerRole } = await getViewer(req);
    
    // 직원과 대행사 어드민만 요청 생성 가능
    if (!['직원', '대행사 어드민'].includes(viewerRole)) {
      return res.status(403).json({ message: '구매요청 생성 권한이 없습니다.' });
    }
    
    const {
      title,
      description,
      amount,
      resourceType,
      priority = '보통',
      dueDate,
      campaignId,
      postId,
      attachments
    } = req.body;
    
    // 필수 필드 검증
    if (!title || !amount || !resourceType) {
      return res.status(400).json({ message: '제목, 금액, 리소스 종류는 필수입니다.' });
    }
    
    // 금액 검증
    if (amount <= 0) {
      return res.status(400).json({ message: '금액은 0보다 커야 합니다.' });
    }
    
    const newRequest = await PurchaseRequest.create({
      title,
      description,
      amount,
      resourceType,
      priority,
      dueDate: dueDate ? new Date(dueDate) : null,
      campaignId: campaignId || null,
      postId: postId || null,
      attachments: attachments || null,
      requesterId: viewerId,
      status: '승인 대기'
    });
    
    // 생성된 요청을 다시 조회 (관계 포함)
    const createdRequest = await PurchaseRequest.findByPk(newRequest.id, {
      include: [
        { model: User, as: 'requester', attributes: ['id', 'name', 'email', 'role'] },
        { model: Campaign, as: 'campaign', attributes: ['id', 'name'] },
        { model: Post, as: 'post', attributes: ['id', 'title'] }
      ]
    });
    
    res.status(201).json(createdRequest);
    
  } catch (error) {
    console.error('구매요청 생성 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * PUT /api/purchase-requests/:id - 구매요청 수정
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { viewerId, viewerRole, viewerCompany } = await getViewer(req);
    
    const request = await PurchaseRequest.findByPk(id, {
      include: [{ model: User, as: 'requester', attributes: ['id', 'company'] }]
    });
    
    if (!request) {
      return res.status(404).json({ message: '구매요청을 찾을 수 없습니다.' });
    }
    
    // 권한 확인
    let hasPermission = false;
    
    if (viewerRole === '슈퍼 어드민') {
      hasPermission = true;
    } else if (viewerRole === '대행사 어드민') {
      // 같은 회사의 요청만 수정 가능
      if (viewerCompany && request.requester?.company === viewerCompany) {
        hasPermission = true;
      }
    } else if (viewerRole === '직원') {
      // 본인이 요청한 것만 수정 가능 (승인 대기 상태일 때만)
      if (request.requesterId === viewerId && request.status === '승인 대기') {
        hasPermission = true;
      }
    }
    
    if (!hasPermission) {
      return res.status(403).json({ message: '권한이 없습니다.' });
    }
    
    const updateData = {};
    const allowedFields = [
      'title', 'description', 'amount', 'resourceType', 'priority', 
      'dueDate', 'campaignId', 'postId', 'attachments'
    ];
    
    // 대행사 어드민은 추가 필드 수정 가능
    if (viewerRole === '대행사 어드민' || viewerRole === '슈퍼 어드민') {
      allowedFields.push(
        'status', 'approverComment', 'rejectReason', 'actualAmount', 
        'receiptUrl', 'billedToClient', 'clientBillAmount'
      );
    }
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });
    
    // 승인/거절 처리 시 승인자 설정
    if (updateData.status && ['승인됨', '거절됨'].includes(updateData.status)) {
      updateData.approverId = viewerId;
      updateData.approvedDate = new Date();
    }
    
    await request.update(updateData);
    
    // 업데이트된 요청 조회
    const updatedRequest = await PurchaseRequest.findByPk(id, {
      include: [
        { model: User, as: 'requester', attributes: ['id', 'name', 'email', 'role'] },
        { model: User, as: 'approver', attributes: ['id', 'name', 'email', 'role'] },
        { model: Campaign, as: 'campaign', attributes: ['id', 'name'] },
        { model: Post, as: 'post', attributes: ['id', 'title'] }
      ]
    });
    
    res.json(updatedRequest);
    
  } catch (error) {
    console.error('구매요청 수정 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * DELETE /api/purchase-requests/:id - 구매요청 삭제
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { viewerId, viewerRole, viewerCompany } = await getViewer(req);
    
    const request = await PurchaseRequest.findByPk(id, {
      include: [{ model: User, as: 'requester', attributes: ['id', 'company'] }]
    });
    
    if (!request) {
      return res.status(404).json({ message: '구매요청을 찾을 수 없습니다.' });
    }
    
    // 권한 확인
    let hasPermission = false;
    
    if (viewerRole === '슈퍼 어드민') {
      hasPermission = true;
    } else if (viewerRole === '대행사 어드민') {
      // 같은 회사의 요청만 삭제 가능
      if (viewerCompany && request.requester?.company === viewerCompany) {
        hasPermission = true;
      }
    } else if (viewerRole === '직원') {
      // 본인이 요청한 것만 삭제 가능 (승인 대기 상태일 때만)
      if (request.requesterId === viewerId && request.status === '승인 대기') {
        hasPermission = true;
      }
    }
    
    if (!hasPermission) {
      return res.status(403).json({ message: '권한이 없습니다.' });
    }
    
    await request.destroy();
    res.status(204).send();
    
  } catch (error) {
    console.error('구매요청 삭제 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * GET /api/purchase-requests/summary/stats - 구매요청 통계
 */
router.get('/summary/stats', async (req, res) => {
  try {
    const { viewerId, viewerRole, viewerCompany } = await getViewer(req);
    
    // 권한별 필터
    let userFilter = {};
    
    if (viewerRole === '슈퍼 어드민') {
      // 모든 데이터
    } else if (viewerRole === '대행사 어드민') {
      if (!viewerCompany) {
        return res.json({
          totalRequests: 0,
          pendingRequests: 0,
          approvedRequests: 0,
          totalAmount: 0,
          thisMonthAmount: 0
        });
      }
      
      const companyUserIds = await User.findAll({
        where: { company: viewerCompany },
        attributes: ['id']
      }).then(users => users.map(u => u.id));
      
      userFilter.requesterId = { [Op.in]: companyUserIds };
    } else if (viewerRole === '직원') {
      userFilter.requesterId = viewerId;
    } else {
      return res.status(403).json({ message: '권한이 없습니다.' });
    }
    
    const [
      totalRequests,
      pendingRequests,
      approvedRequests,
      totalAmountResult,
      thisMonthAmountResult
    ] = await Promise.all([
      PurchaseRequest.count({ where: userFilter }),
      PurchaseRequest.count({ where: { ...userFilter, status: '승인 대기' } }),
      PurchaseRequest.count({ where: { ...userFilter, status: '승인됨' } }),
      PurchaseRequest.sum('amount', { where: { ...userFilter, status: '승인됨' } }),
      PurchaseRequest.sum('amount', {
        where: {
          ...userFilter,
          status: '승인됨',
          approvedDate: {
            [Op.gte]: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      })
    ]);
    
    res.json({
      totalRequests,
      pendingRequests,
      approvedRequests,
      totalAmount: totalAmountResult || 0,
      thisMonthAmount: thisMonthAmountResult || 0
    });
    
  } catch (error) {
    console.error('구매요청 통계 조회 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

export default router;