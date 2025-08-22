// src/api/sales.js
import express from 'express';
import { Sale, Product, User, Campaign } from '../models/index.js';
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
 * 매출 번호 자동 생성
 */
function generateSaleNumber() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
  
  return `S${year}${month}${day}${time}`;
}

/**
 * GET /api/sales - 매출 목록 조회
 */
router.get('/', async (req, res) => {
  try {
    const { viewerId, viewerRole, viewerCompany } = await getViewer(req);
    const { status, productCategory, page = 1, limit = 20, startDate, endDate } = req.query;
    
    // 권한별 필터
    let where = {};
    
    if (viewerRole === '슈퍼 어드민') {
      // 모든 매출 조회 가능
    } else if (viewerRole === '대행사 어드민') {
      // 같은 회사의 매출만 조회
      if (!viewerCompany) {
        return res.json({ sales: [], total: 0, pages: 0 });
      }
      
      const companyUserIds = await User.findAll({
        where: { company: viewerCompany },
        attributes: ['id']
      }).then(users => users.map(u => u.id));
      
      where.salesPersonId = { [Op.in]: companyUserIds };
    } else if (viewerRole === '직원') {
      // 본인이 등록한 매출만 조회
      where.salesPersonId = viewerId;
    } else {
      // 클라이언트는 접근 불가
      return res.status(403).json({ message: '권한이 없습니다.' });
    }
    
    // 추가 필터
    if (status) where.status = status;
    if (startDate) where.saleDate = { [Op.gte]: new Date(startDate) };
    if (endDate) {
      where.saleDate = where.saleDate 
        ? { ...where.saleDate, [Op.lte]: new Date(endDate) }
        : { [Op.lte]: new Date(endDate) };
    }
    
    const offset = (page - 1) * limit;
    
    let include = [
      { 
        model: Product, 
        as: 'product',
        attributes: ['id', 'name', 'category', 'unit']
      },
      { 
        model: User, 
        as: 'salesperson', 
        attributes: ['id', 'name', 'email', 'role'] 
      },
      { 
        model: User, 
        as: 'reviewer', 
        attributes: ['id', 'name', 'email'] 
      },
      { 
        model: Campaign, 
        as: 'campaign', 
        attributes: ['id', 'name'] 
      }
    ];
    
    // 상품 카테고리 필터
    if (productCategory) {
      include[0].where = { category: productCategory };
    }
    
    const { count, rows } = await Sale.findAndCountAll({
      where,
      include,
      order: [['saleDate', 'DESC']],
      limit: parseInt(limit),
      offset
    });
    
    res.json({
      sales: rows,
      total: count,
      pages: Math.ceil(count / limit),
      currentPage: parseInt(page)
    });
    
  } catch (error) {
    console.error('매출 목록 조회 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * GET /api/sales/:id - 매출 상세 조회
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { viewerId, viewerRole, viewerCompany } = await getViewer(req);
    
    const sale = await Sale.findByPk(id, {
      include: [
        { 
          model: Product, 
          as: 'product',
          attributes: ['id', 'name', 'category', 'unit', 'costPrice', 'sellingPrice']
        },
        { 
          model: User, 
          as: 'salesperson', 
          attributes: ['id', 'name', 'email', 'role', 'company'] 
        },
        { 
          model: User, 
          as: 'reviewer', 
          attributes: ['id', 'name', 'email'] 
        },
        { 
          model: Campaign, 
          as: 'campaign', 
          attributes: ['id', 'name'] 
        }
      ]
    });
    
    if (!sale) {
      return res.status(404).json({ message: '매출을 찾을 수 없습니다.' });
    }
    
    // 권한 확인
    let hasPermission = false;
    
    if (viewerRole === '슈퍼 어드민') {
      hasPermission = true;
    } else if (viewerRole === '대행사 어드민') {
      if (viewerCompany && sale.salesperson?.company === viewerCompany) {
        hasPermission = true;
      }
    } else if (viewerRole === '직원') {
      if (sale.salesPersonId === viewerId) {
        hasPermission = true;
      }
    }
    
    if (!hasPermission) {
      return res.status(403).json({ message: '권한이 없습니다.' });
    }
    
    res.json(sale);
    
  } catch (error) {
    console.error('매출 상세 조회 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * POST /api/sales - 새 매출 등록
 */
router.post('/', async (req, res) => {
  try {
    const { viewerId, viewerRole } = await getViewer(req);
    
    // 직원과 대행사 어드민만 매출 등록 가능
    if (!['직원', '대행사 어드민'].includes(viewerRole)) {
      return res.status(403).json({ message: '매출 등록 권한이 없습니다.' });
    }
    
    const {
      productId,
      quantity = 1,
      actualCostPrice,
      actualSellingPrice,
      clientName,
      clientContact,
      clientEmail,
      saleDate,
      contractStartDate,
      contractEndDate,
      campaignId,
      memo
    } = req.body;
    
    // 필수 필드 검증
    if (!productId || !clientName || !actualCostPrice || !actualSellingPrice) {
      return res.status(400).json({ 
        message: '상품, 클라이언트명, 원가, 판매가는 필수입니다.' 
      });
    }
    
    // 상품 존재 확인
    const product = await Product.findByPk(productId);
    if (!product || !product.isActive) {
      return res.status(400).json({ message: '유효하지 않은 상품입니다.' });
    }
    
    // 수량 검증
    if (quantity < product.minQuantity) {
      return res.status(400).json({ 
        message: `최소 주문 수량은 ${product.minQuantity}${product.unit}입니다.` 
      });
    }
    
    if (product.maxQuantity && quantity > product.maxQuantity) {
      return res.status(400).json({ 
        message: `최대 주문 수량은 ${product.maxQuantity}${product.unit}입니다.` 
      });
    }
    
    // 가격 검증
    if (parseFloat(actualSellingPrice) <= parseFloat(actualCostPrice)) {
      return res.status(400).json({ 
        message: '판매가는 원가보다 높아야 합니다.' 
      });
    }
    
    // 매출 번호 생성
    const saleNumber = generateSaleNumber();
    
    // 매출 등록
    const newSale = await Sale.create({
      saleNumber,
      productId: parseInt(productId),
      quantity: parseInt(quantity),
      actualCostPrice: parseFloat(actualCostPrice),
      actualSellingPrice: parseFloat(actualSellingPrice),
      clientName,
      clientContact,
      clientEmail,
      saleDate: saleDate ? new Date(saleDate) : new Date(),
      contractStartDate: contractStartDate ? new Date(contractStartDate) : null,
      contractEndDate: contractEndDate ? new Date(contractEndDate) : null,
      campaignId: campaignId || null,
      memo,
      salesPersonId: viewerId,
      status: '등록'
    });
    
    // 생성된 매출을 다시 조회 (관계 포함)
    const createdSale = await Sale.findByPk(newSale.id, {
      include: [
        { 
          model: Product, 
          as: 'product',
          attributes: ['id', 'name', 'category', 'unit']
        },
        { 
          model: User, 
          as: 'salesperson', 
          attributes: ['id', 'name', 'email', 'role'] 
        },
        { 
          model: Campaign, 
          as: 'campaign', 
          attributes: ['id', 'name'] 
        }
      ]
    });
    
    res.status(201).json(createdSale);
    
  } catch (error) {
    console.error('매출 등록 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * PUT /api/sales/:id - 매출 수정
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { viewerId, viewerRole, viewerCompany } = await getViewer(req);
    
    const sale = await Sale.findByPk(id, {
      include: [{ model: User, as: 'salesperson', attributes: ['id', 'company'] }]
    });
    
    if (!sale) {
      return res.status(404).json({ message: '매출을 찾을 수 없습니다.' });
    }
    
    // 권한 확인
    let hasPermission = false;
    
    if (viewerRole === '슈퍼 어드민') {
      hasPermission = true;
    } else if (viewerRole === '대행사 어드민') {
      if (viewerCompany && sale.salesperson?.company === viewerCompany) {
        hasPermission = true;
      }
    } else if (viewerRole === '직원') {
      // 본인이 등록한 매출만 수정 가능 (등록 상태일 때만)
      if (sale.salesPersonId === viewerId && sale.status === '등록') {
        hasPermission = true;
      }
    }
    
    if (!hasPermission) {
      return res.status(403).json({ message: '권한이 없습니다.' });
    }
    
    const updateData = {};
    const allowedFields = [
      'quantity', 'actualCostPrice', 'actualSellingPrice', 'clientName', 
      'clientContact', 'clientEmail', 'saleDate', 'contractStartDate', 
      'contractEndDate', 'campaignId', 'memo'
    ];
    
    // 본사 관리자는 추가 필드 수정 가능
    if (viewerRole === '대행사 어드민' || viewerRole === '슈퍼 어드민') {
      allowedFields.push('status', 'reviewComment');
    }
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });
    
    // 상태 변경 시 검토자 정보 설정
    if (updateData.status && ['승인', '거절'].includes(updateData.status)) {
      updateData.reviewedBy = viewerId;
      updateData.reviewedAt = new Date();
    }
    
    await sale.update(updateData);
    
    // 업데이트된 매출 조회
    const updatedSale = await Sale.findByPk(id, {
      include: [
        { 
          model: Product, 
          as: 'product',
          attributes: ['id', 'name', 'category', 'unit']
        },
        { 
          model: User, 
          as: 'salesperson', 
          attributes: ['id', 'name', 'email', 'role'] 
        },
        { 
          model: User, 
          as: 'reviewer', 
          attributes: ['id', 'name', 'email'] 
        },
        { 
          model: Campaign, 
          as: 'campaign', 
          attributes: ['id', 'name'] 
        }
      ]
    });
    
    res.json(updatedSale);
    
  } catch (error) {
    console.error('매출 수정 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * DELETE /api/sales/:id - 매출 삭제
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { viewerId, viewerRole, viewerCompany } = await getViewer(req);
    
    const sale = await Sale.findByPk(id, {
      include: [{ model: User, as: 'salesperson', attributes: ['id', 'company'] }]
    });
    
    if (!sale) {
      return res.status(404).json({ message: '매출을 찾을 수 없습니다.' });
    }
    
    // 권한 확인
    let hasPermission = false;
    
    if (viewerRole === '슈퍼 어드민') {
      hasPermission = true;
    } else if (viewerRole === '대행사 어드민') {
      if (viewerCompany && sale.salesperson?.company === viewerCompany) {
        hasPermission = true;
      }
    } else if (viewerRole === '직원') {
      // 본인이 등록한 매출만 삭제 가능 (등록 상태일 때만)
      if (sale.salesPersonId === viewerId && sale.status === '등록') {
        hasPermission = true;
      }
    }
    
    if (!hasPermission) {
      return res.status(403).json({ message: '권한이 없습니다.' });
    }
    
    await sale.destroy();
    res.status(204).send();
    
  } catch (error) {
    console.error('매출 삭제 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * GET /api/sales/summary/stats - 매출 통계
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
          totalSales: 0, pendingSales: 0, approvedSales: 0,
          totalRevenue: 0, totalMargin: 0, totalIncentives: 0
        });
      }
      
      const companyUserIds = await User.findAll({
        where: { company: viewerCompany },
        attributes: ['id']
      }).then(users => users.map(u => u.id));
      
      userFilter.salesPersonId = { [Op.in]: companyUserIds };
    } else if (viewerRole === '직원') {
      userFilter.salesPersonId = viewerId;
    } else {
      return res.status(403).json({ message: '권한이 없습니다.' });
    }
    
    const [
      totalSales,
      pendingSales,
      approvedSales,
      salesData
    ] = await Promise.all([
      Sale.count({ where: userFilter }),
      Sale.count({ where: { ...userFilter, status: '등록' } }),
      Sale.count({ where: { ...userFilter, status: '승인' } }),
      Sale.findAll({
        where: { ...userFilter, status: '승인' },
        include: [
          { model: Product, as: 'product', attributes: ['id'] },
          { model: User, as: 'salesperson', attributes: ['incentiveRate'] }
        ],
        attributes: ['actualCostPrice', 'actualSellingPrice', 'quantity']
      })
    ]);
    
    // 매출 및 마진 계산
    let totalRevenue = 0;
    let totalMargin = 0;
    let totalIncentives = 0;
    
    salesData.forEach(sale => {
      const revenue = sale.actualSellingPrice * sale.quantity;
      const cost = sale.actualCostPrice * sale.quantity;
      const margin = revenue - cost;
      const incentive = margin * (sale.salesperson?.incentiveRate || 0) / 100;
      
      totalRevenue += revenue;
      totalMargin += margin;
      totalIncentives += incentive;
    });
    
    res.json({
      totalSales,
      pendingSales,
      approvedSales,
      totalRevenue: Math.round(totalRevenue),
      totalMargin: Math.round(totalMargin),
      totalIncentives: Math.round(totalIncentives)
    });
    
  } catch (error) {
    console.error('매출 통계 조회 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * POST /api/sales/:id/create-purchase-request
 * 매출 데이터를 기반으로 구매요청 생성
 */
router.post('/:id/create-purchase-request', async (req, res) => {
  try {
    const { id } = req.params;
    const { viewerId, viewerRole } = await getViewer(req);
    const { description, requestDate } = req.body;

    // 권한 확인 (대행사 어드민과 직원만)
    if (!['대행사 어드민', '직원'].includes(viewerRole)) {
      return res.status(403).json({ message: '구매요청 생성 권한이 없습니다.' });
    }

    // 매출 데이터 조회
    const sale = await Sale.findByPk(id, {
      include: [
        { model: Product, as: 'product' },
        { model: Campaign, as: 'campaign' }
      ]
    });

    if (!sale) {
      return res.status(404).json({ message: '매출 데이터를 찾을 수 없습니다.' });
    }

    // 이미 구매요청이 생성되었는지 확인
    const { PurchaseRequest } = require('../models/index.js');
    const existingRequest = await PurchaseRequest.findOne({
      where: { 
        campaignId: sale.campaignId,
        description: { [Op.like]: `%${sale.saleNumber}%` }
      }
    });

    if (existingRequest) {
      return res.status(400).json({ message: '이미 구매요청이 생성되었습니다.' });
    }

    // 구매요청 생성
    const purchaseRequest = await PurchaseRequest.create({
      description: description || `${sale.product?.name || '상품'} - ${sale.clientName} (매출번호: ${sale.saleNumber})`,
      category: '광고비', // 기본 카테고리
      amount: sale.totalSales, // 매출 금액으로 설정
      requestDate: requestDate ? new Date(requestDate) : new Date(),
      requesterId: viewerId,
      campaignId: sale.campaignId,
      postId: null, // 매출 기반 요청은 특정 포스트와 연결되지 않음
      urgency: '보통',
      status: '대기중'
    });

    // 생성된 구매요청을 다시 조회 (관계 포함)
    const createdRequest = await PurchaseRequest.findByPk(purchaseRequest.id, {
      include: [
        { model: User, as: 'requester', attributes: ['id', 'name', 'email'] },
        { model: Campaign, as: 'campaign', attributes: ['id', 'name'] }
      ]
    });

    console.log(`매출 ${sale.saleNumber}을 기반으로 구매요청 생성: ${purchaseRequest.id}`);
    res.status(201).json(createdRequest);

  } catch (error) {
    console.error('구매요청 생성 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

export default router;