// Simple test server to verify the Korean character fix
import express from 'express';
import cors from 'cors';

const app = express();

// Enable CORS for all routes
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Health check endpoint for Render
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'brandflow-backend' 
  });
});

// Test POST endpoint for user creation
app.post('/api/users', (req, res) => {
  const rawViewerId = req.query.viewerId || req.query.adminId;
  const rawViewerRole = req.query.viewerRole || req.query.adminRole || '';
  
  console.log('POST /api/users - Raw params:', {
    rawViewerId,
    rawViewerRole
  });
  
  const viewerId = Number(Array.isArray(rawViewerId) ? rawViewerId[0] : rawViewerId);
  // URL 디코딩 추가
  const viewerRole = decodeURIComponent(String(Array.isArray(rawViewerRole) ? rawViewerRole[0] : rawViewerRole)).trim();
  
  console.log('POST /api/users - Parsed params:', { viewerId, viewerRole });
  console.log('POST /api/users - ViewerRole comparison:');
  console.log('  Received viewerRole:', JSON.stringify(viewerRole));
  console.log('  Expected "슈퍼 어드민":', JSON.stringify('슈퍼 어드민'));
  console.log('  Expected "대행사 어드민":', JSON.stringify('대행사 어드민'));
  console.log('  Match super admin:', viewerRole === '슈퍼 어드민');
  console.log('  Match agency admin:', viewerRole === '대행사 어드민');
  
  // 권한 확인: 슈퍼 어드민 또는 대행사 어드민만 사용자 생성 가능
  // Korean characters sometimes have encoding issues, so check multiple variations
  const isSuperAdmin = viewerRole === '슈퍼 어드민' || 
                      viewerRole === '슈퍼어드민' ||
                      viewerRole.includes('슈퍼') && viewerRole.includes('어드민');
  const isAgencyAdmin = viewerRole === '대행사 어드민' ||
                       viewerRole === '대행사어드민' ||
                       viewerRole.includes('대행사') && viewerRole.includes('어드민');
  
  console.log('isSuperAdmin:', isSuperAdmin);
  console.log('isAgencyAdmin:', isAgencyAdmin);
  
  if (!isSuperAdmin && !isAgencyAdmin) {
    console.log('POST /api/users - Permission denied for viewerRole:', JSON.stringify(viewerRole));
    return res.status(403).json({ message: '권한이 없습니다. 관리자만 사용자를 생성할 수 있습니다.' });
  }
  
  console.log('POST /api/users - Permission granted! Creating user...');
  
  // 새 사용자 ID 생성
  const newUserId = mockUsers.length > 0 ? Math.max(...mockUsers.map(u => u.id)) + 1 : 2;
  
  // 새 사용자 객체 생성
  const newUser = {
    id: newUserId,
    name: req.body.name,
    email: req.body.email,
    role: req.body.role,
    company: req.body.company,
    incentiveRate: req.body.incentiveRate || 0
  };
  
  // mockUsers 배열에 추가
  mockUsers.push(newUser);
  
  // 로그인 자격 증명에도 추가 (기본 비밀번호 사용)
  const defaultPassword = req.body.password || '1234';
  loginCredentials.push({
    email: req.body.email,
    password: defaultPassword,
    userData: newUser
  });
  
  console.log('POST /api/users - User created successfully:', newUser);
  console.log('POST /api/users - Total users:', mockUsers.length);
  
  res.status(201).json({
    ...newUser,
    message: '사용자가 성공적으로 생성되었습니다!'
  });
});

// PUT /api/users/:id - 사용자 정보 수정
app.put('/api/users/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  
  console.log(`PUT /api/users/${userId} - 사용자 수정 요청:`, req.body);
  
  // 사용자 찾기
  const userIndex = mockUsers.findIndex(u => u.id === userId);
  if (userIndex === -1) {
    console.log(`PUT /api/users/${userId} - 사용자를 찾을 수 없음`);
    return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
  }
  
  const existingUser = mockUsers[userIndex];
  
  // 사용자 정보 업데이트 (비밀번호가 비어있으면 기존 비밀번호 유지)
  const updatedUser = {
    ...existingUser,
    name: req.body.name || existingUser.name,
    email: req.body.email || existingUser.email,
    role: req.body.role || existingUser.role,
    company: req.body.company || existingUser.company,
    contact: req.body.contact || existingUser.contact,
    incentiveRate: req.body.incentiveRate !== undefined ? req.body.incentiveRate : existingUser.incentiveRate
  };
  
  // mockUsers 배열 업데이트
  mockUsers[userIndex] = updatedUser;
  
  // 로그인 자격증명도 업데이트 (이메일이 변경된 경우)
  if (req.body.email && req.body.email !== existingUser.email) {
    const credentialIndex = loginCredentials.findIndex(c => c.userData.id === userId);
    if (credentialIndex !== -1) {
      loginCredentials[credentialIndex].email = req.body.email;
      loginCredentials[credentialIndex].userData = updatedUser;
    }
  }
  
  // 비밀번호가 제공된 경우 업데이트
  if (req.body.password && req.body.password.trim() !== '') {
    const credentialIndex = loginCredentials.findIndex(c => c.userData.id === userId);
    if (credentialIndex !== -1) {
      loginCredentials[credentialIndex].password = req.body.password;
    }
  }
  
  console.log(`PUT /api/users/${userId} - 사용자 수정 성공:`, updatedUser);
  
  res.json({
    ...updatedUser,
    message: '사용자 정보가 성공적으로 수정되었습니다!'
  });
});

