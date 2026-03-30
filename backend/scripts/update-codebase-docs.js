#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const repoRoot = path.resolve(scriptDir, '../..');

const codebaseDocPath = path.join(repoRoot, 'CODE_BASE_HE_THONG.md');
const lastScanPath = path.join(repoRoot, '.last-scan.json');
const frontendPackagePath = path.join(repoRoot, 'frontend/package.json');
const backendComposerPath = path.join(repoRoot, 'backend/composer.json');
const frontendComponentsPath = path.join(repoRoot, 'frontend/components');
const frontendStoresPath = path.join(repoRoot, 'frontend/shared/stores');
const frontendHooksPath = path.join(repoRoot, 'frontend/hooks');
const frontendCustomerRequestHooksPath = path.join(repoRoot, 'frontend/components/customer-request/hooks');
const frontendTestsPath = path.join(repoRoot, 'frontend/__tests__');
const frontendE2ePath = path.join(repoRoot, 'frontend/e2e');
const backendServicesPath = path.join(repoRoot, 'backend/app/Services/V5');
const backendMigrationsPath = path.join(repoRoot, 'backend/database/migrations');
const backendTestsPath = path.join(repoRoot, 'backend/tests');
const planDocsPath = path.join(repoRoot, 'plan-code');
const repoSkillsPath = fs.existsSync(path.join(repoRoot, 'skills'))
  ? path.join(repoRoot, 'skills')
  : path.join(repoRoot, '.claude/skills');

const start = Date.now();

function readJson(filePath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function walkFiles(directoryPath, visitor) {
  if (!fs.existsSync(directoryPath)) {
    return;
  }

  for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
    const fullPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, visitor);
      continue;
    }
    if (entry.isFile()) {
      visitor(fullPath, entry.name);
    }
  }
}

function countFiles(directoryPath, predicate) {
  let count = 0;
  walkFiles(directoryPath, (fullPath, fileName) => {
    if (predicate(fullPath, fileName)) {
      count += 1;
    }
  });
  return count;
}

function listDirectoryNames(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  return fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, 'vi'));
}

function listFileBaseNames(directoryPath, extensions) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  return fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && extensions.some((extension) => entry.name.endsWith(extension)))
    .map((entry) => path.parse(entry.name).name)
    .sort((a, b) => a.localeCompare(b, 'vi'));
}

function listLatestFileNames(directoryPath, extension, limit) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  return fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, 'vi'))
    .slice(-limit);
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function toSentenceList(values) {
  return values.length > 0 ? values.join(', ') : 'Khong co';
}

function diffVersionMaps(previous = {}, current = {}, label) {
  const messages = [];
  const keys = Array.from(new Set([...Object.keys(previous), ...Object.keys(current)])).sort((a, b) => a.localeCompare(b, 'vi'));

  for (const key of keys) {
    const previousValue = previous[key] ?? null;
    const currentValue = current[key] ?? null;
    if (previousValue === currentValue) {
      continue;
    }

    if (previousValue === null) {
      messages.push(`${label}: them ${key} = ${currentValue}`);
      continue;
    }

    if (currentValue === null) {
      messages.push(`${label}: xoa ${key} (truoc do ${previousValue})`);
      continue;
    }

    messages.push(`${label}: ${key} ${previousValue} -> ${currentValue}`);
  }

  return messages;
}

function diffArrays(previous = [], current = [], label) {
  const previousSet = new Set(previous);
  const currentSet = new Set(current);
  const added = current.filter((item) => !previousSet.has(item));
  const removed = previous.filter((item) => !currentSet.has(item));
  const messages = [];

  if (added.length > 0) {
    messages.push(`${label}: them ${added.length} (${added.join(', ')})`);
  }

  if (removed.length > 0) {
    messages.push(`${label}: xoa ${removed.length} (${removed.join(', ')})`);
  }

  return messages;
}

function diffCount(previous, current, label) {
  if (typeof previous !== 'number' || previous === current) {
    return [];
  }

  return [`${label}: ${previous} -> ${current}`];
}

const previousScan = readJson(lastScanPath, {});
const frontendPackage = readJson(frontendPackagePath, {});
const backendComposer = readJson(backendComposerPath, {});

const frontendVersions = {
  react: frontendPackage.dependencies?.react ?? 'n/a',
  vite: frontendPackage.devDependencies?.vite ?? 'n/a',
  typescript: frontendPackage.devDependencies?.typescript ?? 'n/a',
  zustand: frontendPackage.dependencies?.zustand ?? 'n/a',
  tailwindcss: frontendPackage.devDependencies?.tailwindcss ?? 'n/a',
  playwright: frontendPackage.devDependencies?.['@playwright/test'] ?? 'n/a',
  vitest: frontendPackage.devDependencies?.vitest ?? 'n/a',
};

