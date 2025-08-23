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
  
  console.log('POST /api/users - Permission granted! User creation would proceed...');
  
  // Simulate successful user creation
  res.status(201).json({
    id: 999,
    name: req.body.name,
    email: req.body.email,
    role: req.body.role,
    company: req.body.company,
    incentiveRate: req.body.incentiveRate,
    message: '사용자가 성공적으로 생성되었습니다!'
  });
});

// Mock users data for testing
const mockUsers = [
  { id: 1, name: '슈퍼 관리자', email: 'admin@test.com', role: '슈퍼 어드민', company: null },
  { id: 2, name: '김대행', email: 'agency@test.com', role: '대행사 어드민', company: 'ABC대행사' },
  { id: 3, name: '직원1', email: 'staff1@abc.com', role: '직원', company: 'ABC대행사' },
  { id: 4, name: '클라이언트1', email: 'client1@company.com', role: '클라이언트', company: 'ABC대행사' }
];

// Mock campaigns data
const mockCampaigns = [
  {
    id: 1,
    name: '테스트 캠페인',
    description: '테스트용 캠페인',
    userId: 4, // 클라이언트1
    managerId: 3, // 직원1
    status: 'active',
    createdAt: new Date().toISOString()
  }
];

// Mock user credentials for login
const loginCredentials = [
  { email: 'admin@test.com', password: 'admin123', userData: mockUsers[0] },
  { email: 'agency@test.com', password: 'agency123', userData: mockUsers[1] },
  { email: 'staff1@abc.com', password: 'staff123', userData: mockUsers[2] },
  { email: 'client1@company.com', password: 'client123', userData: mockUsers[3] }
];

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