// Mock users data for testing
const mockUsers = [
  { id: 1, name: '슈퍼 관리자', email: 'admin@test.com', role: '슈퍼 어드민', company: null, incentiveRate: 0 }
];

// Mock campaigns data
const mockCampaigns = [];

// Mock user credentials for login
const loginCredentials = [
  { email: 'admin@test.com', password: 'admin123', userData: mockUsers[0] }
];

// Mock purchase requests data
const mockPurchaseRequests = [];

// POST /api/auth/login - 로그인 엔드포인트
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  console.log('POST /api/auth/login - Login attempt:', { email, password });
  
  if (!email || !password) {
    return res.status(400).json({ message: '이메일과 비밀번호를 입력해주세요.' });
  }
  
  // 사용자 자격 증명 확인
  const user = loginCredentials.find(cred => 
    cred.email === email && cred.password === password
  );
  
  if (!user) {
    console.log('POST /api/auth/login - Login failed: Invalid credentials');
    return res.status(401).json({ message: '이메일 또는 비밀번호가 잘못되었습니다.' });
  }
  
  console.log('POST /api/auth/login - Login successful:', user.userData.name);
  
  // 로그인 성공 - 사용자 데이터 반환
  res.status(200).json({
    ...user.userData,
    message: '로그인 성공'
  });
});

// GET /api/users - 사용자 목록 조회
app.get('/api/users', (req, res) => {
  const rawViewerId = req.query.viewerId || req.query.adminId;
  const rawViewerRole = req.query.viewerRole || req.query.adminRole || '';
  
  console.log('GET /api/users - Raw params:', { rawViewerId, rawViewerRole });
  
  const viewerId = Number(Array.isArray(rawViewerId) ? rawViewerId[0] : rawViewerId);
  const viewerRole = decodeURIComponent(String(Array.isArray(rawViewerRole) ? rawViewerRole[0] : rawViewerRole)).trim();
  
  console.log('GET /api/users - Parsed params:', { viewerId, viewerRole });
  
  // 권한별 필터링
  let filteredUsers = [];
  if (viewerRole === '슈퍼 어드민' || viewerRole.includes('슈퍼')) {
    filteredUsers = mockUsers; // 모든 사용자
  } else if (viewerRole === '대행사 어드민' || viewerRole.includes('대행사')) {
    const viewer = mockUsers.find(u => u.id === viewerId);
    if (viewer?.company) {
      filteredUsers = mockUsers.filter(u => u.company === viewer.company);
    }
  } else if (viewerRole === '클라이언트') {
    filteredUsers = mockUsers.filter(u => u.id === viewerId);
  }
  
  console.log(`GET /api/users - 반환할 사용자 ${filteredUsers.length}명`);
  res.json(filteredUsers);
});

// GET /api/users/clients - 클라이언트 목록 조회
app.get('/api/users/clients', (req, res) => {
  const rawViewerId = req.query.viewerId || req.query.adminId;
  const rawViewerRole = req.query.viewerRole || req.query.adminRole || '';
  
  const viewerId = Number(Array.isArray(rawViewerId) ? rawViewerId[0] : rawViewerId);
  const viewerRole = decodeURIComponent(String(Array.isArray(rawViewerRole) ? rawViewerRole[0] : rawViewerRole)).trim();
  
  console.log('GET /api/users/clients - Parsed params:', { viewerId, viewerRole });
  
  let clients = mockUsers.filter(u => u.role === '클라이언트');
  
  if (viewerRole === '대행사 어드민' || viewerRole.includes('대행사')) {
    const viewer = mockUsers.find(u => u.id === viewerId);
    if (viewer?.company) {
      clients = clients.filter(c => c.company === viewer.company);
    }
  } else if (viewerRole === '클라이언트') {
    clients = clients.filter(c => c.id === viewerId);
  }
  
  console.log(`GET /api/users/clients - 반환할 클라이언트 ${clients.length}명`);
  res.json(clients);
});

// 캠페인별 등록된 업무(posts) 데이터 저장소
const campaignPosts = {
  1: [], // 신제품 론칭 캠페인
  2: []  // 브랜드 리뉴얼 캠페인
};

// GET /api/campaigns/:id/posts - 캠페인별 업무 목록 조회
app.get('/api/campaigns/:id/posts', (req, res) => {
  const campaignId = parseInt(req.params.id);
  console.log(`GET /api/campaigns/${campaignId}/posts - 캠페인 업무 목록 조회`);
  
  const posts = campaignPosts[campaignId] || [];
  console.log(`캠페인 ${campaignId} 업무 ${posts.length}개 반환`);
  
  res.json({ posts, total: posts.length });
});

