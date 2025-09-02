import { LiabilityProvider, AccountData, ConnectOptions, ConnectResult, DataSource, DataMode } from './base';
import { plaidClient, PLAID_PRODUCTS, PLAID_COUNTRY_CODES } from '../plaid';
import { config } from '../config';
import { storage } from '../storage';

export class PlaidProvider extends LiabilityProvider {
  constructor(dataMode: DataMode = 'live') {
    // Plaid uses sandbox for test mode
    super(dataMode === 'test' ? 'test' : dataMode);
  }
  
  getName(): DataSource {
    return 'plaid';
  }
  
  isConfigured(): boolean {
    return !!(config.PLAID_CLIENT_ID && config.PLAID_SECRET);
  }
  
  async connect(options: ConnectOptions): Promise<ConnectResult> {
    try {
      // Create link token for Plaid Link
      const request = {
        client_name: 'Xelia Debt Tracker',
        country_codes: PLAID_COUNTRY_CODES,
        language: 'en',
        user: {
          client_user_id: options.userId,
        },
        products: PLAID_PRODUCTS,
        redirect_uri: options.redirectUrl,
        webhook: options.webhookUrl,
      };
      
      const response = await plaidClient.linkTokenCreate(request);
      
      return {
        success: true,
        token: response.data.link_token,
      };
    } catch (error) {
      console.error('Plaid connect error:', error);
      return {
        success: false,
        error: 'Failed to create Plaid link token',
      };
    }
  }
  
  async disconnect(connectionId: string): Promise<boolean> {
    try {
      const connection = await storage.getPlaidConnection(connectionId);
      if (!connection) return false;
      
      // Remove the item from Plaid
      await plaidClient.itemRemove({
        access_token: connection.accessToken,
      });
      
      // Mark connection as inactive
      await storage.updatePlaidConnection(connectionId, connection.userId, {
        isActive: false,
      });
      
      return true;
    } catch (error) {
      console.error('Plaid disconnect error:', error);
      return false;
    }
  }
  
  async getAccounts(connectionId: string): Promise<AccountData[]> {
    try {
      const connection = await storage.getPlaidConnection(connectionId);
      if (!connection) return [];
      
      // Get accounts
      const accountsResponse = await plaidClient.accountsGet({
        access_token: connection.accessToken,
      });
      
      // Get liabilities if available
      let liabilities: any = {};
      try {
        const liabilitiesResponse = await plaidClient.liabilitiesGet({
          access_token: connection.accessToken,
        });
        liabilities = liabilitiesResponse.data.liabilities;
      } catch (error) {
        console.log('Liabilities not available for this institution');
      }
      
      // Filter and map liability accounts
      const liabilityAccounts = accountsResponse.data.accounts
        .filter(account => account.type === 'credit' || account.type === 'loan')
        .map(account => this.mapPlaidAccount(account, liabilities, connection.institutionName));
      
      return liabilityAccounts;
    } catch (error) {
      console.error('Plaid getAccounts error:', error);
      return [];
    }
  }
  
  async syncAccount(connectionId: string, accountId: string): Promise<AccountData> {
    const accounts = await this.getAccounts(connectionId);
    const account = accounts.find(a => a.providerId === accountId);
    if (!account) {
      throw new Error('Account not found');
    }
    return account;
  }
  
  async syncAllAccounts(connectionId: string): Promise<AccountData[]> {
    return this.getAccounts(connectionId);
  }
  
  async exchangePublicToken(publicToken: string, userId: string): Promise<string> {
    try {
      // Exchange public token for access token
      const exchangeResponse = await plaidClient.itemPublicTokenExchange({
        public_token: publicToken,
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
      
      // Save connection
      const connection = await storage.createPlaidConnection({
        userId,
        accessToken,
        institutionId: institutionId || 'unknown',
        institutionName,
        isActive: true,
        lastSynced: new Date(),
      });
      
      return connection.id;
    } catch (error) {
      console.error('Plaid exchange token error:', error);
      throw error;
    }
  }
  
  private mapPlaidAccount(account: any, liabilities: any, institutionName: string): AccountData {
    const balance = account.balances.current || 0;
    
    // Try to find detailed liability info
    let liabilityDetails: any = null;
    if (liabilities.credit) {
      liabilityDetails = liabilities.credit.find((c: any) => c.account_id === account.account_id);
    }
    if (!liabilityDetails && liabilities.student) {
      liabilityDetails = liabilities.student.find((s: any) => s.account_id === account.account_id);
    }
    if (!liabilityDetails && liabilities.mortgage) {
      liabilityDetails = liabilities.mortgage.find((m: any) => m.account_id === account.account_id);
    }
    
    return {
      providerId: account.account_id,
      institutionName,
      accountName: account.name,
      accountType: this.mapPlaidAccountType(account),
      currentBalance: Math.abs(balance),
      interestRate: this.extractInterestRate(liabilityDetails),
      minimumPayment: liabilityDetails?.last_payment_amount || undefined,
      creditLimit: account.balances.limit || undefined,
      lastPaymentDate: liabilityDetails?.last_payment_date ? new Date(liabilityDetails.last_payment_date) : undefined,
      nextPaymentDueDate: liabilityDetails?.next_payment_due_date ? new Date(liabilityDetails.next_payment_due_date) : undefined,
      lastSynced: new Date(),
      dataMode: this.dataMode,
      raw: { account, liabilityDetails },
    };
  }
  
  private mapPlaidAccountType(account: any): AccountData['accountType'] {
    const subtype = (account.subtype || '').toLowerCase();
    
    if (subtype.includes('credit')) return 'credit_card';
    if (subtype.includes('auto')) return 'auto_loan';
    if (subtype.includes('student')) return 'student_loan';
    if (subtype.includes('mortgage') || subtype.includes('home equity')) return 'mortgage';
    if (subtype.includes('heloc')) return 'heloc';
    
    return 'personal_loan';
  }
  
  private extractInterestRate(liabilityDetails: any): number | undefined {
    if (!liabilityDetails) return undefined;
    
    // Credit cards
    if (liabilityDetails.aprs) {
      const purchaseApr = liabilityDetails.aprs.find((apr: any) => apr.apr_type === 'purchase_apr');
      if (purchaseApr) return purchaseApr.apr_percentage;
    }
    
    // Student loans
    if (liabilityDetails.interest_rate_percentage) {
      return liabilityDetails.interest_rate_percentage;
    }
    
    // Mortgages
    if (liabilityDetails.interest_rate?.percentage) {
      return liabilityDetails.interest_rate.percentage;
    }
    
    return undefined;
  }
}