import { useState, useEffect, lazy, Suspense } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePlaidLink } from "react-plaid-link";
import { OpalProvider } from "@methodfi/opal-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Building2, 
  CreditCard, 
  TestTube,
  Link,
  ChevronRight,
  Check,
  AlertCircle,
  Loader2,
  Shield,
  Sparkles
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

// Lazy load Method Connect component
const MethodConnect = lazy(() => import("./method-connect"));

interface ProviderConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Provider {
  source: string;
  available: boolean;
  name: string;
  description: string;
  supportsDemo: boolean;
}

interface DemoInstitution {
  name: string;
  accountTypes: string[];
}

export default function ProviderConnectModal({ isOpen, onClose }: ProviderConnectModalProps) {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [dataMode, setDataMode] = useState<'live' | 'demo'>('demo');
  const [plaidToken, setPlaidToken] = useState<string | null>(null);
  const [showMethodConnect, setShowMethodConnect] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch available providers
  const { data: providersData } = useQuery<{ providers: Provider[] }>({
    queryKey: ['/api/providers'],
    enabled: isOpen,
  });

  // Fetch demo institutions
  const { data: demoInstitutions } = useQuery<{ institutions: string[] }>({
    queryKey: ['/api/providers/demo/institutions'],
    enabled: isOpen && selectedProvider === 'demo',
  });

  // Connect to provider
  const connectMutation = useMutation({
    mutationFn: async ({ source, mode }: { source: string; mode: 'live' | 'demo' }) => {
      const response = await apiRequest("POST", `/api/providers/${source}/connect`, {
        dataMode: mode,
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      if (variables.source === 'plaid' && data.token) {
        setPlaidToken(data.token);
      } else if (variables.source === 'method' && data.requiresElementToken) {
        // Method needs to use the Opal SDK
        setShowMethodConnect(true);
      } else if (data.redirectUrl) {
        // For other redirect-based flows
        window.location.href = data.redirectUrl;
      } else if (variables.source === 'demo') {
        // Demo doesn't need additional steps
        toast({
          title: "Ready to add demo accounts",
          description: "Select institutions to add demo data",
        });
      }
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "Please log in again",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Connection failed",
        description: error.message || "Failed to connect to provider",
        variant: "destructive",
      });
    },
  });

  // Plaid Link configuration
  const { open: openPlaidLink, ready: plaidReady } = usePlaidLink({
    token: plaidToken,
    onSuccess: async (publicToken) => {
      try {
        const response = await apiRequest("POST", "/api/providers/plaid/exchange-token", {
          public_token: publicToken,
        });
        const data = await response.json();
        
        queryClient.invalidateQueries({ queryKey: ["/api/debt-accounts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/debt-summary"] });
        
        toast({
          title: "Accounts connected!",
          description: `Successfully connected ${data.accountsCount} accounts`,
        });
        
        onClose();
      } catch (error) {
        toast({
          title: "Connection failed",
          description: "Failed to complete connection",
          variant: "destructive",
        });
      }
    },
    onExit: () => {
      setPlaidToken(null);
    },
  });

  // Auto-open Plaid Link when token is ready
  useEffect(() => {
    if (plaidToken && plaidReady) {
      openPlaidLink();
    }
  }, [plaidToken, plaidReady, openPlaidLink]);

  // Add demo accounts
  const addDemoMutation = useMutation({
    mutationFn: async (institution: string) => {
      const response = await apiRequest("POST", "/api/providers/demo/add", {
        institution,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debt-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/debt-summary"] });
      toast({
        title: "Demo accounts added",
        description: "Demo data has been added to your account",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add demo accounts",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleProviderSelect = (source: string) => {
    setSelectedProvider(source);
    
    if (source === 'demo') {
      // For demo, we don't need to connect first
      return;
    }
    
    // For real providers, initiate connection
    connectMutation.mutate({ source, mode: dataMode });
  };

  const providers = providersData?.providers || [];

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Connect Your Accounts</DialogTitle>
          <DialogDescription>
            Choose how you'd like to connect your financial accounts
          </DialogDescription>
        </DialogHeader>

        <Tabs value={dataMode} onValueChange={(v) => setDataMode(v as 'live' | 'demo')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="demo" className="flex items-center gap-2">
              <TestTube className="h-4 w-4" />
              Try with Demo Data
            </TabsTrigger>
            <TabsTrigger value="live" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Connect Real Accounts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="demo" className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900">Safe Demo Mode</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Explore the app with realistic demo data. Perfect for trying features before connecting real accounts.
                  </p>
                </div>
              </div>
            </div>

            {selectedProvider !== 'demo' ? (
              <Card 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleProviderSelect('demo')}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <TestTube className="h-5 w-5" />
                      Demo Data
                    </span>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </CardTitle>
                  <CardDescription>
                    Add realistic demo accounts from various institutions
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <div className="space-y-3">
                <h4 className="font-medium">Select Demo Institutions</h4>
                <div className="grid grid-cols-2 gap-3">
                  {demoInstitutions?.institutions.map((institution) => (
                    <Card
                      key={institution}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => addDemoMutation.mutate(institution)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{institution}</p>
                            <p className="text-xs text-gray-500">Click to add</p>
                          </div>
                          {addDemoMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="live" className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-green-900">Secure Connection</h4>
                  <p className="text-sm text-green-700 mt-1">
                    Your credentials are never stored. We use bank-level encryption and trusted partners.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              {providers
                .filter((p) => p.source !== 'demo')
                .map((provider) => (
                  <Card
                    key={provider.source}
                    className={`${
                      !provider.available ? 'opacity-50' : 'cursor-pointer hover:shadow-md'
                    } transition-shadow`}
                    onClick={() => provider.available && handleProviderSelect(provider.source)}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          {provider.source === 'plaid' ? (
                            <Building2 className="h-5 w-5" />
                          ) : (
                            <CreditCard className="h-5 w-5" />
                          )}
                          {provider.name}
                        </span>
                        {provider.available ? (
                          <ChevronRight className="h-5 w-5 text-gray-400" />
                        ) : (
                          <Badge variant="secondary">Coming Soon</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>{provider.description}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
            </div>
          </TabsContent>
        </Tabs>

        {connectMutation.isPending && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
      </DialogContent>
    </Dialog>
    
    {/* Method Connect Modal - wrapped in OpalProvider */}
    {showMethodConnect && (
      <OpalProvider>
        <Suspense fallback={<div />}>
          <MethodConnect
            isOpen={showMethodConnect}
            onClose={() => {
              setShowMethodConnect(false);
              setSelectedProvider(null);
            }}
            onSuccess={() => {
              setShowMethodConnect(false);
              onClose();
            }}
            dataMode={dataMode === 'demo' ? 'test' : dataMode}
          />
        </Suspense>
      </OpalProvider>
    )}
    </>
  );
}