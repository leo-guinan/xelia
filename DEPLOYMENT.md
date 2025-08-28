# FlightControl Deployment Guide for Xelia

## 🚀 Quick Start

This application is configured for deployment on FlightControl with PostgreSQL RDS database.

## 📋 Prerequisites

1. **GitHub Repository**: Push your code to GitHub
2. **FlightControl Account**: Sign up at [flightcontrol.dev](https://flightcontrol.dev)
3. **AWS Account**: Connected to FlightControl

## 🔧 Setup Steps

### 1. Connect GitHub Repository

1. Log into FlightControl Dashboard
2. Click "New Project"
3. Connect your GitHub account
4. Select the `xelia` repository

### 2. Create Required Secrets

In FlightControl Dashboard → Project Settings → Secrets, create:

| Secret Name | Description | How to Generate |
|------------|-------------|-----------------|
| `SESSION_SECRET` | Session encryption key (32+ chars) | `openssl rand -base64 32` |
| `DB_USERNAME` | Database username | Choose a secure username |
| `DB_PASSWORD` | Strong database password | `openssl rand -base64 24` |
| `PLAID_CLIENT_ID` | Plaid API client ID | From Plaid dashboard |
| `PLAID_SECRET` | Plaid API secret | From Plaid dashboard |

### 3. Deploy with FlightControl Config

The repository includes `flightcontrol.json` with:
- **Web Service**: Node.js app on Fargate (0.5 CPU, 2GB RAM)
- **Database**: PostgreSQL 15.3 RDS (db.t4g.micro, 20GB)
- **Auto-scaling**: 1-3 instances
- **Health checks**: `/api/health` endpoint
- **Database migrations**: Auto-run on deploy

### 4. Deploy

1. Push to `main` branch
2. FlightControl automatically:
   - Builds the application
   - Runs database migrations
   - Deploys to AWS
   - Configures health checks

## 🔐 Environment Variables

FlightControl automatically sets:

| Variable | Source | Description |
|----------|--------|-------------|
| `NODE_ENV` | `production` | Environment mode |
| `PORT` | `5000` | Server port |
| `DATABASE_URL` | From RDS service | PostgreSQL connection string |
| `SESSION_SECRET` | From secret | Session encryption |
| `PLAID_CLIENT_ID` | From secret | Plaid API |
| `PLAID_SECRET` | From secret | Plaid API |
| `PLAID_ENV` | `sandbox` | Plaid environment |

## 📦 Build & Deploy Process

### Build Phase
```bash
npm ci                  # Install dependencies
npm run build          # Build React frontend & TypeScript backend
```

### Migration Phase
```bash
npm run db:push        # Apply database schema
```

### Start Phase
```bash
npm start              # Start production server
```

## 🏗️ Architecture on AWS

```
┌─────────────────┐
│   CloudFront    │
│      (CDN)      │
└────────┬────────┘
         │
┌────────▼────────┐
│  Load Balancer  │
└────────┬────────┘
         │
┌────────▼────────┐
│    Fargate      │
│   Containers    │
│   (1-3 instances)│
└────────┬────────┘
         │
┌────────▼────────┐
│   PostgreSQL    │
│      RDS        │
│  (Multi-AZ)     │
└─────────────────┘
```

## 🔍 Monitoring

### Health Check
- Endpoint: `https://your-domain.com/api/health`
- Checks database connectivity
- Returns: `{ status: "healthy", timestamp, version, environment }`

### Logs
Access via FlightControl Dashboard:
- Application logs
- Build logs
- Database logs

### Metrics
FlightControl provides:
- CPU/Memory usage
- Request count
- Response times
- Error rates

## 🚨 Troubleshooting

### Database Connection Issues
```bash
# Check environment variable
echo $DATABASE_URL

# Verify SSL is enabled (required for RDS)
# server/db.ts should have ssl: { rejectUnauthorized: false }
```

### Session Issues
```bash
# Ensure SESSION_SECRET is set
# Must be 32+ characters
# Check it's the same across all instances
```

### Build Failures
```bash
# Run locally to test
npm ci
npm run build
npm start
```

### Migration Failures
```bash
# Test migrations locally
DATABASE_URL=your-db-url npm run db:push

# Check schema compatibility
npx drizzle-kit generate:pg
```

## 🔄 Updates & Rollbacks

### Deploy Updates
1. Push to `main` branch
2. FlightControl auto-deploys

### Manual Deploy
1. FlightControl Dashboard → Deployments
2. Click "Deploy" → Select branch

### Rollback
1. FlightControl Dashboard → Deployments
2. Find previous successful deployment
3. Click "Rollback"

## 🔒 Security Checklist

- [x] SSL/TLS enabled (automatic with FlightControl)
- [x] Database in private VPC
- [x] Secrets stored securely
- [x] Rate limiting enabled
- [x] Security headers configured
- [x] Input validation active
- [x] Session security hardened

## 📊 Performance Optimization

### Current Settings
- **Instances**: 1-3 (auto-scaling)
- **CPU**: 0.5 vCPU per instance
- **Memory**: 2GB per instance
- **Database**: db.t4g.micro

### Scaling Options
If needed, update `flightcontrol.json`:
```json
{
  "cpu": 1,           // Increase CPU
  "memory": 4,        // Increase RAM
  "minInstances": 2,  // Higher minimum
  "maxInstances": 10  // Higher maximum
}
```

### Database Scaling
```json
{
  "instanceSize": "db.t4g.small",  // Larger instance
  "storage": 100                   // More storage
}
```

## 🌐 Custom Domain

1. FlightControl Dashboard → Settings → Domains
2. Add your domain
3. Update DNS records as instructed
4. SSL certificate auto-provisioned

## 📱 Post-Deployment

### Verify Deployment
```bash
# Check health
curl https://your-app.flightcontrol.app/api/health

# Test auth
curl -X POST https://your-app.flightcontrol.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'
```

### Monitor Initial Traffic
- Watch logs for errors
- Monitor memory/CPU usage
- Check response times

## 💰 Cost Estimation

**Approximate monthly costs (AWS US-East-1):**
- Fargate (0.5 CPU, 2GB): ~$20-40
- RDS (db.t4g.micro): ~$15-20
- Storage (20GB): ~$2
- Data transfer: Variable
- **Total**: ~$40-80/month

## 📞 Support

- **FlightControl**: [docs.flightcontrol.dev](https://docs.flightcontrol.dev)
- **Issues**: Check `/api/health` endpoint first
- **Logs**: FlightControl Dashboard → Logs

## 🎉 Success Indicators

Your deployment is successful when:
- ✅ Health check returns `healthy`
- ✅ Can create user accounts
- ✅ Can log in successfully
- ✅ Database migrations applied
- ✅ No errors in logs

## 🔗 Important URLs

After deployment:
- **Application**: `https://[project-name].flightcontrol.app`
- **Health Check**: `https://[project-name].flightcontrol.app/api/health`
- **FlightControl Dashboard**: `https://app.flightcontrol.dev`