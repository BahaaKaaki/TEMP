import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api, User, Organization, getAccessToken, clearTokens, ApiRequestError } from '../services/apiClient';

interface AuthState {
  user: User | null;
  organizations: Organization[];
  currentOrganization: Organization | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isBackendAvailable: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; firstName?: string; lastName?: string }) => Promise<void>;
  logout: () => Promise<void>;
  setCurrentOrganization: (org: Organization | null) => void;
  refreshUser: () => Promise<void>;
  checkBackend: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const CURRENT_ORG_KEY = 'sg_current_org_id';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    organizations: [],
    currentOrganization: null,
    isAuthenticated: false,
    isLoading: true,
    isBackendAvailable: false,
  });

  // Check backend availability and load user on mount
  useEffect(() => {
    const init = async () => {
      // First check if backend is available
      const backendAvailable = await api.isBackendAvailable();

      if (!backendAvailable) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          isBackendAvailable: false,
        }));
        return;
      }

      // Backend available - check for existing session
      const token = getAccessToken();
      if (!token) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          isBackendAvailable: true,
        }));
        return;
      }

      // Try to get current user
      try {
        const { user } = await api.auth.getMe();
        const organizations = await api.organizations.list();

        // Restore last selected organization
        const savedOrgId = localStorage.getItem(CURRENT_ORG_KEY);
        const currentOrg = savedOrgId
          ? organizations.find(o => o.id === savedOrgId) || organizations[0] || null
          : organizations[0] || null;

        setState({
          user,
          organizations,
          currentOrganization: currentOrg,
          isAuthenticated: true,
          isLoading: false,
          isBackendAvailable: true,
        });
      } catch (error) {
        // Token invalid or expired
        clearTokens();
        setState(prev => ({
          ...prev,
          isLoading: false,
          isBackendAvailable: true,
        }));
      }
    };

    init();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const { user } = await api.auth.login({ email, password });
      const organizations = await api.organizations.list();
      const currentOrg = organizations[0] || null;

      if (currentOrg) {
        localStorage.setItem(CURRENT_ORG_KEY, currentOrg.id);
      }

      setState({
        user,
        organizations,
        currentOrganization: currentOrg,
        isAuthenticated: true,
        isLoading: false,
        isBackendAvailable: true,
      });
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  const register = useCallback(async (data: { email: string; password: string; firstName?: string; lastName?: string }) => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const { user } = await api.auth.register(data);
      const organizations = await api.organizations.list();
      const currentOrg = organizations[0] || null;

      if (currentOrg) {
        localStorage.setItem(CURRENT_ORG_KEY, currentOrg.id);
      }

      setState({
        user,
        organizations,
        currentOrganization: currentOrg,
        isAuthenticated: true,
        isLoading: false,
        isBackendAvailable: true,
      });
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // Ignore logout errors
    }

    localStorage.removeItem(CURRENT_ORG_KEY);

    setState(prev => ({
      ...prev,
      user: null,
      organizations: [],
      currentOrganization: null,
      isAuthenticated: false,
    }));
  }, []);

  const setCurrentOrganization = useCallback((org: Organization | null) => {
    if (org) {
      localStorage.setItem(CURRENT_ORG_KEY, org.id);
    } else {
      localStorage.removeItem(CURRENT_ORG_KEY);
    }
    setState(prev => ({ ...prev, currentOrganization: org }));
  }, []);

  const refreshUser = useCallback(async () => {
    if (!state.isAuthenticated) return;

    try {
      const { user } = await api.auth.getMe();
      const organizations = await api.organizations.list();

      setState(prev => ({
        ...prev,
        user,
        organizations,
        currentOrganization: prev.currentOrganization
          ? organizations.find(o => o.id === prev.currentOrganization?.id) || organizations[0] || null
          : organizations[0] || null,
      }));
    } catch (error) {
      if (error instanceof ApiRequestError && error.statusCode === 401) {
        logout();
      }
    }
  }, [state.isAuthenticated, logout]);

  const checkBackend = useCallback(async () => {
    const available = await api.isBackendAvailable();
    setState(prev => ({ ...prev, isBackendAvailable: available }));
    return available;
  }, []);

  const value: AuthContextValue = {
    ...state,
    login,
    register,
    logout,
    setCurrentOrganization,
    refreshUser,
    checkBackend,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Helper hook to check if user has specific role
export function useHasRole(requiredRoles: ('owner' | 'admin' | 'editor' | 'viewer')[]): boolean {
  const { currentOrganization } = useAuth();
  if (!currentOrganization) return false;
  return requiredRoles.includes(currentOrganization.role);
}

export default AuthContext;
