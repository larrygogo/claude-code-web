/**
 * Claude Code Web - 综合测试运行器
 * 运行所有 API 和 E2E 测试
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function runTest(name, script) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`运行: ${name}`);
    console.log('='.repeat(50));

    const proc = spawn('node', [join(__dirname, script)], {
      stdio: 'inherit',
      cwd: join(__dirname, '..'),
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ name, passed: true });
      } else {
        resolve({ name, passed: false, code });
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║      Claude Code Web 综合测试套件                 ║');
  console.log('╚══════════════════════════════════════════════════╝');

  const results = [];

  // 运行 API 测试
  results.push(await runTest('API 自动化测试', 'api-test.mjs'));

  // 运行 E2E 测试
  results.push(await runTest('E2E 浏览器测试', 'e2e-test.mjs'));

  // 输出总结
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║                   测试总结                        ║');
  console.log('╚══════════════════════════════════════════════════╝');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(r => {
    const icon = r.passed ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
    console.log(`  ${icon} ${r.name}`);
  });

  console.log(`\n  总计: ${passed} 通过, ${failed} 失败\n`);

  if (failed > 0) {
    console.log('\x1b[31m测试套件未完全通过\x1b[0m\n');
    process.exit(1);
  } else {
    console.log('\x1b[32m所有测试套件通过！\x1b[0m\n');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('测试运行错误:', error);
  process.exit(1);
});
