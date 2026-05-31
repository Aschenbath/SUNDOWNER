/**
 * Code Quality Checker
 * Scans codebase for common issues and anti-patterns
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

class CodeQualityChecker {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.issues = [];
    this.stats = {
      filesScanned: 0,
      linesScanned: 0,
      issuesFound: 0,
    };
  }

  /**
   * Scan directory recursively
   */
  scanDirectory(dir, options = {}) {
    const {
      extensions = ['.js', '.mjs'],
      exclude = ['node_modules', '.git', 'dist', 'build', '.wrangler'],
    } = options;

    const files = readdirSync(dir);

    for (const file of files) {
      const fullPath = join(dir, file);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        if (!exclude.includes(file)) {
          this.scanDirectory(fullPath, options);
        }
      } else if (stat.isFile()) {
        const ext = extname(file);
        if (extensions.includes(ext)) {
          this.scanFile(fullPath);
        }
      }
    }
  }

  /**
   * Scan a single file
   */
  scanFile(filePath) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const relativePath = filePath.replace(this.projectRoot + '/', '');

      this.stats.filesScanned++;
      this.stats.linesScanned += lines.length;

      // Run all checks
      this.checkLongFunctions(relativePath, content, lines);
      this.checkDeepNesting(relativePath, lines);
      this.checkMagicNumbers(relativePath, lines);
      this.checkConsoleStatements(relativePath, lines);
      this.checkTodoComments(relativePath, lines);
      this.checkLongLines(relativePath, lines);
      this.checkUnusedVariables(relativePath, content);
      this.checkMissingErrorHandling(relativePath, content);
    } catch (error) {
      // Skip files that can't be read
    }
  }

  /**
   * Check for long functions (>100 lines)
   */
  checkLongFunctions(file, content, lines) {
    const functionRegex = /(?:function\s+\w+|const\s+\w+\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))/g;
    let match;
    let currentFunction = null;
    let functionStart = 0;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!currentFunction && functionRegex.test(line)) {
        currentFunction = line.trim().slice(0, 50);
        functionStart = i + 1;
        braceDepth = 0;
      }

      if (currentFunction) {
        braceDepth += (line.match(/{/g) || []).length;
        braceDepth -= (line.match(/}/g) || []).length;

        if (braceDepth === 0 && line.includes('}')) {
          const functionLength = i - functionStart + 1;
          if (functionLength > 100) {
            this.addIssue({
              file,
              line: functionStart,
              severity: 'medium',
              type: 'long-function',
              message: `Function is ${functionLength} lines long (>100 lines)`,
              suggestion: 'Consider breaking this function into smaller functions',
            });
          }
          currentFunction = null;
        }
      }
    }
  }

  /**
   * Check for deep nesting (>4 levels)
   */
  checkDeepNesting(file, lines) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const indent = line.match(/^(\s*)/)[1].length;
      const indentLevel = Math.floor(indent / 2);

      if (indentLevel > 4 && line.trim().length > 0) {
        this.addIssue({
          file,
          line: i + 1,
          severity: 'low',
          type: 'deep-nesting',
          message: `Deep nesting detected (${indentLevel} levels)`,
          suggestion: 'Consider extracting nested logic into separate functions',
        });
      }
    }
  }

  /**
   * Check for magic numbers
   */
  checkMagicNumbers(file, lines) {
    const magicNumberRegex = /\b(\d{3,})\b/g;
    const allowedNumbers = new Set(['1000', '1024', '2048', '4096', '8192']);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('//') || line.includes('/*')) continue; // Skip comments

      let match;
      while ((match = magicNumberRegex.exec(line)) !== null) {
        const number = match[1];
        if (!allowedNumbers.has(number)) {
          this.addIssue({
            file,
            line: i + 1,
            severity: 'low',
            type: 'magic-number',
            message: `Magic number detected: ${number}`,
            suggestion: 'Consider using a named constant',
          });
        }
      }
    }
  }

  /**
   * Check for console statements
   */
  checkConsoleStatements(file, lines) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/console\.(log|debug|info)/.test(line) && !line.includes('console.error') && !line.includes('console.warn')) {
        this.addIssue({
          file,
          line: i + 1,
          severity: 'low',
          type: 'console-statement',
          message: 'Console statement found',
          suggestion: 'Remove or replace with proper logging',
        });
      }
    }
  }

  /**
   * Check for TODO comments
   */
  checkTodoComments(file, lines) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/\/\/\s*TODO|\/\*\s*TODO/.test(line)) {
        this.addIssue({
          file,
          line: i + 1,
          severity: 'info',
          type: 'todo-comment',
          message: 'TODO comment found',
          suggestion: 'Track in issue tracker or complete the task',
        });
      }
    }
  }

  /**
   * Check for long lines (>120 chars)
   */
  checkLongLines(file, lines) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 120 && !line.includes('http://') && !line.includes('https://')) {
        this.addIssue({
          file,
          line: i + 1,
          severity: 'low',
          type: 'long-line',
          message: `Line is ${line.length} characters (>120)`,
          suggestion: 'Break into multiple lines for readability',
        });
      }
    }
  }

  /**
   * Check for unused variables
   */
  checkUnusedVariables(file, content) {
    const varRegex = /(?:const|let|var)\s+(\w+)\s*=/g;
    let match;

    while ((match = varRegex.exec(content)) !== null) {
      const varName = match[1];
      if (varName.startsWith('_')) continue; // Intentionally unused

      const usageRegex = new RegExp(`\\b${varName}\\b`, 'g');
      const matches = content.match(usageRegex);

      if (matches && matches.length === 1) {
        this.addIssue({
          file,
          line: 0,
          severity: 'low',
          type: 'unused-variable',
          message: `Variable '${varName}' appears to be unused`,
          suggestion: 'Remove unused variable or prefix with _ if intentional',
        });
      }
    }
  }

  /**
   * Check for missing error handling
   */
  checkMissingErrorHandling(file, content) {
    const asyncFunctionRegex = /async\s+function\s+\w+|const\s+\w+\s*=\s*async/g;
    const hasTryCatch = /try\s*{[\s\S]*?}\s*catch/g;

    const asyncMatches = content.match(asyncFunctionRegex);
    const tryCatchMatches = content.match(hasTryCatch);

    if (asyncMatches && asyncMatches.length > 0) {
      const tryCatchCount = tryCatchMatches ? tryCatchMatches.length : 0;
      if (tryCatchCount < asyncMatches.length / 2) {
        this.addIssue({
          file,
          line: 0,
          severity: 'medium',
          type: 'missing-error-handling',
          message: `File has ${asyncMatches.length} async functions but only ${tryCatchCount} try-catch blocks`,
          suggestion: 'Add error handling to async functions',
        });
      }
    }
  }

  /**
   * Add an issue
   */
  addIssue(issue) {
    this.issues.push(issue);
    this.stats.issuesFound++;
  }

  /**
   * Generate report
   */
  generateReport() {
    const report = {
      summary: this.stats,
      issuesBySeverity: {
        high: this.issues.filter(i => i.severity === 'high').length,
        medium: this.issues.filter(i => i.severity === 'medium').length,
        low: this.issues.filter(i => i.severity === 'low').length,
        info: this.issues.filter(i => i.severity === 'info').length,
      },
      issuesByType: {},
      topIssues: [],
    };

    // Group by type
    for (const issue of this.issues) {
      if (!report.issuesByType[issue.type]) {
        report.issuesByType[issue.type] = 0;
      }
      report.issuesByType[issue.type]++;
    }

    // Get top issues (high and medium severity)
    report.topIssues = this.issues
      .filter(i => i.severity === 'high' || i.severity === 'medium')
      .slice(0, 20);

    return report;
  }

  /**
   * Print report
   */
  printReport() {
    const report = this.generateReport();

    console.log('\n📊 Code Quality Report\n');
    console.log('='.repeat(60));
    console.log(`Files scanned: ${report.summary.filesScanned}`);
    console.log(`Lines scanned: ${report.summary.linesScanned}`);
    console.log(`Issues found: ${report.summary.issuesFound}`);
    console.log('');

    console.log('Issues by severity:');
    console.log(`  🔴 High:   ${report.issuesBySeverity.high}`);
    console.log(`  🟡 Medium: ${report.issuesBySeverity.medium}`);
    console.log(`  🟢 Low:    ${report.issuesBySeverity.low}`);
    console.log(`  ℹ️  Info:   ${report.issuesBySeverity.info}`);
    console.log('');

    console.log('Issues by type:');
    for (const [type, count] of Object.entries(report.issuesByType)) {
      console.log(`  ${type}: ${count}`);
    }
    console.log('');

    if (report.topIssues.length > 0) {
      console.log('Top issues to fix:');
      for (const issue of report.topIssues.slice(0, 10)) {
        const emoji = issue.severity === 'high' ? '🔴' : '🟡';
        console.log(`  ${emoji} ${issue.file}:${issue.line} - ${issue.message}`);
      }
    }

    console.log('\n' + '='.repeat(60) + '\n');
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const projectRoot = process.argv[2] || process.cwd();
  const checker = new CodeQualityChecker(projectRoot);

  console.log(`Scanning ${projectRoot}...\n`);

  checker.scanDirectory(join(projectRoot, 'functions'));
  checker.scanDirectory(join(projectRoot, 'js'));

  checker.printReport();
}

export { CodeQualityChecker };
