import { config } from './config';
import { Encryption } from './security';
import { Method, Environments } from 'method-node';

// Method API configuration
const getMethodEnvironment = () => {
  switch (config.METHOD_ENV) {
    case 'production':
      return Environments.production;
    case 'sandbox':
      return Environments.sandbox;
    case 'dev':
    default:
      return Environments.dev;
  }
};

// Method API types
export interface MethodEntity {
  id: string;
  type: 'individual';
  individual: {
    first_name: string;
    last_name: string;
    phone: string;
    email?: string;
    dob?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface MethodAccount {
  id: string;
  entity_id: string;
  type: 'liability';
  liability: {
    type: 'credit_card' | 'auto_loan' | 'student_loan' | 'mortgage' | 'personal_loan';
    name: string;
    balance: number;
    interest_rate?: number;
    minimum_payment?: number;
    credit_limit?: number;
    last_payment_date?: string;
    next_payment_due_date?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface MethodConnectToken {
  token: string;
  expires_at: string;
}

// Method API client
export class MethodClient {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    if (!config.METHOD_API_KEY) {
      throw new Error('Method API key is not configured');
    }
    this.apiKey = config.METHOD_API_KEY;
    // Method API base URL based on environment
    const methodEnv = getMethodEnvironment();
    this.baseUrl = methodEnv === Environments.production 
      ? 'https://api.method.dev' 
      : 'https://dev.method.dev';
  }

  // Helper method for API requests
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Method API error: ${response.status} - ${JSON.stringify(error)}`);
    }

    return response.json();
  }

  // Create a new entity (user) in Method
  async createEntity(data: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
  }): Promise<MethodEntity> {
    // In development mode, use test data
    const entityData = config.METHOD_ENV === 'dev' ? {
      type: 'individual',
      individual: {
        first_name: data.firstName,
        last_name: data.lastName,
        phone: '6505551234', // Test phone for dev
        email: data.email,
      },
    } : {
      type: 'individual',
      individual: {
        first_name: data.firstName,
        last_name: data.lastName,
        phone: data.phone,
        email: data.email,
      },
    };

    return this.request<MethodEntity>('/entities', {
      method: 'POST',
      body: JSON.stringify(entityData),
    });
  }

  // Create a connect token for Method Connect
  async createConnectToken(entityId: string): Promise<MethodConnectToken> {
    return this.request<MethodConnectToken>('/elements/connect/tokens', {
      method: 'POST',
      body: JSON.stringify({
        entity_id: entityId,
        products: ['liabilities'],
      }),
    });
  }

  // Exchange public token for account access
  async exchangePublicToken(publicToken: string): Promise<{ account_id: string }> {
    return this.request<{ account_id: string }>('/elements/connect/exchange', {
      method: 'POST',
      body: JSON.stringify({
        public_token: publicToken,
      }),
    });
  }

  // Get account details
  async getAccount(accountId: string): Promise<MethodAccount> {
    return this.request<MethodAccount>(`/accounts/${accountId}`, {
      method: 'GET',
    });
  }

  // Get all accounts for an entity
  async getEntityAccounts(entityId: string): Promise<{ data: MethodAccount[] }> {
    return this.request<{ data: MethodAccount[] }>(`/entities/${entityId}/accounts`, {
      method: 'GET',
    });
  }

  // Sync account data (refresh balances)
  async syncAccount(accountId: string): Promise<MethodAccount> {
    return this.request<MethodAccount>(`/accounts/${accountId}/sync`, {
      method: 'POST',
    });
  }

  // Map Method account type to our system
  static mapAccountType(methodType: string): string {
    const typeMap: { [key: string]: string } = {
      'credit_card': 'credit_card',
      'auto_loan': 'auto_loan',
      'student_loan': 'student_loan',
      'mortgage': 'mortgage',
      'personal_loan': 'personal_loan',
    };
    return typeMap[methodType] || 'personal_loan';
  }

  // Format Method account data for our system
  static formatAccountData(account: MethodAccount) {
    const liability = account.liability;
    
    return {
      methodAccountId: account.id,
      syncSource: 'method' as const,
      accountType: this.mapAccountType(liability.type),
      institutionName: liability.name || 'Unknown Institution',
      accountNickname: liability.name || `${liability.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
      currentBalance: Math.abs(liability.balance || 0).toFixed(2),
      interestRate: (liability.interest_rate || 0).toFixed(2),
      minimumPayment: liability.minimum_payment?.toFixed(2) || null,
      creditLimit: liability.credit_limit?.toFixed(2) || null,
      isManual: false,
      lastSynced: new Date(),
    };
  }
}

// Export singleton instance
let methodClient: MethodClient | null = null;

export function getMethodClient(): MethodClient {
  if (!methodClient && config.METHOD_API_KEY) {
    methodClient = new MethodClient();
  }
  if (!methodClient) {
    throw new Error('Method client not initialized - API key missing');
  }
  return methodClient;
}

// Helper to check if Method is configured
export function isMethodConfigured(): boolean {
  return !!config.METHOD_API_KEY;
}