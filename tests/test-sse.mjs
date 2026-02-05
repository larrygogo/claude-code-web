/**
 * 直接测试 SSE 端点
 */

const API_URL = 'http://localhost:3001';

async function testSSE() {
  console.log('1. 登录获取 token...');

  // 先登录获取 token
  const loginRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'Test123456!',
    }),
  });

  if (!loginRes.ok) {
    // 如果登录失败，尝试注册
    console.log('登录失败，尝试注册新用户...');
    const registerRes = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `ssetest_${Date.now()}@example.com`,
        username: `ssetest_${Date.now()}`,
        password: 'Test123456!',
      }),
    });

    if (!registerRes.ok) {
      console.error('注册失败:', await registerRes.text());
      process.exit(1);
    }

    var authData = await registerRes.json();
  } else {
    var authData = await loginRes.json();
  }

  const token = authData.data.tokens.accessToken;
  console.log('Token 获取成功');

  console.log('\n2. 测试 SSE 流...');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.log('\n超时，停止请求');
    controller.abort();
  }, 30000);

  try {
    const response = await fetch(`${API_URL}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: '请回复"测试成功"三个字',
      }),
      signal: controller.signal,
    });

    console.log('响应状态:', response.status);
    console.log('响应头:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      console.error('请求失败:', await response.text());
      process.exit(1);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    console.log('\n开始读取 SSE 流:\n');
    console.log('---');

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        console.log('\n---');
        console.log('流结束');
        break;
      }

      const text = decoder.decode(value, { stream: true });
      process.stdout.write(text);
    }

    clearTimeout(timeoutId);
    console.log('\n\n测试完成!');

  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.log('请求被中止');
    } else {
      console.error('错误:', error.message);
    }
  }
}

testSSE().catch(console.error);