// GET /api/campaigns/:id/financial_summary - 캠페인별 재무 요약
app.get('/api/campaigns/:id/financial_summary', (req, res) => {
  const campaignId = parseInt(req.params.id);
  console.log(`GET /api/campaigns/${campaignId}/financial_summary - 캠페인 재무 요약 조회`);
  
  const posts = campaignPosts[campaignId] || [];
  let totalRevenue = 0;
  let totalCost = 0;
  let completedTasks = 0;
  
  // 상품 연결된 업무들의 매출 계산
  posts.forEach(post => {
    if (post.productId) {
      const product = mockProducts.find(p => p.id === post.productId);
      if (product) {
        // sellingPrice/costPrice가 없으면 price 사용, costPrice는 price의 70%로 가정
        const sellingPrice = product.sellingPrice || product.price || 0;
        const costPrice = product.costPrice || (product.price ? product.price * 0.7 : 0);
        
        const revenue = sellingPrice * (post.quantity || 1);
        const cost = costPrice * (post.quantity || 1);
        totalRevenue += revenue;
        totalCost += cost;
        console.log(`업무: ${post.title}, 상품: ${product.name}, 매출: ${revenue.toLocaleString()}원, 원가: ${cost.toLocaleString()}원`);
      }
    }
    if (post.topicStatus === '승인' || post.topicStatus === '완료') {
      completedTasks++;
    }
  });
  
  const profit = totalRevenue - totalCost;
  
  const summary = {
    total_revenue: totalRevenue,
    total_cost: totalCost,
    profit,
    completed_tasks: completedTasks,
    total_tasks: posts.length,
    completion_rate: posts.length > 0 ? Math.round((completedTasks / posts.length) * 100) : 0
  };
  
  console.log(`캠페인 ${campaignId} 재무 요약:`, summary);
  res.json(summary);
});

// GET /api/campaigns - 캠페인 목록 조회
app.get('/api/campaigns', (req, res) => {
  const rawViewerId = req.query.viewerId || req.query.adminId;
  const rawViewerRole = req.query.viewerRole || req.query.adminRole || '';
  
  const viewerId = Number(Array.isArray(rawViewerId) ? rawViewerId[0] : rawViewerId);
  const viewerRole = decodeURIComponent(String(Array.isArray(rawViewerRole) ? rawViewerRole[0] : rawViewerRole)).trim();
  
  console.log('GET /api/campaigns - Parsed params:', { viewerId, viewerRole });
  
  // 권한별 필터링
  let filteredCampaigns = [];
  if (viewerRole === '슈퍼 어드민' || viewerRole.includes('슈퍼')) {
    filteredCampaigns = mockCampaigns; // 모든 캠페인
  } else if (viewerRole === '대행사 어드민' || viewerRole.includes('대행사')) {
    // 같은 회사 소속 캠페인만
    const viewer = mockUsers.find(u => u.id === viewerId);
    if (viewer?.company) {
      filteredCampaigns = mockCampaigns.filter(c => {
        const client = mockUsers.find(u => u.id === c.userId);
        return client?.company === viewer.company;
      });
    }
  } else if (viewerRole === '클라이언트') {
    filteredCampaigns = mockCampaigns.filter(c => c.userId === viewerId);
  }
  
  console.log(`GET /api/campaigns - 반환할 캠페인 ${filteredCampaigns.length}개`);
  res.json(filteredCampaigns);
});

// POST /api/campaigns - 새 캠페인 생성
app.post('/api/campaigns', (req, res) => {
  const rawViewerId = req.query.viewerId || req.query.adminId;
  const rawViewerRole = req.query.viewerRole || req.query.adminRole || '';
  
  const viewerId = Number(Array.isArray(rawViewerId) ? rawViewerId[0] : rawViewerId);
  const viewerRole = decodeURIComponent(String(Array.isArray(rawViewerRole) ? rawViewerRole[0] : rawViewerRole)).trim();
  
  console.log('POST /api/campaigns - Parsed params:', { viewerId, viewerRole });
  console.log('POST /api/campaigns - Request body:', req.body);
  
  // 권한 확인
  const isAdmin = viewerRole === '슈퍼 어드민' || viewerRole.includes('슈퍼') || 
                  viewerRole === '대행사 어드민' || viewerRole.includes('대행사');
  
  if (!isAdmin) {
    return res.status(403).json({ message: '권한이 없습니다. 관리자만 캠페인을 생성할 수 있습니다.' });
  }
  
  const { name, description, userId, managerId } = req.body;
  
  if (!name || !userId) {
    return res.status(400).json({ message: '필수 필드가 누락되었습니다.' });
  }
  
  // 새 캠페인 생성
  const newCampaign = {
    id: mockCampaigns.length + 1,
    name,
    description: description || '',
    userId: Number(userId),
    managerId: managerId ? Number(managerId) : viewerId,
    status: 'active',
    createdAt: new Date().toISOString()
  };
  
  mockCampaigns.push(newCampaign);
  
  console.log('POST /api/campaigns - 캠페인 생성 성공:', newCampaign);
  res.status(201).json(newCampaign);
});

