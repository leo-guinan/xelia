# Xelia - Personal Debt Management Platform

A comprehensive web application for tracking and managing personal debt accounts, built with modern technologies and designed to help users take control of their financial obligations.

## 🏗️ Architecture Overview

### Tech Stack

**Frontend:**
- **React 18** - UI library with TypeScript
- **Vite** - Build tool and dev server
- **Wouter** - Lightweight routing
- **TanStack Query** - Server state management
- **Tailwind CSS** - Utility-first styling
- **Radix UI** - Headless UI components
- **React Hook Form** - Form management with Zod validation

**Backend:**
- **Node.js + Express** - Server framework
- **TypeScript** - Type safety across the stack
- **Drizzle ORM** - Type-safe database toolkit
- **PostgreSQL** - Primary database (Neon serverless)
- **Passport.js** - Authentication middleware

**Integrations:**
- **Plaid API** - Bank account connections and data
- **Replit Auth** - OAuth authentication system

## 📁 Project Structure

```
xelia/
├── client/                 # Frontend application
│   ├── src/
│   │   ├── components/     # Reusable React components
│   │   │   ├── ui/        # Radix-based UI primitives
│   │   │   ├── account-list.tsx
│   │   │   ├── add-account-modal.tsx
│   │   │   ├── debt-summary.tsx
│   │   │   └── navbar.tsx
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utility functions and configs
│   │   ├── pages/         # Route components
│   │   │   ├── dashboard.tsx
│   │   │   ├── landing.tsx
│   │   │   └── not-found.tsx
│   │   ├── App.tsx        # Main app component
│   │   └── main.tsx       # Entry point
│   └── index.html
│
├── server/                 # Backend application
│   ├── index.ts           # Express server setup
│   ├── routes.ts          # API route definitions
│   ├── db.ts              # Database connection
│   ├── storage.ts         # Data access layer
│   ├── plaid.ts           # Plaid integration
│   ├── replitAuth.ts      # Authentication setup
│   └── vite.ts            # Vite dev server integration
│
├── shared/                 # Shared types and schemas
│   └── schema.ts          # Database schema and Zod validators
│
├── drizzle.config.ts      # Database configuration
├── vite.config.ts         # Vite build configuration
├── tailwind.config.ts     # Tailwind CSS configuration
├── tsconfig.json          # TypeScript configuration
└── package.json           # Dependencies and scripts
```

## 🗄️ Database Schema

The application uses PostgreSQL with the following main tables:

### Users Table
- Stores user profile information
- Managed by Replit Auth system
- Fields: id, email, firstName, lastName, profileImageUrl

### Debt Accounts Table
- Core entity for tracking individual debts
- Supports both manual and Plaid-connected accounts
- Fields:
  - Basic: id, userId, accountNickname, institutionName
  - Financial: currentBalance, interestRate, minimumPayment, creditLimit
  - Metadata: accountType, dueDate, isManual, isHidden, lastSynced

### Plaid Connections Table
- Manages bank connections via Plaid
- Stores encrypted access tokens
- Tracks institution details and sync status

### Sessions Table
- Required for authentication system
- Manages user sessions with expiration

## 🔌 API Architecture

### Authentication Endpoints
- `GET /api/auth/user` - Get current user profile
- Managed by Replit Auth OAuth flow

### Debt Account Management
- `GET /api/debt-accounts` - List user's debt accounts
- `POST /api/debt-accounts` - Create new account
- `PUT /api/debt-accounts/:id` - Update account details
- `DELETE /api/debt-accounts/:id` - Remove account
- `GET /api/debt-summary` - Calculate aggregated metrics

### Plaid Integration
- `POST /api/plaid/link-token` - Generate Plaid Link token
- `POST /api/plaid/exchange-token` - Exchange public token
- `POST /api/plaid/sync-accounts` - Sync account balances

## 🎨 Frontend Architecture

