import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { insertDebtAccountSchema, updateDebtAccountSchema } from "@shared/schema";
import { plaidClient, PLAID_PRODUCTS, PLAID_COUNTRY_CODES } from "./plaid";
import { z } from "zod";
import { apiRateLimiter, sanitizeMiddleware, Encryption, logSecurityEvent } from "./security";
import { config } from "./config";
import { isMethodConfigured, getMethodClient, MethodClient } from "./method";
import { setupProviderRoutes } from "./routes/providers";

// Helper function to sync Method accounts
async function syncMethodAccounts(userId: string, entityId: string, accountId: string) {
  try {
    const methodClient = getMethodClient();
    
    // Get account details
    const account = await methodClient.getAccount(accountId);
    const accountData = MethodClient.formatAccountData(account);
    
    // Check if account already exists
    const existingAccounts = await storage.getDebtAccounts(userId);
    const exists = existingAccounts.find(acc => acc.methodAccountId === account.id);
    
    if (!exists) {
      // Create new account
      await storage.createDebtAccount({
        ...accountData,
        userId,
      });
    } else {
      // Update existing account
      await storage.updateDebtAccount(exists.id, userId, {
        currentBalance: accountData.currentBalance,
        interestRate: accountData.interestRate,
        minimumPayment: accountData.minimumPayment,
        creditLimit: accountData.creditLimit,
        lastSynced: new Date(),
      });
    }
  } catch (error) {
    console.error('Error syncing Method accounts:', error);
    throw error;
  }
}

