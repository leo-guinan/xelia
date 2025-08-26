# ClearDebt - Debt Management Platform

## Overview

ClearDebt is a minimalist debt management platform designed to provide users with a clear, consolidated view of their debt obligations. The application focuses exclusively on debt visibility rather than complex financial management features, offering automated bank account integration through Plaid to track multiple debt accounts across different institutions. The platform displays total debt burden, interest rates, and payment information in a simple, transparent interface that helps users understand their financial obligations without overwhelming complexity.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The client-side application is built with React 18 using TypeScript and Vite as the build tool. The architecture follows a component-based design pattern with:

- **UI Framework**: Radix UI components with shadcn/ui styling system providing consistent, accessible interface elements
- **Styling**: Tailwind CSS with CSS variables for theming and responsive design
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation for type-safe form handling
- **Authentication Flow**: Protected routes that redirect unauthenticated users to login

The component structure separates UI components from business logic, with reusable components in the `/components/ui` directory and feature-specific components for debt management functionality.

### Backend Architecture
The server uses Express.js with TypeScript in a monorepo structure, implementing:

- **API Design**: RESTful endpoints following standard HTTP conventions
- **Authentication**: Replit-based OAuth integration with session management
- **Database Layer**: Drizzle ORM for type-safe database operations with PostgreSQL
- **Session Storage**: PostgreSQL-based session storage using connect-pg-simple
- **Error Handling**: Centralized error handling middleware with proper HTTP status codes
- **Development Tooling**: Hot module replacement via Vite integration in development mode

The server architecture separates concerns through distinct modules for routing, storage operations, authentication, and database connections.

### Data Storage Solutions
The application uses PostgreSQL as the primary database with Drizzle ORM providing:

- **User Management**: Core user table with OAuth profile information (required for Replit Auth)
- **Session Management**: Dedicated sessions table for user authentication state
- **Debt Tracking**: Dedicated table for debt account information including balances, interest rates, and payment details
- **Plaid Integration**: Table for storing Plaid connection tokens and metadata
- **Schema Management**: Drizzle Kit for database migrations and schema evolution

Database design emphasizes data integrity with proper foreign key relationships and cascading deletes for user data cleanup.

### Authentication and Authorization
The platform implements OAuth-based authentication through Replit's identity system:

- **OAuth Flow**: Standard OAuth 2.0/OpenID Connect integration with Replit as the identity provider
- **Session Management**: Server-side session storage with secure HTTP-only cookies
- **Route Protection**: Middleware-based authentication checks for protected API endpoints
- **User Context**: Automatic user context injection from session data for authenticated requests

This approach provides secure authentication without requiring users to manage separate credentials.

### External Dependencies
- **Plaid Integration**: Financial data aggregation service for connecting user bank accounts and retrieving debt information (referenced in schema but not yet implemented)
- **Neon Database**: Serverless PostgreSQL database hosting with WebSocket support for real-time connections
- **Replit Services**: OAuth authentication provider and development platform integration
- **Build Tools**: Vite for fast development builds and hot module replacement, ESBuild for production bundling
- **Monitoring**: Development-specific error overlay and debugging tools through Replit's cartographer plugin

The architecture is designed to be cloud-native and scalable, with serverless database connections and stateless server design enabling horizontal scaling.