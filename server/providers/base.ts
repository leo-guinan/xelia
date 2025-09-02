import { DebtAccount } from "@shared/schema";

export type DataSource = 'plaid' | 'method' | 'demo' | 'manual';
export type DataMode = 'live' | 'test' | 'demo';

export interface AccountData {
  providerId: string; // Provider's account ID
  institutionName: string;
  accountName: string;
  accountType: 'credit_card' | 'auto_loan' | 'student_loan' | 'mortgage' | 'personal_loan' | 'heloc';
  currentBalance: number;
  interestRate?: number;
  minimumPayment?: number;
  creditLimit?: number;
  lastPaymentDate?: Date;
  nextPaymentDueDate?: Date;
  lastSynced: Date;
  dataMode: DataMode;
  raw?: any; // Raw data from provider
}

export interface ConnectionMetadata {
  id: string;
  userId: string;
  provider: DataSource;
  dataMode: DataMode;
  institutionName?: string;
  isActive: boolean;
  lastSynced?: Date | null;
  metadata?: Record<string, any>;
}

export interface ConnectOptions {
  userId: string;
  dataMode: DataMode;
  redirectUrl?: string;
  webhookUrl?: string;
  products?: string[];
}

export interface ConnectResult {
  success: boolean;
  connectionId?: string;
  redirectUrl?: string; // For redirect-based flows
  token?: string; // For embedded flows
  error?: string;
}

export abstract class LiabilityProvider {
  protected dataMode: DataMode;
  
  constructor(dataMode: DataMode = 'live') {
    this.dataMode = dataMode;
  }
  
  abstract getName(): DataSource;
  
  abstract isConfigured(): boolean;
  
  abstract connect(options: ConnectOptions): Promise<ConnectResult>;
  
  abstract disconnect(connectionId: string): Promise<boolean>;
  
  abstract getAccounts(connectionId: string): Promise<AccountData[]>;
  
  abstract syncAccount(connectionId: string, accountId: string): Promise<AccountData>;
  
  abstract syncAllAccounts(connectionId: string): Promise<AccountData[]>;
  
  // Helper to convert provider data to our schema
  protected toAccountData(account: any, provider: DataSource): AccountData {
    // Default implementation - providers can override
    return {
      providerId: account.id || account.account_id,
      institutionName: account.institution_name || 'Unknown',
      accountName: account.name || account.account_name || 'Account',
      accountType: this.mapAccountType(account),
      currentBalance: Math.abs(account.balance || account.current_balance || 0),
      interestRate: account.interest_rate || account.apr || undefined,
      minimumPayment: account.minimum_payment || undefined,
      creditLimit: account.credit_limit || account.limit || undefined,
      lastPaymentDate: account.last_payment_date ? new Date(account.last_payment_date) : undefined,
      nextPaymentDueDate: account.next_payment_due_date ? new Date(account.next_payment_due_date) : undefined,
      lastSynced: new Date(),
      dataMode: this.dataMode,
      raw: account,
    };
  }
  
  protected mapAccountType(account: any): AccountData['accountType'] {
    // Default mapping - providers can override
    const type = (account.type || account.account_type || '').toLowerCase();
    const subtype = (account.subtype || account.account_subtype || '').toLowerCase();
    
    if (type.includes('credit') || subtype.includes('credit')) return 'credit_card';
    if (type.includes('auto') || subtype.includes('auto')) return 'auto_loan';
    if (type.includes('student') || subtype.includes('student')) return 'student_loan';
    if (type.includes('mortgage') || subtype.includes('mortgage')) return 'mortgage';
    if (type.includes('heloc') || subtype.includes('heloc')) return 'heloc';
    
    return 'personal_loan';
  }
}