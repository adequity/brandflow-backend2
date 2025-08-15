import express from 'express';
import { Post, User, Campaign } from '../models/index.js';
import NotificationService from '../services/notificationService.js';

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

// PUT /api/posts/:id - 포스트 정보 수정 (주제, 목차, 링크 등)
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    // 요청 본문에서 업데이트할 데이터들을 가져옵니다.
    const { title, outline, publishedUrl, topicStatus, outlineStatus, images } = req.body;

    try {
        const { viewerId, viewerRole, viewerCompany } = await getViewer(req);
        
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
        if (publishedUrl !== undefined) post.publishedUrl = publishedUrl;
        if (topicStatus !== undefined) post.topicStatus = topicStatus;
        if (outlineStatus !== undefined) post.outlineStatus = outlineStatus;
        if (images !== undefined) post.images = images;

        await post.save();

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
        const { viewerId, viewerRole, viewerCompany } = await getViewer(req);
        
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
        const { viewerId, viewerRole, viewerCompany } = await getViewer(req);
        
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


export default router;
