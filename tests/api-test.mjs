/**
 * Claude Code Web - API 自动化测试
 * 测试所有 API 端点：认证、会话、聊天
 */

const API_BASE_URL = 'http://localhost:3001';
const TEST_USER = {
  email: `test_${Date.now()}@test.com`,
  username: `testuser_${Date.now()}`,
  password: 'Test123456!',
};

let accessToken = null;
let refreshToken = null;
let userId = null;
let sessionId = null;

const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

function log(message, type = 'info') {
  const prefix = {
    info: '\x1b[36mℹ\x1b[0m',
    pass: '\x1b[32m✓\x1b[0m',
    fail: '\x1b[31m✗\x1b[0m',
    warn: '\x1b[33m⚠\x1b[0m',
  };
  console.log(`${prefix[type] || ''} ${message}`);
}

async function test(name, fn) {
  try {
    await fn();
    log(`${name}`, 'pass');
    results.passed++;
    results.tests.push({ name, status: 'passed' });
  } catch (error) {
    log(`${name}: ${error.message}`, 'fail');
    results.failed++;
    results.tests.push({ name, status: 'failed', error: error.message });
  }
}

async function request(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (accessToken && !options.skipAuth) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  return { status: response.status, data, ok: response.ok };
}

async function testHealthCheck() {
  await test('健康检查端点', async () => {
    const res = await request('/health', { skipAuth: true });
    if (res.status !== 200 || res.data.status !== 'ok') {
      throw new Error(`期望 status=ok，得到 ${JSON.stringify(res.data)}`);
    }
  });
}

async function testUserRegistration() {
  await test('用户注册', async () => {
    const res = await request('/api/auth/register', {
      method: 'POST',
      body: TEST_USER,
      skipAuth: true,
    });

    if (!res.ok) {
      throw new Error(`注册失败: ${JSON.stringify(res.data)}`);
    }

    if (!res.data.data?.user?.id || !res.data.data?.tokens?.accessToken) {
      throw new Error('响应缺少必要字段');
    }

    userId = res.data.data.user.id;
    accessToken = res.data.data.tokens.accessToken;
    refreshToken = res.data.data.tokens.refreshToken;
  });
}

async function testDuplicateRegistration() {
  await test('重复注册应返回错误', async () => {
    const res = await request('/api/auth/register', {
      method: 'POST',
      body: TEST_USER,
      skipAuth: true,
    });

    if (res.status !== 409) {
      throw new Error(`期望状态码 409，得到 ${res.status}`);
    }
  });
}

async function testUserLogin() {
  await test('用户登录', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: {
        email: TEST_USER.email,
        password: TEST_USER.password,
      },
      skipAuth: true,
    });

    if (!res.ok) {
      throw new Error(`登录失败: ${JSON.stringify(res.data)}`);
    }

    accessToken = res.data.data.tokens.accessToken;
    refreshToken = res.data.data.tokens.refreshToken;
  });
}

async function testInvalidLogin() {
  await test('无效登录应返回 401', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: {
        email: TEST_USER.email,
        password: 'wrongpassword',
      },
      skipAuth: true,
    });

    if (res.status !== 401) {
      throw new Error(`期望状态码 401，得到 ${res.status}`);
    }
  });
}

async function testGetCurrentUser() {
  await test('获取当前用户信息', async () => {
    const res = await request('/api/auth/me');

    if (!res.ok) {
      throw new Error(`获取用户失败: ${JSON.stringify(res.data)}`);
    }

    if (res.data.data?.id !== userId) {
      throw new Error('用户 ID 不匹配');
    }
  });
}

async function testRefreshToken() {
  await test('刷新 Token', async () => {
    const res = await request('/api/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      skipAuth: true,
    });

    if (!res.ok) {
      throw new Error(`刷新 Token 失败: ${JSON.stringify(res.data)}`);
    }

    accessToken = res.data.data.tokens.accessToken;
    refreshToken = res.data.data.tokens.refreshToken;
  });
}

async function testUnauthorizedAccess() {
  await test('未认证访问应返回 401', async () => {
    const res = await request('/api/sessions', { skipAuth: true });

    if (res.status !== 401) {
      throw new Error(`期望状态码 401，得到 ${res.status}`);
    }
  });
}

async function testCreateSession() {
  await test('创建新会话', async () => {
    const res = await request('/api/sessions', {
      method: 'POST',
      body: { title: '测试会话' },
    });

    if (!res.ok) {
      throw new Error(`创建会话失败: ${JSON.stringify(res.data)}`);
    }

    sessionId = res.data.data?.id;
    if (!sessionId) {
      throw new Error('响应缺少会话 ID');
    }
  });
}

