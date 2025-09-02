import { LiabilityProvider, AccountData, ConnectOptions, ConnectResult, DataSource, DataMode } from './base';
import { v4 as uuidv4 } from 'uuid';

interface DemoAccount {
  id: string;
  institution: string;
  name: string;
  type: AccountData['accountType'];
  balance: number;
  interestRate: number;
  minimumPayment?: number;
  creditLimit?: number;
  daysUntilDue: number;
}

// Predefined demo accounts with realistic data
const DEMO_INSTITUTIONS: { [key: string]: DemoAccount[] } = {
  'Chase Bank': [
    {
      id: 'demo_chase_freedom',
      institution: 'Chase Bank',
      name: 'Chase Freedom Unlimited',
      type: 'credit_card',
      balance: 2847.32,
      interestRate: 19.99,
      minimumPayment: 85,
      creditLimit: 5000,
      daysUntilDue: 12,
    },
    {
      id: 'demo_chase_sapphire',
      institution: 'Chase Bank',
      name: 'Chase Sapphire Preferred',
      type: 'credit_card',
      balance: 1234.56,
      interestRate: 21.99,
      minimumPayment: 45,
      creditLimit: 10000,
      daysUntilDue: 12,
    },
  ],
  'Bank of America': [
    {
      id: 'demo_boa_auto',
      institution: 'Bank of America',
      name: 'Auto Loan - Honda Accord',
      type: 'auto_loan',
      balance: 18543.21,
      interestRate: 4.99,
      minimumPayment: 425,
      daysUntilDue: 5,
    },
  ],
  'Wells Fargo': [
    {
      id: 'demo_wf_mortgage',
      institution: 'Wells Fargo',
      name: 'Home Mortgage',
      type: 'mortgage',
      balance: 285000,
      interestRate: 6.75,
      minimumPayment: 2150,
      daysUntilDue: 1,
    },
    {
      id: 'demo_wf_heloc',
      institution: 'Wells Fargo',
      name: 'Home Equity Line of Credit',
      type: 'heloc',
      balance: 15000,
      interestRate: 8.5,
      minimumPayment: 150,
      creditLimit: 50000,
      daysUntilDue: 1,
    },
  ],
  'Sallie Mae': [
    {
      id: 'demo_sallie_student',
      institution: 'Sallie Mae',
      name: 'Student Loan - Undergraduate',
      type: 'student_loan',
      balance: 32000,
      interestRate: 5.5,
      minimumPayment: 350,
      daysUntilDue: 20,
    },
  ],
  'Capital One': [
    {
      id: 'demo_capital_venture',
      institution: 'Capital One',
      name: 'Venture X Card',
      type: 'credit_card',
      balance: 4521.89,
      interestRate: 23.99,
      minimumPayment: 135,
      creditLimit: 15000,
      daysUntilDue: 8,
    },
  ],
  'American Express': [
    {
      id: 'demo_amex_gold',
      institution: 'American Express',
      name: 'Gold Card',
      type: 'credit_card',
      balance: 3200.00,
      interestRate: 22.99,
      minimumPayment: 96,
      creditLimit: 20000,
      daysUntilDue: 15,
    },
  ],
  'LendingClub': [
    {
      id: 'demo_lc_personal',
      institution: 'LendingClub',
      name: 'Personal Loan - Debt Consolidation',
      type: 'personal_loan',
      balance: 12000,
      interestRate: 11.99,
      minimumPayment: 380,
      daysUntilDue: 25,
    },
  ],
};

export class DemoProvider extends LiabilityProvider {
  private userConnections: Map<string, Set<string>> = new Map();
  
  constructor() {
    super('demo');
  }
  
  getName(): DataSource {
    return 'demo';
  }
  
  isConfigured(): boolean {
    return true; // Demo provider is always available
  }
  
  async connect(options: ConnectOptions): Promise<ConnectResult> {
    // For demo, we'll return a list of institutions to choose from
    const connectionId = `demo_${uuidv4()}`;
    
    // Initialize user's connections if not exists
    if (!this.userConnections.has(options.userId)) {
      this.userConnections.set(options.userId, new Set());
    }
    
    return {
      success: true,
      connectionId,
      // In a real implementation, this would be a URL to a selection page
      redirectUrl: `/demo/select-institution?connectionId=${connectionId}`,
    };
  }
  