// GET /api/campaigns/:id - 캠페인 상세 조회 (trailing slash 처리 함수)
const getCampaignDetail = (req, res) => {
  const rawViewerId = req.query.viewerId || req.query.adminId;
  const rawViewerRole = req.query.viewerRole || req.query.adminRole || '';
  
  const viewerId = Number(Array.isArray(rawViewerId) ? rawViewerId[0] : rawViewerId);
  const viewerRole = decodeURIComponent(String(Array.isArray(rawViewerRole) ? rawViewerRole[0] : rawViewerRole)).trim();
  const campaignId = Number(req.params.id);
  
  console.log(`GET /api/campaigns/${campaignId} - Parsed params:`, { viewerId, viewerRole });
  
  // 캠페인 찾기
  const campaign = mockCampaigns.find(c => c.id === campaignId);
  if (!campaign) {
    console.log(`GET /api/campaigns/${campaignId} - 캠페인을 찾을 수 없음`);
    return res.status(404).json({ message: '캠페인을 찾을 수 없습니다.' });
  }
  
  // 권한 확인
  const viewer = mockUsers.find(u => u.id === viewerId);
  if (viewerRole === '클라이언트') {
    // 클라이언트는 본인 캠페인만 조회 가능
    if (campaign.userId !== viewerId) {
      console.log(`GET /api/campaigns/${campaignId} - 클라이언트 권한 없음`);
      return res.status(403).json({ message: '이 캠페인에 접근할 권한이 없습니다.' });
    }
  } else if (viewerRole === '대행사 어드민' || viewerRole === '직원') {
    // 대행사 어드민/직원은 같은 회사 캠페인만 조회 가능
    const client = mockUsers.find(u => u.id === campaign.userId);
    if (!viewer?.company || client?.company !== viewer.company) {
      console.log(`GET /api/campaigns/${campaignId} - 대행사 권한 없음`);
      return res.status(403).json({ message: '이 캠페인에 접근할 권한이 없습니다.' });
    }
  }
  
  // 담당자 정보 추가
  const manager = mockUsers.find(u => u.id === campaign.managerId);
  const client = mockUsers.find(u => u.id === campaign.userId);
  
  const campaignDetail = {
    ...campaign,
    manager: manager ? {
      id: manager.id,
      name: manager.name,
      email: manager.email,
      role: manager.role
    } : null,
    client: client ? {
      id: client.id,
      name: client.name,
      email: client.email,
      company: client.company
    } : null,
    posts: [] // 업무 목록은 추후 구현
  };
  
  console.log(`GET /api/campaigns/${campaignId} - 캠페인 상세 반환 성공`);
  res.json(campaignDetail);
};

// GET /api/campaigns/:id - 캠페인 상세 조회 (trailing slash 없음)
app.get('/api/campaigns/:id', getCampaignDetail);

// GET /api/campaigns/:id/ - 캠페인 상세 조회 (trailing slash 있음)
app.get('/api/campaigns/:id/', getCampaignDetail);

// PUT /api/campaigns/:id - 캠페인 수정
app.put('/api/campaigns/:id', (req, res) => {
  const rawViewerId = req.query.viewerId || req.query.adminId;
  const rawViewerRole = req.query.viewerRole || req.query.adminRole || '';
  
  const viewerId = Number(Array.isArray(rawViewerId) ? rawViewerId[0] : rawViewerId);
  const viewerRole = decodeURIComponent(String(Array.isArray(rawViewerRole) ? rawViewerRole[0] : rawViewerRole)).trim();
  const campaignId = Number(req.params.id);
  
  console.log(`PUT /api/campaigns/${campaignId} - 캠페인 수정 요청:`, { viewerId, viewerRole });
  console.log(`PUT /api/campaigns/${campaignId} - 요청 데이터:`, req.body);
  
  // 캠페인 찾기
  const campaignIndex = mockCampaigns.findIndex(c => c.id === campaignId);
  if (campaignIndex === -1) {
    console.log(`PUT /api/campaigns/${campaignId} - 캠페인을 찾을 수 없음`);
    return res.status(404).json({ message: '캠페인을 찾을 수 없습니다.' });
  }
  
  const campaign = mockCampaigns[campaignIndex];
  
  // 권한 확인
  const viewer = mockUsers.find(u => u.id === viewerId);
  if (viewerRole === '클라이언트') {
    // 클라이언트는 본인 캠페인만 수정 가능
    if (campaign.userId !== viewerId) {
      console.log(`PUT /api/campaigns/${campaignId} - 클라이언트 권한 없음`);
      return res.status(403).json({ message: '이 캠페인을 수정할 권한이 없습니다.' });
    }
  } else if (viewerRole === '대행사 어드민' || viewerRole === '직원') {
    // 대행사 어드민/직원은 같은 회사 캠페인만 수정 가능
    const client = mockUsers.find(u => u.id === campaign.userId);
    if (!viewer?.company || client?.company !== viewer.company) {
      console.log(`PUT /api/campaigns/${campaignId} - 대행사 권한 없음`);
      return res.status(403).json({ message: '이 캠페인을 수정할 권한이 없습니다.' });
    }
  }
  
  // 캠페인 정보 업데이트
  const updatedCampaign = {
    ...campaign,
    ...req.body,
    id: campaignId, // ID는 변경 불가
    userId: campaign.userId, // 클라이언트 ID는 변경 불가
    updatedAt: new Date().toISOString(),
    updatedBy: viewerId
  };
  
  // mockCampaigns 배열에서 업데이트
  mockCampaigns[campaignIndex] = updatedCampaign;
  
  console.log(`PUT /api/campaigns/${campaignId} - 캠페인 수정 성공:`, updatedCampaign.name);
  res.json(updatedCampaign);
});

