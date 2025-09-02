import { useEffect, useState, useCallback } from 'react';

interface MethodConfig {
  token: string;
  onSuccess: (publicToken: string, metadata: any) => void;
  onError?: (error: any) => void;
  onExit?: () => void;
  onEvent?: (event: string, metadata: any) => void;
}

// Declare global Method interface
declare global {
  interface Window {
    Method?: {
      connect: (config: MethodConfig) => {
        open: () => void;
        close: () => void;
      };
    };
  }
}

export function useMethodConnect(config: MethodConfig | null) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [methodConnect, setMethodConnect] = useState<any>(null);

  // Load Method Connect script
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if script is already loaded
    if (window.Method) {
      setReady(true);
      return;
    }

    // Check if script tag already exists
    const existingScript = document.querySelector('script[src*="method.dev"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        setReady(true);
      });
      return;
    }

    // Create and load script
    const script = document.createElement('script');
    script.src = 'https://cdn.method.dev/connect.js';
    script.async = true;
    script.onload = () => {
      if (window.Method) {
        setReady(true);
      } else {
        setError('Method Connect failed to load');
      }
    };
    script.onerror = () => {
      setError('Failed to load Method Connect script');
    };

    document.body.appendChild(script);

    return () => {
      // Cleanup if needed
    };
  }, []);

  // Initialize Method Connect when config is provided
  useEffect(() => {
    if (!ready || !config || !window.Method) return;

    try {
      const connect = window.Method.connect({
        ...config,
        onSuccess: (publicToken: string, metadata: any) => {
          console.log('Method Connect success:', { publicToken, metadata });
          config.onSuccess(publicToken, metadata);
        },
        onError: (error: any) => {
          console.error('Method Connect error:', error);
          config.onError?.(error);
        },
        onExit: () => {
          console.log('Method Connect exited');
          config.onExit?.();
        },
        onEvent: (event: string, metadata: any) => {
          console.log('Method Connect event:', { event, metadata });
          config.onEvent?.(event, metadata);
        },
      });

      setMethodConnect(connect);
    } catch (err) {
      console.error('Error initializing Method Connect:', err);
      setError('Failed to initialize Method Connect');
    }
  }, [ready, config]);

  const open = useCallback(() => {
    if (methodConnect && methodConnect.open) {
      methodConnect.open();
    } else {
      console.warn('Method Connect not ready or not initialized');
    }
  }, [methodConnect]);

  const close = useCallback(() => {
    if (methodConnect && methodConnect.close) {
      methodConnect.close();
    }
  }, [methodConnect]);

  return {
    ready: ready && !!methodConnect,
    error,
    open,
    close,
  };
}