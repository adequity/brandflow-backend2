import express from 'express';
import { Post, User, Campaign, Sale, Product } from '../models/index.js';
import { Op } from 'sequelize';
import NotificationService from '../services/notificationService.js';
import { getViewer as getViewerUtil, checkPostApprovalAccess, checkCampaignAccess } from '../utils/permissionUtils.js';

const router = express.Router();

/**
 * 매출 번호 생성 함수
 */
async function generateSaleNumber() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  
  // 같은 날짜의 매출 건수 확인
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const todayCount = await Sale.count({
    where: {
      createdAt: {
        [Op.gte]: today,
        [Op.lt]: tomorrow
      }
    }
  });
  
  const sequence = (todayCount + 1).toString().padStart(3, '0');
  return `S${year}${month}${day}${sequence}`;
}

/**
 * Sale 레코드 자동 생성 함수
 */
async function createSaleRecord(post, campaignUser, product) {
  try {
    const saleNumber = await generateSaleNumber();
    
    // 실제 금액은 상품의 기본 가격을 사용
    const actualCostPrice = product.costPrice;
    const actualSellingPrice = product.sellingPrice;
    const quantity = post.quantity || 1;
    
    const saleData = {
      saleNumber,
      quantity,
      actualCostPrice,
      actualSellingPrice,
      productId: product.id,
      salesPersonId: campaignUser.id, // 캠페인 매니저가 영업 담당자
      campaignId: post.campaignId,
      clientName: `${campaignUser.company} - ${post.Campaign.name}`, // 캠페인명을 클라이언트로
      clientContact: campaignUser.name,
      clientEmail: campaignUser.email,
      status: '등록', // 초기 상태
      saleDate: new Date(),
      memo: `캠페인 "${post.Campaign.name}" 업무 "${post.title}" 완료로 자동 생성`
    };
    
    const sale = await Sale.create(saleData);
    console.log(`자동 Sale 레코드 생성 완료: ${saleNumber} (업무 ID: ${post.id})`);
    
    return sale;
  } catch (error) {
    console.error('Sale 레코드 자동 생성 실패:', error);
    throw error;
  }
}

// getViewer 함수는 permissionUtils.js에서 import

