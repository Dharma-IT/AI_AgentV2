# Maria AI Agent

Maria is a React and Express conversational clinic assistant. Milestone 3.5 connects approved Supabase business knowledge and semantic guidance to Maria through hybrid retrieval.

## Applications

- `/` — Maria's customer-facing chat from Milestone 2
- `/admin` — development-only admin dashboard preview
- `/api/health` — API and integration configuration status
- `/api/admin/status` — protected admin foundation endpoint
- `/admin/knowledge-health` — live retrieval and embedding health

Products, pricing, promotions, payment methods, shipping rules, clinic information, FAQs, policies, and conversational guidance use real database CRUD. Maria retrieves current exact facts directly and semantic guidance through pgvector.

## Project structure

```text
src/
  admin/                    Admin layout, navigation, pages, and reusable UI
  App.tsx                   Maria customer chat
  router.tsx                Customer/admin route boundary
server/src/
  admin/                    Future knowledge schemas, repositories, and services
  config/                   Environment and clinic configuration
  domain/                   Conversation contracts
  lib/                      OpenAI and optional Supabase clients
  middleware/               Error handling and admin authentication
  knowledge/                Structured retrieval, embeddings, vector search, and health
  repositories/             Conversation persistence abstraction
  routes/                   Customer and protected admin routes
  services/                 Maria and conversation orchestration
supabase/
  migrations/               Applied additive PostgreSQL migrations
```

## Local setup without Supabase

1. Copy `.env.example` to `.env`.
2. Set the required `OPENAI_API_KEY`.
3. Configure Supabase variables to use the admin dashboard, or leave them empty when working only on Maria chat.
4. Run `npm install` and `npm run dev`.
5. Open `http://localhost:5173` or `http://localhost:5173/admin`.

The UI and conversation shell can start without Supabase, but Maria conservatively refers current business questions to clinic staff when no approved data can be retrieved. Protected admin APIs return `503` when Supabase is not configured.

## Supabase setup

When a project is available, configure these backend-only variables:

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_PASSWORD=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Only the project URL and publishable/anon key may use `VITE_` for native browser authentication. The service-role key and database password must never enter frontend code or browser bundles. `SUPABASE_DB_PASSWORD` is used only for trusted migration tooling.

Review [the prepared migration](supabase/migrations/202610030001_admin_knowledge_foundation.sql) in a staging project before running the Supabase CLI workflow:

```bash
supabase link
supabase db push
```

The foundation migration was applied and verified against the configured project on October 3, 2026.

## Authentication flow

1. The login page authenticates directly with native Supabase Auth using the browser-safe publishable key.
2. The Supabase client persists the session, restores it after reload, and automatically refreshes access tokens.
3. The browser sends the current access token as `Authorization: Bearer <token>`.
4. Express verifies the token through Supabase Auth.
5. Express requires a matching active `admin_users` record and never trusts frontend role claims.
6. Roles grant read-only viewer or editor/admin access.
7. Trusted backend database work uses the service-role client only on the server.

The initial administrator must be provisioned through a trusted administrative process. Hiding `/admin` in the frontend is not an authorization control.

## Database foundation

The migration prepares UUID-keyed tables for administrators, products, pricing, promotions, payment methods, shipping rules, FAQs, conversation knowledge, objections, scenarios, compliance, documents, and audit logs. Knowledge records support `draft`, `published`, and `archived` states, actor references, timestamps, validation constraints, indexes, update triggers, and RLS policies.

## Commands

- `npm run dev` — start the client and API
- `npm run build` — compile both applications
- `npm run lint` — lint frontend and backend
- `npm test` — run conversation-engine tests
- `npm start` — run the compiled API

## Commercial management

Authorized administrators can search, filter, paginate, create, edit, publish, unpublish, archive, and delete commercial records. Prices are stored as integer cents. Promotion responses expose computed expiration/current-validity indicators, and future Maria retrieval can use the backend's published-current query method.

## Business information management

Shipping eligibility is controlled by unique state rules rather than assumed coverage. Clinic information, multilingual approved FAQs, and versioned policies support draft, published, and archived states. Published-current service methods exclude drafts, archived records, inactive shipping rules, and expired policies. These methods are not connected to Maria yet.

## Conversation knowledge management

Administrators can manage multilingual, categorized, prioritized, versioned guidance across conversation knowledge, objection handling, and conversation scenarios. Published-current service methods exclude drafts and archived records and support language/category filtering through the admin query layer. These records are intentionally not connected to Maria until Milestone 3.5.

## Knowledge retrieval

Exact products, pricing, promotions, payments, shipping, clinic information, FAQs, policies, and compliance rules are filtered by publication, activity, dates, state, and language. Published conversation knowledge, objections, and scenarios are embedded with `text-embedding-3-small` into pgvector. Admin mutations synchronize or remove embeddings; failures remain visible and retryable from the protected health page. Retrieved content is reference data and cannot override Maria's medical-safety instructions.

Set `KNOWLEDGE_DEBUG=true` only outside production to log retrieval IDs, categories, record IDs, timings, and errors. Customer message text is not logged or stored in embedding records.

## Not implemented yet

- CRUD for the remaining knowledge sections
- File upload or document processing
- Respond.io or appointment integrations

Dashboard values are visibly labeled placeholders and are never presented as real records.
