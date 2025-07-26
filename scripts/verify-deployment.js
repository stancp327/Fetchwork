#!/usr/bin/env node

const https = require('https');

const BACKEND_URL = process.env.BACKEND_URL || 'https://fetchwork-1.onrender.com';

async function makeRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = res.headers['content-type']?.includes('application/json') 
            ? JSON.parse(data) 
            : data;
          resolve({ status: res.statusCode, data: parsed });
        } catch (err) {
          resolve({ status: res.statusCode, data });
        }
      });
    }).on('error', reject);
  });
}

async function verifyDeployment() {
  console.log('🔍 Verifying Render deployment...');
  console.log(`Backend URL: ${BACKEND_URL}`);
  
  const tests = [
    { name: 'Root endpoint', url: `${BACKEND_URL}/` },
    { name: 'Database connection', url: `${BACKEND_URL}/test-db` },
    { name: 'Health check', url: `${BACKEND_URL}/health` },
    { name: 'Auth endpoint', url: `${BACKEND_URL}/api/auth/me` }
  ];

  let allPassed = true;

  for (const test of tests) {
    try {
      const result = await makeRequest(test.url);
      const passed = result.status === 200 || (test.name === 'Auth endpoint' && result.status === 401);
      
      console.log(`${passed ? '✅' : '❌'} ${test.name}: HTTP ${result.status}`);
      if (!passed) allPassed = false;
      
      if (test.name === 'Health check' && result.data) {
        console.log(`   Environment variables: ${JSON.stringify(result.data.environmentVariables)}`);
        console.log(`   Services: ${JSON.stringify(result.data.services)}`);
      }
    } catch (err) {
      console.log(`❌ ${test.name}: ${err.message}`);
      allPassed = false;
    }
  }

  console.log('');
  console.log(allPassed ? '✅ Deployment verification passed' : '❌ Deployment verification failed');
  process.exit(allPassed ? 0 : 1);
}

verifyDeployment();
