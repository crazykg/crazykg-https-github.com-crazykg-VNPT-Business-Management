import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../.env' });

const apiKey = process.env.VITE_ANTHROPIC_API_KEY;

process.stdout.write('=== Anthropic API Key Test ===\n\n');
process.stdout.write(`API Key loaded: ${apiKey ? '✅ (key exists)' : '❌ (key missing)'}\n`);

if (apiKey) {
  process.stdout.write(`Key length: ${apiKey.length}\n`);
  process.stdout.write(`Valid format: ${apiKey.startsWith('sk-') ? '✅' : '❌'}\n`);
  process.stdout.write(`First 10 chars: ${apiKey.substring(0, 10)}...\n`);
} else {
  process.stdout.write('❌ Không tìm thấy API key!\n');
}
