# Method Integration Implementation Plan

## Overview
Method (https://methodfi.com) provides API access to liability data from credit cards, loans, and other debt accounts. This integration will complement Plaid by providing more detailed liability information.

## Implementation Plan

### Phase 1: Backend Infrastructure

#### 1.1 Configuration Setup
- [ ] Add Method API credentials to environment variables
  - `METHOD_API_KEY`
  - `METHOD_ENV` (dev, sandbox, production)
- [ ] Update config validation schema
- [ ] Add to FlightControl configuration

#### 1.2 Database Schema Updates
- [ ] Add `method_connections` table
  ```sql
  - id
  - user_id (FK to users)
  - entity_id (Method entity ID)
  - account_id (Method account ID)
  - institution_name
  - is_active
  - last_synced
  - created_at
  ```
- [ ] Update `debt_accounts` table
  - Add `method_account_id` column
  - Add `sync_source` enum ('plaid', 'method', 'manual')

#### 1.3 Method API Client (`server/method.ts`)
- [ ] Create Method client wrapper
- [ ] Implement key endpoints:
  - Create entity (user)
  - Create connect token
  - Exchange public token
  - Fetch accounts
  - Fetch liabilities
  - Webhook handling

### Phase 2: API Routes

#### 2.1 Authentication Flow
- [ ] `POST /api/method/create-entity` - Create Method entity for user
- [ ] `POST /api/method/connect-token` - Generate Method Connect token
- [ ] `POST /api/method/exchange-token` - Exchange public token for account access

#### 2.2 Data Sync Routes
- [ ] `GET /api/method/accounts` - Fetch connected Method accounts
- [ ] `POST /api/method/sync` - Sync liability data from Method
- [ ] `POST /api/method/webhook` - Handle Method webhooks

### Phase 3: Frontend Integration

#### 3.1 Method Connect Component
- [ ] Install Method Connect React SDK
- [ ] Create `MethodConnect` component
- [ ] Add Method option to Add Account modal
- [ ] Handle Method Connect flow

#### 3.2 Account Display Updates
- [ ] Show sync source indicator (Plaid vs Method)
- [ ] Display Method-specific fields
- [ ] Handle Method account updates

### Phase 4: Data Synchronization

#### 4.1 Liability Data Mapping
- [ ] Map Method liability types to our account types
- [ ] Handle Method-specific fields:
  - APR rates
  - Payment schedules
  - Credit utilization
  - Loan terms

#### 4.2 Sync Logic
- [ ] Implement intelligent merging (avoid duplicates)
- [ ] Handle account matching between Plaid and Method
- [ ] Scheduled sync jobs

### Phase 5: Testing & Development Mode

#### 5.1 Development Entities
- [ ] Create test entities in Method dashboard
- [ ] Use Method's test credentials:
  ```
  Test SSN: 111223333
  Test Phone: 6505551234
  ```

#### 5.2 Test Scenarios
- [ ] Connect credit card account
- [ ] Connect auto loan
- [ ] Connect student loan
- [ ] Sync and update balances
- [ ] Handle disconnection

## Method API Key Concepts

### Entities
- Represents a user in Method
- Required before connecting accounts
- Contains PII (encrypted by Method)

### Accounts
- Individual liability accounts
- Types: credit_card, auto_loan, student_loan, mortgage, personal_loan

### Connect Flow
1. Create entity for user
2. Generate connect token
3. User completes Method Connect
4. Exchange public token
5. Fetch and sync account data

## Development vs Production

### Development Mode
- Uses test entities with fake data
- No real credentials required
- Simulated account data

### Production Mode
- Real account connections
- Actual liability data
- Requires production API keys

## Security Considerations
- Store Method entity IDs encrypted
- Never store Method Connect tokens
- Use webhook signatures for validation
- Implement rate limiting

## Timeline Estimate
- Phase 1: 2-3 hours (Backend setup)
- Phase 2: 2 hours (API routes)
- Phase 3: 2-3 hours (Frontend)
- Phase 4: 2 hours (Data sync)
- Phase 5: 1 hour (Testing)

Total: ~10-12 hours for complete integration