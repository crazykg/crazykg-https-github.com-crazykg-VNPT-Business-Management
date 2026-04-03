#!/usr/bin/env node

/**
 * Simple script to update codebase documentation
 * Usage: node update-codebase-docs.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function countFiles(dir, ext) {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += countFiles(fullPath, ext);
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      count++;
    }
  }
  return count;
}

process.stdout.write('📊 Codebase Metrics\n');
process.stdout.write('==================\n\n');

const metrics = {
  'Backend Services': countFiles(path.join(ROOT, 'backend/app/Services/V5'), '.php'),
  'Frontend Components': countFiles(path.join(ROOT, 'frontend/components'), '.tsx'),
  'Backend Tests': countFiles(path.join(ROOT, 'backend/tests/Feature'), '.php'),
  'Frontend Tests': countFiles(path.join(ROOT, 'frontend/__tests__'), '.ts'),
  'Plan Documents': countFiles(path.join(ROOT, 'plan-code'), '.md'),
  'Skills': fs.readdirSync(path.join(ROOT, '.claude/skills'), { withFileTypes: true })
    .filter(e => e.isDirectory()).length
};

for (const [key, value] of Object.entries(metrics)) {
  process.stdout.write(`${key}: ${value}\n`);
}

process.stdout.write('\n✅ Documentation ready to update\n');
