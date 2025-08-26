import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
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
import { Building2, Edit, Link } from "lucide-react";
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

  const handlePlaidLink = () => {
    toast({
      title: "Coming Soon",
      description: "Plaid integration is not yet implemented. Please add accounts manually for now.",
      variant: "default",
    });
  };

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
        </DialogHeader>
        
        {!showManualForm ? (
          <div className="space-y-4">
            {/* Plaid Link Integration Point */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Building2 className="h-12 w-12 text-secondary mx-auto mb-4" />
              <h4 className="text-lg font-medium text-primary mb-2">Connect Your Bank</h4>
              <p className="text-sm text-secondary mb-4">
                Securely connect your accounts using bank-level encryption
              </p>
              <Button 
                onClick={handlePlaidLink}
                className="w-full bg-primary text-white hover:bg-gray-800"
                data-testid="button-plaid-connect"
              >
                <Link className="h-4 w-4 mr-2" />
                Connect with Plaid
              </Button>
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
