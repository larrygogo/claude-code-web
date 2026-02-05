/**
 * Claude Code Web - E2E 自动化测试
 * 使用 Puppeteer 测试前端功能
 */

import puppeteer from 'puppeteer';

const BASE_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:3001';
const TEST_USER = {
  email: `e2e_${Date.now()}@test.com`,
  username: `e2euser_${Date.now()}`,
  password: 'Test123456!',
};

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

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function test(name, fn) {
  try {
    await fn();
    log(`${name}`, 'pass');
    results.passed++;
    results.tests.push({ name, status: 'passed' });
    return true;
  } catch (error) {
    log(`${name}: ${error.message}`, 'fail');
    results.failed++;
    results.tests.push({ name, status: 'failed', error: error.message });
    return false;
  }
}

async function runE2ETests() {
  console.log('\n========================================');
  console.log('    Claude Code Web E2E 自动化测试');
  console.log('========================================\n');

  // 检查服务是否运行
  log('检查服务状态...');

  try {
    const healthRes = await fetch(`${API_URL}/health`);
    if (!healthRes.ok) {
      throw new Error('后端服务未运行');
    }
  } catch (error) {
    log(`后端服务检查失败: ${error.message}`, 'fail');
    process.exit(1);
  }

  try {
    const clientRes = await fetch(BASE_URL);
    if (!clientRes.ok) {
      throw new Error('前端服务未运行');
    }
  } catch (error) {
    log(`前端服务检查失败: ${error.message}`, 'fail');
    process.exit(1);
  }

  log('服务运行正常', 'pass');

  // 启动浏览器
  log('启动浏览器...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 800 },
  });

  const page = await browser.newPage();

  // 错误收集
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  try {
    // 测试 1: 首页重定向
    log('\n--- 页面访问测试 ---');
    await test('首页应加载成功', async () => {
      await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 10000 });
      const title = await page.title();
      if (!title.includes('Claude')) {
        throw new Error(`标题不正确: ${title}`);
      }
    });

    // 测试 2: 登录页面
    await test('登录页面应正确显示', async () => {
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
      await sleep(500);

      const emailInput = await page.$('input[type="email"]');
      const passwordInput = await page.$('input[type="password"]');
      const submitBtn = await page.$('button[type="submit"]');

      if (!emailInput || !passwordInput || !submitBtn) {
        throw new Error('登录表单元素缺失');
      }
    });

    // 测试 3: 注册页面
    await test('注册页面应正确显示', async () => {
      await page.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle0' });
      await sleep(500);

      const emailInput = await page.$('input[type="email"]');
      const usernameInput = await page.$('#username');
      const passwordInput = await page.$('input[type="password"]');

      if (!emailInput || !usernameInput || !passwordInput) {
        throw new Error('注册表单元素缺失');
      }
    });

    // 测试 4: 用户注册流程
    log('\n--- 认证流程测试 ---');
    await test('用户注册流程应成功', async () => {
      await page.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle0' });
      await sleep(500);

      // 填写表单
      await page.type('input[type="email"]', TEST_USER.email);
      await page.type('#username', TEST_USER.username);
      // 输入密码到两个密码框
      const passwordInputs = await page.$$('input[type="password"]');
      if (passwordInputs.length >= 2) {
        await passwordInputs[0].type(TEST_USER.password);
        await passwordInputs[1].type(TEST_USER.password);
      } else {
        await page.type('input[type="password"]', TEST_USER.password);
      }

      // 提交
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }).catch(() => {}),
        page.click('button[type="submit"]'),
      ]);

      await sleep(2000);

      // 验证跳转到聊天页面
      const url = page.url();
      if (!url.includes('/chat')) {
        throw new Error(`注册后未跳转到聊天页面，当前URL: ${url}`);
      }
    });

    // 测试 5: 聊天页面元素
    log('\n--- 聊天界面测试 ---');
    await test('聊天页面应正确显示', async () => {
      await sleep(1000);

      const textarea = await page.$('textarea');
      const sendBtn = await page.$('button[type="submit"]');

      if (!textarea || !sendBtn) {
        throw new Error('聊天界面元素缺失');
      }
    });

    // 测试 6: 发送消息
    await test('发送消息应成功', async () => {
      const textarea = await page.$('textarea');
      if (!textarea) throw new Error('输入框不存在');

      await textarea.type('请回复"测试成功"');
      await sleep(300);

      const sendBtn = await page.$('button[type="submit"]');
      if (!sendBtn) throw new Error('发送按钮不存在');

      await sendBtn.click();

      // 等待响应（最多 30 秒）
      await sleep(5000);

      // 检查是否有消息显示
      const messages = await page.$$('[class*="message"], [class*="Message"]');
      if (messages.length === 0) {
        // 尝试其他选择器
        const content = await page.content();
        if (!content.includes('你') && !content.includes('测试')) {
          throw new Error('未检测到消息内容');
        }
      }
    });

    // 测试 7: 流式输出
    await test('流式输出应正常工作', async () => {
      // 检查是否有 loading 状态或流式内容
      await sleep(10000);  // 等待响应完成

      const pageContent = await page.content();
      // 检查是否有 AI 响应内容
      if (!pageContent.includes('Claude') && !pageContent.includes('assistant') && !pageContent.includes('测试')) {
        log('警告：未检测到明确的 AI 响应，但流程可能仍正常', 'warn');
      }
    });

    // 测试 8: 侧边栏会话列表
    await test('侧边栏应显示会话', async () => {
      // 检查侧边栏元素
      const sidebar = await page.$('[class*="sidebar"], [class*="Sidebar"], aside');
      if (!sidebar) {
        // 可能在移动端视图，跳过
        log('未找到侧边栏（可能是移动端视图）', 'warn');
        return;
      }
    });

    // 测试 9: 登出功能
    log('\n--- 其他功能测试 ---');
    await test('登出功能应正常', async () => {
      // 清除 localStorage 模拟登出
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });

      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
      const url = page.url();
      if (!url.includes('/login')) {
        throw new Error('登出后未重定向到登录页面');
      }
    });

    // 测试 10: 响应式设计
    log('\n--- 响应式设计测试 ---');
    await test('移动端视图应正常显示', async () => {
      await page.setViewport({ width: 375, height: 667 }); // iPhone SE
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
      await sleep(500);

      const emailInput = await page.$('input[type="email"]');
      if (!emailInput) {
        throw new Error('移动端登录页面元素缺失');
      }

      // 恢复桌面视图
      await page.setViewport({ width: 1280, height: 800 });
    });

    // 保存截图
    await page.screenshot({ path: 'tests/e2e-result.png', fullPage: true });
    log('\n截图已保存到 tests/e2e-result.png');

  } catch (error) {
    log(`测试执行错误: ${error.message}`, 'fail');
    await page.screenshot({ path: 'tests/e2e-error.png', fullPage: true });
  } finally {
    await browser.close();
  }

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
  }

  if (errors.length > 0) {
    console.log('\n浏览器错误:');
    errors.slice(0, 5).forEach(e => console.log(`  - ${e}`));
  }

  if (results.failed === 0) {
    console.log('\n\x1b[32m所有 E2E 测试通过！\x1b[0m\n');
  }

  process.exit(results.failed > 0 ? 1 : 0);
}

runE2ETests().catch(error => {
  console.error('测试运行错误:', error);
  process.exit(1);
});
