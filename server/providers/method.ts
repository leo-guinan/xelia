import { LiabilityProvider, AccountData, ConnectOptions, ConnectResult, DataSource, DataMode } from './base';
import { Method, Environments } from 'method-node';
import { config } from '../config';
import { storage } from '../storage';

export class MethodProvider extends LiabilityProvider {
  private methodClient: any;
  
  constructor(dataMode: DataMode = 'live') {
    super(dataMode);
    
    if (this.isConfigured()) {
      const env = this.getMethodEnvironment();
      // Method client initialization - note Method is a function/constructor
      this.methodClient = new Method({
        apiKey: config.METHOD_API_KEY!,
        env,
      });
    }
  }
  
  getName(): DataSource {
    return 'method';
  }
  
  isConfigured(): boolean {
    return !!config.METHOD_API_KEY;
  }
  
  private getMethodEnvironment() {
    if (this.dataMode === 'test' || config.METHOD_ENV === 'sandbox') {
      return Environments.sandbox;
    }
    if (config.METHOD_ENV === 'production') {
      return Environments.production;
    }
    return Environments.dev;
  }
  
  async connect(options: ConnectOptions): Promise<ConnectResult> {
    try {
      // Get or create entity for the user
      const entity = await this.getOrCreateEntity(options.userId);
      
      // Method uses element tokens for the connect flow
      // The frontend will need to separately request the element token
      // and use it with the Opal SDK
      
      return {
        success: true,
        connectionId: entity.id,
        requiresElementToken: true, // Signal that frontend needs to request element token
      };
    } catch (error) {
      console.error('Method connect error:', error);
      return {
        success: false,
        error: 'Failed to create Method entity',
      };
    }
  }
  
  async createElementToken(userId: string): Promise<string> {
    try {
      // Get or create entity for the user
      const entity = await this.getOrCreateEntity(userId);
      
      // Create element token for the Connect flow
      // The Connect element allows users to connect their liability accounts
      const elementResponse = await this.methodClient.elements.token.create({
        entity_id: entity.id,
        type: 'connect',
        connect: {
          // Request products we want to fetch for the accounts
          products: ['balance', 'payoff', 'update'],
          // Filter for liability accounts only
          account_filters: {
            liability_types: [
              'credit_card',
              'auto_loan',
              'student_loans', // Note: 'student_loans' not 'student_loan'
              'mortgage',
              'personal_loan',
              'loan', // General loan type
            ],
          },
        },
      });
      
      return elementResponse.data.element_token;
    } catch (error) {
      console.error('Method createElementToken error:', error);
      throw new Error('Failed to create element token');
    }
  }
  
  async disconnect(connectionId: string): Promise<boolean> {
    try {
      const connection = await storage.getMethodConnection(connectionId);
      if (!connection) return false;
      
      // Mark connection as inactive
      await storage.updateMethodConnection(connectionId, connection.userId, {
        isActive: false,
      });
      
      return true;
    } catch (error) {
      console.error('Method disconnect error:', error);
      return false;
    }
  }
  
  async getAccounts(connectionId: string): Promise<AccountData[]> {
    try {
      const connection = await storage.getMethodConnection(connectionId);
      if (!connection) return [];
      
      // Get accounts for the entity
      const accounts = await this.methodClient
        .entities(connection.entityId)
        .accounts
        .list();
      
      // Filter and map liability accounts
      const liabilityAccounts = accounts.data
        .filter((account: any) => account.type === 'liability')
        .map((account: any) => this.mapMethodAccount(account, connection.institutionName));
      
      return liabilityAccounts;
    } catch (error) {
      console.error('Method getAccounts error:', error);
      return [];
    }
  }
  
  async syncAccount(connectionId: string, accountId: string): Promise<AccountData> {
    try {
      const connection = await storage.getMethodConnection(connectionId);
      if (!connection) throw new Error('Connection not found');
      
      // Sync specific account
      const account = await this.methodClient
        .accounts(accountId)
        .sync();
      
      return this.mapMethodAccount(account, connection.institutionName);
    } catch (error) {
      console.error('Method syncAccount error:', error);
      throw error;
    }
  }
  