// Helper function to sync accounts from Plaid
async function syncPlaidAccounts(userId: string, accessToken: string, institutionName: string) {
  try {
    // Get accounts
    const accountsResponse = await plaidClient.accountsGet({ access_token: accessToken });
    
    // Process liability accounts
    for (const account of accountsResponse.data.accounts) {
      if (account.type === 'credit' || account.type === 'loan') {
        const balances = account.balances;
        const balance = balances.current || 0;
        
        // Map Plaid account type to our system
        let accountType = 'personal_loan';
        if (account.subtype === 'credit card') accountType = 'credit_card';
        else if (account.subtype === 'auto') accountType = 'auto_loan';
        else if (account.subtype === 'student') accountType = 'student_loan';
        else if (account.subtype === 'mortgage' || account.subtype === 'home equity') accountType = 'mortgage';
        
        // Check if account already exists
        const existingAccounts = await storage.getDebtAccounts(userId);
        const exists = existingAccounts.find(acc => acc.plaidAccountId === account.account_id);
        
        if (!exists) {
          // Create new account
          await storage.createDebtAccount({
            userId,
            plaidAccountId: account.account_id,
            syncSource: 'plaid',
            accountType,
            institutionName,
            accountNickname: account.name,
            currentBalance: balance.toFixed(2),
            interestRate: '0', // Plaid doesn't provide interest rates
            minimumPayment: null,
            creditLimit: account.type === 'credit' && balances.limit ? balances.limit.toFixed(2) : null,
            isManual: false,
            lastSynced: new Date(),
          });
        } else {
          // Update existing account
          await storage.updateDebtAccount(exists.id, userId, {
            currentBalance: balance.toFixed(2),
            creditLimit: account.type === 'credit' && balances.limit ? balances.limit.toFixed(2) : null,
            lastSynced: new Date(),
          });
        }
      }
    }
  } catch (error) {
    console.error('Error syncing Plaid accounts:', error);
    throw error;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  setupAuth(app);
  
  // Provider routes (new unified abstraction)
  setupProviderRoutes(app);

  // Note: Auth routes are now handled in auth.ts

  // Health check endpoint (no auth required for monitoring)
  app.get('/api/health', async (req, res) => {
    try {
      // Check database connection
      await storage.checkHealth();
      res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: config.NODE_ENV,
      });
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(503).json({ 
        status: 'unhealthy',
        error: 'Database connection failed',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Apply rate limiting and sanitization to all API routes
  app.use('/api', apiRateLimiter);
  app.use('/api', sanitizeMiddleware);

  // Debt account routes
  app.get('/api/debt-accounts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const accounts = await storage.getDebtAccounts(userId);
      res.json(accounts);
    } catch (error) {
      console.error("Error fetching debt accounts:", error);
      res.status(500).json({ message: "Failed to fetch debt accounts" });
    }
  });

  app.post('/api/debt-accounts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const validatedData = insertDebtAccountSchema.parse(req.body);
      const account = await storage.createDebtAccount({ ...validatedData, userId });
      res.status(201).json(account);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        console.error("Error creating debt account:", error);
        res.status(500).json({ message: "Failed to create debt account" });
      }
    }
  });

  app.put('/api/debt-accounts/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const { id } = req.params;
      const validatedData = updateDebtAccountSchema.parse(req.body);
      const account = await storage.updateDebtAccount(id, userId, validatedData);
      
      if (!account) {
        res.status(404).json({ message: "Account not found" });
        return;
      }
      
      res.json(account);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        console.error("Error updating debt account:", error);
        res.status(500).json({ message: "Failed to update debt account" });
      }
    }
  });

  app.delete('/api/debt-accounts/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const { id } = req.params;
      const success = await storage.deleteDebtAccount(id, userId);
      
      if (!success) {
        res.status(404).json({ message: "Account not found" });
        return;
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting debt account:", error);
      res.status(500).json({ message: "Failed to delete debt account" });
    }
  });

  // Debt summary calculation
  app.get('/api/debt-summary', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const accounts = await storage.getDebtAccounts(userId);
      
      const totalDebt = accounts.reduce((sum, account) => sum + parseFloat(account.currentBalance), 0);
      const totalMinimumPayments = accounts.reduce((sum, account) => 
        sum + (account.minimumPayment ? parseFloat(account.minimumPayment) : 0), 0);
      
      // Calculate weighted average interest rate
      const weightedInterest = accounts.reduce((sum, account) => 
        sum + (parseFloat(account.currentBalance) * parseFloat(account.interestRate)), 0);
      const weightedAvgRate = totalDebt > 0 ? weightedInterest / totalDebt : 0;
      
      // Calculate monthly interest
      const monthlyInterest = accounts.reduce((sum, account) => 
        sum + (parseFloat(account.currentBalance) * parseFloat(account.interestRate) / 100 / 12), 0);
      
      res.json({
        totalDebt,
        weightedAvgRate,
        totalMinimumPayments,
        monthlyInterest,
        accountCount: accounts.length,
      });
    } catch (error) {
      console.error("Error calculating debt summary:", error);
      res.status(500).json({ message: "Failed to calculate debt summary" });
    }
  });

  // Plaid connection routes
  app.post('/api/plaid/link-token', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      const linkTokenRequest = {
        user: {
          client_user_id: userId,
          email_address: user.email || undefined,
          phone_number: undefined,
          legal_name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : undefined,
        },
        client_name: "Xelia",
        products: PLAID_PRODUCTS,
        country_codes: PLAID_COUNTRY_CODES,
        language: 'en',
      };

      const linkTokenResponse = await plaidClient.linkTokenCreate(linkTokenRequest);
      res.json({ link_token: linkTokenResponse.data.link_token });
    } catch (error) {
      console.error("Error creating link token:", error);
      res.status(500).json({ message: "Failed to create link token" });
    }
  });

  app.post('/api/plaid/exchange-token', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const { public_token } = req.body;

      if (!public_token) {
        res.status(400).json({ message: "Public token is required" });
        return;
      }

      // Exchange public token for access token
      const exchangeResponse = await plaidClient.itemPublicTokenExchange({
        public_token,
      });

      const accessToken = exchangeResponse.data.access_token;
      const itemId = exchangeResponse.data.item_id;

      // Get institution info
      const itemResponse = await plaidClient.itemGet({ access_token: accessToken });
      const institutionId = itemResponse.data.item.institution_id;
      
      let institutionName = "Unknown Institution";
      if (institutionId) {
        try {
          const institutionResponse = await plaidClient.institutionsGetById({
            institution_id: institutionId,
            country_codes: PLAID_COUNTRY_CODES,
          });
          institutionName = institutionResponse.data.institution.name;
        } catch (error) {
          console.warn("Failed to fetch institution name:", error);
        }
      }

      // Store Plaid connection
      const connection = await storage.createPlaidConnection({
        userId,
        accessToken,
        institutionId: institutionId || '',
        institutionName,
        isActive: true,
        lastSynced: new Date(),
      });

      // Fetch and create debt accounts
      await syncPlaidAccounts(userId, accessToken, institutionName);

      res.json({ 
        success: true, 
        connection_id: connection.id,
        institution_name: institutionName 
      });
    } catch (error) {
      console.error("Error exchanging token:", error);
      res.status(500).json({ message: "Failed to exchange token" });
    }
  });

  // Sync Plaid accounts
  app.post('/api/plaid/sync', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const connections = await storage.getPlaidConnections(userId);

      let syncedCount = 0;
      for (const connection of connections) {
        try {
          await syncPlaidAccounts(userId, connection.accessToken, connection.institutionName);
          await storage.updatePlaidConnection(connection.id, userId, { lastSynced: new Date() });
          syncedCount++;
        } catch (error) {
          console.error(`Failed to sync connection ${connection.id}:`, error);
        }
      }

      res.json({ 
        success: true, 
        synced_connections: syncedCount,
        total_connections: connections.length 
      });
    } catch (error) {
      console.error("Error syncing accounts:", error);
      res.status(500).json({ message: "Failed to sync accounts" });
    }
  });

  // Method API routes (if configured)
  const methodModule = config.METHOD_API_KEY ? await import('./method') : null;
  
  if (methodModule) {
    const { getMethodClient, isMethodConfigured, MethodClient } = methodModule;
    
    // Create or get Method entity for user
    app.post('/api/method/create-entity', isAuthenticated, async (req: any, res) => {
      try {
        if (!isMethodConfigured()) {
          return res.status(400).json({ message: 'Method is not configured' });
        }
        
        const userId = req.session.userId!;
        const user = await storage.getUser(userId);
        
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }
        
        // Check if entity already exists
        const existingConnections = await storage.getMethodConnections(userId);
        if (existingConnections.length > 0) {
          return res.json({ 
            entity_id: existingConnections[0].entityId,
            exists: true 
          });
        }
        
        // Create new entity
        const methodClient = getMethodClient();
        const entity = await methodClient.createEntity({
          firstName: user.firstName || 'Unknown',
          lastName: user.lastName || 'Unknown',
          phone: '6505551234', // Test phone for dev
          email: user.email,
        });
        
        res.json({ 
          entity_id: entity.id,
          exists: false 
        });
      } catch (error) {
        console.error('Error creating Method entity:', error);
        res.status(500).json({ message: 'Failed to create Method entity' });
      }
    });
    
    // Generate Method Connect token
    app.post('/api/method/connect-token', isAuthenticated, async (req: any, res) => {
      try {
        if (!isMethodConfigured()) {
          return res.status(400).json({ message: 'Method is not configured' });
        }
        
        const { entity_id } = req.body;
        if (!entity_id) {
          return res.status(400).json({ message: 'Entity ID is required' });
        }
        
        const methodClient = getMethodClient();
        const connectToken = await methodClient.createConnectToken(entity_id);
        
        res.json({ connect_token: connectToken.token });
      } catch (error) {
        console.error('Error creating Method connect token:', error);
        res.status(500).json({ message: 'Failed to create connect token' });
      }
    });
    
    // Exchange Method public token
    app.post('/api/method/exchange-token', isAuthenticated, async (req: any, res) => {
      try {
        if (!isMethodConfigured()) {
          return res.status(400).json({ message: 'Method is not configured' });
        }
        
        const userId = req.session.userId!;
        const { public_token, entity_id, institution_name } = req.body;
        
        if (!public_token || !entity_id) {
          return res.status(400).json({ message: 'Public token and entity ID are required' });
        }
        
        const methodClient = getMethodClient();
        
        // Exchange public token
        const { account_id } = await methodClient.exchangePublicToken(public_token);
        
        // Save Method connection
        const connection = await storage.createMethodConnection({
          userId,
          entityId: entity_id,
          accountId: account_id,
          institutionName: institution_name || 'Unknown Institution',
          isActive: true,
          lastSynced: new Date(),
        });
        
        // Sync accounts immediately
        await syncMethodAccounts(userId, entity_id, account_id);
        
        res.json({
          success: true,
          connection_id: connection.id,
        });
      } catch (error) {
        console.error('Error exchanging Method token:', error);
        res.status(500).json({ message: 'Failed to exchange token' });
      }
    });
    
    // Sync Method accounts
    app.post('/api/method/sync', isAuthenticated, async (req: any, res) => {
      try {
        if (!isMethodConfigured()) {
          return res.status(400).json({ message: 'Method is not configured' });
        }
        
        const userId = req.session.userId!;
        const connections = await storage.getMethodConnections(userId);
        let syncedCount = 0;
        
        for (const connection of connections) {
          try {
            await syncMethodAccounts(userId, connection.entityId, connection.accountId);
            await storage.updateMethodConnection(connection.id, userId, { 
              lastSynced: new Date() 
            });
            syncedCount++;
          } catch (error) {
            console.error(`Failed to sync Method connection ${connection.id}:`, error);
          }
        }
        
        res.json({
          success: true,
          synced_connections: syncedCount,
          total_connections: connections.length,
        });
      } catch (error) {
        console.error('Error syncing Method accounts:', error);
        res.status(500).json({ message: 'Failed to sync accounts' });
      }
    });
    
  }

  const httpServer = createServer(app);
  return httpServer;
}
