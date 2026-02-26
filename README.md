# ImmoAlert - Real Estate SaaS Platform

## Overview

ImmoAlert is a real estate SaaS platform that automatically scrapes Facebook property listings, enriches them with AI, and notifies matching users via WhatsApp.

## Architecture

- **Backend**: Node.js/Express with TypeScript, Prisma ORM, Supabase PostgreSQL
- **Frontend**: React 18 with TypeScript, Vite, TailwindCSS, React Query
- **AI**: OpenAI GPT for property data extraction and classification
- **Messaging**: Whapi (WhatsApp API) for user notifications
- **Scraping**: RapidAPI Facebook Scraper

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Supabase account
- Whapi account
- OpenAI API key
- RapidAPI key

### Local Development

1. **Clone and setup**:
```bash
cd immoalert
```

2. **Backend setup**:
```bash
cd backend
cp .env.example .env
# Edit .env with your credentials
npm install
npx prisma migrate dev
npm run dev
```

3. **Frontend setup**:
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

### Docker Deployment

1. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with production credentials
```

2. **Deploy**:
```bash
./deploy.sh production
```

Or manually:
```bash
docker-compose build
docker-compose up -d
```

3. **Verify deployment**:
- Frontend: http://localhost
- Backend API: http://localhost:3000/health

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `WHAPI_TOKEN` | Whapi authentication token |
| `OPENAI_API_KEY` | OpenAI API key |
| `RAPIDAPI_KEY` | RapidAPI key |
| `JWT_SECRET` | Secret for JWT signing |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `SCRAPER_INTERVAL_MINUTES` | 30 | Facebook scraping interval |
| `ENRICHMENT_INTERVAL_MINUTES` | 5 | AI enrichment interval |
| `MATCHING_INTERVAL_MINUTES` | 3 | User matching interval |
| `AI_CONFIDENCE_THRESHOLD` | 0.7 | Minimum AI confidence score |
| `MAX_LISTINGS_PER_BATCH` | 50 | Max listings processed per batch |

## Project Structure

```
immoalert/
├── backend/
│   ├── src/
│   │   ├── config/        # Database & configuration
│   │   ├── controllers/   # API controllers
│   │   ├── jobs/          # Cron jobs
│   │   ├── routes/        # API routes
│   │   └── services/      # Business logic
│   ├── prisma/
│   │   └── schema.prisma  # Database schema
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   └── services/      # API services
│   └── Dockerfile
├── docker-compose.yml
└── deploy.sh
```

## API Endpoints

### Public
- `GET /health` - Health check
- `POST /webhooks/whapi` - Whapi webhook

### Admin
- `GET /api/admin/dashboard` - Dashboard stats
- `GET /api/admin/listings` - List listings
- `GET /api/admin/groups` - List groups
- `POST /api/admin/scrape` - Trigger scraping
- `POST /api/admin/enrich` - Trigger AI enrichment
- `POST /api/admin/match` - Trigger matching

### Users
- `GET /api/users` - List users
- `GET /api/users/:id` - Get user details
- `PUT /api/users/:id` - Update user
- `GET /api/users/:id/conversations` - Get conversation history

## License

MIT