### Component Hierarchy
```
App
├── QueryClientProvider (React Query)
├── TooltipProvider (UI Context)
├── Router (Wouter)
│   ├── Landing Page (unauthenticated)
│   └── Dashboard (authenticated)
│       ├── Navbar
│       ├── DebtSummary
│       └── AccountList
│           └── AddAccountModal
```

### State Management
- **Server State**: TanStack Query for API data caching and synchronization
- **UI State**: React hooks and context for local component state
- **Form State**: React Hook Form with Zod validation

### Styling System
- Tailwind CSS for utility classes
- Radix UI for accessible, unstyled components
- Custom theme configuration in `tailwind.config.ts`
- CSS variables for dynamic theming

## 🔐 Security Features

- OAuth 2.0 authentication via Replit Auth
- Session-based authentication with secure cookies
- Input validation using Zod schemas
- SQL injection prevention via parameterized queries (Drizzle ORM)
- Encrypted storage of Plaid access tokens
- Environment-based configuration for sensitive data

## 🚀 Development Setup

### Prerequisites
- Node.js 20+
- PostgreSQL database (or Neon account)
- Plaid API credentials (for bank connections)

### Environment Variables
```bash
DATABASE_URL=          # PostgreSQL connection string
PLAID_CLIENT_ID=      # Plaid API client ID
PLAID_SECRET=         # Plaid API secret
PLAID_ENV=            # sandbox/development/production
PORT=5000             # Server port (optional)
```

### Installation & Running
```bash
# Install dependencies
npm install

# Run database migrations
npm run db:push

# Development mode
npm run dev

# Production build
npm run build
npm start

# Type checking
npm run check
```

## 📦 Key Dependencies

### Core Libraries
- `express` - Web server framework
- `drizzle-orm` - Type-safe ORM
- `react` & `react-dom` - UI framework
- `vite` - Build tool and dev server

### UI Components
- `@radix-ui/*` - Accessible component primitives
- `tailwindcss` - Utility-first CSS
- `lucide-react` - Icon library
- `framer-motion` - Animation library

### Data & Validation
- `@tanstack/react-query` - Server state management
- `zod` - Schema validation
- `react-hook-form` - Form handling
- `drizzle-zod` - Zod schema generation from Drizzle

### Integrations
- `plaid` - Banking API client
- `passport` - Authentication middleware
- `openid-client` - OAuth/OIDC support

## 🏃 Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Run production server
- `npm run check` - TypeScript type checking
- `npm run db:push` - Apply database schema changes

## 🔄 Data Flow

1. **User Authentication**: OAuth flow via Replit Auth → Passport.js → Session storage
2. **API Requests**: React components → TanStack Query → Express API → Storage layer → PostgreSQL
3. **Bank Sync**: Plaid Link → Token exchange → Account data fetch → Database update
4. **Real-time Updates**: API mutations → Query invalidation → Automatic refetch → UI update

## 🎯 Key Features

- **Multi-source Account Management**: Manual entry or automatic bank sync via Plaid
- **Comprehensive Debt Tracking**: Balance, interest rates, minimum payments, due dates
- **Smart Calculations**: Weighted average interest, total monthly obligations, interest cost analysis
- **Responsive Design**: Mobile-first approach with adaptive layouts
- **Type Safety**: End-to-end TypeScript with Zod runtime validation
- **Optimistic Updates**: Instant UI feedback with background synchronization

## 🔧 Development Patterns

### API Error Handling
- Centralized error middleware in Express
- Consistent error response format
- Zod validation errors with detailed field messages

### Database Access Pattern
- Repository pattern via `storage.ts`
- Type-safe queries with Drizzle ORM
- Transaction support for complex operations

### Frontend Data Fetching
- Query keys pattern for cache management
- Optimistic updates for better UX
- Automatic refetch on window focus

### Component Architecture
- Composition over inheritance
- Controlled components for forms
- Custom hooks for business logic extraction

## 🚦 Production Considerations

- Environment-specific configuration (dev/staging/prod)
- Database connection pooling
- API rate limiting for external services
- Error tracking and monitoring setup
- Secure session management
- HTTPS enforcement
- CORS configuration for API access