// 대행사별 로고 저장소 (실제로는 데이터베이스 사용)
const companyLogos = new Map();

// GET /api/company/logo - 회사 로고 조회 (대행사별)
app.get('/api/company/logo', (req, res) => {
  const rawViewerId = req.query.viewerId || req.query.adminId;
  const rawViewerRole = req.query.viewerRole || req.query.adminRole || '';
  
  const viewerId = Number(Array.isArray(rawViewerId) ? rawViewerId[0] : rawViewerId);
  const viewerRole = decodeURIComponent(String(Array.isArray(rawViewerRole) ? rawViewerRole[0] : rawViewerRole)).trim();
  
  console.log('GET /api/company/logo - Parsed params:', { viewerId, viewerRole });
  
  // 사용자의 회사 정보 찾기
  const user = mockUsers.find(u => u.id === viewerId);
  const companyName = user?.company || 'default';
  
  // 해당 회사의 로고 데이터 조회
  const logoData = companyLogos.get(companyName) || {
    id: 1,
    logoUrl: null,
    uploadedAt: null,
    companyId: companyName,
    updatedBy: viewerId
  };
  
  console.log(`GET /api/company/logo - ${companyName} 회사 로고 데이터:`, logoData);
  res.json(logoData);
});

// POST /api/company/logo - 회사 로고 업로드
app.post('/api/company/logo', (req, res) => {
  const rawViewerId = req.query.viewerId || req.query.adminId;
  const rawViewerRole = req.query.viewerRole || req.query.adminRole || '';
  
  const viewerId = Number(Array.isArray(rawViewerId) ? rawViewerId[0] : rawViewerId);
  const viewerRole = decodeURIComponent(String(Array.isArray(rawViewerRole) ? rawViewerRole[0] : rawViewerRole)).trim();
  
  console.log('POST /api/company/logo - Parsed params:', { viewerId, viewerRole });
  console.log('POST /api/company/logo - Request body:', req.body);
  
  // 권한 확인: 대행사 어드민만 로고 업로드 가능
  const isAgencyAdmin = viewerRole === '대행사 어드민' || 
                       viewerRole === '대행사어드민' ||
                       viewerRole.includes('대행사') && viewerRole.includes('어드민');
  
  if (!isAgencyAdmin) {
    console.log('POST /api/company/logo - Permission denied for viewerRole:', JSON.stringify(viewerRole));
    return res.status(403).json({ message: '권한이 없습니다. 대행사 어드민만 로고를 업로드할 수 있습니다.' });
  }
  
  const { logoUrl } = req.body;
  
  if (!logoUrl) {
    return res.status(400).json({ message: '로고 URL이 필요합니다.' });
  }
  
  // 사용자의 회사 정보 찾기
  const user = mockUsers.find(u => u.id === viewerId);
  const companyName = user?.company || 'default';
  
  // 해당 회사의 로고 데이터 저장
  const updatedLogo = {
    id: Date.now(),
    logoUrl: logoUrl,
    uploadedAt: new Date().toISOString(),
    companyId: companyName,
    updatedBy: viewerId
  };
  
  // 대행사별 로고 저장
  companyLogos.set(companyName, updatedLogo);
  
  console.log(`POST /api/company/logo - ${companyName} 회사 로고 업로드 성공:`, updatedLogo);
  res.status(200).json(updatedLogo);
});

// DELETE /api/company/logo - 회사 로고 제거 (대행사별)
app.delete('/api/company/logo', (req, res) => {
  const rawViewerId = req.query.viewerId || req.query.adminId;
  const rawViewerRole = req.query.viewerRole || req.query.adminRole || '';
  
  const viewerId = Number(Array.isArray(rawViewerId) ? rawViewerId[0] : rawViewerId);
  const viewerRole = decodeURIComponent(String(Array.isArray(rawViewerRole) ? rawViewerRole[0] : rawViewerRole)).trim();
  
  console.log('DELETE /api/company/logo - Parsed params:', { viewerId, viewerRole });
  
  // 권한 확인: 대행사 어드민만 로고 제거 가능
  const isAgencyAdmin = viewerRole === '대행사 어드민' || 
                       viewerRole === '대행사어드민' ||
                       viewerRole.includes('대행사') && viewerRole.includes('어드민');
  
  if (!isAgencyAdmin) {
    console.log('DELETE /api/company/logo - Permission denied for viewerRole:', JSON.stringify(viewerRole));
    return res.status(403).json({ message: '권한이 없습니다. 대행사 어드민만 로고를 제거할 수 있습니다.' });
  }
  
  // 사용자의 회사 정보 찾기
  const user = mockUsers.find(u => u.id === viewerId);
  const companyName = user?.company || 'default';
  
  // 해당 회사의 로고 제거
  companyLogos.delete(companyName);
  
  console.log(`DELETE /api/company/logo - ${companyName} 회사 로고 제거 성공`);
  res.status(200).json({ message: '로고가 제거되었습니다.' });
});

