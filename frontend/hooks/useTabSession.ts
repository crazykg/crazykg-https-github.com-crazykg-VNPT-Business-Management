/**
 * useTabSession — Legacy hook kept for compatibility.
 *
 * Multi-tab is enabled. This hook no longer claims or evicts sessions.
 */

import { useEffect } from 'react';

interface UseTabSessionOptions {
  isAuthenticated: boolean;
  onEvicted: () => void;
}

export const useTabSession = ({ isAuthenticated, onEvicted }: UseTabSessionOptions): void => {
  useEffect(() => {
    void isAuthenticated;
    void onEvicted;
  }, [isAuthenticated, onEvicted]);
};
