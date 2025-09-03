import type { Express } from 'express';
import { isAuthenticated } from '../auth';
import { providerManager } from '../providers/manager';
import { PlaidProvider } from '../providers/plaid';
import { DataSource, DataMode } from '../providers/base';

export function setupProviderRoutes(app: Express) {
  // Get available providers
  app.get('/api/providers', isAuthenticated, async (req: any, res) => {
    try {
      const providers = providerManager.getAvailableProviders();
      res.json({
        providers: providers.map(p => ({
          source: p.source,
          available: p.available,
          name: getProviderDisplayName(p.source),
          description: getProviderDescription(p.source),
          supportsDemo: p.source === 'demo' || p.source === 'plaid' || p.source === 'method',
        })),
      });
    } catch (error) {
      console.error('Error getting providers:', error);
      res.status(500).json({ message: 'Failed to get providers' });
    }
  });
  
  // Connect to a provider
  app.post('/api/providers/:source/connect', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const source = req.params.source as DataSource;
      const { dataMode = 'live', redirectUrl, webhookUrl } = req.body;
      
      const result = await providerManager.connect(source, {
        userId,
        dataMode: dataMode as DataMode,
        redirectUrl,
        webhookUrl,
      });
      
      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }
      
      res.json(result);
    } catch (error) {
      console.error('Error connecting to provider:', error);
      res.status(500).json({ message: 'Failed to connect to provider' });
    }
  });
  
  // Exchange token (for Plaid)
  app.post('/api/providers/plaid/exchange-token', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const { public_token } = req.body;
      
      if (!public_token) {
        return res.status(400).json({ message: 'Public token is required' });
      }
      
      const plaidProvider = providerManager.getProvider('plaid') as PlaidProvider;
      if (!plaidProvider) {
        return res.status(400).json({ message: 'Plaid provider not available' });
      }
      
      const connectionId = await plaidProvider.exchangePublicToken(public_token, userId);
      
      // Sync accounts immediately
      const accounts = await plaidProvider.getAccounts(connectionId);
      
      res.json({
        success: true,
        connectionId,
        accountsCount: accounts.length,
      });
    } catch (error) {
      console.error('Error exchanging Plaid token:', error);
      res.status(500).json({ message: 'Failed to exchange token' });
    }
  });
  
  // Create Method element token (for Opal/Connect)
  app.post('/api/providers/method/element-token', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const methodProvider = providerManager.getProvider('method');
      
      if (!methodProvider) {
        return res.status(400).json({ message: 'Method provider not available' });
      }
      
      // Create element token for the user
      const token = await (methodProvider as any).createElementToken(userId);
      
      res.json({ token });
    } catch (error) {
      console.error('Error creating Method element token:', error);
      res.status(500).json({ message: 'Failed to create element token' });
    }
  });
  
  // Handle Method webhook
  app.post('/api/providers/method/webhook', async (req, res) => {
    try {
      const methodProvider = providerManager.getProvider('method');
      if (!methodProvider) {
        return res.status(400).json({ message: 'Method provider not available' });
      }
      
      // Method provider will handle the webhook
      await (methodProvider as any).handleWebhook(req.body);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error handling Method webhook:', error);
      res.status(500).json({ message: 'Failed to handle webhook' });
    }
  });
  
  // Sync all accounts
  app.post('/api/providers/sync', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const result = await providerManager.syncAccounts(userId);
      
      res.json({
        success: true,
        synced: result.synced,
        failed: result.failed,
      });
    } catch (error) {
      console.error('Error syncing accounts:', error);
      res.status(500).json({ message: 'Failed to sync accounts' });
    }
  });
  
  // Sync specific account
  app.post('/api/providers/sync/:accountId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const { accountId } = req.params;
      
      const success = await providerManager.syncAccount(userId, accountId);
      
      if (!success) {
        return res.status(404).json({ message: 'Account not found or sync failed' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error syncing account:', error);
      res.status(500).json({ message: 'Failed to sync account' });
    }
  });
  
  // Add demo accounts
  app.post('/api/providers/demo/add', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const { institution } = req.body;
      
      if (!institution) {
        return res.status(400).json({ message: 'Institution is required' });
      }
      
      const success = await providerManager.addDemoAccounts(userId, institution);
      
      if (!success) {
        return res.status(400).json({ message: 'Failed to add demo accounts' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error adding demo accounts:', error);
      res.status(500).json({ message: 'Failed to add demo accounts' });
    }
  });
  
  // Get demo institutions
  app.get('/api/providers/demo/institutions', async (req, res) => {
    try {
      const institutions = await providerManager.getDemoInstitutions();
      res.json({ institutions });
    } catch (error) {
      console.error('Error getting demo institutions:', error);
      res.status(500).json({ message: 'Failed to get demo institutions' });
    }
  });
  
  // Disconnect from provider
  app.delete('/api/providers/:source/:connectionId', isAuthenticated, async (req: any, res) => {
    try {
      const { source, connectionId } = req.params;
      
      const success = await providerManager.disconnect(source as DataSource, connectionId);
      
      if (!success) {
        return res.status(404).json({ message: 'Connection not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error disconnecting from provider:', error);
      res.status(500).json({ message: 'Failed to disconnect' });
    }
  });
}

function getProviderDisplayName(source: DataSource): string {
  switch (source) {
    case 'plaid':
      return 'Plaid';
    case 'method':
      return 'Method';
    case 'demo':
      return 'Demo Data';
    default:
      return source;
  }
}

function getProviderDescription(source: DataSource): string {
  switch (source) {
    case 'plaid':
      return 'Connect your bank accounts and credit cards';
    case 'method':
      return 'Connect your loans and liabilities';
    case 'demo':
      return 'Try with realistic demo data';
    default:
      return '';
  }
}