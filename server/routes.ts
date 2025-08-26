import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertDebtAccountSchema, updateDebtAccountSchema } from "@shared/schema";
import { plaidClient, PLAID_PRODUCTS, PLAID_COUNTRY_CODES } from "./plaid";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Debt account routes
  app.get('/api/debt-accounts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const accounts = await storage.getDebtAccounts(userId);
      res.json(accounts);
    } catch (error) {
      console.error("Error fetching debt accounts:", error);
      res.status(500).json({ message: "Failed to fetch debt accounts" });
    }
  });

  app.post('/api/debt-accounts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
        client_name: "ClearDebt",
        products: PLAID_PRODUCTS,
        country_codes: PLAID_COUNTRY_CODES,
        language: 'en',
        redirect_uri: process.env.NODE_ENV === 'production' 
          ? `https://${req.hostname}/api/plaid/oauth-redirect`
          : undefined,
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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

  // Helper function to sync accounts from Plaid
  async function syncPlaidAccounts(userId: string, accessToken: string, institutionName: string) {
    try {
      // Get accounts
      const accountsResponse = await plaidClient.accountsGet({ access_token: accessToken });
      const accounts = accountsResponse.data.accounts;

      // Get liabilities (debt accounts)
      const liabilitiesResponse = await plaidClient.liabilitiesGet({ access_token: accessToken });
      const liabilities = liabilitiesResponse.data.liabilities;

      // Process credit cards
      for (const creditCard of liabilities.credit || []) {
        const account = accounts.find(acc => acc.account_id === creditCard.account_id);
        if (!account) continue;

        const existingAccount = await storage.getDebtAccounts(userId);
        const exists = existingAccount.find(acc => acc.plaidAccountId === account.account_id);
        
        if (!exists) {
          await storage.createDebtAccount({
            userId,
            plaidAccountId: account.account_id,
            institutionName,
            accountNickname: account.name || `${institutionName} Credit Card`,
            accountType: 'credit_card',
            currentBalance: Math.abs(account.balances.current || 0).toFixed(2),
            interestRate: (creditCard.aprs?.find(apr => apr.apr_type === 'purchase_apr')?.apr_percentage || 0).toFixed(2),
            minimumPayment: creditCard.last_payment_amount?.toFixed(2) || null,
            creditLimit: account.balances.limit?.toFixed(2) || null,
            isManual: false,
            lastSynced: new Date(),
          });
        } else {
          // Update existing account
          await storage.updateDebtAccount(exists.id, userId, {
            currentBalance: Math.abs(account.balances.current || 0).toFixed(2),
            interestRate: (creditCard.aprs?.find(apr => apr.apr_type === 'purchase_apr')?.apr_percentage || parseFloat(exists.interestRate)).toFixed(2),
            creditLimit: account.balances.limit?.toFixed(2) || exists.creditLimit,
            lastSynced: new Date(),
          });
        }
      }

      // Process student loans
      for (const studentLoan of liabilities.student || []) {
        const account = accounts.find(acc => acc.account_id === studentLoan.account_id);
        if (!account) continue;

        const existingAccount = await storage.getDebtAccounts(userId);
        const exists = existingAccount.find(acc => acc.plaidAccountId === account.account_id);
        
        if (!exists) {
          await storage.createDebtAccount({
            userId,
            plaidAccountId: account.account_id,
            institutionName,
            accountNickname: account.name || `${institutionName} Student Loan`,
            accountType: 'student_loan',
            currentBalance: Math.abs(account.balances.current || 0).toFixed(2),
            interestRate: (studentLoan.interest_rate_percentage || 0).toFixed(2),
            minimumPayment: studentLoan.minimum_payment_amount?.toFixed(2) || null,
            isManual: false,
            lastSynced: new Date(),
          });
        } else {
          // Update existing account
          await storage.updateDebtAccount(exists.id, userId, {
            currentBalance: Math.abs(account.balances.current || 0).toFixed(2),
            interestRate: (studentLoan.interest_rate_percentage || parseFloat(exists.interestRate)).toFixed(2),
            minimumPayment: studentLoan.minimum_payment_amount?.toFixed(2) || exists.minimumPayment,
            lastSynced: new Date(),
          });
        }
      }

      // Process mortgages
      for (const mortgage of liabilities.mortgage || []) {
        const account = accounts.find(acc => acc.account_id === mortgage.account_id);
        if (!account) continue;

        const existingAccount = await storage.getDebtAccounts(userId);
        const exists = existingAccount.find(acc => acc.plaidAccountId === account.account_id);
        
        if (!exists) {
          await storage.createDebtAccount({
            userId,
            plaidAccountId: account.account_id,
            institutionName,
            accountNickname: account.name || `${institutionName} Mortgage`,
            accountType: 'mortgage',
            currentBalance: Math.abs(account.balances.current || 0).toFixed(2),
            interestRate: (mortgage.interest_rate?.percentage || 0).toFixed(2),
            minimumPayment: null, // Mortgages don't have minimum_payment_amount in Plaid API
            isManual: false,
            lastSynced: new Date(),
          });
        } else {
          // Update existing account
          await storage.updateDebtAccount(exists.id, userId, {
            currentBalance: Math.abs(account.balances.current || 0).toFixed(2),
            interestRate: (mortgage.interest_rate?.percentage || parseFloat(exists.interestRate)).toFixed(2),
            lastSynced: new Date(),
          });
        }
      }
    } catch (error) {
      console.error("Error syncing Plaid accounts:", error);
      throw error;
    }
  }

  const httpServer = createServer(app);
  return httpServer;
}