// GET /api/purchase-requests - 발주 요청 목록 조회
app.get('/api/purchase-requests', (req, res) => {
  const rawViewerId = req.query.viewerId || req.query.adminId;
  const rawViewerRole = req.query.viewerRole || req.query.adminRole || '';
  
  console.log('GET /api/purchase-requests - Raw params:', { rawViewerId, rawViewerRole });
  
  const viewerId = Number(Array.isArray(rawViewerId) ? rawViewerId[0] : rawViewerId);
  const viewerRole = decodeURIComponent(String(Array.isArray(rawViewerRole) ? rawViewerRole[0] : rawViewerRole)).trim();
  
  console.log('GET /api/purchase-requests - Parsed params:', { viewerId, viewerRole });
  
  // 필터 파라미터
  const status = req.query.status;
  const resourceType = req.query.resourceType;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  
  let filteredRequests = [...mockPurchaseRequests];
  
  // 권한별 필터링
  if (viewerRole === '슈퍼 어드민') {
    // 슈퍼 어드민은 모든 발주 요청 조회 가능
    filteredRequests = mockPurchaseRequests;
  } else if (viewerRole === '대행사 어드민' || viewerRole === '직원') {
    // 대행사 어드민/직원은 소속 회사의 발주 요청만 조회 가능
    const viewer = mockUsers.find(u => u.id === viewerId);
    console.log('GET /api/purchase-requests - Viewer:', viewer);
    if (viewer) {
      filteredRequests = mockPurchaseRequests.filter(r => {
        const requester = mockUsers.find(u => u.id === r.requesterId);
        console.log('GET /api/purchase-requests - Checking request:', r.id, 'requester:', requester, 'company match:', requester?.company === viewer.company);
        return requester && requester.company === viewer.company;
      });
    }
  } else if (viewerRole === '클라이언트') {
    // 클라이언트는 자신의 발주 요청만 조회 가능
    filteredRequests = mockPurchaseRequests.filter(r => r.requesterId === viewerId);
  }
  
  console.log('GET /api/purchase-requests - After company filtering:', filteredRequests.length);
  console.log('GET /api/purchase-requests - Status filter:', status, 'ResourceType filter:', resourceType);
  
  // 상태별 필터링
  if (status) {
    filteredRequests = filteredRequests.filter(r => r.status === status);
    console.log('GET /api/purchase-requests - After status filtering:', filteredRequests.length);
  }
  
  // 리소스 타입별 필터링 (전체가 아닌 경우에만)
  if (resourceType && resourceType !== '전체' && resourceType !== '비품 구매') {
    filteredRequests = filteredRequests.filter(r => r.resourceType === resourceType);
    console.log('GET /api/purchase-requests - After resourceType filtering:', filteredRequests.length);
  }
  
  // 페이징
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedRequests = filteredRequests.slice(startIndex, endIndex);
  
  console.log(`GET /api/purchase-requests - Returning ${paginatedRequests.length} requests`);
  res.status(200).json({
    requests: paginatedRequests,
    total: filteredRequests.length,
    page,
    totalPages: Math.ceil(filteredRequests.length / limit)
  });
});

// POST /api/purchase-requests - 발주 요청 생성
app.post('/api/purchase-requests', (req, res) => {
  const rawViewerId = req.query.viewerId || req.query.adminId;
  const rawViewerRole = req.query.viewerRole || req.query.adminRole || '';
  
  console.log('POST /api/purchase-requests - Raw params:', { rawViewerId, rawViewerRole });
  
  const viewerId = Number(Array.isArray(rawViewerId) ? rawViewerId[0] : rawViewerId);
  const viewerRole = decodeURIComponent(String(Array.isArray(rawViewerRole) ? rawViewerRole[0] : rawViewerRole)).trim();
  
  console.log('POST /api/purchase-requests - Parsed params:', { viewerId, viewerRole });
  console.log('POST /api/purchase-requests - Request body:', req.body);
  
  const { title, description, amount, resourceType, priority, dueDate, campaignId, postId } = req.body;
  
  // 유효성 검증
  if (!title || !description || !amount) {
    return res.status(400).json({ message: '제목, 설명, 금액은 필수 항목입니다.' });
  }
  
  // 요청자 정보 확인
  const requester = mockUsers.find(u => u.id === viewerId);
  if (!requester) {
    return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
  }
  
  // 새 발주 요청 생성
  const newRequest = {
    id: mockPurchaseRequests.length + 1,
    title,
    description,
    amount: Number(amount),
    resourceType: resourceType || '캠페인 업무 발주',
    priority: priority || '보통',
    status: 'pending',
    dueDate,
    campaignId: campaignId || null,
    postId: postId || null,
    requesterId: viewerId,
    requesterName: requester.name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    approverComment: null
  };
  
  mockPurchaseRequests.push(newRequest);
  
  console.log('POST /api/purchase-requests - Created new request:', newRequest);
  res.status(201).json(newRequest);
});

