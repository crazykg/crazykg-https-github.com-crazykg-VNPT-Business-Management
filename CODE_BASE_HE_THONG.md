# Code Base Hệ Thống - Tài liệu Tổng quan

**Cập nhật**: 2026-03-27

## Quick Metrics

| Category | Count |
|----------|-------|
| Backend Services | ~200 files |
| Frontend Components | ~150 TSX + ~50 TS |
| Backend Tests | ~100 tests |
| Frontend Tests | ~50 tests |
| Plan Documents | ~50 files |
| Skills | 2 skills |

## Mục lục

1. [Tổng quan Kiến trúc](#tổng-quan-kiến-trúc)
2. [Backend Services](#backend-services)
3. [Frontend Components](#frontend-components)
4. [Database](#database)
5. [Testing](#testing)
6. [Skills](#skills)

---

## Tổng quan Kiến trúc

### Monorepo Structure

```
qlcv2/
├── frontend/          → React 19 + Vite + TypeScript
├── backend/           → Laravel 12 + MySQL 8
├── perf/              → k6 load testing
├── plan-code/         → Architecture plans
├── docs/              → Documentation
└── .claude/skills/    → Claude Code skills
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, TypeScript, TailwindCSS |
| Backend | Laravel 12, PHP 8.4, MySQL 8, Redis |
| Auth | Sanctum (cookie-based) |
| Testing | Vitest, Playwright, PHPUnit |
 
