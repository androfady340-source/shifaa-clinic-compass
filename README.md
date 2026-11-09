# Shifaa Clinic Compass

An Arabic-first clinic appointment booking and management application built with React, TypeScript, TanStack Start, and Supabase. The interface supports right-to-left (RTL) layouts and is designed around patients, doctors, and clinic administrators.

## Features

- Browse medical specialties and approved doctor profiles.
- View doctor availability and book appointments online.
- Check an appointment's status using its booking reference and phone number.
- Doctor registration with an approval workflow.
- Doctor workspace for managing profile information, availability, days off, and appointments.
- Administrator workspace for managing doctors and clinic bookings.
- Server-side booking validation, including date, availability, payment-method, and duplicate-slot checks.
- Responsive interface with Arabic RTL support.

## Tech stack

- **Application:** React 19, TypeScript, TanStack Start, TanStack Router
- **Data and authentication:** Supabase Auth, Postgres, Row Level Security (RLS), Supabase RPC
- **UI:** Tailwind CSS, Radix UI, Lucide
- **Tooling:** Vite, Vitest, ESLint, Prettier
- **Deployment configuration:** Nitro with the Cloudflare target configured by the project Vite setup

## Getting started

### Requirements

- Node.js compatible with the versions used by the project dependencies
- npm or Bun
- A Supabase project

### 1. Clone and install

```bash
git clone https://github.com/androfady340-source/shifaa-clinic-compass.git
cd shifaa-clinic-compass
npm install
```

If you use Bun, you can install from the included Bun lockfile with `bun install`.

### 2. Configure environment variables

Copy `.env.example` to `.env` and replace the placeholders with values from your Supabase project.

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase URL used by the browser build |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key used by the browser build |
| `SUPABASE_URL` | Supabase URL used by server-side code |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key used by authenticated server-side requests |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret service-role key for trusted server-only operations |

**Security:** Never expose `SUPABASE_SERVICE_ROLE_KEY` through a `VITE_` variable, commit real credentials, or use the service-role client in browser code. Keep your local `.env` file private.

### 3. Set up the database

Apply the SQL migration in `drizzle/migrations/0000_clinic_schema.sql` to your Supabase project using the Supabase SQL Editor or your established migration workflow. Review the migration and configure Supabase Auth and project settings for your deployment before accepting real bookings.

The migration defines the application roles, doctors, specialties, availability, days off, bookings, row-level security policies, and booking-related database functions.

### 4. Run locally

```bash
npm run dev
```

Vite prints the local development URL in the terminal.

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run build:dev` | Create a development-mode build |
| `npm run preview` | Preview the built application |
| `npm run lint` | Run ESLint |
| `npm run test` | Run the Vitest test suite |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run format` | Format files with Prettier |

## Project structure

```text
src/
  components/             Shared UI and application components
  integrations/supabase/  Supabase clients, auth helpers, and generated types
  lib/                    Application queries, booking logic, and utilities
  routes/                 TanStack file-based routes
  test/                   Application tests
drizzle/
  migrations/             SQL schema and database migrations
supabase/
  config.toml              Supabase project configuration
public/                    Static public assets
```

## Testing

Run the automated tests with:

```bash
npm run test
```

The current test suite includes booking-slot/time logic and application route matching. Run the production build and lint checks as well before deploying changes.

## Deployment notes

The repository's Vite configuration uses the Lovable TanStack configuration package, which configures Nitro for the project's Cloudflare-oriented build setup. Set the required environment variables in the hosting provider's secret/environment settings, apply the database migration, and verify authentication, booking creation, appointment tracking, and administrator access in the deployed environment.

## Maintainer

**Andro Fady** — [GitHub](https://github.com/androfady340-source)
