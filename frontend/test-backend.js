// Test Backend Connection
const BACKEND_URL = 'https://medi-backend-q4wc.onrender.com';

console.log('Testing backend connection...\n');

// Test 1: Health Check
fetch(`${BACKEND_URL}/api/`)
  .then(res => res.json())
  .then(data => {
    console.log('✅ Backend API is working!');
    console.log('Response:', data);
    console.log('\n---\n');
    
    // Test 2: Check reports endpoint
    return fetch(`${BACKEND_URL}/api/reports`);
  })
  .then(res => res.json())
  .then(data => {
    console.log('✅ Reports endpoint working!');
    console.log('Reports count:', data.length);
    console.log('\n---\n');
    console.log('🎉 All tests passed! Your backend is fully operational.');
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
  });