// PUT /api/purchase-requests/:id - 발주 요청 상태 업데이트
app.put('/api/purchase-requests/:id', (req, res) => {
  const requestId = parseInt(req.params.id);
  const rawViewerId = req.query.viewerId || req.query.adminId;
  const rawViewerRole = req.query.viewerRole || req.query.adminRole || '';
  
  console.log('PUT /api/purchase-requests/:id - Raw params:', { requestId, rawViewerId, rawViewerRole });
  
  const viewerId = Number(Array.isArray(rawViewerId) ? rawViewerId[0] : rawViewerId);
  const viewerRole = decodeURIComponent(String(Array.isArray(rawViewerRole) ? rawViewerRole[0] : rawViewerRole)).trim();
  
  console.log('PUT /api/purchase-requests/:id - Parsed params:', { requestId, viewerId, viewerRole });
  console.log('PUT /api/purchase-requests/:id - Request body:', req.body);
  
  const { status, approverComment } = req.body;
  
  // 발주 요청 찾기
  const requestIndex = mockPurchaseRequests.findIndex(r => r.id === requestId);
  if (requestIndex === -1) {
    return res.status(404).json({ message: '발주 요청을 찾을 수 없습니다.' });
  }
  
  const request = mockPurchaseRequests[requestIndex];
  
  // 권한 확인 - 대행사 어드민/직원만 상태 변경 가능
  const isAgencyAdmin = viewerRole === '대행사 어드민';
  const isStaff = viewerRole === '직원';
  
  if (!isAgencyAdmin && !isStaff) {
    return res.status(403).json({ message: '권한이 없습니다. 대행사 어드민 또는 직원만 발주 요청 상태를 변경할 수 있습니다.' });
  }
  
  // 상태 업데이트
  if (status) {
    request.status = status;
  }
  if (approverComment) {
    request.approverComment = approverComment;
  }
  request.updatedAt = new Date().toISOString();
  
  console.log('PUT /api/purchase-requests/:id - Updated request:', request);
  res.status(200).json(request);
});

// Mock Products Data
const mockProducts = [];

// Mock Work Types Data
const mockWorkTypes = [];

// GET /api/products - 상품 목록 조회
app.get('/api/products', (req, res) => {
  const rawViewerId = req.query.viewerId || req.query.adminId;
  const rawViewerRole = req.query.viewerRole || req.query.adminRole || '';
  
  const viewerId = Number(Array.isArray(rawViewerId) ? rawViewerId[0] : rawViewerId);
  const viewerRole = decodeURIComponent(String(Array.isArray(rawViewerRole) ? rawViewerRole[0] : rawViewerRole)).trim();
  
  console.log('GET /api/products - Parsed params:', { viewerId, viewerRole });
  
  // 모든 역할이 상품 목록 조회 가능
  const products = mockProducts.map(product => ({
    ...product,
    // 추가 메타데이터
    isAvailable: true,
    totalOrders: 0
  }));
  
  console.log(`GET /api/products - 반환할 상품 ${products.length}개`);
  res.status(200).json({
    products,
    total: products.length
  });
});

// GET /api/products/ - 상품 목록 조회 (trailing slash 지원)
app.get('/api/products/', (req, res) => {
  // /api/products로 리다이렉트
  req.url = req.url.replace('/api/products/', '/api/products');
  return app._router.handle(req, res);
});

// GET /api/work-types - 업무타입 목록 조회
app.get('/api/work-types', (req, res) => {
  const rawViewerId = req.query.viewerId || req.query.adminId;
  const rawViewerRole = req.query.viewerRole || req.query.adminRole || '';
  
  const viewerId = Number(Array.isArray(rawViewerId) ? rawViewerId[0] : rawViewerId);
  const viewerRole = decodeURIComponent(String(Array.isArray(rawViewerRole) ? rawViewerRole[0] : rawViewerRole)).trim();
  
  console.log('GET /api/work-types - Parsed params:', { viewerId, viewerRole });
  
  // 활성화된 업무타입만 반환
  const workTypes = mockWorkTypes.filter(workType => workType.isActive);
  
  console.log(`GET /api/work-types - 반환할 업무타입 ${workTypes.length}개`);
  res.status(200).json(workTypes);
});

// GET /api/work-types/ - 업무타입 목록 조회 (trailing slash 지원)
app.get('/api/work-types/', (req, res) => {
  // /api/work-types로 리다이렉트
  req.url = req.url.replace('/api/work-types/', '/api/work-types');
  return app._router.handle(req, res);
});

// Mock incentive data
const mockIncentives = [];

