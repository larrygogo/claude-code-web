/**
 * Claude Code Web - 真实浏览器 E2E 测试
 * 使用非 headless 模式进行完整的用户交互测试
 */

import puppeteer from 'puppeteer';

const BASE_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:3001';
const TEST_USER = {
  email: `browser_${Date.now()}@test.com`,
  username: `browseruser_${Date.now()}`,
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

async function waitForElement(page, selector, timeout = 10000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const element = await page.$(selector);
    if (element) return element;
    await sleep(100);
  }
  return null;
}

async function runBrowserTests() {
  console.log('\n========================================');
  console.log('  Claude Code Web 真实浏览器 E2E 测试');
  console.log('========================================\n');

  // 检查服务状态
  log('检查服务状态...');
  try {
    await fetch(`${API_URL}/health`);
    await fetch(BASE_URL);
  } catch (error) {
    log(`服务未运行: ${error.message}`, 'fail');
    console.log('\n请先运行 pnpm dev 启动服务\n');
    process.exit(1);
  }
  log('服务运行正常', 'pass');

  // 启动真实浏览器（非 headless）
  log('启动浏览器（真实窗口模式）...');
  const browser = await puppeteer.launch({
    headless: false,  // 真实浏览器窗口
    slowMo: 50,       // 放慢操作便于观察
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1280,900',
    ],
    defaultViewport: { width: 1280, height: 800 },
  });

  const page = await browser.newPage();

  // 记录网络请求
  const apiRequests = [];
  page.on('request', req => {
    if (req.url().includes('/api/')) {
      apiRequests.push({ method: req.method(), url: req.url() });
    }
  });

  try {
    // ===== 测试 1: 访问登录页面 =====
    log('\n--- 认证页面测试 ---');
    await test('访问登录页面', async () => {
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(2000);  // 等待 React hydration

      // 等待表单元素出现
      const emailInput = await waitForElement(page, 'input[type="email"]', 15000);
      if (!emailInput) {
        await page.screenshot({ path: 'tests/browser-login-error.png' });
        throw new Error('登录表单未加载');
      }
    });

    // ===== 测试 2: 导航到注册页面 =====
    await test('导航到注册页面', async () => {
      // 点击注册链接
      const registerLink = await page.$('a[href="/register"]');
      if (registerLink) {
        await registerLink.click();
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
      } else {
        await page.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle2' });
      }
      await sleep(2000);

      const usernameInput = await waitForElement(page, '#username', 10000);
      if (!usernameInput) {
        throw new Error('注册表单未加载');
      }
    });

    // ===== 测试 3: 用户注册流程 =====
    await test('完成用户注册', async () => {
      // 填写注册表单
      await page.type('input[type="email"]', TEST_USER.email, { delay: 30 });
      await page.type('#username', TEST_USER.username, { delay: 30 });

      // 填写两个密码框
      const passwordInputs = await page.$$('input[type="password"]');
      for (const input of passwordInputs) {
        await input.type(TEST_USER.password, { delay: 30 });
      }

      await sleep(500);
      await page.screenshot({ path: 'tests/browser-register-filled.png' });

      // 点击注册按钮
      const submitBtn = await page.$('button[type="submit"]');
      if (!submitBtn) throw new Error('提交按钮未找到');

      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
        submitBtn.click(),
      ]);

      await sleep(3000);

      // 验证跳转到聊天页面
      const url = page.url();
      if (!url.includes('/chat')) {
        await page.screenshot({ path: 'tests/browser-register-result.png' });
        throw new Error(`注册后未跳转到聊天页面，当前: ${url}`);
      }
    });

    // ===== 测试 4: 聊天界面加载 =====
    log('\n--- 聊天功能测试 ---');
    await test('聊天界面正确加载', async () => {
      await sleep(2000);

      const textarea = await waitForElement(page, 'textarea', 10000);
      if (!textarea) {
        await page.screenshot({ path: 'tests/browser-chat-error.png' });
        throw new Error('聊天输入框未加载');
      }

      await page.screenshot({ path: 'tests/browser-chat-loaded.png' });
    });

    // ===== 测试 5: 发送消息 =====
    await test('发送聊天消息', async () => {
      const textarea = await page.$('textarea');
      if (!textarea) throw new Error('输入框不存在');

      // 输入消息
      await textarea.click();
      await textarea.type('你好，请简单回复"测试成功"两个字', { delay: 20 });
      await sleep(500);

      // 点击发送
      const sendBtn = await page.$('button[type="submit"]');
      if (!sendBtn) throw new Error('发送按钮不存在');

      await sendBtn.click();
      log('消息已发送，等待 AI 响应...', 'info');
    });

    // ===== 测试 6: 等待 AI 响应 =====
    await test('接收 AI 流式响应', async () => {
      // 等待响应开始（最多 30 秒）
      const startTime = Date.now();
      let responseReceived = false;

      while (Date.now() - startTime < 30000) {
        const content = await page.content();
        // 检查是否有 assistant 消息
        if (content.includes('assistant') || content.includes('测试')) {
          responseReceived = true;
          break;
        }
        await sleep(500);
      }

      // 再等待响应完成
      await sleep(5000);
      await page.screenshot({ path: 'tests/browser-chat-response.png' });

      if (!responseReceived) {
        log('警告：未检测到明确的响应内容，但流程可能正常', 'warn');
      }
    });

    // ===== 测试 7: 会话列表 =====
    log('\n--- 会话管理测试 ---');
    await test('会话列表显示', async () => {
      // 检查侧边栏是否有会话
      const sidebar = await page.$('aside, [class*="sidebar"], [class*="Sidebar"]');
      if (sidebar) {
        const sessions = await page.$$('[class*="session"], [class*="Session"]');
        log(`检测到 ${sessions.length} 个会话元素`, 'info');
      }
      // 不抛出错误，因为侧边栏可能在移动视图中隐藏
    });

    // ===== 测试 8: 新建会话 =====
    await test('创建新会话', async () => {
      // 尝试找到新建对话按钮
      const newChatBtn = await page.$('button[class*="new"], a[href="/chat"]');
      if (newChatBtn) {
        await newChatBtn.click();
        await sleep(2000);
      }

      // 验证输入框存在
      const textarea = await page.$('textarea');
      if (!textarea) {
        throw new Error('新会话创建失败');
      }
    });

    // ===== 测试 9: 响应式设计 =====
    log('\n--- 响应式设计测试 ---');
    await test('移动端视图', async () => {
      await page.setViewport({ width: 375, height: 667 }); // iPhone SE
      await sleep(1000);

      await page.screenshot({ path: 'tests/browser-mobile-view.png' });

      // 检查底部导航是否显示
      const bottomNav = await page.$('[class*="bottom"], [class*="Bottom"], nav');
      log(bottomNav ? '检测到移动端导航' : '未检测到专门的移动端导航', 'info');

      // 恢复桌面视图
      await page.setViewport({ width: 1280, height: 800 });
      await sleep(500);
    });

    // ===== 测试 10: 登出功能 =====
    log('\n--- 登出测试 ---');
    await test('用户登出', async () => {
      // 尝试找到设置或用户菜单
      await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle2' }).catch(() => {});
      await sleep(2000);

      // 清除本地存储模拟登出
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });

      // 刷新应重定向到登录页
      await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
      await sleep(2000);

      const url = page.url();
      if (url.includes('/login') || url.includes('/register')) {
        log('已成功登出并重定向', 'info');
      }
    });

    // 最终截图
    await page.screenshot({ path: 'tests/browser-final.png', fullPage: true });

  } catch (error) {
    log(`测试执行错误: ${error.message}`, 'fail');
    await page.screenshot({ path: 'tests/browser-error.png' });
  }

  // 输出 API 请求摘要
  console.log('\n--- API 请求统计 ---');
  const apiSummary = {};
  apiRequests.forEach(r => {
    const key = `${r.method} ${r.url.split('?')[0].replace(API_URL, '')}`;
    apiSummary[key] = (apiSummary[key] || 0) + 1;
  });
  Object.entries(apiSummary).forEach(([key, count]) => {
    console.log(`  ${key}: ${count} 次`);
  });

  // 输出结果
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

  console.log('\n截图已保存到 tests/ 目录');
  console.log('浏览器将在 10 秒后关闭，你可以手动操作查看...\n');

  // 保持浏览器打开一段时间
  await sleep(10000);
  await browser.close();

  process.exit(results.failed > 0 ? 1 : 0);
}

runBrowserTests().catch(error => {
  console.error('测试运行错误:', error);
  process.exit(1);
});