// PUT /api/posts/:id - 포스트 정보 수정 (주제, 목차, 링크 등)
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    // 요청 본문에서 업데이트할 데이터들을 가져옵니다.
    const { title, outline, publishedUrl, topicStatus, outlineStatus, images, productId, quantity, workType, startDate, dueDate } = req.body;

    try {
        const { viewerId, viewerRole, viewerCompany } = await getViewerUtil(req);
        
        const post = await Post.findByPk(id, {
            include: [
                {
                    model: Campaign,
                    as: 'Campaign',
                    include: [{ model: User, as: 'User' }]
                },
                {
                    model: Product,
                    as: 'product'
                }
            ]
        });
        if (!post) {
            return res.status(404).json({ message: '포스트를 찾을 수 없습니다.' });
        }

        // 권한 확인
        let hasPermission = false;
        
        if (viewerRole === '슈퍼 어드민') {
            hasPermission = true;
        } else if (viewerRole === '대행사 어드민') {
            // 대행사 어드민은 같은 회사의 캠페인 업무 수정 가능
            const campaignUser = post.Campaign?.User;
            if (viewerCompany && 
                campaignUser?.company === viewerCompany && 
                campaignUser.role !== '슈퍼 어드민') {
                hasPermission = true;
            }
        } else if (viewerRole === '직원') {
            // 직원은 같은 회사의 캠페인 업무 수정 가능
            const campaignUser = post.Campaign?.User;
            if (viewerCompany && campaignUser?.company === viewerCompany) {
                hasPermission = true;
            }
        } else if (viewerRole === '클라이언트') {
            // 클라이언트는 본인의 캠페인만 수정 가능
            if (post.Campaign?.userId === viewerId) {
                hasPermission = true;
            }
        }
        
        if (!hasPermission) {
            return res.status(403).json({ message: '권한이 없습니다.' });
        }

        // 이전 상태 저장 (알림용)
        const previousTopicStatus = post.topicStatus;
        const previousOutlineStatus = post.outlineStatus;
        const previousOutline = post.outline;
        const previousPublishedUrl = post.publishedUrl;

        // 전달된 필드만 선택적으로 업데이트합니다.
        if (title !== undefined) post.title = title;
        if (outline !== undefined) post.outline = outline;
        if (publishedUrl !== undefined) {
            post.publishedUrl = publishedUrl;
            // skipApproval된 업무(topicStatus와 outlineStatus가 모두 '승인됨')가 결과물을 등록하면 자동으로 완료 처리
            if (publishedUrl && post.topicStatus === '승인됨' && post.outlineStatus === '승인됨') {
                post.topicStatus = '완료';
                post.outlineStatus = '완료';
            }
        }
        if (topicStatus !== undefined) post.topicStatus = topicStatus;
        if (outlineStatus !== undefined) post.outlineStatus = outlineStatus;
        if (images !== undefined) post.images = images;
        if (productId !== undefined) post.productId = productId ? Number(productId) : null;
        if (quantity !== undefined) post.quantity = quantity ? Number(quantity) : 1;
        if (workType !== undefined) post.workType = workType;
        if (startDate !== undefined) post.startDate = startDate;
        if (dueDate !== undefined) post.dueDate = dueDate;

        await post.save();

        // Sale 레코드 자동 생성 로직 (업무 완료 시)
        try {
            const wasCompleted = !previousPublishedUrl && publishedUrl; // 결과물이 새로 등록된 경우
            const hasProduct = post.productId && post.Product; // 상품이 연결된 경우
            const hasCampaignUser = post.Campaign?.User; // 캠페인 매니저가 있는 경우
            
            if (wasCompleted && hasProduct && hasCampaignUser) {
                // 이미 같은 업무에 대한 Sale 레코드가 있는지 확인
                const existingSale = await Sale.findOne({
                    where: {
                        campaignId: post.campaignId,
                        productId: post.productId,
                        memo: { [Op.like]: `%업무 ID: ${post.id}%` }
                    }
                });
                
                if (!existingSale) {
                    await createSaleRecord(post, post.Campaign.User, post.Product);
                    console.log(`업무 완료로 Sale 레코드 자동 생성: 업무 ID ${post.id}, 상품 ID ${post.productId}`);
                } else {
                    console.log(`업무 ID ${post.id}에 대한 Sale 레코드가 이미 존재함: ${existingSale.saleNumber}`);
                }
            }
        } catch (saleError) {
            console.error('Sale 레코드 자동 생성 실패 (업무는 정상 업데이트됨):', saleError);
        }

        // 알림 발송 로직 (실패해도 업데이트는 성공으로 처리)
        if (viewerId) {
            try {
                // 업무 상태 변경 알림
                if (topicStatus && topicStatus !== previousTopicStatus) {
                    await NotificationService.notifyTaskStatusChanged(post, topicStatus, viewerId);
                }

                // 세부사항 상태 변경 알림  
                if (outlineStatus && outlineStatus !== previousOutlineStatus) {
                    await NotificationService.notifyOutlineStatusChanged(post, outlineStatus, viewerId);
                }

                // 세부사항 제출 알림 (새로 outline이 추가된 경우)
                if (outline && !previousOutline) {
                    await NotificationService.notifyOutlineSubmitted(post, viewerId);
                }

                // 결과물 제출 알림 (새로 publishedUrl이 추가된 경우)
                if (publishedUrl && !previousPublishedUrl) {
                    await NotificationService.notifyResultSubmitted(post, viewerId);
                }
            } catch (notificationError) {
                console.error('포스트 업데이트 알림 발송 실패 (포스트는 정상 업데이트됨):', notificationError);
            }
        }

        res.status(200).json(post);
    } catch (error) {
        console.error(`포스트(ID: ${id}) 수정 실패:`, error);
        res.status(500).json({ message: '서버 에러가 발생했습니다.' });
    }
});

