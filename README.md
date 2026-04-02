# VNPT Business Management

Project is split into two independent applications:

- `frontend/`: React + Vite UI
- `backend/`: Laravel API/app

## Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Build:

```bash
cd frontend
npm run build
```

## Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
npm install
php artisan serve --host=127.0.0.1 --port=8002
```

Build assets:

```bash
cd backend
npm run build
```

## Performance Testing

API performance smoke/load scripts live in [`perf/README.md`](./perf/README.md).

Quick start:

```bash
cd perf
npm run smoke
```

## AI Skills

This repo now includes a shared, model-agnostic UI redesign playbook:

- `docs/ui-redesign.md` - source of truth for the redesign workflow and design system
- `skills/ui-redesign.skill` - lightweight repo skill entry that points to the shared playbook
- `.claude/skills/ui-redesign/SKILL.md` - Claude wrapper that now reads the shared playbook instead of owning duplicate instructions

Use it when an AI assistant needs to redesign a page or component without changing business logic.
