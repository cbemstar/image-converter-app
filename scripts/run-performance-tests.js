#!/usr/bin/env node

/**
 * Performance Test Runner
 * 
 * Runs comprehensive performance and load tests with detailed reporting
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class PerformanceTestRunner {
  constructor() {
    this.results = {
      startTime: new Date(),
      endTime: null,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      testSuites: [],
      performanceMetrics: {},
      summary: {}
    };
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  logHeader(message) {
    this.log(`\n${'='.repeat(60)}`, 'cyan');
    this.log(`${message}`, 'bright');
    this.log(`${'='.repeat(60)}`, 'cyan');
  }

  logSubHeader(message) {
    this.log(`\n${'-'.repeat(40)}`, 'blue');
    this.log(`${message}`, 'blue');
    this.log(`${'-'.repeat(40)}`, 'blue');
  }

  async runTestSuite(suiteName, testPattern, timeout = 60000) {
    this.logSubHeader(`Running ${suiteName}`);
    
    const startTime = Date.now();
    let success = false;
    let output = '';
    let error = '';

    try {
      // Run Jest with specific test pattern
      const command = `npm test -- --testNamePattern="${testPattern}" --verbose --detectOpenHandles --forceExit --testTimeout=${timeout}`;
      
      this.log(`Executing: ${command}`, 'yellow');
      
      output = execSync(command, { 
        encoding: 'utf8',
        timeout: timeout + 10000, // Add buffer to Jest timeout
        stdio: 'pipe'
      });
      
      success = true;
      this.log(`✅ ${suiteName} completed successfully`, 'green');
      
    } catch (err) {
      error = err.message;
      output = err.stdout || '';
      
      this.log(`❌ ${suiteName} failed`, 'red');
      if (err.stdout) {
        this.log('STDOUT:', 'yellow');
        this.log(err.stdout, 'reset');
      }
      if (err.stderr) {
        this.log('STDERR:', 'red');
        this.log(err.stderr, 'reset');
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    const suiteResult = {
      name: suiteName,
      success,
      duration,
      output,
      error,
      timestamp: new Date(startTime)
    };

    this.results.testSuites.push(suiteResult);
    
    if (success) {
      this.results.passedTests++;
    } else {
      this.results.failedTests++;
    }
    
    this.results.totalTests++;

    return suiteResult;
  }

  extractPerformanceMetrics(output) {
    const metrics = {};
    
    // Extract test execution times
    const timeMatches = output.match(/Time:\s+(\d+\.?\d*)\s*s/g);
    if (timeMatches) {
      metrics.executionTimes = timeMatches.map(match => 
        parseFloat(match.match(/(\d+\.?\d*)/)[1])
      );
    }

    // Extract test counts
    const testCountMatch = output.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+total/);
    if (testCountMatch) {
      metrics.testsRun = parseInt(testCountMatch[2]);
      metrics.testsPassed = parseInt(testCountMatch[1]);
    }

    // Extract performance-specific metrics from test output
    const performanceLines = output.split('\n').filter(line => 
      line.includes('ms') || 
      line.includes('per second') || 
      line.includes('throughput') ||
      line.includes('latency')
    );

    if (performanceLines.length > 0) {
      metrics.performanceIndicators = performanceLines;
    }

    return metrics;
  }

  generateReport() {
    this.results.endTime = new Date();
    const totalDuration = this.results.endTime - this.results.startTime;

    this.logHeader('PERFORMANCE TEST REPORT');

    // Summary
    this.log(`\nTest Execution Summary:`, 'bright');
    this.log(`  Start Time: ${this.results.startTime.toISOString()}`, 'cyan');
    this.log(`  End Time: ${this.results.endTime.toISOString()}`, 'cyan');
    this.log(`  Total Duration: ${(totalDuration / 1000).toFixed(2)} seconds`, 'cyan');
    this.log(`  Total Test Suites: ${this.results.totalTests}`, 'cyan');
    this.log(`  Passed: ${this.results.passedTests}`, 'green');
    this.log(`  Failed: ${this.results.failedTests}`, this.results.failedTests > 0 ? 'red' : 'green');

    // Individual suite results
    this.log(`\nTest Suite Results:`, 'bright');
    this.results.testSuites.forEach(suite => {
      const status = suite.success ? '✅' : '❌';
      const color = suite.success ? 'green' : 'red';
      this.log(`  ${status} ${suite.name}: ${(suite.duration / 1000).toFixed(2)}s`, color);
      
      if (!suite.success && suite.error) {
        this.log(`    Error: ${suite.error.split('\n')[0]}`, 'red');
      }
    });

    // Performance metrics
    this.log(`\nPerformance Metrics:`, 'bright');
    this.results.testSuites.forEach(suite => {
      if (suite.success && suite.output) {
        const metrics = this.extractPerformanceMetrics(suite.output);
        if (Object.keys(metrics).length > 0) {
          this.log(`  ${suite.name}:`, 'cyan');
          
          if (metrics.executionTimes) {
            this.log(`    Execution Time: ${metrics.executionTimes[0]}s`, 'yellow');
          }
          
          if (metrics.testsRun) {
            this.log(`    Tests Run: ${metrics.testsRun}`, 'yellow');
            this.log(`    Tests Passed: ${metrics.testsPassed}`, 'yellow');
          }
          
          if (metrics.performanceIndicators && metrics.performanceIndicators.length > 0) {
            this.log(`    Performance Indicators:`, 'yellow');
            metrics.performanceIndicators.slice(0, 5).forEach(indicator => {
              this.log(`      ${indicator.trim()}`, 'reset');
            });
          }
        }
      }
    });

    // Recommendations
    this.log(`\nRecommendations:`, 'bright');
    
    if (this.results.failedTests > 0) {
      this.log(`  ⚠️  ${this.results.failedTests} test suite(s) failed. Review the errors above.`, 'yellow');
    }
    
    const longRunningSuites = this.results.testSuites.filter(suite => suite.duration > 30000);
    if (longRunningSuites.length > 0) {
      this.log(`  ⚠️  ${longRunningSuites.length} test suite(s) took longer than 30 seconds:`, 'yellow');
      longRunningSuites.forEach(suite => {
        this.log(`      ${suite.name}: ${(suite.duration / 1000).toFixed(2)}s`, 'yellow');
      });
    }

    if (this.results.passedTests === this.results.totalTests) {
      this.log(`  ✅ All performance tests passed! System is performing within acceptable limits.`, 'green');
    }

    // Save detailed report to file
    this.saveReportToFile();

    return this.results.failedTests === 0;
  }

  saveReportToFile() {
    const reportDir = path.join(__dirname, '../test-reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = path.join(reportDir, `performance-test-report-${timestamp}.json`);

    const detailedReport = {
      ...this.results,
      summary: {
        totalDuration: this.results.endTime - this.results.startTime,
        successRate: this.results.passedTests / this.results.totalTests,
        averageSuiteDuration: this.results.testSuites.reduce((sum, suite) => sum + suite.duration, 0) / this.results.testSuites.length
      }
    };

    fs.writeFileSync(reportFile, JSON.stringify(detailedReport, null, 2));
    this.log(`\nDetailed report saved to: ${reportFile}`, 'cyan');
  }

  async run() {
    this.logHeader('STARTING PERFORMANCE TEST SUITE');
    
    this.log('This test suite will evaluate system performance under various load conditions.', 'cyan');
    this.log('Tests include: conversion processing, concurrent users, database performance, and stress testing.', 'cyan');

    try {
      // Run performance test suites
      await this.runTestSuite(
        'Conversion Processing Performance',
        'Conversion Processing Performance Tests',
        120000 // 2 minutes timeout
      );

      await this.runTestSuite(
        'Concurrent User Load Tests',
        'Concurrent User Load Tests',
        180000 // 3 minutes timeout
      );

      // Optional: Run database tests if Supabase is available
      try {
        execSync('curl -s http://localhost:54321/health', { stdio: 'pipe', timeout: 5000 });
        this.log('\n🔍 Supabase detected - including database performance tests', 'cyan');
        
        await this.runTestSuite(
          'Database Performance Tests',
          'Database.*performance|Database.*load',
          90000 // 1.5 minutes timeout
        );
      } catch (error) {
        this.log('\n⚠️  Supabase not running - skipping database performance tests', 'yellow');
        this.log('   Start Supabase with "supabase start" to include database tests', 'yellow');
      }

    } catch (error) {
      this.log(`\n❌ Critical error during test execution: ${error.message}`, 'red');
      this.results.failedTests++;
    }

    // Generate and display report
    const success = this.generateReport();

    // Exit with appropriate code
    process.exit(success ? 0 : 1);
  }
}

// Run the performance test suite
if (require.main === module) {
  const runner = new PerformanceTestRunner();
  runner.run().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = PerformanceTestRunner;