async function testGetSessions() {
  await test('获取会话列表', async () => {
    const res = await request('/api/sessions');

    if (!res.ok) {
      throw new Error(`获取会话列表失败: ${JSON.stringify(res.data)}`);
    }

    if (!Array.isArray(res.data.data)) {
      throw new Error('响应应为数组');
    }
  });
}

async function testGetSession() {
  await test('获取会话详情', async () => {
    const res = await request(`/api/sessions/${sessionId}`);

    if (!res.ok) {
      throw new Error(`获取会话详情失败: ${JSON.stringify(res.data)}`);
    }

    if (res.data.data?.id !== sessionId) {
      throw new Error('会话 ID 不匹配');
    }
  });
}

async function testUpdateSession() {
  await test('更新会话标题', async () => {
    const newTitle = '更新后的标题';
    const res = await request(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      body: { title: newTitle },
    });

    if (!res.ok) {
      throw new Error(`更新会话失败: ${JSON.stringify(res.data)}`);
    }

    if (res.data.data?.title !== newTitle) {
      throw new Error('标题未更新');
    }
  });
}

async function testChatStream() {
  await test('发送聊天消息（SSE 流）', async () => {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('聊天超时（30秒）'));
      }, 30000);

      try {
        const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            message: '你好，请简单回复"测试成功"',
          }),
        });

        if (!response.ok) {
          clearTimeout(timeout);
          const error = await response.json();
          reject(new Error(`聊天请求失败: ${JSON.stringify(error)}`));
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let receivedInit = false;
        let receivedText = false;
        let receivedDone = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              const eventType = line.substring(7).trim();
              if (eventType === 'init') receivedInit = true;
              if (eventType === 'text_delta') receivedText = true;
              if (eventType === 'done') receivedDone = true;
            }
          }
        }

        clearTimeout(timeout);

        if (!receivedInit) {
          reject(new Error('未收到 init 事件'));
        } else if (!receivedText) {
          reject(new Error('未收到 text_delta 事件'));
        } else if (!receivedDone) {
          reject(new Error('未收到 done 事件'));
        } else {
          resolve();
        }
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  });
}

async function testForkSession() {
  await test('分支会话', async () => {
    const res = await request(`/api/sessions/${sessionId}/fork`, {
      method: 'POST',
      body: { messageIndex: 0 },
    });

    if (!res.ok) {
      throw new Error(`分支会话失败: ${JSON.stringify(res.data)}`);
    }

    if (!res.data.data?.id) {
      throw new Error('响应缺少新会话 ID');
    }
  });
}

async function testDeleteSession() {
  await test('删除会话', async () => {
    const res = await request(`/api/sessions/${sessionId}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      throw new Error(`删除会话失败: ${JSON.stringify(res.data)}`);
    }
  });
}

async function testLogout() {
  await test('用户登出', async () => {
    const res = await request('/api/auth/logout', {
      method: 'POST',
      body: { refreshToken },
    });

    if (!res.ok) {
      throw new Error(`登出失败: ${JSON.stringify(res.data)}`);
    }
  });
}

async function runAllTests() {
  console.log('\n========================================');
  console.log('    Claude Code Web API 自动化测试');
  console.log('========================================\n');

  log('开始测试...\n');

  // 健康检查
  log('--- 基础测试 ---');
  await testHealthCheck();

  // 认证测试
  log('\n--- 认证测试 ---');
  await testUserRegistration();
  await testDuplicateRegistration();
  await testUserLogin();
  await testInvalidLogin();
  await testGetCurrentUser();
  await testRefreshToken();
  await testUnauthorizedAccess();

  // 会话测试
  log('\n--- 会话测试 ---');
  await testCreateSession();
  await testGetSessions();
  await testGetSession();
  await testUpdateSession();

  // 聊天测试
  log('\n--- 聊天测试 ---');
  await testChatStream();

  // 会话操作测试
  log('\n--- 会话操作测试 ---');
  await testForkSession();
  await testDeleteSession();

  // 登出测试
  log('\n--- 登出测试 ---');
  await testLogout();

  // 输出结果摘要
  console.log('\n========================================');
  console.log('              测试结果');
  console.log('========================================');
  console.log(`\x1b[32m通过: ${results.passed}\x1b[0m`);
  console.log(`\x1b[31m失败: ${results.failed}\x1b[0m`);
  console.log(`总计: ${results.passed + results.failed}`);

  if (results.failed > 0) {
    console.log('\n失败的测试:');
    results.tests
      .filter(t => t.status === 'failed')
      .forEach(t => console.log(`  - ${t.name}: ${t.error}`));
    process.exit(1);
  } else {
    console.log('\n\x1b[32m所有测试通过！\x1b[0m\n');
    process.exit(0);
  }
}

runAllTests().catch(error => {
  console.error('测试运行错误:', error);
  process.exit(1);
});
