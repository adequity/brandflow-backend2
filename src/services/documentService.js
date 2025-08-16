// src/services/documentService.js
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

class DocumentService {
  constructor() {
    this.browser = null;
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
    return this.browser;
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  // 거래명세서 HTML 템플릿
  generateTransactionDetailHTML(purchaseRequest, approver, requester) {
    const formatAmount = (amount) => {
      return new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'KRW'
      }).format(amount);
    };

    const formatDate = (date) => {
      return new Date(date).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    };

    return `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>거래명세서</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: 'Noto Sans KR', Arial, sans-serif; 
                font-size: 14px; 
                line-height: 1.6; 
                color: #333;
                background: white;
                padding: 40px;
            }
            .document { 
                max-width: 800px; 
                margin: 0 auto; 
                background: white;
                border: 2px solid #e5e7eb;
                border-radius: 8px;
                overflow: hidden;
            }
            .header { 
                background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); 
                color: white; 
                padding: 30px; 
                text-align: center; 
            }
            .header h1 { 
                font-size: 28px; 
                font-weight: bold; 
                margin-bottom: 8px; 
            }
            .header p { 
                font-size: 16px; 
                opacity: 0.9; 
            }
            .content { 
                padding: 40px; 
            }
            .section { 
                margin-bottom: 30px; 
            }
            .section-title { 
                font-size: 18px; 
                font-weight: bold; 
                color: #1f2937; 
                margin-bottom: 15px; 
                padding-bottom: 8px; 
                border-bottom: 2px solid #e5e7eb; 
            }
            .info-grid { 
                display: grid; 
                grid-template-columns: 1fr 1fr; 
                gap: 20px; 
                margin-bottom: 20px; 
            }
            .info-item { 
                padding: 15px; 
                background: #f9fafb; 
                border-radius: 6px; 
                border-left: 4px solid #3b82f6; 
            }
            .info-label { 
                font-weight: bold; 
                color: #6b7280; 
                font-size: 12px; 
                text-transform: uppercase; 
                margin-bottom: 5px; 
            }
            .info-value { 
                font-size: 16px; 
                color: #1f2937; 
                font-weight: 600; 
            }
            .amount-section { 
                background: #fef3c7; 
                border: 2px solid #f59e0b; 
                border-radius: 8px; 
                padding: 25px; 
                text-align: center; 
                margin: 30px 0; 
            }
            .amount-label { 
                font-size: 14px; 
                color: #92400e; 
                margin-bottom: 8px; 
            }
            .amount-value { 
                font-size: 32px; 
                font-weight: bold; 
                color: #92400e; 
            }
            .description-box { 
                background: #f3f4f6; 
                border-radius: 6px; 
                padding: 20px; 
                margin: 20px 0; 
            }
            .status-badge { 
                display: inline-block; 
                padding: 8px 16px; 
                border-radius: 20px; 
                font-size: 12px; 
                font-weight: bold; 
                text-transform: uppercase; 
            }
            .status-approved { 
                background: #d1fae5; 
                color: #065f46; 
            }
            .footer { 
                margin-top: 40px; 
                padding-top: 20px; 
                border-top: 1px solid #e5e7eb; 
                text-align: center; 
                color: #6b7280; 
                font-size: 12px; 
            }
            .brand-logo { 
                font-size: 20px; 
                font-weight: bold; 
                color: white; 
                margin-bottom: 5px; 
            }
        </style>
    </head>
    <body>
        <div class="document">
            <div class="header">
                <div class="brand-logo">🚀 BrandFlow</div>
                <h1>거래명세서</h1>
                <p>Transaction Details</p>
            </div>
            
            <div class="content">
                <!-- 기본 정보 -->
                <div class="section">
                    <div class="section-title">📋 요청 정보</div>
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">요청 번호</div>
                            <div class="info-value">#PR-${purchaseRequest.id.toString().padStart(4, '0')}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">요청일</div>
                            <div class="info-value">${formatDate(purchaseRequest.requestedDate)}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">상태</div>
                            <div class="info-value">
                                <span class="status-badge status-approved">${purchaseRequest.status}</span>
                            </div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">리소스 종류</div>
                            <div class="info-value">${purchaseRequest.resourceType}</div>
                        </div>
                    </div>
                </div>

                <!-- 담당자 정보 -->
                <div class="section">
                    <div class="section-title">👥 담당자 정보</div>
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">요청자</div>
                            <div class="info-value">${requester.name}</div>
                            <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">${requester.email}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">승인자</div>
                            <div class="info-value">${approver?.name || '대기중'}</div>
                            <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">${approver?.email || ''}</div>
                        </div>
                    </div>
                </div>

                <!-- 금액 정보 -->
                <div class="amount-section">
                    <div class="amount-label">💰 승인 금액</div>
                    <div class="amount-value">${formatAmount(purchaseRequest.amount)}</div>
                </div>

                <!-- 요청 내용 -->
                <div class="section">
                    <div class="section-title">📝 요청 내용</div>
                    <div class="info-item" style="width: 100%;">
                        <div class="info-label">제목</div>
                        <div class="info-value">${purchaseRequest.title}</div>
                    </div>
                    ${purchaseRequest.description ? `
                    <div class="description-box">
                        <div class="info-label">상세 설명</div>
                        <div style="margin-top: 8px; white-space: pre-line;">${purchaseRequest.description}</div>
                    </div>
                    ` : ''}
                </div>

                <!-- 캠페인 정보 -->
                ${purchaseRequest.campaign ? `
                <div class="section">
                    <div class="section-title">🎯 연관 캠페인</div>
                    <div class="info-item" style="width: 100%;">
                        <div class="info-label">캠페인명</div>
                        <div class="info-value">${purchaseRequest.campaign.name}</div>
                    </div>
                </div>
                ` : ''}

                <!-- 승인 코멘트 -->
                ${purchaseRequest.approverComment ? `
                <div class="section">
                    <div class="section-title">💬 승인자 코멘트</div>
                    <div class="description-box">
                        <div style="white-space: pre-line;">${purchaseRequest.approverComment}</div>
                    </div>
                </div>
                ` : ''}
            </div>

            <div class="footer">
                <p>본 문서는 BrandFlow 시스템에서 자동 생성되었습니다.</p>
                <p>생성일시: ${new Date().toLocaleString('ko-KR')}</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  // 견적서 HTML 템플릿
  generateQuoteHTML(purchaseRequest, approver, requester, marginRate = 0.15) {
    const formatAmount = (amount) => {
      return new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'KRW'
      }).format(amount);
    };

    const formatDate = (date) => {
      return new Date(date).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    };

    const baseAmount = parseFloat(purchaseRequest.amount);
    const marginAmount = baseAmount * marginRate;
    const totalAmount = baseAmount + marginAmount;
    const vatAmount = totalAmount * 0.1;
    const finalAmount = totalAmount + vatAmount;

    return `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>견적서</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: 'Noto Sans KR', Arial, sans-serif; 
                font-size: 14px; 
                line-height: 1.6; 
                color: #333;
                background: white;
                padding: 40px;
            }
            .document { 
                max-width: 800px; 
                margin: 0 auto; 
                background: white;
                border: 2px solid #e5e7eb;
                border-radius: 8px;
                overflow: hidden;
            }
            .header { 
                background: linear-gradient(135deg, #10b981 0%, #047857 100%); 
                color: white; 
                padding: 30px; 
                text-align: center; 
            }
            .header h1 { 
                font-size: 28px; 
                font-weight: bold; 
                margin-bottom: 8px; 
            }
            .header p { 
                font-size: 16px; 
                opacity: 0.9; 
            }
            .content { 
                padding: 40px; 
            }
            .section { 
                margin-bottom: 30px; 
            }
            .section-title { 
                font-size: 18px; 
                font-weight: bold; 
                color: #1f2937; 
                margin-bottom: 15px; 
                padding-bottom: 8px; 
                border-bottom: 2px solid #e5e7eb; 
            }
            .quote-table { 
                width: 100%; 
                border-collapse: collapse; 
                margin: 20px 0; 
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                overflow: hidden;
            }
            .quote-table th { 
                background: #f9fafb; 
                padding: 15px; 
                text-align: left; 
                font-weight: bold; 
                border-bottom: 1px solid #e5e7eb; 
            }
            .quote-table td { 
                padding: 15px; 
                border-bottom: 1px solid #f3f4f6; 
            }
            .quote-table tr:last-child td { 
                border-bottom: none; 
            }
            .amount-right { 
                text-align: right; 
                font-weight: 600; 
            }
            .total-row { 
                background: #fef3c7; 
                font-weight: bold; 
            }
            .final-total { 
                background: #10b981; 
                color: white; 
                font-size: 18px; 
                font-weight: bold; 
            }
            .info-grid { 
                display: grid; 
                grid-template-columns: 1fr 1fr; 
                gap: 20px; 
                margin-bottom: 20px; 
            }
            .info-item { 
                padding: 15px; 
                background: #f9fafb; 
                border-radius: 6px; 
                border-left: 4px solid #10b981; 
            }
            .info-label { 
                font-weight: bold; 
                color: #6b7280; 
                font-size: 12px; 
                text-transform: uppercase; 
                margin-bottom: 5px; 
            }
            .info-value { 
                font-size: 16px; 
                color: #1f2937; 
                font-weight: 600; 
            }
            .footer { 
                margin-top: 40px; 
                padding-top: 20px; 
                border-top: 1px solid #e5e7eb; 
                text-align: center; 
                color: #6b7280; 
                font-size: 12px; 
            }
            .brand-logo { 
                font-size: 20px; 
                font-weight: bold; 
                color: white; 
                margin-bottom: 5px; 
            }
            .note-box { 
                background: #eff6ff; 
                border: 1px solid #93c5fd; 
                border-radius: 6px; 
                padding: 15px; 
                margin: 20px 0; 
                font-size: 13px; 
                color: #1e40af; 
            }
        </style>
    </head>
    <body>
        <div class="document">
            <div class="header">
                <div class="brand-logo">🚀 BrandFlow</div>
                <h1>견적서</h1>
                <p>Quotation</p>
            </div>
            
            <div class="content">
                <!-- 기본 정보 -->
                <div class="section">
                    <div class="section-title">📋 견적 정보</div>
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">견적 번호</div>
                            <div class="info-value">#QT-${purchaseRequest.id.toString().padStart(4, '0')}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">견적일</div>
                            <div class="info-value">${formatDate(new Date())}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">유효기간</div>
                            <div class="info-value">견적일로부터 30일</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">담당자</div>
                            <div class="info-value">${approver?.name || requester.name}</div>
                        </div>
                    </div>
                </div>

                <!-- 견적 내역 -->
                <div class="section">
                    <div class="section-title">💰 견적 내역</div>
                    
                    <table class="quote-table">
                        <thead>
                            <tr>
                                <th style="width: 50%;">항목</th>
                                <th style="width: 20%;">분류</th>
                                <th style="width: 30%;">금액</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>
                                    <strong>${purchaseRequest.title}</strong>
                                    ${purchaseRequest.description ? `<br><small style="color: #6b7280;">${purchaseRequest.description.substring(0, 100)}${purchaseRequest.description.length > 100 ? '...' : ''}</small>` : ''}
                                </td>
                                <td>${purchaseRequest.resourceType}</td>
                                <td class="amount-right">${formatAmount(baseAmount)}</td>
                            </tr>
                            <tr>
                                <td>대행 수수료 (${(marginRate * 100).toFixed(0)}%)</td>
                                <td>서비스</td>
                                <td class="amount-right">${formatAmount(marginAmount)}</td>
                            </tr>
                            <tr class="total-row">
                                <td colspan="2"><strong>소계</strong></td>
                                <td class="amount-right"><strong>${formatAmount(totalAmount)}</strong></td>
                            </tr>
                            <tr>
                                <td colspan="2">부가가치세 (10%)</td>
                                <td class="amount-right">${formatAmount(vatAmount)}</td>
                            </tr>
                            <tr class="final-total">
                                <td colspan="2"><strong>총 금액</strong></td>
                                <td class="amount-right"><strong>${formatAmount(finalAmount)}</strong></td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- 캠페인 정보 -->
                ${purchaseRequest.campaign ? `
                <div class="section">
                    <div class="section-title">🎯 프로젝트 정보</div>
                    <div class="info-item" style="width: 100%;">
                        <div class="info-label">프로젝트명</div>
                        <div class="info-value">${purchaseRequest.campaign.name}</div>
                    </div>
                </div>
                ` : ''}

                <!-- 결제 조건 -->
                <div class="section">
                    <div class="section-title">📄 결제 조건</div>
                    <div class="note-box">
                        <strong>결제 조건:</strong> 선금 50%, 완료 후 50%<br>
                        <strong>결제 방법:</strong> 계좌이체 또는 세금계산서<br>
                        <strong>작업 기간:</strong> 계약 후 ${purchaseRequest.dueDate ? `${formatDate(purchaseRequest.dueDate)}까지` : '협의'}<br>
                        <strong>기타:</strong> 본 견적에는 부가가치세가 포함되어 있습니다.
                    </div>
                </div>
            </div>

            <div class="footer">
                <p>본 견적서는 BrandFlow 시스템에서 자동 생성되었습니다.</p>
                <p>생성일시: ${new Date().toLocaleString('ko-KR')}</p>
                <p style="margin-top: 10px; font-weight: bold;">문의사항이 있으시면 담당자에게 연락 바랍니다.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  // PDF와 JPG 동시 생성
  async generateDocuments(purchaseRequest, requester, approver, type = 'transaction') {
    const browser = await this.initBrowser();
    const page = await browser.newPage();

    try {
      // HTML 콘텐츠 생성
      const htmlContent = type === 'quote' 
        ? this.generateQuoteHTML(purchaseRequest, approver, requester)
        : this.generateTransactionDetailHTML(purchaseRequest, approver, requester);

      // 페이지 설정
      await page.setContent(htmlContent, { 
        waitUntil: 'networkidle0',
        timeout: 30000 
      });

      await page.setViewport({ 
        width: 1200, 
        height: 1600, 
        deviceScaleFactor: 2 
      });

      // 파일명 생성
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
      const docType = type === 'quote' ? 'quote' : 'transaction';
      const filename = `${docType}_${purchaseRequest.id}_${timestamp}`;

      // 임시 디렉토리 생성
      const tempDir = path.join(process.cwd(), 'temp');
      try {
        await fs.access(tempDir);
      } catch {
        await fs.mkdir(tempDir, { recursive: true });
      }

      // PDF 생성
      const pdfPath = path.join(tempDir, `${filename}.pdf`);
      await page.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      });

      // JPG 생성 (고해상도)
      const jpgPath = path.join(tempDir, `${filename}.jpg`);
      const screenshot = await page.screenshot({
        type: 'jpeg',
        quality: 90,
        fullPage: true
      });

      // Sharp를 사용해 고품질 JPG 생성
      await sharp(screenshot)
        .jpeg({ quality: 95, progressive: true })
        .toFile(jpgPath);

      return {
        pdf: pdfPath,
        jpg: jpgPath,
        filename: filename
      };

    } finally {
      await page.close();
    }
  }

  // 파일 정리
  async cleanupFiles(filePaths) {
    for (const filePath of filePaths) {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.warn(`파일 삭제 실패: ${filePath}`, error);
      }
    }
  }
}

export default new DocumentService();