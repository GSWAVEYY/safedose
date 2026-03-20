# SafeDose API — Environment Variables

Copy these into a `.env` file in `services/api/`. NEVER commit `.env` to git.

## Database (Supabase PostgreSQL)

```
DATABASE_URL="postgresql://postgres.hlsjzgwcjtbvavepsdah:[YOUR-DB-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
```

Get your password from: Supabase Dashboard → Project Settings → Database

## Auth

```
JWT_SECRET=""
```

Generate with: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

## Stripe

```
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
```

Create products: Premium ($4.99/mo), Family ($9.99/mo)

## Sentry

```
SENTRY_DSN=""
```

Create project: sentry.io → gswaveyy-org → new project "safedose-api" (platform: node)

## Server

```
NODE_ENV="development"
PORT=3001
HOST="0.0.0.0"
CORS_ORIGIN="http://localhost:8081"
ENABLE_TEST_PUSH="false"
```
