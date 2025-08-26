import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard, Percent, Calendar, TrendingUp } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useToast } from "@/hooks/use-toast";

interface DebtSummary {
  totalDebt: number;
  weightedAvgRate: number;
  totalMinimumPayments: number;
  monthlyInterest: number;
  accountCount: number;
}

export default function DebtSummary() {
  const { toast } = useToast();

  const { data: summary, isLoading, error } = useQuery<DebtSummary>({
    queryKey: ["/api/debt-summary"],
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

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-8 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
        <p className="text-red-800">Failed to load debt summary. Please try refreshing the page.</p>
      </div>
    );
  }

  if (!summary || summary.accountCount === 0) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 text-center">
        <CreditCard className="h-12 w-12 text-blue-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-primary mb-2">No debt accounts found</h3>
        <p className="text-secondary">Connect your first account to see your debt overview</p>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (rate: number) => {
    return `${rate.toFixed(1)}%`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary">Total Debt</p>
              <p className="text-3xl font-bold text-primary mt-1" data-testid="text-total-debt">
                {formatCurrency(summary.totalDebt)}
              </p>
            </div>
            <div className="bg-red-50 p-3 rounded-lg">
              <CreditCard className="h-6 w-6 text-debt-red" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white shadow-sm border border-gray-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary">Weighted Avg. Rate</p>
              <p className="text-3xl font-bold text-debt-amber mt-1" data-testid="text-avg-rate">
                {formatPercentage(summary.weightedAvgRate)}
              </p>
            </div>
            <div className="bg-amber-50 p-3 rounded-lg">
              <Percent className="h-6 w-6 text-debt-amber" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white shadow-sm border border-gray-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary">Monthly Minimums</p>
              <p className="text-3xl font-bold text-primary mt-1" data-testid="text-monthly-minimums">
                {formatCurrency(summary.totalMinimumPayments)}
              </p>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white shadow-sm border border-gray-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary">Monthly Interest</p>
              <p className="text-3xl font-bold text-debt-red mt-1" data-testid="text-monthly-interest">
                {formatCurrency(summary.monthlyInterest)}
              </p>
            </div>
            <div className="bg-red-50 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6 text-debt-red" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
