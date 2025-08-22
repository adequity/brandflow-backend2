// src/api/systemSettings.js
import express from 'express';
import { SystemSetting, User } from '../models/index.js';
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
 * 기본 시스템 설정 생성
 */
async function initializeDefaultSettings() {
  const defaultSettings = [
    {
      settingKey: 'incentive_visibility_staff',
      settingValue: 'true',
      settingType: 'boolean',
      category: 'incentive',
      description: '직원이 자신의 인센티브 금액을 볼 수 있는지 여부',
      defaultValue: 'true',
      accessLevel: 'super_admin'
    },
    {
      settingKey: 'incentive_visibility_agency_admin',
      settingValue: 'true',
      settingType: 'boolean',
      category: 'incentive',
      description: '대행사 어드민이 직원들의 인센티브를 볼 수 있는지 여부',
      defaultValue: 'true',
      accessLevel: 'super_admin'
    },
    {
      settingKey: 'auto_margin_calculation',
      settingValue: 'false',
      settingType: 'boolean',
      category: 'sales',
      description: '자동 마진 계산 활성화 여부',
      defaultValue: 'false',
      accessLevel: 'agency_admin'
    },
    {
      settingKey: 'default_margin_rate',
      settingValue: '15',
      settingType: 'number',
      category: 'sales',
      description: '기본 마진율 (%)',
      defaultValue: '15',
      accessLevel: 'agency_admin'
    },
    {
      settingKey: 'document_auto_generation',
      settingValue: 'true',
      settingType: 'boolean',
      category: 'document',
      description: '승인 시 자동 문서 생성 여부',
      defaultValue: 'true',
      accessLevel: 'agency_admin'
    }
  ];

  for (const setting of defaultSettings) {
    const exists = await SystemSetting.findOne({ where: { settingKey: setting.settingKey } });
    if (!exists) {
      await SystemSetting.create(setting);
    }
  }
}

/**
 * GET /api/system-settings - 시스템 설정 목록 조회
 */
