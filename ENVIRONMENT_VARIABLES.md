# Environment Variables Configuration

## Required Variables for Production

These environment variables must be set in your FlightControl dashboard:

### Security & Authentication
- **SESSION_SECRET** (Required)
  - Generate with: `openssl rand -base64 32`
  - Used for signing session cookies
  - Must be at least 32 characters

- **ENCRYPTION_KEY** (Required in production)
  - Generate with: `openssl rand -base64 32`
  - Used for encrypting sensitive data (like Plaid tokens)
  - Must be at least 32 characters

### Plaid Integration
- **PLAID_CLIENT_ID** (Required for Plaid features)
  - Your Plaid client ID from dashboard.plaid.com
  
- **PLAID_SECRET** (Required for Plaid features)
  - Your Plaid secret key from dashboard.plaid.com
  
- **PLAID_ENV** (Set in flightcontrol.json)
  - Currently set to: `development`
  - Options: `sandbox`, `development`, or `production`

### Email Configuration (Optional)
- **EMAIL_FROM**
  - Email address for system notifications
  - Example: `noreply@yourdomain.com`

### Already Configured in flightcontrol.json
These are already set and don't need manual configuration:
- **NODE_ENV**: `production`
- **PORT**: `5000`
- **DATABASE_URL**: Automatically set from RDS service
- **ALLOWED_ORIGINS**: Set to CloudFront domain
- **PLAID_ENV**: `development`

## Setting Environment Variables in FlightControl

1. Log into your FlightControl dashboard
2. Navigate to your project
3. Go to the Environment Variables section
4. Add each required variable with its value
5. Save and redeploy

## Security Notes
- Never commit actual values to version control
- Use strong, unique values for SESSION_SECRET and ENCRYPTION_KEY
- Keep Plaid credentials secure
- Rotate secrets periodically