/**
 * BrandFlow Logging System
 * 구조화된 로깅 및 모니터링 시스템
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs';

class Logger {
  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.ensureLogDirectory();
    this.logger = this.createLogger();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  createLogger() {
    const logFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );

    return winston.createLogger({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      format: logFormat,
      defaultMeta: { service: 'brandflow-backend' },
      transports: [
        // 에러 로그 (별도 파일)
        new winston.transports.File({
          filename: path.join(this.logDir, 'error.log'),
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 10
        }),

        // 모든 로그
        new winston.transports.File({
          filename: path.join(this.logDir, 'combined.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 10
        }),

        // 개발 환경에서는 콘솔에도 출력
        ...(process.env.NODE_ENV !== 'production' ? [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.simple()
            )
          })
        ] : [])
      ]
    });
  }

  // 사용자 액션 로깅
  logUserAction(userId, action, resource, metadata = {}) {
    this.logger.info('User Action', {
      userId,
      action,
      resource,
      metadata,
      timestamp: new Date().toISOString(),
      type: 'user_action'
    });
  }

  // API 요청 로깅
  logAPIRequest(req, res, duration) {
    this.logger.info('API Request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id,
      type: 'api_request'
    });
  }

  // 보안 이벤트 로깅
  logSecurityEvent(event, userId, ip, metadata = {}) {
    this.logger.warn('Security Event', {
      event,
      userId,
      ip,
      metadata,
      timestamp: new Date().toISOString(),
      type: 'security_event'
    });
  }

  // 성능 메트릭 로깅
  logPerformance(operation, duration, metadata = {}) {
    this.logger.info('Performance Metric', {
      operation,
      duration: `${duration}ms`,
      metadata,
      timestamp: new Date().toISOString(),
      type: 'performance'
    });
  }

  // 에러 로깅
  logError(error, context = {}) {
    this.logger.error('Application Error', {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      type: 'error'
    });
  }

  // 비즈니스 이벤트 로깅
  logBusinessEvent(event, data) {
    this.logger.info('Business Event', {
      event,
      data,
      timestamp: new Date().toISOString(),
      type: 'business_event'
    });
  }

  // 시스템 상태 로깅
  logSystemHealth(metrics) {
    this.logger.info('System Health', {
      ...metrics,
      timestamp: new Date().toISOString(),
      type: 'system_health'
    });
  }
}

// 글로벌 로거 인스턴스
const logger = new Logger();

// 미들웨어 함수들
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.logAPIRequest(req, res, duration);
  });
  
  next();
};

export const errorLogger = (error, req, res, next) => {
  logger.logError(error, {
    method: req.method,
    url: req.url,
    userId: req.user?.id,
    ip: req.ip
  });
  
  next(error);
};

export default logger;