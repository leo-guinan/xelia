import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  CreditCard, 
  Car, 
  GraduationCap, 
  Home, 
  DollarSign, 
  MoreVertical, 
  Edit,
  EyeOff,
  RefreshCw,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { DebtAccount } from "@shared/schema";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const accountTypeIcons = {
  credit_card: CreditCard,
  auto_loan: Car,
  student_loan: GraduationCap,
  mortgage: Home,
  personal_loan: DollarSign,
  heloc: Home,
};

const accountTypeLabels = {
  credit_card: "Credit Card",
  auto_loan: "Auto Loan",
  student_loan: "Student Loan",
  mortgage: "Mortgage",
  personal_loan: "Personal Loan",
  heloc: "HELOC",
};

export default function AccountList() {
  const [sortBy, setSortBy] = useState("balance-desc");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accounts = [], isLoading, error } = useQuery<DebtAccount[]>({
    queryKey: ["/api/debt-accounts"],
    retry: false,
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
    },
  });

  const hideAccountMutation = useMutation({
    mutationFn: async (accountId: string) => {
      await apiRequest("PUT", `/api/debt-accounts/${accountId}`, { isHidden: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debt-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/debt-summary"] });
      toast({
        title: "Account hidden",
        description: "The account has been hidden from your dashboard.",
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
        title: "Error",
        description: "Failed to hide account. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getInterestRateColor = (rate: number) => {
    if (rate >= 20) return "debt-red";
    if (rate >= 10) return "debt-amber";
    return "debt-green";
  };

  const getInterestRateBadgeClass = (rate: number) => {
    if (rate >= 20) return "bg-red-50 text-debt-red border-red-200";
    if (rate >= 10) return "bg-amber-50 text-debt-amber border-amber-200";
    return "bg-green-50 text-debt-green border-green-200";
  };

  const sortAccounts = (accounts: DebtAccount[]) => {
    switch (sortBy) {
      case "balance-desc":
        return [...accounts].sort((a, b) => parseFloat(b.currentBalance) - parseFloat(a.currentBalance));
      case "rate-desc":
        return [...accounts].sort((a, b) => parseFloat(b.interestRate) - parseFloat(a.interestRate));
      case "due-date":
        return [...accounts].sort((a, b) => (a.dueDate || 999) - (b.dueDate || 999));
      default:
        return accounts;
    }
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(parseFloat(amount));
  };

  const formatDueDate = (dueDate: number | null) => {
    if (!dueDate) return "Not set";
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const dueMonth = dueDate <= now.getDate() ? currentMonth + 1 : currentMonth;
    const year = dueMonth > 11 ? currentYear + 1 : currentYear;
    const month = dueMonth > 11 ? 0 : dueMonth;
    
    const dueDateTime = new Date(year, month, dueDate);
    return dueDateTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const isDueSoon = (dueDate: number | null) => {
    if (!dueDate) return false;
    const now = new Date();
    const currentDay = now.getDate();
    const daysUntilDue = dueDate >= currentDay ? dueDate - currentDay : (30 - currentDay) + dueDate;
    return daysUntilDue <= 5;
  };

  const getCreditUtilization = (balance: string, limit: string | null) => {
    if (!limit) return null;
    const utilization = (parseFloat(balance) / parseFloat(limit)) * 100;
    return Math.round(utilization);
  };

  if (isLoading) {
    return (
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/4"></div>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
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

  const sortedAccounts = sortAccounts(accounts);

  return (
    <Card className="bg-white shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h3 className="text-lg font-semibold text-primary">Your Accounts</h3>
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
                <SelectItem value="due-date">Due Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {sortedAccounts.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-semibold text-primary mb-2">No accounts found</h4>
            <p className="text-secondary">Add your first debt account to get started</p>
          </div>
        ) : (
          sortedAccounts.map((account) => {
            const IconComponent = accountTypeIcons[account.accountType as keyof typeof accountTypeIcons] || CreditCard;
            const interestRate = parseFloat(account.interestRate);
            const utilization = getCreditUtilization(account.currentBalance, account.creditLimit);
            
            return (
              <div key={account.id} className="px-6 py-4 hover:bg-gray-50 transition-colors" data-testid={`card-account-${account.id}`}>
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className={`w-12 h-12 bg-${getInterestRateColor(interestRate)}-50 rounded-lg flex items-center justify-center`}>
                        <IconComponent className={`h-6 w-6 text-${getInterestRateColor(interestRate)}`} />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-primary" data-testid={`text-account-name-${account.id}`}>
                        {account.accountNickname}
                      </h4>
                      <p className="text-sm text-secondary">
                        {account.institutionName} • {accountTypeLabels[account.accountType as keyof typeof accountTypeLabels]}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-6 lg:gap-8">
                    <div className="text-center sm:text-left">
                      <p className="text-sm font-medium text-secondary">Balance</p>
                      <p className="text-xl font-bold text-primary" data-testid={`text-balance-${account.id}`}>
                        {formatCurrency(account.currentBalance)}
                      </p>
                    </div>
                    
                    <div className="text-center sm:text-left">
                      <p className="text-sm font-medium text-secondary">Interest Rate</p>
                      <div className="flex items-center justify-center sm:justify-start">
                        <Badge 
                          variant="outline" 
                          className={`${getInterestRateBadgeClass(interestRate)} font-medium`}
                          data-testid={`badge-rate-${account.id}`}
                        >
                          {interestRate.toFixed(2)}%
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0 ml-2 text-current hover:text-current"
                            data-testid={`button-edit-rate-${account.id}`}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </Badge>
                      </div>
                    </div>
                    
                    {account.minimumPayment && (
                      <div className="text-center sm:text-left">
                        <p className="text-sm font-medium text-secondary">Min Payment</p>
                        <p className="text-lg font-semibold text-primary" data-testid={`text-minimum-${account.id}`}>
                          {formatCurrency(account.minimumPayment)}
                        </p>
                      </div>
                    )}
                    
                    {account.dueDate && (
                      <div className="text-center sm:text-left">
                        <p className="text-sm font-medium text-secondary">Due Date</p>
                        <div className="flex items-center justify-center sm:justify-start">
                          <span className="text-sm font-medium text-primary mr-2" data-testid={`text-due-date-${account.id}`}>
                            {formatDueDate(account.dueDate)}
                          </span>
                          {isDueSoon(account.dueDate) && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Due Soon
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="p-2 text-secondary hover:text-primary"
                          data-testid={`button-menu-${account.id}`}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => hideAccountMutation.mutate(account.id)}
                          disabled={hideAccountMutation.isPending}
                          data-testid={`button-hide-${account.id}`}
                        >
                          <EyeOff className="h-4 w-4 mr-2" />
                          Hide Account
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                
                {/* Credit Utilization Bar for Credit Cards */}
                {account.accountType === 'credit_card' && utilization !== null && (
                  <div className="mt-4 lg:ml-16">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-secondary">Credit Utilization</span>
                      <span className="font-medium text-secondary" data-testid={`text-utilization-${account.id}`}>
                        {utilization}%
                      </span>
                    </div>
                    <Progress 
                      value={utilization} 
                      className={`h-2 ${utilization > 80 ? 'text-debt-red' : utilization > 30 ? 'text-debt-amber' : 'text-debt-green'}`}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      
      {/* Connection Status */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <CheckCircle className="h-5 w-5 text-debt-green" />
            <div>
              <h4 className="text-sm font-semibold text-primary">All accounts synced</h4>
              <p className="text-xs text-secondary">
                Last updated: {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
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
    </Card>
  );
}
