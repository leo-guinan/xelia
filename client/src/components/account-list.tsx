import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  CreditCard, 
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Plus,
} from "lucide-react";
import { DebtAccount } from "@shared/schema";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import AccountCard from "./account-card";
import AddAccountModal from "./add-account-modal";
import ProviderConnectModal from "./provider-connect-modal";

export default function AccountList() {
  const [sortBy, setSortBy] = useState("balance-desc");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accounts = [], isLoading, error } = useQuery<DebtAccount[]>({
    queryKey: ["/api/debt-accounts"],
    retry: false,
  });

  // Handle unauthorized errors
  if (error && isUnauthorizedError(error)) {
    toast({
      title: "Unauthorized",
      description: "You are logged out. Logging in again...",
      variant: "destructive",
    });
    setTimeout(() => {
      window.location.href = "/api/login";
    }, 500);
  }

  const syncPlaidMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/plaid/sync");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/debt-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/debt-summary"] });
      toast({
        title: "Plaid accounts synced",
        description: `Updated ${data.synced_connections} of ${data.total_connections} connections.`,
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Sync failed",
        description: "Failed to sync Plaid accounts. Please try again.",
        variant: "destructive",
      });
    },
  });

  const syncMethodMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/method/sync");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/debt-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/debt-summary"] });
      toast({
        title: "Method accounts synced",
        description: `Updated ${data.synced_accounts} accounts.`,
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Sync failed",
        description: "Failed to sync Method accounts. Please try again.",
        variant: "destructive",
      });
    },
  });

  const syncAccountMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const account = accounts.find(a => a.id === accountId);
      if (!account) throw new Error("Account not found");
      
      const endpoint = account.syncSource === 'method' 
        ? `/api/method/sync/${accountId}`
        : `/api/plaid/sync/${accountId}`;
      
      const response = await apiRequest("POST", endpoint);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debt-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/debt-summary"] });
      toast({
        title: "Account synced",
        description: "Account data has been updated.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Sync failed",
        description: "Failed to sync account. Please try again.",
        variant: "destructive",
      });
    },
  });

  const sortAccounts = (accounts: DebtAccount[]) => {
    switch (sortBy) {
      case "balance-desc":
        return [...accounts].sort((a, b) => parseFloat(b.currentBalance) - parseFloat(a.currentBalance));
      case "rate-desc":
        return [...accounts].sort((a, b) => parseFloat(b.interestRate) - parseFloat(a.interestRate));
      case "type":
        return [...accounts].sort((a, b) => a.accountType.localeCompare(b.accountType));
      case "source":
        return [...accounts].sort((a, b) => (a.syncSource || 'manual').localeCompare(b.syncSource || 'manual'));
      default:
        return accounts;
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/4"></div>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardContent className="p-6">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-800">Failed to load accounts. Please try refreshing the page.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const sortedAccounts = sortAccounts(accounts || []);
  const plaidAccounts = accounts.filter(a => a.syncSource === 'plaid' || (!a.syncSource && !a.isManual));
  const methodAccounts = accounts.filter(a => a.syncSource === 'method');
  const manualAccounts = accounts.filter(a => a.isManual);

  return (
    <>
      <Card className="bg-white shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-semibold text-primary">Your Accounts</h3>
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowProviderModal(true)}
                  size="sm"
                  className="bg-primary text-white hover:bg-gray-800"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Connect Accounts
                </Button>
                <Button
                  onClick={() => setShowAddModal(true)}
                  size="sm"
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Manual Entry
                </Button>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <label htmlFor="sort-select" className="text-sm font-medium text-secondary">
                Sort by:
              </label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-48" data-testid="select-sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="balance-desc">Balance (High to Low)</SelectItem>
                  <SelectItem value="rate-desc">Interest Rate (High to Low)</SelectItem>
                  <SelectItem value="type">Account Type</SelectItem>
                  <SelectItem value="source">Data Source</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="p-6">
          {sortedAccounts.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-semibold text-primary mb-2">No accounts found</h4>
              <p className="text-secondary mb-4">Connect your accounts or try with demo data</p>
              <div className="flex gap-3 justify-center">
                <Button
                  onClick={() => setShowProviderModal(true)}
                  className="bg-primary text-white hover:bg-gray-800"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Get Started
                </Button>
                <Button
                  onClick={() => setShowAddModal(true)}
                  variant="outline"
                >
                  Manual Entry
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {sortedAccounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  onSync={!account.isManual ? (id) => syncAccountMutation.mutate(id) : undefined}
                  isSyncing={syncAccountMutation.isPending && syncAccountMutation.variables === account.id}
                />
              ))}
            </div>
          )}
        </div>
        
        {/* Connection Status */}
        {sortedAccounts.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <h4 className="text-sm font-semibold text-primary">Connection Status</h4>
                  <p className="text-xs text-secondary">
                    {plaidAccounts.length > 0 && `${plaidAccounts.length} Plaid`}
                    {plaidAccounts.length > 0 && methodAccounts.length > 0 && ', '}
                    {methodAccounts.length > 0 && `${methodAccounts.length} Method`}
                    {(plaidAccounts.length > 0 || methodAccounts.length > 0) && manualAccounts.length > 0 && ', '}
                    {manualAccounts.length > 0 && `${manualAccounts.length} Manual`}
                    {' accounts'}
                  </p>
                </div>
              </div>
              <div className="flex space-x-2">
                {plaidAccounts.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => syncPlaidMutation.mutate()}
                    disabled={syncPlaidMutation.isPending}
                    data-testid="button-sync-plaid"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${syncPlaidMutation.isPending ? 'animate-spin' : ''}`} />
                    {syncPlaidMutation.isPending ? 'Syncing...' : 'Sync Plaid'}
                  </Button>
                )}
                {methodAccounts.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => syncMethodMutation.mutate()}
                    disabled={syncMethodMutation.isPending}
                    data-testid="button-sync-method"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${syncMethodMutation.isPending ? 'animate-spin' : ''}`} />
                    {syncMethodMutation.isPending ? 'Syncing...' : 'Sync Method'}
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ["/api/debt-accounts"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/debt-summary"] });
                    toast({
                      title: "Refreshing data",
                      description: "Account data is being updated...",
                    });
                  }}
                  data-testid="button-refresh"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      <AddAccountModal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)} 
      />
      
      <ProviderConnectModal
        isOpen={showProviderModal}
        onClose={() => setShowProviderModal(false)}
      />
    </>
  );
}