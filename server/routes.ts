import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertDebtAccountSchema, updateDebtAccountSchema } from "@shared/schema";
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

  // Plaid connection routes (placeholder for future implementation)
  app.post('/api/plaid/link-token', isAuthenticated, async (req: any, res) => {
    // TODO: Implement Plaid link token creation
    res.status(501).json({ message: "Plaid integration not yet implemented" });
  });

  app.post('/api/plaid/exchange-token', isAuthenticated, async (req: any, res) => {
    // TODO: Implement Plaid public token exchange
    res.status(501).json({ message: "Plaid integration not yet implemented" });
  });

  const httpServer = createServer(app);
  return httpServer;
}
