import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { usePlaidLink } from "react-plaid-link";
import { useMethodConnect } from "@/hooks/useMethodConnect";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Building2, Edit, Link, CreditCard } from "lucide-react";
import { insertDebtAccountSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const manualAccountSchema = insertDebtAccountSchema.extend({
  currentBalance: z.string().min(1, "Balance is required"),
  interestRate: z.string().min(1, "Interest rate is required"),
  minimumPayment: z.string().optional(),
  creditLimit: z.string().optional(),
});

type ManualAccountForm = z.infer<typeof manualAccountSchema>;

const accountTypes = [
  { value: "credit_card", label: "Credit Card" },
  { value: "auto_loan", label: "Auto Loan" },
  { value: "student_loan", label: "Student Loan" },
  { value: "mortgage", label: "Mortgage" },
  { value: "personal_loan", label: "Personal Loan" },
  { value: "heloc", label: "HELOC" },
];

export default function AddAccountModal({ isOpen, onClose }: AddAccountModalProps) {
  const [showManualForm, setShowManualForm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ManualAccountForm>({
    resolver: zodResolver(manualAccountSchema),
    defaultValues: {
      institutionName: "",
      accountNickname: "",
      accountType: "credit_card",
      currentBalance: "",
      interestRate: "",
      minimumPayment: "",
      creditLimit: "",
      isManual: true,
    },
  });

  const createAccountMutation = useMutation({
    mutationFn: async (data: ManualAccountForm) => {
      const payload = {
        ...data,
        currentBalance: parseFloat(data.currentBalance).toFixed(2),
        interestRate: parseFloat(data.interestRate).toFixed(2),
        minimumPayment: data.minimumPayment ? parseFloat(data.minimumPayment).toFixed(2) : null,
        creditLimit: data.creditLimit ? parseFloat(data.creditLimit).toFixed(2) : null,
        isManual: true,
      };
      await apiRequest("POST", "/api/debt-accounts", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debt-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/debt-summary"] });
      toast({
        title: "Account added",
        description: "Your debt account has been added successfully.",
      });
      onClose();
      form.reset();
      setShowManualForm(false);
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
        description: "Failed to add account. Please try again.",
        variant: "destructive",
      });
    },
  });

  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [methodToken, setMethodToken] = useState<string | null>(null);
  const [methodEntityId, setMethodEntityId] = useState<string | null>(null);
  const [connectionType, setConnectionType] = useState<'plaid' | 'method' | null>(null);

  // Fetch link token
  const linkTokenMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/plaid/link-token");
      return response.json();
    },
    onSuccess: (data) => {
      setLinkToken(data.link_token);
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
        description: "Failed to initialize bank connection. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Exchange public token
  const exchangeTokenMutation = useMutation({
    mutationFn: async (publicToken: string) => {
      const response = await apiRequest("POST", "/api/plaid/exchange-token", {
        public_token: publicToken,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/debt-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/debt-summary"] });
      toast({
        title: "Accounts connected!",
        description: `Successfully connected to ${data.institution_name}. Your debt accounts are now being synced.`,
      });
      onClose();
      setLinkToken(null);
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
        title: "Connection failed",
        description: "Failed to connect your accounts. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Plaid Link configuration
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (publicToken, metadata) => {
      console.log('Plaid Link success:', { publicToken, metadata });
      exchangeTokenMutation.mutate(publicToken);
    },
    onExit: (err, metadata) => {
      console.log('Plaid Link exit:', { err, metadata });
      setLinkToken(null);
    },
    onEvent: (eventName, metadata) => {
      console.log('Plaid Link event:', { eventName, metadata });
    },
  });

  const handlePlaidLink = () => {
    setConnectionType('plaid');
    if (linkToken && ready) {
      open();
    } else {
      linkTokenMutation.mutate();
    }
  };

  // Method token mutation - first create entity, then get connect token
  const methodTokenMutation = useMutation({
    mutationFn: async () => {
      // First, create or get entity
      const entityResponse = await apiRequest("POST", "/api/method/create-entity");
      const entityData = await entityResponse.json();
      
      // Then get connect token for that entity
      const tokenResponse = await apiRequest("POST", "/api/method/connect-token", {
        entity_id: entityData.entity_id
      });
      const tokenData = await tokenResponse.json();
      return { ...tokenData, entity_id: entityData.entity_id };
    },
    onSuccess: (data) => {
      setMethodToken(data.connect_token || data.token);
      setMethodEntityId(data.entity_id);
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
        description: "Failed to initialize Method connection. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Exchange Method public token
  const exchangeMethodTokenMutation = useMutation({
    mutationFn: async (publicToken: string) => {
      const response = await apiRequest("POST", "/api/method/exchange-token", {
        public_token: publicToken,
        entity_id: methodEntityId,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debt-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/debt-summary"] });
      toast({
        title: "Accounts connected!",
        description: "Successfully connected your liability accounts via Method.",
      });
      onClose();
      setMethodToken(null);
      setMethodEntityId(null);
      setConnectionType(null);
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
        title: "Connection failed",
        description: "Failed to connect your Method accounts. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Method Connect configuration
  const { open: openMethod, ready: methodReady } = useMethodConnect(
    methodToken ? {
      token: methodToken,
      onSuccess: (publicToken, metadata) => {
        console.log('Method Connect success:', { publicToken, metadata });
        exchangeMethodTokenMutation.mutate(publicToken);
      },
      onError: (error) => {
        console.error('Method Connect error:', error);
        toast({
          title: "Connection Error",
          description: "Failed to connect with Method. Please try again.",
          variant: "destructive",
        });
        setMethodToken(null);
        setMethodEntityId(null);
        setConnectionType(null);
      },
      onExit: () => {
        console.log('Method Connect exited');
        setMethodToken(null);
        setMethodEntityId(null);
        setConnectionType(null);
      },
      onEvent: (event, metadata) => {
        console.log('Method Connect event:', { event, metadata });
      },
    } : null
  );

  const handleMethodLink = () => {
    setConnectionType('method');
    if (methodToken && methodReady) {
      openMethod();
    } else {
      methodTokenMutation.mutate();
    }
  };

  // Auto-open Method Connect when token is ready
  useEffect(() => {
    if (methodToken && methodReady && connectionType === 'method') {
      openMethod();
    }
  }, [methodToken, methodReady, openMethod, connectionType]);

  // Auto-open Plaid Link when token is ready
  useEffect(() => {
    if (linkToken && ready && connectionType === 'plaid') {
      open();
    }
  }, [linkToken, ready, open, connectionType]);

  const onSubmit = (data: ManualAccountForm) => {
    createAccountMutation.mutate(data);
  };

  const handleClose = () => {
    onClose();
    setShowManualForm(false);
    form.reset();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" data-testid="modal-add-account">
        <DialogHeader>
          <DialogTitle>Add New Account</DialogTitle>
          <DialogDescription>
            Connect your financial accounts or add them manually to track your debt.
          </DialogDescription>
        </DialogHeader>
        
        {!showManualForm ? (
          <div className="space-y-4">
            {/* Connection Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Plaid Link Integration */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                <Building2 className="h-10 w-10 text-secondary mx-auto mb-3" />
                <h4 className="text-md font-medium text-primary mb-2">Bank Accounts</h4>
                <p className="text-xs text-secondary mb-3">
                  Connect checking & savings accounts
                </p>
                <Button 
                  onClick={handlePlaidLink}
                  disabled={linkTokenMutation.isPending || exchangeTokenMutation.isPending || connectionType === 'method'}
                  className="w-full bg-primary text-white hover:bg-gray-800"
                  size="sm"
                  data-testid="button-plaid-connect"
                >
                  <Link className="h-4 w-4 mr-2" />
                  {linkTokenMutation.isPending && connectionType === 'plaid' ? "Initializing..." : 
                   exchangeTokenMutation.isPending ? "Connecting..." : 
                   "Connect with Plaid"}
                </Button>
              </div>

              {/* Method Link Integration */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                <CreditCard className="h-10 w-10 text-secondary mx-auto mb-3" />
                <h4 className="text-md font-medium text-primary mb-2">Liability Accounts</h4>
                <p className="text-xs text-secondary mb-3">
                  Connect credit cards, loans & mortgages
                </p>
                <Button 
                  onClick={handleMethodLink}
                  disabled={methodTokenMutation.isPending || exchangeMethodTokenMutation.isPending || connectionType === 'plaid'}
                  className="w-full bg-primary text-white hover:bg-gray-800"
                  size="sm"
                  data-testid="button-method-connect"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  {methodTokenMutation.isPending && connectionType === 'method' ? "Initializing..." : 
                   exchangeMethodTokenMutation.isPending ? "Connecting..." : 
                   "Connect with Method"}
                </Button>
              </div>
            </div>
            
            <div className="relative">
              <Separator />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="bg-white px-2 text-sm text-secondary">Or</span>
              </div>
            </div>
            
            <Button 
              variant="outline"
              className="w-full"
              onClick={() => setShowManualForm(true)}
              data-testid="button-manual-entry"
            >
              <Edit className="h-4 w-4 mr-2" />
              Add Account Manually
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="institutionName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Institution Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., Chase Bank" 
                        {...field} 
                        data-testid="input-institution"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="accountNickname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Nickname</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., Chase Freedom Card" 
                        {...field} 
                        data-testid="input-nickname"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="accountType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-account-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {accountTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="currentBalance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Balance</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00" 
                          {...field} 
                          data-testid="input-balance"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="interestRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Interest Rate (%)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00" 
                          {...field} 
                          data-testid="input-rate"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="minimumPayment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Payment (Optional)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00" 
                          {...field} 
                          data-testid="input-minimum"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {form.watch("accountType") === "credit_card" && (
                  <FormField
                    control={form.control}
                    name="creditLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Credit Limit (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00" 
                            {...field} 
                            data-testid="input-limit"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
              
              <div className="flex space-x-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowManualForm(false)}
                  className="flex-1"
                  data-testid="button-back"
                >
                  Back
                </Button>
                <Button 
                  type="submit" 
                  disabled={createAccountMutation.isPending}
                  className="flex-1 bg-primary text-white hover:bg-gray-800"
                  data-testid="button-submit"
                >
                  {createAccountMutation.isPending ? "Adding..." : "Add Account"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