// DELETE /api/posts/:id - 포스트 삭제
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { viewerId, viewerRole, viewerCompany } = await getViewerUtil(req);
        
        const post = await Post.findByPk(id, {
            include: [{
                model: Campaign,
                as: 'Campaign',
                include: [{ model: User, as: 'User' }]
            }]
        });
        if (!post) {
            return res.status(404).json({ message: '포스트를 찾을 수 없습니다.' });
        }

        // 권한 확인
        let hasPermission = false;
        
        if (viewerRole === '슈퍼 어드민') {
            hasPermission = true;
        } else if (viewerRole === '대행사 어드민') {
            // 대행사 어드민은 같은 회사의 캠페인 업무 삭제 가능
            const campaignUser = post.Campaign?.User;
            if (viewerCompany && 
                campaignUser?.company === viewerCompany && 
                campaignUser.role !== '슈퍼 어드민') {
                hasPermission = true;
            }
        } else if (viewerRole === '직원') {
            // 직원은 같은 회사의 캠페인 업무 삭제 가능
            const campaignUser = post.Campaign?.User;
            if (viewerCompany && campaignUser?.company === viewerCompany) {
                hasPermission = true;
            }
        } else if (viewerRole === '클라이언트') {
            // 클라이언트는 본인의 캠페인만 삭제 가능
            if (post.Campaign?.userId === viewerId) {
                hasPermission = true;
            }
        }
        
        if (!hasPermission) {
            return res.status(403).json({ message: '권한이 없습니다.' });
        }

        await post.destroy();
        res.status(204).send();
    } catch (error) {
        console.error(`포스트(ID: ${id}) 삭제 실패:`, error);
        res.status(500).json({ message: '서버 에러가 발생했습니다.' });
    }
});

// PUT /api/posts/:id/status - 포스트 상태 수정 (클라이언트용)
router.put('/:id/status', async (req, res) => {
    const { id } = req.params;
    const { topicStatus, outlineStatus, rejectReason } = req.body;

    try {
        const { viewerId, viewerRole, viewerCompany } = await getViewerUtil(req);
        
        const post = await Post.findByPk(id, {
            include: [{
                model: Campaign,
                as: 'Campaign',
                include: [{ model: User, as: 'User' }]
            }]
        });
        if (!post) {
            return res.status(404).json({ message: '포스트를 찾을 수 없습니다.' });
        }

        // 권한 확인
        let hasPermission = false;
        
        if (viewerRole === '슈퍼 어드민') {
            hasPermission = true;
        } else if (viewerRole === '대행사 어드민') {
            // 대행사 어드민은 같은 회사의 캠페인 업무 상태 변경 가능
            const campaignUser = post.Campaign?.User;
            if (viewerCompany && 
                campaignUser?.company === viewerCompany && 
                campaignUser.role !== '슈퍼 어드민') {
                hasPermission = true;
            }
        } else if (viewerRole === '직원') {
            // 직원은 같은 회사의 캠페인 업무 상태 변경 가능
            const campaignUser = post.Campaign?.User;
            if (viewerCompany && campaignUser?.company === viewerCompany) {
                hasPermission = true;
            }
        } else if (viewerRole === '클라이언트') {
            // 클라이언트는 본인의 캠페인만 상태 변경 가능
            if (post.Campaign?.userId === viewerId) {
                hasPermission = true;
            }
        }
        
        if (!hasPermission) {
            return res.status(403).json({ message: '권한이 없습니다.' });
        }

        if (topicStatus) post.topicStatus = topicStatus;
        if (outlineStatus) post.outlineStatus = outlineStatus;
        post.rejectReason = rejectReason; // 반려 사유는 항상 업데이트

        await post.save();
        res.status(200).json(post);
    } catch (error) {
        console.error(`포스트(ID: ${id}) 상태 수정 실패:`, error);
        res.status(500).json({ message: '서버 에러가 발생했습니다.' });
    }
});

/**
 * PUT /api/posts/:id/approve - 업무 승인 (주제/목차/결과물)
 * 클라이언트만 본인 캠페인의 업무를 승인할 수 있음
 */