const backendVersions = {
  php: backendComposer.require?.php ?? 'n/a',
  laravel: backendComposer.require?.['laravel/framework'] ?? 'n/a',
  sanctum: backendComposer.require?.['laravel/sanctum'] ?? 'n/a',
  phpunit: backendComposer['require-dev']?.['phpunit/phpunit'] ?? 'n/a',
};

const componentGroups = listDirectoryNames(frontendComponentsPath);
const storeFiles = listFileBaseNames(frontendStoresPath, ['.ts', '.tsx']);
const hookFiles = Array.from(
  new Set([
    ...listFileBaseNames(frontendHooksPath, ['.ts', '.tsx']),
    ...listFileBaseNames(frontendCustomerRequestHooksPath, ['.ts', '.tsx']),
  ])
).sort((a, b) => a.localeCompare(b, 'vi'));
const serviceDirectories = listDirectoryNames(backendServicesPath);
const latestMigrations = listLatestFileNames(backendMigrationsPath, '.php', 5);
const skillFiles = listFileBaseNames(repoSkillsPath, ['.skill']);

const frontendUnitTestCount = countFiles(
  frontendTestsPath,
  (fullPath) => fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')
);
const backendTestCount = countFiles(
  backendTestsPath,
  (_, fileName) => fileName.endsWith('Test.php')
);
const e2eSpecCount = countFiles(
  frontendE2ePath,
  (_, fileName) => fileName.endsWith('.spec.ts')
);
const backendServiceFileCount = countFiles(
  backendServicesPath,
  (_, fileName) => fileName.endsWith('.php')
);
const frontendComponentFileCount = countFiles(
  frontendComponentsPath,
  (_, fileName) => fileName.endsWith('.tsx')
);
const planDocumentCount = countFiles(
  planDocsPath,
  (_, fileName) => fileName.endsWith('.md')
);
const migrationFileCount = countFiles(
  backendMigrationsPath,
  (_, fileName) => fileName.endsWith('.php')
);

const nextScan = {
  timestamp: new Date().toISOString(),
  changes: [],
  frontend: {
    versions: frontendVersions,
    components: componentGroups,
    stores: storeFiles,
    hooks: hookFiles,
    e2eTests: e2eSpecCount,
  },
  backend: {
    versions: backendVersions,
    services: serviceDirectories,
    migrations: latestMigrations,
  },
  tests: {
    frontend: frontendUnitTestCount,
    backend: backendTestCount,
    e2e: e2eSpecCount,
  },
  e2eTests: e2eSpecCount,
  metrics: {
    backendServices: backendServiceFileCount,
    frontendComponents: frontendComponentFileCount,
    backendTests: backendTestCount,
    frontendTests: frontendUnitTestCount,
    planDocuments: planDocumentCount,
    skills: skillFiles.length,
    migrations: migrationFileCount,
  },
};

const changes = [
  ...diffVersionMaps(previousScan.frontend?.versions, nextScan.frontend.versions, 'Frontend versions'),
  ...diffVersionMaps(previousScan.backend?.versions, nextScan.backend.versions, 'Backend versions'),
  ...diffArrays(previousScan.frontend?.components, nextScan.frontend.components, 'Frontend component groups'),
  ...diffArrays(previousScan.frontend?.stores, nextScan.frontend.stores, 'Frontend stores'),
  ...diffArrays(previousScan.frontend?.hooks, nextScan.frontend.hooks, 'Frontend hooks'),
  ...diffArrays(previousScan.backend?.services, nextScan.backend.services, 'Backend service directories'),
  ...diffCount(previousScan.tests?.frontend, nextScan.tests.frontend, 'Frontend tests'),
  ...diffCount(previousScan.tests?.backend, nextScan.tests.backend, 'Backend tests'),
  ...diffCount(previousScan.tests?.e2e ?? previousScan.e2eTests, nextScan.tests.e2e, 'E2E tests'),
  ...diffCount(previousScan.metrics?.planDocuments, nextScan.metrics.planDocuments, 'Plan documents'),
  ...diffCount(previousScan.metrics?.skills, nextScan.metrics.skills, 'Repo skills'),
];

nextScan.changes = changes;

const repoName = path.basename(repoRoot);
const skillsRelativePath = path.relative(repoRoot, repoSkillsPath) || 'skills';
const changeSummaryLines = changes.length > 0
  ? changes.map((change) => `- ${change}`).join('\n')
  : '- Khong co thay doi dang ke so voi lan quet truoc.';
