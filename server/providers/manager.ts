import { LiabilityProvider, AccountData, ConnectOptions, ConnectResult, DataSource, DataMode, ConnectionMetadata } from './base';
import { PlaidProvider } from './plaid';
import { MethodProvider } from './method';
import { DemoProvider } from './demo';
import { storage } from '../storage';
import { DebtAccount } from '@shared/schema';

export class ProviderManager {
  private providers: Map<DataSource, LiabilityProvider> = new Map();
  
  constructor() {
    // Initialize all providers
    this.registerProvider(new PlaidProvider());
    this.registerProvider(new MethodProvider());
    this.registerProvider(new DemoProvider());
  }
  
  private registerProvider(provider: LiabilityProvider) {
    this.providers.set(provider.getName(), provider);
  }
  
  getProvider(source: DataSource): LiabilityProvider | undefined {
    return this.providers.get(source);
  }
  
  getAvailableProviders(): { source: DataSource; available: boolean }[] {
    return Array.from(this.providers.entries()).map(([source, provider]) => ({
      source,
      available: provider.isConfigured(),
    }));
  }
  
  async connect(source: DataSource, options: ConnectOptions): Promise<ConnectResult> {
    const provider = this.getProvider(source);
    if (!provider) {
      return {
        success: false,
        error: `Provider ${source} not found`,
      };
    }
    
    if (!provider.isConfigured()) {
      return {
        success: false,
        error: `Provider ${source} is not configured`,
      };
    }
    
    return provider.connect(options);
  }
  
  async disconnect(source: DataSource, connectionId: string): Promise<boolean> {
    const provider = this.getProvider(source);
    if (!provider) return false;
    
    return provider.disconnect(connectionId);
  }
  
  async syncAccounts(userId: string): Promise<{ synced: number; failed: number }> {
    let synced = 0;
    let failed = 0;
    
    // Sync all active connections for the user
    const connections = await this.getUserConnections(userId);
    
    for (const connection of connections) {
      if (!connection.isActive) continue;
      
      const provider = this.getProvider(connection.provider);
      if (!provider) {
        failed++;
        continue;
      }
      
      try {
        const accounts = await provider.syncAllAccounts(connection.id);
        await this.saveAccountsToDatabase(userId, connection, accounts);
        synced += accounts.length;
      } catch (error) {
        console.error(`Failed to sync ${connection.provider} connection ${connection.id}:`, error);
        failed++;
      }
    }
    
    return { synced, failed };
  }
  
  async syncAccount(userId: string, accountId: string): Promise<boolean> {
    // Find which provider owns this account
    const account = await storage.getDebtAccount(accountId, userId);
    if (!account) return false;
    
    const connection = await this.getConnectionForAccount(account);
    if (!connection) return false;
    
    const provider = this.getProvider(connection.provider);
    if (!provider) return false;
    
    try {
      const updatedAccount = await provider.syncAccount(connection.id, account.plaidAccountId || account.methodAccountId || accountId);
      await this.updateAccountInDatabase(userId, account.id, updatedAccount);
      return true;
    } catch (error) {
      console.error(`Failed to sync account ${accountId}:`, error);
      return false;
    }
  }
  
  private async getUserConnections(userId: string): Promise<ConnectionMetadata[]> {
    const connections: ConnectionMetadata[] = [];
    
    // Get Plaid connections
    const plaidConnections = await storage.getPlaidConnections(userId);
    connections.push(...plaidConnections.map(conn => ({
      id: conn.id,
      userId: conn.userId,
      provider: 'plaid' as DataSource,
      dataMode: 'live' as DataMode, // Plaid is always live or sandbox
      institutionName: conn.institutionName,
      isActive: conn.isActive || false,
      lastSynced: conn.lastSynced,
    })));
    
    // Get Method connections
    const methodConnections = await storage.getMethodConnections(userId);
    connections.push(...methodConnections.map(conn => ({
      id: conn.id,
      userId: conn.userId,
      provider: 'method' as DataSource,
      dataMode: 'live' as DataMode, // Method is always live or sandbox
      institutionName: conn.institutionName,
      isActive: conn.isActive || false,
      lastSynced: conn.lastSynced,
    })));
    
    // Get demo connections (stored in memory for now)
    // In production, these would be stored in the database
    
    return connections;
  }
  
