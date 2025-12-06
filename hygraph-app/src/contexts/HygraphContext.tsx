'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { init } from '@hygraph/app-sdk';
import type { HygraphContext, SidebarContext } from '@/lib/types';

interface AppProps {
  context?: {
    project?: { id?: string; name?: string };
    environment?: { id?: string; name?: string };
    user?: { id?: string; email?: string };
  };
  token?: string;
  endpoint?: string;
  entry?: {
    id?: string;
    model?: string;
    stage?: string;
  };
  [key: string]: unknown;
}

interface HygraphAppState {
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  context: HygraphContext | SidebarContext | null;
  sdkProps: AppProps | null;
}

interface HygraphAppContextValue extends HygraphAppState {
  refreshProps: () => void;
}

const HygraphAppContext = createContext<HygraphAppContextValue | null>(null);

// Hook to use Hygraph context
export function useHygraph() {
  const ctx = useContext(HygraphAppContext);
  if (!ctx) {
    throw new Error('useHygraph must be used within HygraphProvider');
  }
  return ctx;
}

// Hook specifically for sidebar context (includes entry info)
export function useSidebarContext() {
  const { context, ...rest } = useHygraph();
  return {
    ...rest,
    context: context as SidebarContext | null,
    entry: (context as SidebarContext)?.entry || null,
  };
}

interface HygraphProviderProps {
  children: React.ReactNode;
  elementType: 'page' | 'sidebar';
}

export function HygraphProvider({ children, elementType }: HygraphProviderProps) {
  const [state, setState] = useState<HygraphAppState>({
    isReady: false,
    isLoading: true,
    error: null,
    context: null,
    sdkProps: null,
  });

  const handleProps = useCallback((props: AppProps) => {
    console.log('HygraphProvider received props:', props);
    
    const context: HygraphContext = {
      project: {
        id: props.context?.project?.id || 'unknown',
        name: props.context?.project?.name || 'Project',
      },
      environment: {
        id: props.context?.environment?.id || 'master',
        name: props.context?.environment?.name || 'master',
      },
      user: {
        id: props.context?.user?.id || 'unknown',
        email: props.context?.user?.email || '',
      },
      authToken: props.token || '',
      endpoint: props.endpoint || '',
    };

    // For sidebar, add entry info
    if (elementType === 'sidebar' && props.entry) {
      (context as SidebarContext).entry = {
        id: props.entry.id || '',
        modelApiId: props.entry.model || '',
        stage: props.entry.stage || 'DRAFT',
      };
    }

    setState(prev => ({
      ...prev,
      isReady: true,
      isLoading: false,
      context,
      sdkProps: props,
    }));
  }, [elementType]);

  const refreshProps = useCallback(() => {
    if (state.sdkProps) {
      handleProps(state.sdkProps);
    }
  }, [state.sdkProps, handleProps]);

  useEffect(() => {
    // Check if we're in an iframe (Hygraph context)
    const inIframe = typeof window !== 'undefined' && window.parent !== window;
    
    if (!inIframe) {
      // Development mode - no SDK connection
      setState({
        isReady: true,
        isLoading: false,
        error: null,
        context: {
          project: { id: 'dev', name: 'Development' },
          environment: { id: 'master', name: 'master' },
          user: { id: 'dev', email: 'dev@example.com' },
          authToken: '',
          endpoint: '',
        },
        sdkProps: null,
      });
      return;
    }

    // Initialize SDK
    init({
      debug: true,
      onProps: handleProps,
    })
      .then((result) => {
        console.log('SDK init result in provider:', result);
        if (result.status === 'ok') {
          handleProps(result.props as AppProps);
        }
      })
      .catch((err) => {
        console.error('SDK init error in provider:', err);
        setState({
          isReady: false,
          isLoading: false,
          error: err.message || 'Failed to connect to Hygraph',
          context: null,
          sdkProps: null,
        });
      });
  }, [handleProps]);

  return (
    <HygraphAppContext.Provider value={{ ...state, refreshProps }}>
      {children}
    </HygraphAppContext.Provider>
  );
}
