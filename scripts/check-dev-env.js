/**
 * Development Environment Health Check
 * Verifies that all dependencies and services are properly configured
 */

import { existsSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

const checks = [];
let passedChecks = 0;
let failedChecks = 0;

function check(name, fn) {
  checks.push({ name, fn });
}

function pass(message) {
  console.log(`✅ ${message}`);
  passedChecks++;
}

function fail(message) {
  console.log(`❌ ${message}`);
  failedChecks++;
}

function warn(message) {
  console.log(`⚠️  ${message}`);
}

function info(message) {
  console.log(`ℹ️  ${message}`);
}

// Check 1: Node.js version
check('Node.js Version', () => {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0]);

  if (major >= 22) {
    pass(`Node.js ${version} (recommended: 22.x)`);
  } else if (major >= 18) {
    warn(`Node.js ${version} (works, but 22.x recommended)`);
    passedChecks++;
  } else {
    fail(`Node.js ${version} (requires 18.x or higher)`);
  }
});

// Check 2: Package.json exists
check('Package Configuration', () => {
  const pkgPath = join(PROJECT_ROOT, 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    pass(`package.json found (${pkg.name}@${pkg.version})`);
  } else {
    fail('package.json not found');
  }
});

// Check 3: Dependencies installed
check('Dependencies', () => {
  const nodeModulesPath = join(PROJECT_ROOT, 'node_modules');
  if (existsSync(nodeModulesPath)) {
    pass('node_modules directory exists');
  } else {
    fail('node_modules not found - run: npm install');
  }
});

// Check 4: Wrangler CLI
check('Wrangler CLI', () => {
  try {
    const version = execSync('npx wrangler --version', {
      encoding: 'utf-8',
      cwd: PROJECT_ROOT,
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
    pass(`Wrangler installed (${version})`);
  } catch (error) {
    fail('Wrangler not found - run: npm install');
  }
});

// Check 5: Git repository
check('Git Repository', () => {
  const gitPath = join(PROJECT_ROOT, '.git');
  if (existsSync(gitPath)) {
    try {
      const branch = execSync('git branch --show-current', {
        encoding: 'utf-8',
        cwd: PROJECT_ROOT,
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
      pass(`Git repository (branch: ${branch})`);
    } catch (error) {
      warn('Git repository exists but cannot read branch');
      passedChecks++;
    }
  } else {
    warn('Not a git repository');
    passedChecks++;
  }
});

// Check 6: Test files
check('Test Suite', () => {
  const testPath = join(PROJECT_ROOT, 'test');
  if (existsSync(testPath)) {
    try {
      const testFiles = execSync('find test -name "*.test.js" | wc -l', {
        encoding: 'utf-8',
        cwd: PROJECT_ROOT,
        shell: '/bin/bash',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
      pass(`Test directory exists (${testFiles} test files)`);
    } catch (error) {
      // Fallback for Windows
      pass('Test directory exists');
    }
  } else {
    warn('Test directory not found');
    passedChecks++;
  }
});

// Check 7: Environment files
check('Environment Configuration', () => {
  const wranglerToml = join(PROJECT_ROOT, 'wrangler.toml');

  if (existsSync(wranglerToml)) {
    pass('wrangler.toml found');
  } else {
    warn('wrangler.toml not found (may be intentional for Pages)');
    passedChecks++;
  }
});

// Check 8: Key utility modules
check('Utility Modules', () => {
  const utilsPath = join(PROJECT_ROOT, 'functions', 'utils');
  const requiredModules = [
    'rateLimiter.js',
    'errorHandling.js',
    'apiCache.js',
    'fileTypes.js',
    'inFlightCache.js',
  ];

  const missing = requiredModules.filter(mod =>
    !existsSync(join(utilsPath, mod))
  );

  if (missing.length === 0) {
    pass(`All utility modules present (${requiredModules.length} modules)`);
  } else {
    fail(`Missing utility modules: ${missing.join(', ')}`);
  }
});

// Check 9: Better-sqlite3 (for tests)
check('Native Dependencies', () => {
  try {
    const betterSqlitePath = join(PROJECT_ROOT, 'node_modules', 'better-sqlite3');
    if (existsSync(betterSqlitePath)) {
      try {
        // Try to require it
        const { createRequire } = await import('module');
        const require = createRequire(import.meta.url);
        require('better-sqlite3');
        pass('better-sqlite3 compiled and working');
      } catch (error) {
        if (error.message.includes('NODE_MODULE_VERSION')) {
          fail('better-sqlite3 needs rebuild - run: npm rebuild better-sqlite3');
        } else {
          warn('better-sqlite3 may need attention');
          passedChecks++;
        }
      }
    } else {
      warn('better-sqlite3 not installed (needed for tests)');
      passedChecks++;
    }
  } catch (error) {
    warn('Could not check better-sqlite3');
    passedChecks++;
  }
});

// Check 10: Recent commits
check('Recent Activity', () => {
  try {
    const lastCommit = execSync('git log -1 --format="%h - %s (%cr)"', {
      encoding: 'utf-8',
      cwd: PROJECT_ROOT,
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
    info(`Last commit: ${lastCommit}`);
    passedChecks++;
  } catch (error) {
    passedChecks++;
  }
});

// Run all checks
async function runChecks() {
  console.log('\n🔍 SUNDOWNER Development Environment Check\n');
  console.log('='.repeat(60));
  console.log('');

  for (const { name, fn } of checks) {
    console.log(`\n📋 ${name}`);
    try {
      await fn();
    } catch (error) {
      fail(`Check failed: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Results: ${passedChecks} passed, ${failedChecks} failed\n`);

  if (failedChecks === 0) {
    console.log('✨ All checks passed! Environment is ready.\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some checks failed. Please fix the issues above.\n');
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runChecks().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runChecks };