router.get('/', async (req, res) => {
  try {
    const { viewerId, viewerRole } = await getViewer(req);
    const { category, accessLevel } = req.query;
    
    // 권한 확인: 슈퍼 어드민과 대행사 어드민만 조회 가능
    if (!['슈퍼 어드민', '대행사 어드민'].includes(viewerRole)) {
      return res.status(403).json({ message: '시스템 설정 조회 권한이 없습니다.' });
    }
    
    let where = { isActive: true };
    
    // 카테고리 필터
    if (category) {
      where.category = category;
    }
    
    // 권한 레벨 필터 (대행사 어드민은 자신이 수정 가능한 설정만 조회)
    if (viewerRole === '대행사 어드민') {
      where.accessLevel = { [Op.in]: ['agency_admin', 'staff'] };
    }
    if (accessLevel) {
      where.accessLevel = accessLevel;
    }
    
    const settings = await SystemSetting.findAll({
      where,
      include: [
        {
          model: User,
          as: 'modifier',
          attributes: ['id', 'name', 'email'],
          required: false
        }
      ],
      order: [['category', 'ASC'], ['settingKey', 'ASC']]
    });
    
    res.json({ settings });
    
  } catch (error) {
    console.error('시스템 설정 조회 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * GET /api/system-settings/:key - 특정 설정 조회
 */
router.get('/:key', async (req, res) => {
  try {
    const { viewerId, viewerRole } = await getViewer(req);
    const { key } = req.params;
    
    const setting = await SystemSetting.findOne({
      where: { settingKey: key, isActive: true },
      include: [
        {
          model: User,
          as: 'modifier',
          attributes: ['id', 'name', 'email'],
          required: false
        }
      ]
    });
    
    if (!setting) {
      return res.status(404).json({ message: '설정을 찾을 수 없습니다.' });
    }
    
    // 권한 확인
    if (viewerRole === '대행사 어드민' && setting.accessLevel === 'super_admin') {
      return res.status(403).json({ message: '해당 설정에 대한 조회 권한이 없습니다.' });
    }
    
    res.json(setting);
    
  } catch (error) {
    console.error('설정 조회 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * PUT /api/system-settings/:key - 설정 수정
 */
router.put('/:key', async (req, res) => {
  try {
    const { viewerId, viewerRole } = await getViewer(req);
    const { key } = req.params;
    const { settingValue, description } = req.body;
    
    const setting = await SystemSetting.findOne({
      where: { settingKey: key, isActive: true }
    });
    
    if (!setting) {
      return res.status(404).json({ message: '설정을 찾을 수 없습니다.' });
    }
    
    // 권한 확인
    let hasPermission = false;
    
    if (viewerRole === '슈퍼 어드민') {
      hasPermission = true;
    } else if (viewerRole === '대행사 어드민') {
      if (['agency_admin', 'staff'].includes(setting.accessLevel)) {
        hasPermission = true;
      }
    }
    
    if (!hasPermission) {
      return res.status(403).json({ message: '해당 설정에 대한 수정 권한이 없습니다.' });
    }
    
    // 설정 타입에 따른 값 검증
    let validatedValue = settingValue;
    
    switch (setting.settingType) {
      case 'boolean':
        if (typeof settingValue !== 'boolean' && !['true', 'false'].includes(String(settingValue).toLowerCase())) {
          return res.status(400).json({ message: '불린 값이어야 합니다 (true/false).' });
        }
        validatedValue = String(settingValue).toLowerCase() === 'true';
        break;
        
      case 'number':
        const num = parseFloat(settingValue);
        if (isNaN(num)) {
          return res.status(400).json({ message: '숫자 값이어야 합니다.' });
        }
        validatedValue = String(num);
        break;
        
      case 'json':
        try {
          JSON.parse(settingValue);
        } catch (e) {
          return res.status(400).json({ message: '유효한 JSON 형식이어야 합니다.' });
        }
        break;
    }
    
    // 설정 업데이트
    await setting.update({
      settingValue: String(validatedValue),
      description: description || setting.description,
      lastModifiedBy: viewerId
    });
    
    // 업데이트된 설정 조회
    const updatedSetting = await SystemSetting.findByPk(setting.id, {
      include: [
        {
          model: User,
          as: 'modifier',
          attributes: ['id', 'name', 'email'],
          required: false
        }
      ]
    });
    
    res.json(updatedSetting);
    
  } catch (error) {
    console.error('설정 수정 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * POST /api/system-settings - 새 설정 생성 (슈퍼 어드민만)
 */
router.post('/', async (req, res) => {
  try {
    const { viewerId, viewerRole } = await getViewer(req);
    
    // 슈퍼 어드민만 새 설정 생성 가능
    if (viewerRole !== '슈퍼 어드민') {
      return res.status(403).json({ message: '새 설정 생성은 슈퍼 어드민만 가능합니다.' });
    }
    
    const {
      settingKey,
      settingValue,
      settingType = 'string',
      category = 'general',
      description,
      defaultValue,
      accessLevel = 'super_admin'
    } = req.body;
    
    // 필수 필드 검증
    if (!settingKey || settingValue === undefined) {
      return res.status(400).json({ message: '설정 키와 값은 필수입니다.' });
    }
    
    // 중복 키 확인
    const existingSetting = await SystemSetting.findOne({ where: { settingKey } });
    if (existingSetting) {
      return res.status(400).json({ message: '이미 존재하는 설정 키입니다.' });
    }
    
    // 새 설정 생성
    const newSetting = await SystemSetting.create({
      settingKey,
      settingValue: String(settingValue),
      settingType,
      category,
      description,
      defaultValue: defaultValue || String(settingValue),
      accessLevel,
      lastModifiedBy: viewerId
    });
    
    res.status(201).json(newSetting);
    
  } catch (error) {
    console.error('설정 생성 실패:', error);
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
 * GET /api/system-settings/public/incentive-settings - 인센티브 표시 설정 조회 (모든 사용자)
 */
router.get('/public/incentive-settings', async (req, res) => {
  try {
    const { viewerId, viewerRole } = await getViewer(req);
    
    if (!viewerId || !viewerRole) {
      return res.status(401).json({ message: '인증이 필요합니다.' });
    }
    
    const settings = await SystemSetting.findAll({
      where: {
        settingKey: {
          [Op.in]: ['incentive_visibility_staff', 'incentive_visibility_agency_admin']
        },
        isActive: true
      },
      attributes: ['settingKey', 'settingValue', 'settingType']
    });
    
    const result = {
      showIncentiveToStaff: true,
      showIncentiveToAgencyAdmin: true
    };
    
    settings.forEach(setting => {
      const value = setting.settingType === 'boolean' 
        ? setting.settingValue.toLowerCase() === 'true'
        : setting.settingValue;
        
      if (setting.settingKey === 'incentive_visibility_staff') {
        result.showIncentiveToStaff = value;
      } else if (setting.settingKey === 'incentive_visibility_agency_admin') {
        result.showIncentiveToAgencyAdmin = value;
      }
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('인센티브 설정 조회 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/**
 * 앱 시작 시 기본 설정 초기화
 */
router.post('/initialize', async (req, res) => {
  try {
    const { viewerId, viewerRole } = await getViewer(req);
    
    // 슈퍼 어드민만 초기화 가능
    if (viewerRole !== '슈퍼 어드민') {
      return res.status(403).json({ message: '초기화는 슈퍼 어드민만 가능합니다.' });
    }
    
    await initializeDefaultSettings();
    
    res.json({ message: '기본 설정이 초기화되었습니다.' });
    
  } catch (error) {
    console.error('설정 초기화 실패:', error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

export default router;