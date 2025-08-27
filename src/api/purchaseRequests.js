// src/api/purchaseRequests.js
import express from 'express';
import { PurchaseRequest, User, Campaign, Post } from '../models/index.js';
import { Op } from 'sequelize';
import DocumentService from '../services/documentService.js';
import fs from 'fs/promises';
import { getViewer as getViewerUtil, checkPurchaseRequestApprovalAccess } from '../utils/permissionUtils.js';
import NotificationService from '../services/notificationService.js';

const router = express.Router();

// getViewer 함수는 permissionUtils.js에서 import

/**
 * GET /api/purchase-requests - 구매요청 목록 조회
 */
router.get('/', async (req, res) => {
  try {
    const { viewerId, viewerRole, viewerCompany } = await getViewerUtil(req);
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
    const { viewerId, viewerRole, viewerCompany } = await getViewerUtil(req);
    
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
    const { viewerId, viewerRole } = await getViewerUtil(req);
    
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
    const { viewerId, viewerRole, viewerCompany } = await getViewerUtil(req);
    
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
    
    // 구매요청 상태 변경 시 캠페인 집행 상태 자동 업데이트
    if (updateData.status && request.campaignId) {
      try {
        const campaign = await Campaign.findByPk(request.campaignId);
        
        if (campaign) {
          if (updateData.status === '승인됨') {
            // 구매요청이 승인되면 캠페인 집행 상태를 '승인'으로 변경
            await campaign.update({
              executionStatus: '승인',
              executionApprovedAt: new Date()
            });
            console.log(`캠페인 ${campaign.id} 집행 상태를 '승인'으로 업데이트`);
          } else if (updateData.status === '완료됨') {
            // 구매요청이 완료되면 캠페인 집행 상태를 '완료'로 변경
            await campaign.update({
              executionStatus: '완료',
              executionCompletedAt: new Date()
            });
            console.log(`캠페인 ${campaign.id} 집행 상태를 '완료'로 업데이트`);
          }
        }
      } catch (campaignUpdateError) {
        console.error('캠페인 집행 상태 업데이트 실패:', campaignUpdateError);
        // 실패해도 구매요청 업데이트는 성공으로 처리
      }
    }
    
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
    const { viewerId, viewerRole, viewerCompany } = await getViewerUtil(req);
    
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
 * POST /api/purchase-requests/:id/generate-documents - 문서 생성 (PDF + JPG)
 */
router.post('/:id/generate-documents', async (req, res) => {
  try {
    const { id } = req.params;
    const { type = 'transaction' } = req.body; // 'transaction' 또는 'quote'
    const { viewerId, viewerRole, viewerCompany } = await getViewerUtil(req);
    
    // 구매요청 조회
    const request = await PurchaseRequest.findByPk(id, {
      include: [
        { model: User, as: 'requester', attributes: ['id', 'name', 'email', 'company'] },
        { model: User, as: 'approver', attributes: ['id', 'name', 'email'] },
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
      if (viewerCompany && request.requester?.company === viewerCompany) {
        hasPermission = true;
      }
    } else if (viewerRole === '직원') {
      if (request.requesterId === viewerId) {
        hasPermission = true;
      }
    }
    
    if (!hasPermission) {
      return res.status(403).json({ message: '권한이 없습니다.' });
    }
    
    // 문서 생성
    const documents = await DocumentService.generateDocuments(
      request, 
      request.requester, 
      request.approver, 
      type
    );
    
    // 파일 읽기
    const pdfBuffer = await fs.readFile(documents.pdf);
    const jpgBuffer = await fs.readFile(documents.jpg);
    
    // Base64 인코딩
    const pdfBase64 = pdfBuffer.toString('base64');
    const jpgBase64 = jpgBuffer.toString('base64');
    
    // 임시 파일 정리
    await DocumentService.cleanupFiles([documents.pdf, documents.jpg]);
    
    res.json({
      success: true,
      files: {
        pdf: {
          filename: `${documents.filename}.pdf`,
          data: pdfBase64,
          mimeType: 'application/pdf'
        },
        jpg: {
          filename: `${documents.filename}.jpg`,
          data: jpgBase64,
          mimeType: 'image/jpeg'
        }
      }
    });
    
  } catch (error) {
    console.error('문서 생성 실패:', error);
    res.status(500).json({ message: '문서 생성에 실패했습니다.' });
  }
});

/**
 * GET /api/purchase-requests/summary/stats - 구매요청 통계
 */
router.get('/summary/stats', async (req, res) => {
  try {
    const { viewerId, viewerRole, viewerCompany } = await getViewerUtil(req);
    
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

/**
 * PUT /api/purchase-requests/:id/approve - 발주요청 승인/반려
 * 대행사 어드민만 같은 회사의 발주요청을 승인할 수 있음
 */
router.put('/:id/approve', async (req, res) => {
  const { id } = req.params;
  const { status, approverComment } = req.body; // status: '승인됨' | '반려됨'
  
  try {
    const { viewerId, viewerRole, viewerCompany, viewer } = await getViewerUtil(req);
    
    // 발주요청 조회
    const request = await PurchaseRequest.findByPk(id, {
      include: [
        {
          model: User,
          as: 'requester',
          attributes: ['id', 'name', 'email', 'company', 'role']
        },
        {
          model: Campaign,
          as: 'campaign',
          attributes: ['id', 'name']
        }
      ]
    });
    
    if (!request) {
      return res.status(404).json({ message: '발주요청을 찾을 수 없습니다.' });
    }
    
    // 승인 권한 확인
    const canApprove = checkPurchaseRequestApprovalAccess(viewerRole, viewerCompany, request);
    if (!canApprove) {
      return res.status(403).json({ 
        message: '승인 권한이 없습니다. 대행사 어드민만 같은 회사의 발주요청을 승인할 수 있습니다.' 
      });
    }
    
    // 이미 처리된 요청인지 확인
    if (request.status !== '승인 대기' && request.status !== 'pending') {
      return res.status(400).json({ 
        message: '이미 처리된 요청입니다.',
        currentStatus: request.status 
      });
    }
    
    // 상태 업데이트
    request.status = status;
    request.approverComment = approverComment || null;
    request.approverId = viewerId;
    request.approvedDate = status === '승인됨' ? new Date() : null;
    
    await request.save();
    
    // 요청자에게 알림 전송
    try {
      await NotificationService.createNotification({
        userId: request.requesterId,
        title: `발주요청 ${status === '승인됨' ? '승인' : '반려'}`,
        message: `"${request.title}" 발주요청이 ${status === '승인됨' ? '승인' : '반려'}되었습니다.` +
                (approverComment ? `\n사유: ${approverComment}` : ''),
        type: 'approval',
        relatedId: request.id,
        relatedType: 'purchase_request'
      });
    } catch (notificationError) {
      console.error('알림 전송 실패:', notificationError);
    }
    
    // 승인된 경우 해당 캠페인 매니저에게도 알림
    if (status === '승인됨' && request.campaign) {
      try {
        const campaign = await Campaign.findByPk(request.campaignId, {
          attributes: ['id', 'name', 'managerId']
        });
        
        if (campaign && campaign.managerId !== request.requesterId) {
          await NotificationService.createNotification({
            userId: campaign.managerId,
            title: '발주요청 승인 완료',
            message: `캠페인 "${campaign.name}"의 발주요청 "${request.title}"이 승인되었습니다.`,
            type: 'info',
            relatedId: request.id,
            relatedType: 'purchase_request'
          });
        }
      } catch (notificationError) {
        console.error('캠페인 매니저 알림 전송 실패:', notificationError);
      }
    }
    
    res.status(200).json({
      message: `발주요청 ${status === '승인됨' ? '승인' : '반려'} 완료`,
      request: {
        id: request.id,
        status: request.status,
        approverComment: request.approverComment,
        approverId: request.approverId,
        approvedDate: request.approvedDate,
        approver: {
          id: viewer.id,
          name: viewer.name,
          email: viewer.email
        }
      }
    });
    
  } catch (error) {
    console.error(`발주요청(ID: ${id}) 승인 처리 실패:`, error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

export default router;