const latestMigrationLines = latestMigrations.length > 0
  ? latestMigrations.map((migration) => `- \`${migration}\``).join('\n')
  : '- Khong co migration nao.';

const codebaseDoc = `# Code Base Hệ Thống - Tài liệu Tổng quan

**Cập nhật**: ${formatDate(new Date(nextScan.timestamp))}

## Quick Metrics

| Category | Count |
|----------|-------|
| Backend Services | ${nextScan.metrics.backendServices} files |
| Frontend Components | ${nextScan.metrics.frontendComponents} TSX files |
| Backend Tests | ${nextScan.metrics.backendTests} tests |
| Frontend Tests | ${nextScan.metrics.frontendTests} tests |
| E2E Tests | ${nextScan.tests.e2e} specs |
| Plan Documents | ${nextScan.metrics.planDocuments} files |
| Skills | ${nextScan.metrics.skills} skills |

## Mục lục

1. [Tổng quan Kiến trúc](#tổng-quan-kiến-trúc)
2. [Backend Services](#backend-services)
3. [Frontend Components](#frontend-components)
4. [Database](#database)
5. [Testing](#testing)
6. [Skills](#skills)
7. [Recent Scan](#recent-scan)

---

## Tổng quan Kiến trúc

### Monorepo Structure

\`\`\`
${repoName}/
├── frontend/          -> React + Vite + TypeScript
├── backend/           -> Laravel API
├── perf/              -> Load testing
├── plan-code/         -> Architecture plans
├── docs/              -> Documentation
└── ${skillsRelativePath}/ -> Repo skills
\`\`\`

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React ${nextScan.frontend.versions.react}, Vite ${nextScan.frontend.versions.vite}, TypeScript ${nextScan.frontend.versions.typescript}, TailwindCSS ${nextScan.frontend.versions.tailwindcss} |
| State | Zustand ${nextScan.frontend.versions.zustand} |
| Backend | Laravel ${nextScan.backend.versions.laravel}, PHP ${nextScan.backend.versions.php}, Sanctum ${nextScan.backend.versions.sanctum} |
| Testing | Vitest ${nextScan.frontend.versions.vitest}, Playwright ${nextScan.frontend.versions.playwright}, PHPUnit ${nextScan.backend.versions.phpunit} |

## Backend Services

- Service directories (${nextScan.backend.services.length}): ${toSentenceList(nextScan.backend.services)}
- PHP service files: ${nextScan.metrics.backendServices}
- Latest migrations:
${latestMigrationLines}

## Frontend Components

- Component groups (${nextScan.frontend.components.length}): ${toSentenceList(nextScan.frontend.components)}
- TSX component files: ${nextScan.metrics.frontendComponents}
- Shared stores (${nextScan.frontend.stores.length}): ${toSentenceList(nextScan.frontend.stores)}
- Custom hooks (${nextScan.frontend.hooks.length}): ${toSentenceList(nextScan.frontend.hooks)}

## Database

- Backend migrations scanned: ${nextScan.metrics.migrations}
- Latest migrations:
${latestMigrationLines}

## Testing

- Frontend unit tests: ${nextScan.tests.frontend}
- Frontend E2E specs: ${nextScan.tests.e2e}
- Backend PHP tests: ${nextScan.tests.backend}

## Skills

- Repo skills (${skillFiles.length}): ${toSentenceList(skillFiles)}

## Recent Scan

- Last scan timestamp: ${nextScan.timestamp}
- Change summary:
${changeSummaryLines}
`;

fs.writeFileSync(lastScanPath, `${JSON.stringify(nextScan, null, 2)}\n`, 'utf8');
fs.writeFileSync(codebaseDocPath, codebaseDoc.trimEnd() + '\n', 'utf8');

const durationSeconds = ((Date.now() - start) / 1000).toFixed(2);

console.log(`Update complete in ${durationSeconds}s`);
if (changes.length === 0) {
  console.log('No significant changes detected');
} else {
  console.log(`${changes.length} changes detected:`);
  for (const change of changes) {
    console.log(`- ${change}`);
  }
}

console.log('Stats:');
console.log(`- Frontend component files: ${nextScan.metrics.frontendComponents}`);
console.log(`- Frontend tests: ${nextScan.tests.frontend}`);
console.log(`- E2E specs: ${nextScan.tests.e2e}`);
console.log(`- Backend service files: ${nextScan.metrics.backendServices}`);
console.log(`- Backend tests: ${nextScan.tests.backend}`);