  async disconnect(connectionId: string): Promise<boolean> {
    // Remove from all users
    for (const [userId, connections] of Array.from(this.userConnections.entries())) {
      if (connections.has(connectionId)) {
        connections.delete(connectionId);
        return true;
      }
    }
    return false;
  }
  
  async getAccounts(connectionId: string): Promise<AccountData[]> {
    // Return random selection of demo accounts
    const institutions = Object.keys(DEMO_INSTITUTIONS);
    const selectedInstitution = institutions[Math.floor(Math.random() * institutions.length)];
    const accounts = DEMO_INSTITUTIONS[selectedInstitution];
    
    return accounts.map(account => this.mapDemoAccount(account));
  }
  
  async syncAccount(connectionId: string, accountId: string): Promise<AccountData> {
    // Find the account across all institutions
    for (const accounts of Object.values(DEMO_INSTITUTIONS)) {
      const account = accounts.find(a => a.id === accountId);
      if (account) {
        // Simulate balance changes
        const variation = (Math.random() - 0.5) * 100; // +/- $50
        account.balance = Math.max(0, account.balance + variation);
        
        return this.mapDemoAccount(account);
      }
    }
    
    throw new Error('Demo account not found');
  }
  
  async syncAllAccounts(connectionId: string): Promise<AccountData[]> {
    const accounts = await this.getAccounts(connectionId);
    
    // Simulate small balance changes
    return accounts.map(account => ({
      ...account,
      currentBalance: Math.max(0, account.currentBalance + (Math.random() - 0.5) * 100),
      lastSynced: new Date(),
    }));
  }
  
  async addDemoInstitution(userId: string, institutionName: string): Promise<string> {
    const connectionId = `demo_${institutionName.replace(/\s+/g, '_')}_${uuidv4()}`;
    
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    
    this.userConnections.get(userId)!.add(connectionId);
    
    return connectionId;
  }
  
  async getDemoInstitutions(): Promise<string[]> {
    return Object.keys(DEMO_INSTITUTIONS);
  }
  
  async getDemoAccountsForInstitution(institution: string): Promise<AccountData[]> {
    const accounts = DEMO_INSTITUTIONS[institution] || [];
    return accounts.map(account => this.mapDemoAccount(account));
  }
  
  private mapDemoAccount(account: DemoAccount): AccountData {
    const now = new Date();
    const nextPaymentDate = new Date();
    nextPaymentDate.setDate(now.getDate() + account.daysUntilDue);
    
    const lastPaymentDate = new Date();
    lastPaymentDate.setMonth(now.getMonth() - 1);
    lastPaymentDate.setDate(nextPaymentDate.getDate());
    
    return {
      providerId: account.id,
      institutionName: account.institution,
      accountName: account.name,
      accountType: account.type,
      currentBalance: account.balance,
      interestRate: account.interestRate,
      minimumPayment: account.minimumPayment,
      creditLimit: account.creditLimit,
      lastPaymentDate,
      nextPaymentDueDate: nextPaymentDate,
      lastSynced: new Date(),
      dataMode: 'demo',
      raw: account,
    };
  }
  
  // Generate realistic transaction history for demo accounts
  generateTransactionHistory(accountId: string, months: number = 6): any[] {
    const transactions = [];
    const now = new Date();
    
    for (let month = 0; month < months; month++) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - month);
      
      // Generate 5-15 transactions per month
      const numTransactions = 5 + Math.floor(Math.random() * 10);
      
      for (let i = 0; i < numTransactions; i++) {
        const transactionDate = new Date(date);
        transactionDate.setDate(Math.floor(Math.random() * 28) + 1);
        
        transactions.push({
          id: `demo_txn_${uuidv4()}`,
          accountId,
          date: transactionDate,
          amount: Math.random() * 500 + 10,
          description: this.generateTransactionDescription(),
          category: this.generateTransactionCategory(),
        });
      }
    }
    
    return transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
  }
  
  private generateTransactionDescription(): string {
    const descriptions = [
      'Amazon Purchase',
      'Walmart',
      'Target',
      'Gas Station',
      'Restaurant',
      'Grocery Store',
      'Online Shopping',
      'Coffee Shop',
      'Subscription Service',
      'Insurance Payment',
      'Utility Bill',
      'Phone Bill',
    ];
    
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  }
  
  private generateTransactionCategory(): string {
    const categories = [
      'Shopping',
      'Food & Dining',
      'Transportation',
      'Bills & Utilities',
      'Entertainment',
      'Healthcare',
      'Other',
    ];
    
    return categories[Math.floor(Math.random() * categories.length)];
  }
}