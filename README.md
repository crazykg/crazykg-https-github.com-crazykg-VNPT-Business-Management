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
