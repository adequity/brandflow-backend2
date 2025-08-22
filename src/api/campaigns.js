// routes/campaigns.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Campaign, User, Post, Product } from '../models/index.js';
import { Op } from 'sequelize';
import sequelize from '../config/db.js';
import NotificationService from '../services/notificationService.js';

const router = express.Router();

// 업로드 폴더 생성
const uploadDir = 'uploads/chat-images';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer 설정 (카톡 이미지용)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `chat-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB 제한
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'));
    }
  }
});

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
    'productId',
    'quantity',
    'createdAt',
    'updatedAt',
  ],
  include: [
    {
      model: Product,
      as: 'product',
      attributes: ['id', 'name', 'category', 'unit', 'costPrice', 'sellingPrice'],
      required: false
    }
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
    } else if (viewerRole === '직원') {
      // 직원은 같은 회사의 캠페인만 조회 (대행사 어드민과 동일한 권한)
      if (!viewerCompany) {
        whereClause = { managerId: viewerId }; // 회사가 없으면 자신이 담당자인 캠페인만
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
    const budget = req.body?.budget ? Number(req.body.budget) : null;
    const notes = req.body?.notes ? String(req.body.notes).trim() : null;
    const reminders = req.body?.reminders ? String(req.body.reminders).trim() : null;
    const invoiceIssued = req.body?.invoiceIssued === true;
    const paymentCompleted = req.body?.paymentCompleted === true;
    const invoiceDueDate = req.body?.invoiceDueDate ? new Date(req.body.invoiceDueDate) : null;
    const paymentDueDate = req.body?.paymentDueDate ? new Date(req.body.paymentDueDate) : null;

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

    const { viewerId, viewerRole, viewerCompany } = await getViewer(req);
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

    const created = await Campaign.create({ 
      name, 
      client, 
      userId, 
      managerId, 
      budget, 
      notes, 
      reminders,
      invoiceIssued,
      paymentCompleted,
      invoiceDate: invoiceIssued ? new Date() : null,
      paymentDate: paymentCompleted ? new Date() : null,
      invoiceDueDate,
      paymentDueDate
    });
    const full = await Campaign.findByPk(created.id, { include: commonInclude });
    
    // 캠페인 매출이 있는 경우 자동으로 매출관리 데이터 생성
    if (budget && budget > 0) {
      try {
        const { Sale, Product } = sequelize.models;
        
        // 기본 상품을 찾거나 생성 (캠페인용 가상 상품)
        let campaignProduct = await Product.findOne({
          where: { 
            name: '캠페인 계약매출',
            category: '캠페인',
            company: null // 공용 상품
          }
        });
        
        if (!campaignProduct) {
          campaignProduct = await Product.create({
            name: '캠페인 계약매출',
            description: '캠페인 생성 시 자동 생성되는 계약매출',
            category: '캠페인',
            costPrice: 0, // 캠페인 매출은 원가 없음
            sellingPrice: budget,
            unit: '건',
            isActive: true,
            createdBy: viewerId,
            company: null // 공용 상품
          });
        }
        
        // 매출관리 데이터 생성
        const saleNumber = `CAMP-${created.id}-${Date.now()}`;
        await Sale.create({
          saleNumber,
          quantity: 1,
          actualCostPrice: 0, // 캠페인 매출은 원가 없음
          actualSellingPrice: budget,
          status: '등록', // 기본 상태
          saleDate: new Date(),
          clientName: full.client || '미정',
          clientContact: full.Client?.name || null,
          clientEmail: full.Client?.email || null,
          memo: `캠페인 "${full.name}" 자동 생성 매출`,
          productId: campaignProduct.id,
          salesPersonId: managerId, // 캠페인 담당자
          campaignId: created.id
        });
        
        console.log(`캠페인 ${created.id}의 매출관리 데이터 자동 생성 완료 (${budget}원)`);
      } catch (saleError) {
        console.error('매출관리 데이터 자동 생성 실패:', saleError);
        // 실패해도 캠페인 생성은 성공으로 처리
      }
    }
    
    // 캠페인 생성 알림 발송 (실패해도 캠페인 생성은 성공으로 처리)
    try {
      await NotificationService.notifyCampaignCreated(full, viewerId);
    } catch (notificationError) {
      console.error('캠페인 생성 알림 발송 실패 (캠페인은 정상 생성됨):', notificationError);
    }
    
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
    const productId = req.body?.productId ? Number(req.body.productId) : null;
    const quantity = req.body?.quantity ? Number(req.body.quantity) : 1;
    const startDate = req.body?.startDate || null;
    const dueDate = req.body?.dueDate || null;
    const skipApproval = req.body?.skipApproval || false;
    
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
      topicStatus: skipApproval ? '승인됨' : '주제 승인 대기',
      outlineStatus: skipApproval ? '승인됨' : null,
      productId: productId && !isNaN(productId) ? productId : null,
      quantity: quantity && !isNaN(quantity) ? quantity : 1,
      startDate,
      dueDate,
    });

    // 새 업무 등록 알림 발송 (실패해도 업무 등록은 성공으로 처리)
    try {
      await NotificationService.notifyTaskCreated(newPost, viewerId);
    } catch (notificationError) {
      console.error('업무 등록 알림 발송 실패 (업무는 정상 등록됨):', notificationError);
    }

    res.status(201).json(newPost);
  } catch (error) {
    console.error('주제 등록 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * POST /api/campaigns/:id/chat-images
 * 캠페인 카톡 이미지 업로드
 */
router.post('/:id/chat-images', upload.array('images', 10), async (req, res) => {
  try {
    const campaignId = Number(req.params.id);
    const { viewerId, viewerRole, viewerCompany } = await getViewer(req);
    
    console.log('Chat images upload request:', { campaignId, viewerId, viewerRole, filesCount: req.files?.length });
    
    // 캠페인 존재 확인 및 권한 체크
    const campaign = await Campaign.findByPk(campaignId, {
      include: [
        { model: User, as: 'User', attributes: ['id', 'company'] },
        { model: User, as: 'Client', attributes: ['id', 'company'] },
      ],
    });
    
    if (!campaign) {
      return res.status(404).json({ message: '캠페인을 찾을 수 없습니다.' });
    }
    
    // 권한 체크
    let hasPermission = false;
    if (viewerRole === '슈퍼 어드민') {
      hasPermission = true;
    } else if (viewerRole === '대행사 어드민') {
      const isManager = campaign.managerId === viewerId;
      const isSameCompanyUser = viewerCompany && campaign.User?.company === viewerCompany;
      const isSameCompanyClient = viewerCompany && campaign.Client?.company === viewerCompany;
      hasPermission = isManager || isSameCompanyUser || isSameCompanyClient;
    } else if (viewerRole === '클라이언트') {
      hasPermission = campaign.userId === viewerId;
    }
    
    if (!hasPermission) {
      // 권한이 없으면 업로드된 파일들 삭제
      req.files?.forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) console.error('파일 삭제 실패:', err);
        });
      });
      return res.status(403).json({ message: '권한이 없습니다.' });
    }
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: '업로드할 이미지가 없습니다.' });
    }
    
    // 업로드된 파일 정보 반환
    const uploadedImages = req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      url: `/uploads/chat-images/${file.filename}`
    }));
    
    console.log('Chat images uploaded successfully:', uploadedImages.length);
    res.json({
      message: '카톡 이미지가 성공적으로 업로드되었습니다.',
      images: uploadedImages
    });
    
  } catch (error) {
    console.error('카톡 이미지 업로드 실패:', error);
    // 에러 발생 시 업로드된 파일들 삭제
    req.files?.forEach(file => {
      fs.unlink(file.path, (err) => {
        if (err) console.error('파일 삭제 실패:', err);
      });
    });
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * PUT /api/campaigns/:id/chat-content
 * 캠페인 카톡 내용 저장
 */
router.put('/:id/chat-content', async (req, res) => {
  try {
    const campaignId = Number(req.params.id);
    const { chatContent, chatSummary, chatAttachments } = req.body;
    const { viewerId, viewerRole, viewerCompany } = await getViewer(req);
    
    console.log('Chat content save request:', { campaignId, viewerId, viewerRole });
    
    // 캠페인 존재 확인
    const campaign = await Campaign.findByPk(campaignId, {
      include: [
        { model: User, as: 'User', attributes: ['id', 'company'] },
        { model: User, as: 'Client', attributes: ['id', 'company'] },
      ],
    });
    
    if (!campaign) {
      return res.status(404).json({ message: '캠페인을 찾을 수 없습니다.' });
    }
    
    // 권한 체크 (캠페인에 접근할 수 있는 사용자만 카톡 내용 저장 가능)
    let hasPermission = false;
    
    if (viewerRole === '슈퍼 어드민') {
      hasPermission = true;
    } else if (viewerRole === '대행사 어드민') {
      const isManager = campaign.managerId === viewerId;
      const isSameCompanyUser = viewerCompany && campaign.User?.company === viewerCompany;
      const isSameCompanyClient = viewerCompany && campaign.Client?.company === viewerCompany;
      hasPermission = isManager || isSameCompanyUser || isSameCompanyClient;
    } else if (viewerRole === '클라이언트') {
      hasPermission = campaign.userId === viewerId;
    }
    
    if (!hasPermission) {
      return res.status(403).json({ message: '권한이 없습니다.' });
    }
    
    // 카톡 내용 업데이트
    await campaign.update({
      chatContent: chatContent || null,
      chatSummary: chatSummary || null,
      chatAttachments: chatAttachments || null,
    });
    
    console.log('Chat content saved successfully for campaign:', campaignId);
    res.json({ 
      message: '카톡 내용이 성공적으로 저장되었습니다.',
      chatContent: campaign.chatContent,
      chatSummary: campaign.chatSummary,
      chatAttachments: campaign.chatAttachments
    });
    
  } catch (error) {
    console.error('카톡 내용 저장 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * GET /api/campaigns/:id/chat-content
 * 캠페인 카톡 내용 조회
 */
router.get('/:id/chat-content', async (req, res) => {
  try {
    const campaignId = Number(req.params.id);
    const { viewerId, viewerRole, viewerCompany } = await getViewer(req);
    
    console.log('Chat content get request:', { campaignId, viewerId, viewerRole });
    
    // 캠페인 존재 확인
    const campaign = await Campaign.findByPk(campaignId, {
      attributes: ['id', 'name', 'chatContent', 'chatSummary', 'chatAttachments', 'managerId', 'userId'],
      include: [
        { model: User, as: 'User', attributes: ['id', 'company'] },
        { model: User, as: 'Client', attributes: ['id', 'company'] },
      ],
    });
    
    if (!campaign) {
      return res.status(404).json({ message: '캠페인을 찾을 수 없습니다.' });
    }
    
    // 권한 체크 (캠페인에 접근할 수 있는 사용자만 카톡 내용 조회 가능)
    let hasPermission = false;
    
    if (viewerRole === '슈퍼 어드민') {
      hasPermission = true;
    } else if (viewerRole === '대행사 어드민') {
      const isManager = campaign.managerId === viewerId;
      const isSameCompanyUser = viewerCompany && campaign.User?.company === viewerCompany;
      const isSameCompanyClient = viewerCompany && campaign.Client?.company === viewerCompany;
      hasPermission = isManager || isSameCompanyUser || isSameCompanyClient;
    } else if (viewerRole === '클라이언트') {
      hasPermission = campaign.userId === viewerId;
    }
    
    if (!hasPermission) {
      return res.status(403).json({ message: '권한이 없습니다.' });
    }
    
    res.json({
      campaignId: campaign.id,
      campaignName: campaign.name,
      chatContent: campaign.chatContent || '',
      chatSummary: campaign.chatSummary || '',
      chatAttachments: campaign.chatAttachments || ''
    });
    
  } catch (error) {
    console.error('카톡 내용 조회 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * PUT /api/campaigns/:id
 * 캠페인 수정 (계산서/입금 상태 업데이트 등)
 */
router.put('/:id', async (req, res) => {
  try {
    const campaignId = Number(req.params.id);
    const { viewerId, viewerRole, viewerCompany } = await getViewer(req);
    
    console.log('Campaign update request:', { campaignId, viewerId, viewerRole });
    
    // 캠페인 존재 확인 및 권한 체크
    const campaign = await Campaign.findByPk(campaignId, {
      include: [
        { model: User, as: 'User', attributes: ['id', 'company'] },
        { model: User, as: 'Client', attributes: ['id', 'company'] },
      ],
    });
    
    if (!campaign) {
      return res.status(404).json({ message: '캠페인을 찾을 수 없습니다.' });
    }
    
    // 권한 체크
    let hasPermission = false;
    if (viewerRole === '슈퍼 어드민') {
      hasPermission = true;
    } else if (viewerRole === '대행사 어드민') {
      const isManager = campaign.managerId === viewerId;
      const isSameCompanyUser = viewerCompany && campaign.User?.company === viewerCompany;
      const isSameCompanyClient = viewerCompany && campaign.Client?.company === viewerCompany;
      hasPermission = isManager || isSameCompanyUser || isSameCompanyClient;
    } else if (viewerRole === '직원') {
      const isManager = campaign.managerId === viewerId;
      const isSameCompanyUser = viewerCompany && campaign.User?.company === viewerCompany;
      const isSameCompanyClient = viewerCompany && campaign.Client?.company === viewerCompany;
      hasPermission = isManager || isSameCompanyUser || isSameCompanyClient;
    }
    
    if (!hasPermission) {
      return res.status(403).json({ message: '권한이 없습니다.' });
    }
    
    // 업데이트할 필드들
    const updateData = {};
    const allowedFields = ['budget', 'notes', 'reminders', 'invoiceIssued', 'paymentCompleted', 'invoiceDueDate', 'paymentDueDate'];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'invoiceDueDate' || field === 'paymentDueDate') {
          updateData[field] = req.body[field] ? new Date(req.body[field]) : null;
        } else {
          updateData[field] = req.body[field];
        }
      }
    });
    
    // 계산서 발행일/입금 완료일 자동 설정
    if (req.body.invoiceIssued === true && !campaign.invoiceIssued) {
      updateData.invoiceDate = new Date();
    } else if (req.body.invoiceIssued === false) {
      updateData.invoiceDate = null;
    }
    
    if (req.body.paymentCompleted === true && !campaign.paymentCompleted) {
      updateData.paymentDate = new Date();
    } else if (req.body.paymentCompleted === false) {
      updateData.paymentDate = null;
    }
    
    // 캠페인 업데이트
    await campaign.update(updateData);
    
    // 업데이트된 캠페인 조회
    const updatedCampaign = await Campaign.findByPk(campaignId, {
      include: commonInclude
    });
    
    console.log('Campaign updated successfully:', campaignId);
    res.json(updatedCampaign);
    
  } catch (error) {
    console.error('캠페인 수정 실패:', error);
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

/**
 * GET /api/campaigns/:id/financial-summary
 * 캠페인별 재무 요약 (예산, 매출, 원가, 이익)
 */
router.get('/:id/financial-summary', async (req, res) => {
  try {
    const campaignId = Number(req.params.id);
    const { viewerId, viewerRole, viewerCompany } = await getViewer(req);
    
    console.log('Campaign financial summary request:', { campaignId, viewerId, viewerRole });
    
    // 캠페인 존재 확인 및 권한 체크
    const campaign = await Campaign.findByPk(campaignId, {
      include: [
        { model: User, as: 'User', attributes: ['id', 'company'] },
        { model: User, as: 'Client', attributes: ['id', 'company'] },
        {
          model: Post,
          as: 'posts',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'category', 'unit', 'costPrice', 'sellingPrice'],
              required: false
            }
          ],
          required: false
        }
      ],
    });
    
    if (!campaign) {
      return res.status(404).json({ message: '캠페인을 찾을 수 없습니다.' });
    }
    
    // 권한 체크
    let hasPermission = false;
    if (viewerRole === '슈퍼 어드민') {
      hasPermission = true;
    } else if (viewerRole === '대행사 어드민' || viewerRole === '직원') {
      const isManager = campaign.managerId === viewerId;
      const isSameCompanyUser = viewerCompany && campaign.User?.company === viewerCompany;
      const isSameCompanyClient = viewerCompany && campaign.Client?.company === viewerCompany;
      hasPermission = isManager || isSameCompanyUser || isSameCompanyClient;
    } else if (viewerRole === '클라이언트') {
      hasPermission = campaign.userId === viewerId;
    }
    
    if (!hasPermission) {
      return res.status(403).json({ message: '권한이 없습니다.' });
    }
    
    // 재무 계산
    const budget = campaign.budget || 0; // 캠페인 예산 (잡힌/잡힐 예정인 매출)
    let productBasedRevenue = 0; // 완료된 업무의 상품 기반 매출
    let totalCost = 0; // 총 원가
    
    // 완료된 업무들의 상품 기반 계산
    console.log('Campaign posts for financial calculation:', campaign.posts?.map(p => ({
      id: p.id,
      title: p.title,
      publishedUrl: !!p.publishedUrl,
      productId: p.productId,
      hasProduct: !!p.product,
      quantity: p.quantity,
      product: p.product ? {
        id: p.product.id,
        name: p.product.name,
        sellingPrice: p.product.sellingPrice,
        costPrice: p.product.costPrice
      } : null
    })));
    
    const completedPosts = campaign.posts?.filter(post => 
      post.publishedUrl && post.product && post.quantity
    ) || [];
    
    console.log('Completed posts for revenue calculation:', completedPosts.length);
    
    completedPosts.forEach(post => {
      const revenue = post.product.sellingPrice * post.quantity;
      const cost = post.product.costPrice * post.quantity;
      console.log(`Post ${post.id}: Revenue=${revenue}, Cost=${cost}, Quantity=${post.quantity}`);
      productBasedRevenue += revenue;
      totalCost += cost;
    });
    
    // 총 매출 = 캠페인 예산(계약 매출) + 상품 기반 매출
    const totalRevenue = budget + productBasedRevenue;
    const totalProfit = totalRevenue - totalCost;
    const budgetUtilization = budget > 0 ? (productBasedRevenue / budget * 100) : 0;
    
    const summary = {
      campaignId: campaign.id,
      campaignName: campaign.name,
      budget: budget, // 캠페인 예산 (계약 매출)
      productBasedRevenue: productBasedRevenue, // 완료된 업무의 상품 기반 매출
      totalRevenue: totalRevenue, // 총 매출 (예산 + 상품 기반 매출)
      totalCost: totalCost,
      totalProfit: totalProfit,
      budgetUtilization: Math.round(budgetUtilization * 100) / 100,
      completedTasksCount: completedPosts.length,
      totalTasksCount: campaign.posts?.length || 0,
      taskDetails: completedPosts.map(post => ({
        taskId: post.id,
        taskTitle: post.title,
        product: post.product ? {
          id: post.product.id,
          name: post.product.name,
          category: post.product.category
        } : null,
        quantity: post.quantity,
        revenue: post.product ? post.product.sellingPrice * post.quantity : 0,
        cost: post.product ? post.product.costPrice * post.quantity : 0,
        profit: post.product ? (post.product.sellingPrice - post.product.costPrice) * post.quantity : 0
      }))
    };
    
    console.log('Campaign financial summary calculated:', summary);
    res.json(summary);
    
  } catch (error) {
    console.error('캠페인 재무 요약 조회 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

export default router;
