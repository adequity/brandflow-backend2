// src/api/monthlyIncentives.js
import express from 'express';
import { MonthlyIncentive, User, Sale } from '../models/index.js';
import { Op } from 'sequelize';
import sequelize from '../config/db.js';

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
 * 특정 월의 직원별 매출 데이터 집계
 */
async function calculateMonthlySalesData(userId, year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  
  const salesData = await Sale.findAll({
    where: {
      salesPersonId: userId,
      status: '승인',
      saleDate: {
        [Op.between]: [startDate, endDate]
      }
    },
    include: [
      {
        model: User,
        as: 'salesperson',
        attributes: ['id', 'name', 'incentiveRate']
      }
    ]
  });
  
  let totalSales = 0;
  let totalCost = 0;
  let totalMargin = 0;
  let salesCount = salesData.length;
  let incentiveRate = 0;
  
  salesData.forEach(sale => {
    const sales = sale.actualSellingPrice * sale.quantity;
    const cost = sale.actualCostPrice * sale.quantity;
    const margin = sales - cost;
    
    totalSales += sales;
    totalCost += cost;
    totalMargin += margin;
    
    // 인센티브율은 직원 정보에서 가져오기
    if (sale.salesperson) {
      incentiveRate = sale.salesperson.incentiveRate;
    }
  });
  
  const incentiveAmount = totalMargin * (incentiveRate / 100);
  
  return {
    totalSales,
    totalCost,
    totalMargin,
    salesCount,
    incentiveRate,
    incentiveAmount
  };
}

/**
 * POST /api/monthly-incentives/calculate - 월간 인센티브 자동 계산
 */