router.put('/:id/approve', async (req, res) => {
    const { id } = req.params;
    const { type, status, rejectReason } = req.body; // type: 'topic', 'outline', 'result'
    
    try {
        const { viewerId, viewerRole, viewerCompany, viewer } = await getViewerUtil(req);
        
        // 업무 조회
        const post = await Post.findByPk(id, {
            include: [
                {
                    model: Campaign,
                    as: 'Campaign',
                    include: [
                        {
                            model: User,
                            as: 'User', // 캠페인의 클라이언트
                            attributes: ['id', 'name', 'email', 'company', 'role']
                        }
                    ]
                }
            ]
        });
        
        if (!post) {
            return res.status(404).json({ message: '업무를 찾을 수 없습니다.' });
        }
        
        // 캠페인 접근 권한 확인
        const hasAccess = await checkCampaignAccess(viewerRole, viewerCompany, viewerId, post.Campaign);
        if (!hasAccess) {
            return res.status(403).json({ message: '이 캠페인에 접근할 권한이 없습니다.' });
        }
        
        // 승인 권한 확인 (클라이언트만 본인 캠페인의 업무 승인 가능)
        const canApprove = checkPostApprovalAccess(viewerRole, viewerId, post.Campaign, post);
        if (!canApprove) {
            return res.status(403).json({ 
                message: '승인 권한이 없습니다. 클라이언트만 본인 캠페인의 업무를 승인할 수 있습니다.' 
            });
        }
        
        // 상태 업데이트
        let updateField = '';
        let notification = {
            targetUserId: null,
            title: '',
            message: ''
        };
        
        switch(type) {
            case 'topic':
                updateField = 'topicStatus';
                post.topicStatus = status;
                notification = {
                    targetUserId: post.Campaign.managerId, // 캠페인 매니저에게 알림
                    title: `주제 ${status === '승인됨' ? '승인' : '반려'}`,
                    message: `캠페인 "${post.Campaign.name}"의 업무 "${post.title}" 주제가 ${status === '승인됨' ? '승인' : '반려'}되었습니다.`
                };
                break;
                
            case 'outline':
                updateField = 'outlineStatus';
                post.outlineStatus = status;
                notification = {
                    targetUserId: post.Campaign.managerId,
                    title: `목차 ${status === '승인됨' ? '승인' : '반려'}`,
                    message: `캠페인 "${post.Campaign.name}"의 업무 "${post.title}" 목차가 ${status === '승인됨' ? '승인' : '반려'}되었습니다.`
                };
                break;
                
            case 'result':
                // 결과물 승인은 publishedUrl이 있을 때만 가능
                if (!post.publishedUrl) {
                    return res.status(400).json({ message: '결과물이 등록되지 않았습니다.' });
                }
                
                if (status === '승인됨') {
                    post.status = '완료';
                    
                    // 상품이 연결되어 있으면 자동으로 Sale 레코드 생성
                    if (post.productId) {
                        const product = await Product.findByPk(post.productId);
                        if (product) {
                            await createSaleRecord(post, post.Campaign.User, product);
                        }
                    }
                }
                
                notification = {
                    targetUserId: post.Campaign.managerId,
                    title: `결과물 ${status === '승인됨' ? '승인' : '반려'}`,
                    message: `캠페인 "${post.Campaign.name}"의 업무 "${post.title}" 결과물이 ${status === '승인됨' ? '승인' : '반려'}되었습니다.`
                };
                break;
                
            default:
                return res.status(400).json({ message: '올바르지 않은 승인 타입입니다.' });
        }
        
        // 반려 사유 저장
        if (status === '반려됨' && rejectReason) {
            post.rejectReason = rejectReason;
        }
        
        await post.save();
        
        // 알림 전송
        if (notification.targetUserId) {
            try {
                await NotificationService.createNotification({
                    userId: notification.targetUserId,
                    title: notification.title,
                    message: notification.message,
                    type: 'approval',
                    relatedId: post.id,
                    relatedType: 'post'
                });
            } catch (notificationError) {
                console.error('알림 전송 실패:', notificationError);
            }
        }
        
        res.status(200).json({
            message: `${type} ${status === '승인됨' ? '승인' : '반려'} 완료`,
            post: {
                id: post.id,
                [updateField]: post[updateField],
                status: post.status,
                rejectReason: post.rejectReason
            }
        });
        
    } catch (error) {
        console.error(`업무(ID: ${id}) 승인 처리 실패:`, error);
        res.status(500).json({ message: '서버 에러가 발생했습니다.' });
    }
});

export default router;
