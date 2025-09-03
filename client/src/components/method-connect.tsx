import { useEffect } from 'react';
import { useOpal, OpalEventType } from '@methodfi/opal-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface MethodConnectProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  dataMode: 'live' | 'test';
}

export default function MethodConnect({ isOpen, onClose, onSuccess, dataMode }: MethodConnectProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { open, close, isOpen: isOpalOpen, error } = useOpal({
    env: dataMode === 'live' ? 'production' : 'sandbox',
    onOpen: () => {
      console.log('Method Opal opened');
    },
    onExit: () => {
      console.log('Method Opal exited');
      onClose();
    },
    onEvent: async (event) => {
      console.log('Method Opal event:', event);
      
      switch (event.type) {
        case OpalEventType.SESSION_STARTED:
          // User started the connect session
          break;
          
        case OpalEventType.SESSION_COMPLETED:
          // User successfully connected accounts
          try {
            // Refresh account data
            await queryClient.invalidateQueries({ queryKey: ['/api/debt-accounts'] });
            await queryClient.invalidateQueries({ queryKey: ['/api/debt-summary'] });
            
            toast({
              title: 'Accounts connected!',
              description: 'Your Method accounts have been successfully connected',
            });
            
            onSuccess?.();
            onClose();
          } catch (error) {
            console.error('Error handling Method session completion:', error);
          }
          break;
          
        case OpalEventType.SESSION_ERRORED:
          // Error occurred during session
          toast({
            title: 'Connection error',
            description: 'Failed to connect accounts',
            variant: 'destructive',
          });
          break;
          
        case OpalEventType.SESSION_EXITED:
          // User exited without completing
          break;
      }
    },
  });
  
  useEffect(() => {
    if (isOpen && !isOpalOpen) {
      // Fetch element token and open Method Opal
      fetchTokenAndOpen();
    }
  }, [isOpen]);
  
  const fetchTokenAndOpen = async () => {
    try {
      // Get element token from server
      const response = await apiRequest('POST', '/api/providers/method/element-token');
      const { token } = await response.json();
      
      // Open Opal with the token
      open({ token });
    } catch (error) {
      console.error('Error fetching Method element token:', error);
      toast({
        title: 'Connection failed',
        description: 'Failed to initialize Method connection',
        variant: 'destructive',
      });
      onClose();
    }
  };
  
  // The Opal SDK handles its own UI, so we don't render anything
  return null;
}