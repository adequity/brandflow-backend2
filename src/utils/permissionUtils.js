// src/utils/permissionUtils.js
import { User } from '../models/index.js';

/**
 * 접근 권한 스코프 정의
 */
export const getAccessScope = (viewerRole, viewerCompany, viewerId) => {
  switch(viewerRole) {
    case '슈퍼 어드민': 
      return { 
        type: 'ALL', 
        filter: {},
        permissions: ['view', 'create', 'update', 'delete', 'approve'] 
      };
    
    case '대행사 어드민': 
      return { 
        type: 'COMPANY', 
        filter: { company: viewerCompany },
        permissions: ['view', 'create', 'update', 'approve_purchase', 'approve_incentive']
      };
    
    case '직원': 
      return { 
        type: 'OWN', 
        filter: { userId: viewerId },
        permissions: ['view', 'create', 'update']
      };
    
    case '클라이언트': 
      return { 
        type: 'OWN',
        filter: { userId: viewerId },
        permissions: ['view', 'approve_post']
      };
    
    default:
      return { type: 'NONE', filter: {}, permissions: [] };
  }
};

/**
 * 호출자 정보 파싱 (공통 함수)
 */
export async function getViewer(req) {
  const rawViewerId = req.query.viewerId || req.query.adminId;
  const rawViewerRole = req.query.viewerRole || req.query.adminRole || '';
  
  const viewerId = Number(Array.isArray(rawViewerId) ? rawViewerId[0] : rawViewerId);
  const viewerRole = decodeURIComponent(String(Array.isArray(rawViewerRole) ? rawViewerRole[0] : rawViewerRole)).trim();
  
  let viewerCompany = null;
  let viewer = null;

  if (viewerId && !isNaN(viewerId)) {
    viewer = await User.findByPk(viewerId, {
      attributes: ['id', 'company', 'role', 'name', 'email']
    });
    viewerCompany = viewer?.company || null;
  }
  
  return { viewerId, viewerRole, viewerCompany, viewer };
}

/**
 * 권한 체크 함수
 */
export const checkPermission = (viewerRole, permission, targetResource = null, viewer = null) => {
  const scope = getAccessScope(viewerRole, viewer?.company, viewer?.id);
  
  // 권한이 없으면 false
  if (!scope.permissions.includes(permission)) {
    return false;
  }
  
  // 추가 리소스별 검증
  if (targetResource && permission.includes('own')) {
    // 본인 것만 접근 가능한 권한
    if (targetResource.userId && targetResource.userId !== viewer?.id) {
      return false;
    }
    if (targetResource.requesterId && targetResource.requesterId !== viewer?.id) {
      return false;
    }
  }
  
  return true;
};

/**
 * 캠페인 접근 권한 검증
 */
export const checkCampaignAccess = async (viewerRole, viewerCompany, viewerId, campaign) => {
  if (viewerRole === '슈퍼 어드민') {
    return true;
  }
  
  if (viewerRole === '대행사 어드민') {
    // 캠페인의 클라이언트가 같은 회사인지 확인
    const campaignUser = await User.findByPk(campaign.userId);
    return campaignUser?.company === viewerCompany;
  }
  
  if (viewerRole === '직원') {
    // 본인이 담당자인 캠페인만
    return campaign.managerId === viewerId;
  }
  
  if (viewerRole === '클라이언트') {
    // 본인의 캠페인만
    return campaign.userId === viewerId;
  }
  
  return false;
};

/**
 * 업무(Post) 승인 권한 검증
 */
export const checkPostApprovalAccess = (viewerRole, viewerId, campaign, post) => {
  // 클라이언트는 본인 캠페인의 업무만 승인/반려 가능
  if (viewerRole === '클라이언트') {
    return campaign.userId === viewerId;
  }
  
  // 슈퍼 어드민은 모든 승인 가능
  if (viewerRole === '슈퍼 어드민') {
    return true;
  }
  
  // 대행사 어드민, 직원은 업무 승인 권한 없음
  return false;
};

/**
 * 발주요청 승인 권한 검증
 */
export const checkPurchaseRequestApprovalAccess = (viewerRole, viewerCompany, request) => {
  // 슈퍼 어드민은 모든 승인 가능
  if (viewerRole === '슈퍼 어드민') {
    return true;
  }
  
  // 대행사 어드민은 같은 회사의 발주요청만 승인 가능
  if (viewerRole === '대행사 어드민') {
    return request.requester?.company === viewerCompany;
  }
  
  return false;
};

/**
 * 인센티브 승인 권한 검증
 */
export const checkIncentiveApprovalAccess = (viewerRole, viewerCompany, incentive) => {
  // 슈퍼 어드민은 모든 승인 가능
  if (viewerRole === '슈퍼 어드민') {
    return true;
  }
  
  // 대행사 어드민은 같은 회사의 인센티브만 승인 가능
  if (viewerRole === '대행사 어드민') {
    return incentive.employee?.company === viewerCompany;
  }
  
  return false;
};