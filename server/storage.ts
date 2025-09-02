import {
  users,
  debtAccounts,
  plaidConnections,
  methodConnections,
  type User,
  type UpsertUser,
  type DebtAccount,
  type InsertDebtAccount,
  type UpdateDebtAccount,
  type PlaidConnection,
  type InsertPlaidConnection,
  type MethodConnection,
  type InsertMethodConnection,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // Health check
  checkHealth(): Promise<void>;
  
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
  updateUserSecurity(id: string, updates: { failedLoginAttempts?: number; lockedUntil?: Date | null }): Promise<void>;
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
  
  // Method connection operations
  getMethodConnections(userId: string): Promise<MethodConnection[]>;
  getMethodConnectionByEntity(entityId: string): Promise<MethodConnection | undefined>;
  createMethodConnection(connection: InsertMethodConnection & { userId: string }): Promise<MethodConnection>;
  updateMethodConnection(id: string, userId: string, updates: Partial<MethodConnection>): Promise<MethodConnection | undefined>;
  
  // Additional helper methods
  getPlaidConnection(id: string): Promise<PlaidConnection | undefined>;
  getMethodConnection(id: string): Promise<MethodConnection | undefined>;
  getMethodConnectionByAccountId(accountId: string): Promise<MethodConnection | undefined>;
  getUserByMethodEntityId(entityId: string): Promise<User | undefined>;
  saveMethodEntityId(userId: string, entityId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Health check
  async checkHealth(): Promise<void> {
    // Simple query to check database connection
    await db.select().from(users).limit(1);
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async updateUserSecurity(id: string, updates: { failedLoginAttempts?: number; lockedUntil?: Date | null }): Promise<void> {
    await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
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

  // Method connection operations
  async getMethodConnections(userId: string): Promise<MethodConnection[]> {
    return await db
      .select()
      .from(methodConnections)
      .where(and(eq(methodConnections.userId, userId), eq(methodConnections.isActive, true)));
  }

  async getMethodConnectionByEntity(entityId: string): Promise<MethodConnection | undefined> {
    const [connection] = await db
      .select()
      .from(methodConnections)
      .where(eq(methodConnections.entityId, entityId));
    return connection;
  }

  async createMethodConnection(connectionData: InsertMethodConnection & { userId: string }): Promise<MethodConnection> {
    const [connection] = await db
      .insert(methodConnections)
      .values(connectionData)
      .returning();
    return connection;
  }

  async updateMethodConnection(id: string, userId: string, updates: Partial<MethodConnection>): Promise<MethodConnection | undefined> {
    const [connection] = await db
      .update(methodConnections)
      .set(updates)
      .where(and(eq(methodConnections.id, id), eq(methodConnections.userId, userId)))
      .returning();
    return connection;
  }
  
  // Additional helper methods
  async getPlaidConnection(id: string): Promise<PlaidConnection | undefined> {
    const [connection] = await db
      .select()
      .from(plaidConnections)
      .where(eq(plaidConnections.id, id));
    return connection;
  }
  
  async getMethodConnection(id: string): Promise<MethodConnection | undefined> {
    const [connection] = await db
      .select()
      .from(methodConnections)
      .where(eq(methodConnections.id, id));
    return connection;
  }
  
  async getMethodConnectionByAccountId(accountId: string): Promise<MethodConnection | undefined> {
    const [connection] = await db
      .select()
      .from(methodConnections)
      .where(eq(methodConnections.accountId, accountId));
    return connection;
  }
  
  async getUserByMethodEntityId(entityId: string): Promise<User | undefined> {
    // First find the Method connection with this entity ID
    const [connection] = await db
      .select()
      .from(methodConnections)
      .where(eq(methodConnections.entityId, entityId));
    
    if (!connection) return undefined;
    
    // Then get the user
    return this.getUser(connection.userId);
  }
  
  async saveMethodEntityId(userId: string, entityId: string): Promise<void> {
    // This is a helper that could store the entity ID in user metadata
    // For now, we'll rely on the methodConnections table
    // In a real implementation, you might want to add a methodEntityId field to the users table
  }
}

export const storage = new DatabaseStorage();