  private async getConnectionForAccount(account: DebtAccount): Promise<ConnectionMetadata | null> {
    if (account.plaidAccountId) {
      // Find Plaid connection
      const connections = await storage.getPlaidConnections(account.userId);
      const connection = connections.find(c => c.isActive);
      if (connection) {
        return {
          id: connection.id,
          userId: connection.userId,
          provider: 'plaid',
          dataMode: 'live',
          institutionName: connection.institutionName,
          isActive: connection.isActive || false,
          lastSynced: connection.lastSynced || undefined,
        };
      }
    }
    
    if (account.methodAccountId) {
      // Find Method connection
      const connections = await storage.getMethodConnections(account.userId);
      const connection = connections.find(c => c.accountId === account.methodAccountId);
      if (connection) {
        return {
          id: connection.id,
          userId: connection.userId,
          provider: 'method',
          dataMode: 'live',
          institutionName: connection.institutionName,
          isActive: connection.isActive || false,
          lastSynced: connection.lastSynced || undefined,
        };
      }
    }
    
    if (account.syncSource === 'demo') {
      // Demo connection
      return {
        id: `demo_${account.id}`,
        userId: account.userId,
        provider: 'demo',
        dataMode: 'demo',
        institutionName: account.institutionName,
        isActive: true,
        lastSynced: account.lastSynced || undefined,
      };
    }
    
    return null;
  }
  
  private async saveAccountsToDatabase(userId: string, connection: ConnectionMetadata, accounts: AccountData[]) {
    for (const account of accounts) {
      // Check if account already exists
      const existingAccounts = await storage.getDebtAccounts(userId);
      let existing: DebtAccount | undefined;
      
      if (connection.provider === 'plaid') {
        existing = existingAccounts.find(a => a.plaidAccountId === account.providerId);
      } else if (connection.provider === 'method') {
        existing = existingAccounts.find(a => a.methodAccountId === account.providerId);
      } else if (connection.provider === 'demo') {
        existing = existingAccounts.find(a => 
          a.syncSource === 'demo' && a.accountNickname === account.accountName
        );
      }
      
      const accountData = {
        userId,
        institutionName: account.institutionName,
        accountNickname: account.accountName,
        accountType: account.accountType,
        currentBalance: account.currentBalance.toFixed(2),
        interestRate: (account.interestRate || 0).toFixed(2),
        minimumPayment: account.minimumPayment?.toFixed(2) || null,
        creditLimit: account.creditLimit?.toFixed(2) || null,
        isManual: false,
        syncSource: connection.provider,
        plaidAccountId: connection.provider === 'plaid' ? account.providerId : null,
        methodAccountId: connection.provider === 'method' ? account.providerId : null,
        lastSynced: account.lastSynced,
      };
      
      if (existing) {
        await storage.updateDebtAccount(existing.id, userId, accountData);
      } else {
        await storage.createDebtAccount(accountData);
      }
    }
  }
  
  private async updateAccountInDatabase(userId: string, accountId: string, account: AccountData) {
    await storage.updateDebtAccount(accountId, userId, {
      currentBalance: account.currentBalance.toFixed(2),
      interestRate: (account.interestRate || 0).toFixed(2),
      minimumPayment: account.minimumPayment?.toFixed(2) || null,
      creditLimit: account.creditLimit?.toFixed(2) || null,
      lastSynced: account.lastSynced,
    });
  }
  
  // Helper method to get a mixed view of accounts (real + demo)
  async getMixedAccounts(userId: string, includeDemo: boolean = false): Promise<DebtAccount[]> {
    const accounts = await storage.getDebtAccounts(userId);
    
    if (!includeDemo) {
      return accounts.filter(a => a.syncSource !== 'demo');
    }
    
    return accounts;
  }
  
  // Add demo accounts for a user
  async addDemoAccounts(userId: string, institutionName: string): Promise<boolean> {
    const demoProvider = this.getProvider('demo') as DemoProvider;
    if (!demoProvider) return false;
    
    try {
      const connectionId = await demoProvider.addDemoInstitution(userId, institutionName);
      const accounts = await demoProvider.getDemoAccountsForInstitution(institutionName);
      
      const connection: ConnectionMetadata = {
        id: connectionId,
        userId,
        provider: 'demo',
        dataMode: 'demo',
        institutionName,
        isActive: true,
        lastSynced: new Date(),
      };
      
      await this.saveAccountsToDatabase(userId, connection, accounts);
      return true;
    } catch (error) {
      console.error('Failed to add demo accounts:', error);
      return false;
    }
  }
  
  // Get available demo institutions
  async getDemoInstitutions(): Promise<string[]> {
    const demoProvider = this.getProvider('demo') as DemoProvider;
    if (!demoProvider) return [];
    
    return demoProvider.getDemoInstitutions();
  }
}

// Export singleton instance
export const providerManager = new ProviderManager();