// GET /api/monthly-incentives - 월간 인센티브 목록 조회
app.get('/api/monthly-incentives', (req, res) => {
  const rawViewerId = req.query.viewerId || req.query.adminId;
  const rawViewerRole = req.query.viewerRole || req.query.adminRole || '';
  
  console.log('GET /api/monthly-incentives - Raw params:', {
    rawViewerId,
    rawViewerRole
  });
  
  const viewerId = Number(Array.isArray(rawViewerId) ? rawViewerId[0] : rawViewerId);
  const viewerRole = decodeURIComponent(String(Array.isArray(rawViewerRole) ? rawViewerRole[0] : rawViewerRole)).trim();
  
  console.log('GET /api/monthly-incentives - Parsed params:', { viewerId, viewerRole });

  // 필터링 파라미터
  const { year, month, status, userId } = req.query;
  
  let filteredIncentives = [...mockIncentives];
  
  // 년도 필터
  if (year) {
    filteredIncentives = filteredIncentives.filter(i => i.year == year);
  }
  
  // 월 필터
  if (month) {
    filteredIncentives = filteredIncentives.filter(i => i.month == month);
  }
  
  // 상태 필터
  if (status && status !== '전체') {
    filteredIncentives = filteredIncentives.filter(i => i.status === status);
  }
  
  // 직원 필터
  if (userId && userId !== 'all') {
    filteredIncentives = filteredIncentives.filter(i => i.userId == userId);
  }
  
  // 권한별 필터링
  if (viewerRole === '직원') {
    filteredIncentives = filteredIncentives.filter(i => i.userId === viewerId);
  } else if (viewerRole === '대행사 어드민') {
    // 같은 회사 직원들의 인센티브만
    filteredIncentives = filteredIncentives.filter(i => i.employee?.company === 'ABC대행사');
  }
  // 슈퍼 어드민은 모든 인센티브 조회 가능
  
  console.log(`GET /api/monthly-incentives - 반환할 인센티브 ${filteredIncentives.length}개`);
  
  res.json({
    incentives: filteredIncentives,
    total: filteredIncentives.length,
    pages: Math.ceil(filteredIncentives.length / 20)
  });
});

// GET /api/monthly-incentives/summary/stats - 인센티브 통계
app.get('/api/monthly-incentives/summary/stats', (req, res) => {
  const rawViewerId = req.query.viewerId || req.query.adminId;
  const rawViewerRole = req.query.viewerRole || req.query.adminRole || '';
  
  const viewerId = Number(Array.isArray(rawViewerId) ? rawViewerId[0] : rawViewerId);
  const viewerRole = decodeURIComponent(String(Array.isArray(rawViewerRole) ? rawViewerRole[0] : rawViewerRole)).trim();
  
  console.log('GET /api/monthly-incentives/summary/stats - Parsed params:', { viewerId, viewerRole });

  let filteredIncentives = [...mockIncentives];
  
  // 권한별 필터링
  if (viewerRole === '직원') {
    filteredIncentives = filteredIncentives.filter(i => i.userId === viewerId);
  } else if (viewerRole === '대행사 어드민') {
    filteredIncentives = filteredIncentives.filter(i => i.employee?.company === 'ABC대행사');
  }
  
  const targetEmployees = filteredIncentives.length;
  const pending = filteredIncentives.filter(i => i.status === '검토대기').length;
  const approved = filteredIncentives.filter(i => i.status === '승인완료').length;
  const totalAmount = filteredIncentives.reduce((sum, i) => sum + (i.incentiveAmount + (i.adjustmentAmount || 0)), 0);
  
  console.log('GET /api/monthly-incentives/summary/stats - 통계:', {
    targetEmployees,
    pending,
    approved,
    totalAmount
  });
  
  res.json({
    targetEmployees,
    pending,
    approved,
    totalAmount
  });
});

// POST /api/monthly-incentives/calculate - 인센티브 계산
app.post('/api/monthly-incentives/calculate', (req, res) => {
  const rawViewerId = req.query.viewerId || req.query.adminId;
  const rawViewerRole = req.query.viewerRole || req.query.adminRole || '';
  
  const viewerId = Number(Array.isArray(rawViewerId) ? rawViewerId[0] : rawViewerId);
  const viewerRole = decodeURIComponent(String(Array.isArray(rawViewerRole) ? rawViewerRole[0] : rawViewerRole)).trim();
  
  console.log('POST /api/monthly-incentives/calculate - Parsed params:', { viewerId, viewerRole });

  // 관리자만 인센티브 계산 가능
  if (!['슈퍼 어드민', '대행사 어드민'].includes(viewerRole)) {
    return res.status(403).json({ message: '인센티브 계산 권한이 없습니다.' });
  }
  
  const { year, month } = req.body;
  
  console.log(`POST /api/monthly-incentives/calculate - ${year}년 ${month}월 인센티브 계산 요청`);
  
  // 모의 계산 결과
  const calculatedIncentives = [
    {
      userId: 1,
      employeeName: '직원1',
      incentiveAmount: 2400,
      status: '검토대기'
    },
    {
      userId: 3,
      employeeName: '김직원',
      incentiveAmount: 1440,
      status: '검토대기'
    }
  ];
  
  res.json({
    message: '인센티브 계산이 완료되었습니다.',
    calculatedCount: calculatedIncentives.length,
    incentives: calculatedIncentives
  });
});

// Catch all other routes
app.get('*', (req, res) => {
  res.status(404).json({ message: 'Test server - endpoint not implemented' });
});

app.post('*', (req, res) => {
  res.status(404).json({ message: 'Test server - endpoint not implemented' });
});

const PORT = process.env.PORT || 5004;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`BrandFlow API Server running on port ${PORT}`);
  console.log('Ready to handle requests...');
});