// src/api/products.js
import express from 'express';
import { Product, User } from '../models/index.js';
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
 * GET /api/products - 상품 목록 조회
 */
router.get('/', async (req, res) => {
  try {
    const { viewerId, viewerRole, viewerCompany } = await getViewer(req);
    const { category, isActive = 'true', page = 1, limit = 50 } = req.query;
    
    console.log('Products API - viewerId:', viewerId, 'viewerRole:', viewerRole, 'isActive:', isActive);
    
    // 기본적으로 활성화된 상품만 조회
    let where = { isActive: isActive === 'true' };
    
    // 회사별 필터링
    if (viewerRole === '슈퍼 어드민') {
      // 슈퍼 어드민은 모든 상품 조회 가능
    } else if (viewerRole === '대행사 어드민' || viewerRole === '직원' || viewerRole === '클라이언트') {
      // 대행사 관련 사용자는 공용 상품(company = null) + 자기 회사 상품만
      where[Op.or] = [
        { company: null }, // 공용 상품
        { company: viewerCompany } // 자기 회사 상품
      ];
    }
    
    // 카테고리 필터
    if (category) {
      where.category = category;
    }
    
    const offset = (page - 1) * limit;
    
    const { count, rows } = await Product.findAndCountAll({
      where,
      include: [
        { 
          model: User, 
          as: 'creator', 
          attributes: ['id', 'name', 'email'] 
        }
      ],
      order: [['category', 'ASC'], ['name', 'ASC']],
      limit: parseInt(limit),
      offset
    });
    
    res.json({
      products: rows,
      total: count,
      pages: Math.ceil(count / limit),
      currentPage: parseInt(page)
    });
    
  } catch (error) {
    console.error('상품 목록 조회 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * GET /api/products/:id - 상품 상세 조회
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findByPk(id, {
      include: [
        { 
          model: User, 
          as: 'creator', 
          attributes: ['id', 'name', 'email'] 
        }
      ]
    });
    
    if (!product) {
      return res.status(404).json({ message: '상품을 찾을 수 없습니다.' });
    }
    
    res.json(product);
    
  } catch (error) {
    console.error('상품 상세 조회 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * POST /api/products - 새 상품 생성 (본사 관리자만)
 */
router.post('/', async (req, res) => {
  try {
    const { viewerId, viewerRole, viewerCompany } = await getViewer(req);
    
    // 권한 확인: 슈퍼 어드민 또는 대행사 어드민만 상품 생성 가능
    if (viewerRole !== '슈퍼 어드민' && viewerRole !== '대행사 어드민') {
      return res.status(403).json({ message: '상품 생성 권한이 없습니다.' });
    }
    
    const {
      name,
      description,
      sku,
      category,
      costPrice,
      sellingPrice,
      unit = '건',
      minQuantity = 1,
      maxQuantity,
      tags
    } = req.body;
    
    // 필수 필드 검증
    if (!name || !category || !costPrice) {
      return res.status(400).json({ 
        message: '상품명, 카테고리, 원가는 필수입니다.' 
      });
    }
    
    // 가격 검증 (판매가가 있을 때만)
    if (sellingPrice && parseFloat(sellingPrice) <= parseFloat(costPrice)) {
      return res.status(400).json({ 
        message: '판매가는 원가보다 높아야 합니다.' 
      });
    }
    
    // SKU 중복 확인
    if (sku) {
      const existingProduct = await Product.findOne({ where: { sku } });
      if (existingProduct) {
        return res.status(400).json({ message: '이미 존재하는 상품 코드입니다.' });
      }
    }
    
    // 상품 생성
    const newProduct = await Product.create({
      name,
      description,
      sku,
      category,
      costPrice: parseFloat(costPrice),
      sellingPrice: sellingPrice ? parseFloat(sellingPrice) : null,
      unit,
      minQuantity: parseInt(minQuantity),
      maxQuantity: maxQuantity ? parseInt(maxQuantity) : null,
      tags: tags || null,
      createdBy: viewerId,
      isActive: true,
      company: viewerRole === '슈퍼 어드민' ? null : viewerCompany // 슈퍼 어드민이 만든 상품은 공용, 대행사 어드민이 만든 상품은 회사 전용
    });
    
    // 생성된 상품을 다시 조회 (관계 포함)
    const createdProduct = await Product.findByPk(newProduct.id, {
      include: [
        { 
          model: User, 
          as: 'creator', 
          attributes: ['id', 'name', 'email'] 
        }
      ]
    });
    
    res.status(201).json(createdProduct);
    
  } catch (error) {
    console.error('상품 생성 실패:', error);
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ 
        message: '입력 데이터가 올바르지 않습니다.',
        details: error.errors.map(e => e.message)
      });
    }
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * PUT /api/products/:id - 상품 수정 (본사 관리자만)
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { viewerId, viewerRole } = await getViewer(req);
    
    // 권한 확인
    if (viewerRole !== '슈퍼 어드민' && viewerRole !== '대행사 어드민') {
      return res.status(403).json({ message: '상품 수정 권한이 없습니다.' });
    }
    
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ message: '상품을 찾을 수 없습니다.' });
    }
    
    const updateData = {};
    const allowedFields = [
      'name', 'description', 'sku', 'category', 'costPrice', 'sellingPrice',
      'unit', 'minQuantity', 'maxQuantity', 'tags', 'isActive'
    ];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });
    
    // 가격 검증 (판매가가 있을 때만)
    const newCostPrice = updateData.costPrice || product.costPrice;
    const newSellingPrice = updateData.sellingPrice !== undefined ? updateData.sellingPrice : product.sellingPrice;
    
    if (newSellingPrice && parseFloat(newSellingPrice) <= parseFloat(newCostPrice)) {
      return res.status(400).json({ 
        message: '판매가는 원가보다 높아야 합니다.' 
      });
    }
    
    // SKU 중복 확인 (다른 상품과)
    if (updateData.sku && updateData.sku !== product.sku) {
      const existingProduct = await Product.findOne({ 
        where: { 
          sku: updateData.sku,
          id: { [Op.ne]: id }
        } 
      });
      if (existingProduct) {
        return res.status(400).json({ message: '이미 존재하는 상품 코드입니다.' });
      }
    }
    
    await product.update(updateData);
    
    // 업데이트된 상품 조회
    const updatedProduct = await Product.findByPk(id, {
      include: [
        { 
          model: User, 
          as: 'creator', 
          attributes: ['id', 'name', 'email'] 
        }
      ]
    });
    
    res.json(updatedProduct);
    
  } catch (error) {
    console.error('상품 수정 실패:', error);
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ 
        message: '입력 데이터가 올바르지 않습니다.',
        details: error.errors.map(e => e.message)
      });
    }
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * DELETE /api/products/:id - 상품 삭제 (본사 관리자만)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { viewerId, viewerRole } = await getViewer(req);
    
    // 권한 확인
    if (viewerRole !== '슈퍼 어드민') {
      return res.status(403).json({ message: '상품 삭제는 슈퍼 어드민만 가능합니다.' });
    }
    
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ message: '상품을 찾을 수 없습니다.' });
    }
    
    // 실제 삭제 대신 비활성화
    await product.update({ isActive: false });
    
    res.json({ message: '상품이 비활성화되었습니다.' });
    
  } catch (error) {
    console.error('상품 삭제 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * GET /api/products/categories/list - 카테고리 목록
 */
router.get('/categories/list', async (req, res) => {
  try {
    const categories = [
      'SNS 광고',
      '검색 광고', 
      '크리에이티브',
      '웹사이트',
      '브랜딩',
      '컨설팅',
      '기타'
    ];
    
    res.json(categories);
    
  } catch (error) {
    console.error('카테고리 목록 조회 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

export default router;