  async syncAllAccounts(connectionId: string): Promise<AccountData[]> {
    try {
      const accounts = await this.getAccounts(connectionId);
      
      // Sync each account
      const syncedAccounts = await Promise.all(
        accounts.map(async (account) => {
          try {
            return await this.syncAccount(connectionId, account.providerId);
          } catch (error) {
            console.error(`Failed to sync account ${account.providerId}:`, error);
            return account; // Return existing data if sync fails
          }
        })
      );
      
      return syncedAccounts;
    } catch (error) {
      console.error('Method syncAllAccounts error:', error);
      return [];
    }
  }
  
  async handleWebhook(event: any): Promise<void> {
    // Handle Method webhooks
    switch (event.type) {
      case 'connect.completed':
        // User completed the connect flow
        await this.handleConnectCompleted(event);
        break;
      case 'account.updated':
        // Account data was updated
        await this.handleAccountUpdated(event);
        break;
      default:
        console.log('Unhandled Method webhook event:', event.type);
    }
  }
  
  private async handleConnectCompleted(event: any) {
    const { entity_id, connect_id, accounts } = event.data;
    
    // Save the connection
    const user = await storage.getUserByMethodEntityId(entity_id);
    if (!user) {
      console.error('User not found for entity:', entity_id);
      return;
    }
    
    // Save each account connection
    for (const account of accounts) {
      await storage.createMethodConnection({
        userId: user.id,
        entityId: entity_id,
        accountId: account.id,
        institutionName: account.institution_name || 'Unknown',
        isActive: true,
        lastSynced: new Date(),
      });
    }
  }
  
  private async handleAccountUpdated(event: any) {
    // Sync the updated account
    const { account_id } = event.data;
    const connection = await storage.getMethodConnectionByAccountId(account_id);
    if (connection) {
      await this.syncAccount(connection.id, account_id);
    }
  }
  
  private async getOrCreateEntity(userId: string) {
    // Check if entity already exists
    const existingConnections = await storage.getMethodConnections(userId);
    if (existingConnections.length > 0) {
      // Get entity from Method
      return await this.methodClient.entities(existingConnections[0].entityId).retrieve();
    }
    
    // Create new entity
    const user = await storage.getUser(userId);
    if (!user) throw new Error('User not found');
    
    const entityData: any = {
      type: 'individual',
      individual: {
        first_name: user.firstName || 'Unknown',
        last_name: user.lastName || 'Unknown',
        email: user.email,
      },
    };
    
    // Add phone for non-demo mode
    if (this.dataMode !== 'demo') {
      entityData.individual.phone = '6505551234'; // This should come from user profile
    }
    
    const entity = await this.methodClient.entities.create(entityData);
    
    // Save entity ID for future reference
    await storage.saveMethodEntityId(userId, entity.id);
    
    return entity;
  }
  
  private mapMethodAccount(account: any, institutionName: string): AccountData {
    const liability = account.liability || {};
    
    return {
      providerId: account.id,
      institutionName: institutionName || liability.name || 'Unknown Institution',
      accountName: liability.name || `${liability.type?.replace('_', ' ')} Account`,
      accountType: this.mapMethodAccountType(liability.type),
      currentBalance: Math.abs(liability.balance || 0),
      interestRate: liability.interest_rate || undefined,
      minimumPayment: liability.minimum_payment || undefined,
      creditLimit: liability.credit_limit || undefined,
      lastPaymentDate: liability.last_payment_date ? new Date(liability.last_payment_date) : undefined,
      nextPaymentDueDate: liability.next_payment_due_date ? new Date(liability.next_payment_due_date) : undefined,
      lastSynced: new Date(),
      dataMode: this.dataMode,
      raw: account,
    };
  }
  
  private mapMethodAccountType(type: string): AccountData['accountType'] {
    const typeMap: { [key: string]: AccountData['accountType'] } = {
      'credit_card': 'credit_card',
      'auto_loan': 'auto_loan',
      'student_loan': 'student_loan',
      'mortgage': 'mortgage',
      'personal_loan': 'personal_loan',
      'heloc': 'heloc',
    };
    
    return typeMap[type] || 'personal_loan';
  }
}