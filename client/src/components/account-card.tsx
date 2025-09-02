import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CreditCard, 
  Car, 
  GraduationCap, 
  Home, 
  DollarSign,
  Building2,
  RefreshCw,
  Calendar,
  TrendingUp,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import type { DebtAccount } from "@shared/schema";

interface AccountCardProps {
  account: DebtAccount & {
    lastSynced?: Date | string | null;
    nextPaymentDue?: string | null;
    lastPaymentDate?: string | null;
  };
  onSync?: (accountId: string) => void;
  isSyncing?: boolean;
}

const accountTypeIcons = {
  credit_card: CreditCard,
  auto_loan: Car,
  student_loan: GraduationCap,
  mortgage: Home,
  personal_loan: DollarSign,
  heloc: Building2,
};

const syncSourceLabels = {
  plaid: "Plaid",
  method: "Method",
  manual: "Manual",
};

const syncSourceColors = {
  plaid: "bg-green-100 text-green-800",
  method: "bg-blue-100 text-blue-800",
  manual: "bg-gray-100 text-gray-800",
};

export default function AccountCard({ account, onSync, isSyncing }: AccountCardProps) {
  const Icon = accountTypeIcons[account.accountType as keyof typeof accountTypeIcons] || DollarSign;
  const balance = parseFloat(account.currentBalance || "0");
  const creditLimit = account.creditLimit ? parseFloat(account.creditLimit) : null;
  const interestRate = parseFloat(account.interestRate || "0");
  const minimumPayment = account.minimumPayment ? parseFloat(account.minimumPayment) : null;
  
  // Calculate utilization for credit cards
  const utilization = creditLimit ? (balance / creditLimit) * 100 : null;
  
  // Determine sync source
  const syncSource = account.syncSource || (account.isManual ? "manual" : "plaid");
  const syncLabel = syncSourceLabels[syncSource as keyof typeof syncSourceLabels] || "Unknown";
  const syncColorClass = syncSourceColors[syncSource as keyof typeof syncSourceColors] || "bg-gray-100 text-gray-800";
  
  // Format dates
  const lastSyncedDate = account.lastSynced ? 
    (typeof account.lastSynced === 'string' ? new Date(account.lastSynced) : account.lastSynced) : null;
  const formattedLastSync = lastSyncedDate ? format(lastSyncedDate, "MMM d, h:mm a") : "Never";
  
  return (
    <Card className="relative overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Icon className="h-5 w-5 text-gray-700" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">
                {account.accountNickname || account.institutionName}
              </CardTitle>
              <p className="text-sm text-gray-500">{account.institutionName}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant="secondary" className={syncColorClass}>
              {syncLabel}
            </Badge>
            {!account.isManual && onSync && (
              <button
                onClick={() => onSync(account.id)}
                disabled={isSyncing}
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                title={`Last synced: ${formattedLastSync}`}
              >
                <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : formattedLastSync}
              </button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Balance Section */}
        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-gray-500">Current Balance</span>
            <span className="text-2xl font-bold">${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          
          {/* Credit Utilization for Credit Cards */}
          {account.accountType === 'credit_card' && creditLimit && (
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Credit Utilization</span>
                <span className={utilization! > 70 ? "text-red-600 font-medium" : "text-gray-700"}>
                  {utilization!.toFixed(0)}%
                </span>
              </div>
              <Progress value={utilization!} className="h-2" />
              <div className="flex justify-between text-xs text-gray-500">
                <span>${balance.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                <span>${creditLimit.toLocaleString('en-US', { maximumFractionDigits: 0 })} limit</span>
              </div>
            </div>
          )}
        </div>
        
        {/* Payment Information */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Interest Rate</p>
            <p className="font-medium flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {interestRate.toFixed(2)}%
            </p>
          </div>
          {minimumPayment && (
            <div>
              <p className="text-gray-500">Min. Payment</p>
              <p className="font-medium">${minimumPayment.toFixed(2)}</p>
            </div>
          )}
        </div>
        
        {/* Method-specific payment dates */}
        {syncSource === 'method' && (
          <div className="border-t pt-3 space-y-2">
            {account.nextPaymentDue && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Next Payment Due
                </span>
                <span className="font-medium">
                  {format(new Date(account.nextPaymentDue), "MMM d, yyyy")}
                </span>
              </div>
            )}
            {account.lastPaymentDate && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Last Payment
                </span>
                <span className="text-gray-700">
                  {format(new Date(account.lastPaymentDate), "MMM d, yyyy")}
                </span>
              </div>
            )}
          </div>
        )}
        
        {/* Manual account indicator */}
        {account.isManual && (
          <div className="border-t pt-3">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <AlertCircle className="h-3 w-3" />
              <span>Manually entered account - update regularly for accuracy</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}