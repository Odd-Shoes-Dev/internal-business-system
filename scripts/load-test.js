#!/usr/bin/env node

/**
 * API Load Testing Script
 * Tests the BlueOx API endpoints under simulated high load
 * 
 * Usage:
 *   node load-test.js --endpoint=webhook --concurrent=10 --requests=100
 *   node load-test.js --endpoint=all --concurrent=5 --requests=50
 */

const https = require('https');
const http = require('http');
const crypto = require('crypto');

class ApiLoadTester {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:3000';
    this.results = [];
    this.startTime = Date.now();
  }

  /**
   * Generate test API key and salon ID for testing
   */
  generateTestCredentials() {
    return {
      apiKey: `test_${crypto.randomUUID()}`,
      salonId: `salon_${Math.floor(Math.random() * 1000)}`
    };
  }

  /**
   * Generate realistic salon webhook data
   */
  generateSalonWebhookData() {
    const saleId = `sale_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    return {
      event: 'salon.sale.completed',
      salon_id: `salon_${Math.floor(Math.random() * 100)}`,
      data: {
        sale_id: saleId,
        customer_id: `customer_${Math.floor(Math.random() * 500)}`,
        customer_name: `Test Customer ${Math.floor(Math.random() * 100)}`,
        amount: Math.floor(Math.random() * 500) + 50, // 50-550
        tax_amount: Math.floor(Math.random() * 50) + 5, // 5-55
        payment_method: ['cash', 'card', 'mobile_money'][Math.floor(Math.random() * 3)],
        currency: 'UGX',
        services: [
          {
            service_name: 'Hair Cut',
            staff_member: `Staff ${Math.floor(Math.random() * 10)}`,
            amount: Math.floor(Math.random() * 200) + 30,
            commission_amount: Math.floor(Math.random() * 20) + 5
          }
        ],
        timestamp: new Date().toISOString(),
        reference_number: saleId
      }
    };
  }

  /**
   * Make HTTP request and measure performance
   */
  async makeRequest(options) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const isHttps = options.url.startsWith('https');
      const client = isHttps ? https : http;

      const req = client.request(options.url, {
        method: options.method || 'POST',
        headers: options.headers || {},
        timeout: 30000 // 30 second timeout
      }, (res) => {
        let data = '';
        
        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          const endTime = Date.now();
          const duration = endTime - startTime;

          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data,
            duration: duration,
            success: res.statusCode >= 200 && res.statusCode < 400
          });
        });
      });

      req.on('error', (error) => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        reject({
          error: error.message,
          duration: duration,
          success: false
        });
      });

      req.on('timeout', () => {
        req.destroy();
        const endTime = Date.now();
        const duration = endTime - startTime;

        reject({
          error: 'Request timeout',
          duration: duration,
          success: false
        });
      });

      if (options.body) {
        req.write(JSON.stringify(options.body));
      }

      req.end();
    });
  }

  /**
   * Test webhook endpoint
   */
  async testWebhookEndpoint(concurrent = 10, totalRequests = 100) {
    console.log(`Testing webhook endpoint: ${concurrent} concurrent, ${totalRequests} total requests`);
    
    const requests = [];
    const credentials = this.generateTestCredentials();

    for (let i = 0; i < totalRequests; i++) {
      const requestPromise = this.makeRequest({
        url: `${this.baseUrl}/api/integrations/salon/webhook`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${credentials.apiKey}`,
          'X-Salon-ID': credentials.salonId
        },
        body: this.generateSalonWebhookData()
      }).catch(error => error); // Catch errors to include in results

      requests.push(requestPromise);

      // Manage concurrency
      if (requests.length >= concurrent) {
        const batch = requests.splice(0, concurrent);
        const batchResults = await Promise.all(batch);
        this.results.push(...batchResults);
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Process remaining requests
    if (requests.length > 0) {
      const remainingResults = await Promise.all(requests);
      this.results.push(...remainingResults);
    }
  }

  /**
   * Test health endpoint
   */
  async testHealthEndpoint(concurrent = 5, totalRequests = 50) {
    console.log(`Testing health endpoint: ${concurrent} concurrent, ${totalRequests} total requests`);
    
    const requests = [];

    for (let i = 0; i < totalRequests; i++) {
      const requestPromise = this.makeRequest({
        url: `${this.baseUrl}/api/health`,
        method: 'GET',
        headers: {
          'User-Agent': 'LoadTest/1.0'
        }
      }).catch(error => error);

      requests.push(requestPromise);

      if (requests.length >= concurrent) {
        const batch = requests.splice(0, concurrent);
        const batchResults = await Promise.all(batch);
        this.results.push(...batchResults);
        
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    if (requests.length > 0) {
      const remainingResults = await Promise.all(requests);
      this.results.push(...remainingResults);
    }
  }

  /**
   * Generate load test report
   */
  generateReport() {
    const totalTime = Date.now() - this.startTime;
    const totalRequests = this.results.length;
    const successfulRequests = this.results.filter(r => r.success).length;
    const failedRequests = totalRequests - successfulRequests;
    
    const durations = this.results.map(r => r.duration).sort((a, b) => a - b);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const p50 = durations[Math.floor(durations.length * 0.5)];
    const p95 = durations[Math.floor(durations.length * 0.95)];
    const p99 = durations[Math.floor(durations.length * 0.99)];
    
    const requestsPerSecond = (totalRequests / totalTime) * 1000;
    
    // Group by status code
    const statusCodes = {};
    this.results.forEach(result => {
      const code = result.statusCode || 'ERROR';
      statusCodes[code] = (statusCodes[code] || 0) + 1;
    });

    const report = {
      summary: {
        totalRequests,
        successfulRequests,
        failedRequests,
        successRate: (successfulRequests / totalRequests) * 100,
        totalTime: totalTime,
        requestsPerSecond: requestsPerSecond
      },
      performance: {
        averageResponseTime: Math.round(avgDuration),
        p50ResponseTime: p50,
        p95ResponseTime: p95,
        p99ResponseTime: p99,
        minResponseTime: durations[0],
        maxResponseTime: durations[durations.length - 1]
      },
      statusCodes,
      errors: this.results
        .filter(r => !r.success)
        .slice(0, 10) // Show first 10 errors
        .map(r => ({ error: r.error, duration: r.duration }))
    };

    return report;
  }

  /**
   * Print formatted report to console
   */
  printReport() {
    const report = this.generateReport();
    
    console.log('\n' + '='.repeat(60));
    console.log('API LOAD TEST REPORT');
    console.log('='.repeat(60));
    
    console.log('\nSUMMARY:');
    console.log(`Total Requests: ${report.summary.totalRequests}`);
    console.log(`Successful: ${report.summary.successfulRequests} (${report.summary.successRate.toFixed(1)}%)`);
    console.log(`Failed: ${report.summary.failedRequests}`);
    console.log(`Total Time: ${(report.summary.totalTime / 1000).toFixed(2)}s`);
    console.log(`Requests/sec: ${report.summary.requestsPerSecond.toFixed(2)}`);
    
    console.log('\nPERFORMANCE:');
    console.log(`Average Response Time: ${report.performance.averageResponseTime}ms`);
    console.log(`50th Percentile: ${report.performance.p50ResponseTime}ms`);
    console.log(`95th Percentile: ${report.performance.p95ResponseTime}ms`);
    console.log(`99th Percentile: ${report.performance.p99ResponseTime}ms`);
    console.log(`Min Response Time: ${report.performance.minResponseTime}ms`);
    console.log(`Max Response Time: ${report.performance.maxResponseTime}ms`);
    
    console.log('\nSTATUS CODES:');
    Object.entries(report.statusCodes).forEach(([code, count]) => {
      console.log(`${code}: ${count} requests`);
    });
    
    if (report.errors.length > 0) {
      console.log('\nFIRST 10 ERRORS:');
      report.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.error} (${error.duration}ms)`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
  }

  /**
   * Export results to JSON file
   */
  async exportResults(filename) {
    const fs = require('fs').promises;
    const report = this.generateReport();
    
    const fullReport = {
      timestamp: new Date().toISOString(),
      report,
      rawResults: this.results
    };
    
    await fs.writeFile(filename, JSON.stringify(fullReport, null, 2));
    console.log(`Results exported to ${filename}`);
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const options = {};
  
  args.forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      options[key] = value;
    }
  });

  const endpoint = options.endpoint || 'webhook';
  const concurrent = parseInt(options.concurrent) || 10;
  const requests = parseInt(options.requests) || 100;
  const baseUrl = options.url || 'http://localhost:3000';
  
  const tester = new ApiLoadTester({ baseUrl });
  
  console.log(`Starting load test...`);
  console.log(`Target: ${baseUrl}`);
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Concurrent: ${concurrent}`);
  console.log(`Total Requests: ${requests}`);
  console.log('');

  try {
    switch (endpoint) {
      case 'webhook':
        await tester.testWebhookEndpoint(concurrent, requests);
        break;
      case 'health':
        await tester.testHealthEndpoint(concurrent, requests);
        break;
      case 'all':
        await tester.testHealthEndpoint(Math.ceil(concurrent / 2), Math.ceil(requests / 2));
        await tester.testWebhookEndpoint(Math.ceil(concurrent / 2), Math.ceil(requests / 2));
        break;
      default:
        console.error(`Unknown endpoint: ${endpoint}`);
        process.exit(1);
    }

    tester.printReport();
    
    if (options.export) {
      await tester.exportResults(options.export);
    }
    
  } catch (error) {
    console.error('Load test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { ApiLoadTester };