import {
  users,
  debtAccounts,
  plaidConnections,
  type User,
  type UpsertUser,
  type DebtAccount,
  type InsertDebtAccount,
  type UpdateDebtAccount,
  type PlaidConnection,
  type InsertPlaidConnection,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Debt account operations
  getDebtAccounts(userId: string): Promise<DebtAccount[]>;
  getDebtAccount(id: string, userId: string): Promise<DebtAccount | undefined>;
  createDebtAccount(account: InsertDebtAccount & { userId: string }): Promise<DebtAccount>;
  updateDebtAccount(id: string, userId: string, updates: UpdateDebtAccount): Promise<DebtAccount | undefined>;
  deleteDebtAccount(id: string, userId: string): Promise<boolean>;
  
  // Plaid connection operations
  getPlaidConnections(userId: string): Promise<PlaidConnection[]>;
  createPlaidConnection(connection: InsertPlaidConnection & { userId: string }): Promise<PlaidConnection>;
  updatePlaidConnection(id: string, userId: string, updates: Partial<PlaidConnection>): Promise<PlaidConnection | undefined>;
  getPlaidConnectionByToken(accessToken: string): Promise<PlaidConnection | undefined>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Debt account operations
  async getDebtAccounts(userId: string): Promise<DebtAccount[]> {
    return await db
      .select()
      .from(debtAccounts)
      .where(and(eq(debtAccounts.userId, userId), eq(debtAccounts.isHidden, false)))
      .orderBy(desc(debtAccounts.currentBalance));
  }

  async getDebtAccount(id: string, userId: string): Promise<DebtAccount | undefined> {
    const [account] = await db
      .select()
      .from(debtAccounts)
      .where(and(eq(debtAccounts.id, id), eq(debtAccounts.userId, userId)));
    return account;
  }

  async createDebtAccount(accountData: InsertDebtAccount & { userId: string }): Promise<DebtAccount> {
    const [account] = await db
      .insert(debtAccounts)
      .values(accountData)
      .returning();
    return account;
  }

  async updateDebtAccount(id: string, userId: string, updates: UpdateDebtAccount): Promise<DebtAccount | undefined> {
    const [account] = await db
      .update(debtAccounts)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(debtAccounts.id, id), eq(debtAccounts.userId, userId)))
      .returning();
    return account;
  }

  async deleteDebtAccount(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(debtAccounts)
      .where(and(eq(debtAccounts.id, id), eq(debtAccounts.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  // Plaid connection operations
  async getPlaidConnections(userId: string): Promise<PlaidConnection[]> {
    return await db
      .select()
      .from(plaidConnections)
      .where(and(eq(plaidConnections.userId, userId), eq(plaidConnections.isActive, true)));
  }

  async createPlaidConnection(connectionData: InsertPlaidConnection & { userId: string }): Promise<PlaidConnection> {
    const [connection] = await db
      .insert(plaidConnections)
      .values(connectionData)
      .returning();
    return connection;
  }

  async updatePlaidConnection(id: string, userId: string, updates: Partial<PlaidConnection>): Promise<PlaidConnection | undefined> {
    const [connection] = await db
      .update(plaidConnections)
      .set(updates)
      .where(and(eq(plaidConnections.id, id), eq(plaidConnections.userId, userId)))
      .returning();
    return connection;
  }

  async getPlaidConnectionByToken(accessToken: string): Promise<PlaidConnection | undefined> {
    const [connection] = await db
      .select()
      .from(plaidConnections)
      .where(eq(plaidConnections.accessToken, accessToken));
    return connection;
  }
}

export const storage = new DatabaseStorage();
