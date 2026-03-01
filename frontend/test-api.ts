import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../.env' });

const apiKey = process.env.VITE_ANTHROPIC_API_KEY;

console.log('=== Anthropic API Key Test ===\n');
console.log('API Key loaded:', apiKey ? '✅ (key exists)' : '❌ (key missing)');

if (apiKey) {
  console.log('Key length:', apiKey.length);
  console.log('Valid format:', apiKey.startsWith('sk-') ? '✅' : '❌');
  console.log('First 10 chars:', apiKey.substring(0, 10) + '...');
} else {
  console.log('❌ Không tìm thấy API key!');
}