router.post('/calculate', async (req, res) => {
  try {
    const { viewerId, viewerRole, viewerCompany } = await getViewer(req);
    
    // 관리자만 인센티브 계산 가능
    if (!['슈퍼 어드민', '대행사 어드민'].includes(viewerRole)) {
      return res.status(403).json({ message: '인센티브 계산 권한이 없습니다.' });
    }
    
    const { year, month, userIds } = req.body;
    
    if (!year || !month) {
      return res.status(400).json({ message: '연도와 월을 입력해주세요.' });
    }
    
    // 대상 직원 목록 가져오기
    let targetUsers = [];
    
    if (userIds && userIds.length > 0) {
      // 특정 직원들만
      const whereCondition = { 
        id: { [Op.in]: userIds },
        role: { [Op.in]: ['직원', '대행사 어드민'] }
      };
      
      if (viewerRole === '대행사 어드민') {
        whereCondition.company = viewerCompany;
      }
      
      targetUsers = await User.findAll({ where: whereCondition });
    } else {
      // 전체 직원
      const whereCondition = { 
        role: { [Op.in]: ['직원', '대행사 어드민'] }
      };
      
      if (viewerRole === '대행사 어드민') {
        whereCondition.company = viewerCompany;
      }
      
      targetUsers = await User.findAll({ where: whereCondition });
    }
    
    const results = [];
    
    for (const user of targetUsers) {
      try {
        // 이미 해당 월 인센티브가 있는지 확인
        const existing = await MonthlyIncentive.findOne({
          where: { userId: user.id, year, month }
        });
        
        if (existing) {
          results.push({
            userId: user.id,
            userName: user.name,
            status: 'skipped',
            message: '이미 계산된 인센티브가 있습니다.'
          });
          continue;
        }
        
        // 매출 데이터 계산
        const salesData = await calculateMonthlySalesData(user.id, year, month);
        
        // 인센티브 레코드 생성
        const incentive = await MonthlyIncentive.create({
          year,
          month,
          userId: user.id,
          totalSales: salesData.totalSales,
          totalCost: salesData.totalCost,
          totalMargin: salesData.totalMargin,
          incentiveRate: salesData.incentiveRate,
          incentiveAmount: salesData.incentiveAmount,
          salesCount: salesData.salesCount,
          status: '검토대기',
          createdBy: viewerId
        });
        
        results.push({
          userId: user.id,
          userName: user.name,
          status: 'created',
          incentiveId: incentive.id,
          amount: salesData.incentiveAmount
        });
        
      } catch (error) {
        results.push({
          userId: user.id,
          userName: user.name,
          status: 'error',
          message: error.message
        });
      }
    }
    
    res.json({
      message: '인센티브 계산이 완료되었습니다.',
      results
    });
    
  } catch (error) {
    console.error('월간 인센티브 계산 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * GET /api/monthly-incentives - 인센티브 목록 조회
 */
router.get('/', async (req, res) => {
  try {
    const { viewerId, viewerRole, viewerCompany } = await getViewer(req);
    const { year, month, status, userId, page = 1, limit = 20 } = req.query;
    
    let where = {};
    
    // 권한별 필터
    if (viewerRole === '슈퍼 어드민') {
      // 슈퍼 어드민은 모든 인센티브 조회 가능
      // where 조건 없음 (모든 데이터 조회)
    } else if (viewerRole === '대행사 어드민') {
      // 같은 회사 직원들의 인센티브만
      if (!viewerCompany) {
        return res.json({ incentives: [], total: 0, pages: 0 });
      }
      
      const companyUserIds = await User.findAll({
        where: { company: viewerCompany },
        attributes: ['id']
      }).then(users => users.map(u => u.id));
      
      where.userId = { [Op.in]: companyUserIds };
    } else if (viewerRole === '직원') {
      // 본인 인센티브만
      where.userId = viewerId;
    } else {
      return res.status(403).json({ message: '권한이 없습니다.' });
    }
    
    // 추가 필터
    if (year) where.year = year;
    if (month) where.month = month;
    if (status) where.status = status;
    if (userId) where.userId = userId;
    
    const offset = (page - 1) * limit;
    
    const { count, rows } = await MonthlyIncentive.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'employee',
          attributes: ['id', 'name', 'email', 'company', 'incentiveRate']
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'name', 'email'],
          required: false
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'email'],
          required: false
        }
      ],
      order: [['year', 'DESC'], ['month', 'DESC'], ['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });
    
    res.json({
      incentives: rows,
      total: count,
      pages: Math.ceil(count / limit),
      currentPage: parseInt(page)
    });
    
  } catch (error) {
    console.error('인센티브 목록 조회 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * GET /api/monthly-incentives/summary/stats - 인센티브 통계
 */
router.get('/summary/stats', async (req, res) => {
  try {
    const { viewerId, viewerRole, viewerCompany } = await getViewer(req);
    const { year, month } = req.query;
    
    let where = {};
    
    // 권한별 필터
    if (viewerRole === '슈퍼 어드민') {
      // 모든 데이터
    } else if (viewerRole === '대행사 어드민') {
      if (!viewerCompany) {
        return res.json({
          totalEmployees: 0, pendingIncentives: 0, approvedIncentives: 0,
          totalIncentiveAmount: 0, totalAdjustmentAmount: 0
        });
      }
      
      const companyUserIds = await User.findAll({
        where: { company: viewerCompany },
        attributes: ['id']
      }).then(users => users.map(u => u.id));
      
      where.userId = { [Op.in]: companyUserIds };
    } else if (viewerRole === '직원') {
      where.userId = viewerId;
    } else {
      return res.status(403).json({ message: '권한이 없습니다.' });
    }
    
    // 기간 필터
    if (year) where.year = year;
    if (month) where.month = month;
    
    const [
      totalEmployees,
      pendingIncentives,
      approvedIncentives,
      totalAmountResult
    ] = await Promise.all([
      MonthlyIncentive.count({ 
        where,
        distinct: true,
        col: 'userId'
      }),
      MonthlyIncentive.count({ where: { ...where, status: '검토대기' } }),
      MonthlyIncentive.count({ where: { ...where, status: { [Op.in]: ['승인완료', '지급완료'] } } }),
      MonthlyIncentive.findAll({
        where: { ...where, status: { [Op.in]: ['승인완료', '지급완료'] } },
        attributes: [
          [sequelize.fn('SUM', sequelize.col('incentiveAmount')), 'totalIncentive'],
          [sequelize.fn('SUM', sequelize.col('adjustmentAmount')), 'totalAdjustment']
        ],
        raw: true
      })
    ]);
    
    const totalIncentiveAmount = parseFloat(totalAmountResult[0]?.totalIncentive || 0);
    const totalAdjustmentAmount = parseFloat(totalAmountResult[0]?.totalAdjustment || 0);
    
    res.json({
      totalEmployees,
      pendingIncentives,
      approvedIncentives,
      totalIncentiveAmount: Math.round(totalIncentiveAmount),
      totalAdjustmentAmount: Math.round(totalAdjustmentAmount),
      totalFinalAmount: Math.round(totalIncentiveAmount + totalAdjustmentAmount)
    });
    
  } catch (error) {
    console.error('인센티브 통계 조회 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * GET /api/monthly-incentives/:id - 인센티브 상세 조회
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { viewerId, viewerRole, viewerCompany } = await getViewer(req);
    
    const incentive = await MonthlyIncentive.findByPk(id, {
      include: [
        {
          model: User,
          as: 'employee',
          attributes: ['id', 'name', 'email', 'company', 'incentiveRate']
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'name', 'email'],
          required: false
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'email'],
          required: false
        }
      ]
    });
    
    if (!incentive) {
      return res.status(404).json({ message: '인센티브를 찾을 수 없습니다.' });
    }
    
    // 권한 확인
    let hasPermission = false;
    
    if (viewerRole === '슈퍼 어드민') {
      hasPermission = true;
    } else if (viewerRole === '대행사 어드민') {
      if (viewerCompany && incentive.employee?.company === viewerCompany) {
        hasPermission = true;
      }
    } else if (viewerRole === '직원') {
      if (incentive.userId === viewerId) {
        hasPermission = true;
      }
    }
    
    if (!hasPermission) {
      return res.status(403).json({ message: '권한이 없습니다.' });
    }
    
    res.json(incentive);
    
  } catch (error) {
    console.error('인센티브 상세 조회 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * PUT /api/monthly-incentives/:id - 인센티브 수정/승인
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { viewerId, viewerRole, viewerCompany } = await getViewer(req);
    
    const incentive = await MonthlyIncentive.findByPk(id, {
      include: [{ model: User, as: 'employee', attributes: ['id', 'company'] }]
    });
    
    if (!incentive) {
      return res.status(404).json({ message: '인센티브를 찾을 수 없습니다.' });
    }
    
    // 권한 확인
    let hasPermission = false;
    
    if (viewerRole === '슈퍼 어드민') {
      hasPermission = true;
    } else if (viewerRole === '대행사 어드민') {
      if (viewerCompany && incentive.employee?.company === viewerCompany) {
        hasPermission = true;
      }
    }
    
    if (!hasPermission) {
      return res.status(403).json({ message: '권한이 없습니다.' });
    }
    
    const updateData = {};
    const allowedFields = [
      'adjustmentAmount', 'adjustmentReason', 'status', 
      'paymentDate', 'paymentMethod', 'paymentMemo'
    ];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });
    
    // 상태 변경 시 승인자 정보 설정
    if (updateData.status && ['승인완료', '지급완료', '보류', '취소'].includes(updateData.status)) {
      updateData.approvedBy = viewerId;
      updateData.approvedAt = new Date();
    }
    
    await incentive.update(updateData);
    
    // 업데이트된 인센티브 조회
    const updatedIncentive = await MonthlyIncentive.findByPk(id, {
      include: [
        {
          model: User,
          as: 'employee',
          attributes: ['id', 'name', 'email', 'company', 'incentiveRate']
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'name', 'email'],
          required: false
        }
      ]
    });
    
    res.json(updatedIncentive);
    
  } catch (error) {
    console.error('인센티브 수정 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * DELETE /api/monthly-incentives/:id - 인센티브 삭제
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { viewerId, viewerRole, viewerCompany } = await getViewer(req);
    
    const incentive = await MonthlyIncentive.findByPk(id, {
      include: [{ model: User, as: 'employee', attributes: ['id', 'company'] }]
    });
    
    if (!incentive) {
      return res.status(404).json({ message: '인센티브를 찾을 수 없습니다.' });
    }
    
    // 권한 확인 (슈퍼 어드민 또는 해당 회사 대행사 어드민)
    let hasPermission = false;
    
    if (viewerRole === '슈퍼 어드민') {
      hasPermission = true;
    } else if (viewerRole === '대행사 어드민') {
      if (viewerCompany && incentive.employee?.company === viewerCompany) {
        hasPermission = true;
      }
    }
    
    if (!hasPermission) {
      return res.status(403).json({ message: '권한이 없습니다.' });
    }
    
    // 지급완료 상태는 삭제 불가
    if (incentive.status === '지급완료') {
      return res.status(400).json({ message: '지급완료된 인센티브는 삭제할 수 없습니다.' });
    }
    
    await incentive.destroy();
    res.status(204).send();
    
  } catch (error) {
    console.error('인센티브 삭제 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

export default router;