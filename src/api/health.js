/**
 * System Health Check API
 * 시스템 상태 모니터링 및 헬스체크 엔드포인트
 */

import express from 'express';
import { Op } from 'sequelize';
import { User, Campaign, Post, PurchaseRequest } from '../models/index.js';
import logger from '../utils/logger.js';

const router = express.Router();

// 시스템 헬스체크
router.get('/', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // 데이터베이스 연결 테스트
    const dbTest = await testDatabaseConnection();
    
    // 시스템 메트릭 수집
    const metrics = await collectSystemMetrics();
    
    const responseTime = Date.now() - startTime;
    
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.2.0',
      uptime: process.uptime(),
      responseTime: `${responseTime}ms`,
      database: dbTest,
      metrics: metrics,
      environment: process.env.NODE_ENV || 'development'
    };

    // 성능 로깅
    logger.logPerformance('health_check', responseTime);
    logger.logSystemHealth(healthStatus);

    res.json(healthStatus);
  } catch (error) {
    logger.logError(error, { endpoint: '/health' });
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      version: '2.2.0'
    });
  }
});

// 상세 시스템 상태
router.get('/detailed', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // 상세 메트릭 수집
    const detailedMetrics = await collectDetailedMetrics();
    
    const responseTime = Date.now() - startTime;
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      ...detailedMetrics
    });
  } catch (error) {
    logger.logError(error, { endpoint: '/health/detailed' });
    res.status(503).json({
      status: 'error',
      error: error.message
    });
  }
});

// 데이터베이스 연결 테스트
async function testDatabaseConnection() {
  try {
    // 간단한 쿼리로 DB 연결 테스트
    const userCount = await User.count();
    return {
      status: 'connected',
      userCount: userCount,
      lastChecked: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      lastChecked: new Date().toISOString()
    };
  }
}

// 기본 시스템 메트릭 수집
async function collectSystemMetrics() {
  try {
    const [
      userCount,
      campaignCount,
      postCount,
      purchaseRequestCount
    ] = await Promise.all([
      User.count(),
      Campaign.count(),
      Post.count(),
      PurchaseRequest.count()
    ]);

    return {
      users: userCount,
      campaigns: campaignCount,
      posts: postCount,
      purchaseRequests: purchaseRequestCount,
      memory: {
        used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
      }
    };
  } catch (error) {
    logger.logError(error, { function: 'collectSystemMetrics' });
    return {
      error: 'Failed to collect metrics'
    };
  }
}

// 상세 메트릭 수집
async function collectDetailedMetrics() {
  try {
    const now = new Date();
    const last24Hours = new Date(now - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const [
      recentUsers,
      recentCampaigns,
      recentPosts,
      recentPurchaseRequests,
      activeUsers,
      companies
    ] = await Promise.all([
      User.count({
        where: {
          createdAt: { [Op.gte]: last24Hours }
        }
      }),
      Campaign.count({
        where: {
          createdAt: { [Op.gte]: last7Days }
        }
      }),
      Post.count({
        where: {
          createdAt: { [Op.gte]: last7Days }
        }
      }),
      PurchaseRequest.count({
        where: {
          createdAt: { [Op.gte]: last7Days }
        }
      }),
      User.count({
        where: {
          isActive: true
        }
      }),
      User.findAll({
        attributes: ['company'],
        group: ['company'],
        raw: true
      })
    ]);

    return {
      activity: {
        newUsersLast24h: recentUsers,
        newCampaignsLast7d: recentCampaigns,
        newPostsLast7d: recentPosts,
        newPurchaseRequestsLast7d: recentPurchaseRequests
      },
      users: {
        total: await User.count(),
        active: activeUsers,
        companies: companies.length
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        uptime: `${Math.floor(process.uptime())}s`,
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      }
    };
  } catch (error) {
    logger.logError(error, { function: 'collectDetailedMetrics' });
    return {
      error: 'Failed to collect detailed metrics'
    };
  }
}

export default router;