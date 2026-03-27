/**
 * Utility functions for pagination and query management
 * 
 * This module contains functions for handling paginated queries,
 * debouncing, and request signature normalization.
 */

import type { PaginatedQuery } from '../types';

// Module-level refs for tracking state
const pageLoadVersionRef: Record<string, number> = {};
const pageQueryDebounceRef: Record<string, number> = {};
const pageQueryInFlightSignatureRef: Record<string, string> = {};

/**
 * Normalize a query object to a consistent signature string for comparison
 */
export const normalizeQuerySignature = (query: PaginatedQuery): string => {
  const normalizedFilters = Object.entries(query.filters || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => [key, value ?? '']);

  return JSON.stringify({
    page: Number(query.page || 1),
    per_page: Number(query.per_page || 10),
    q: String(query.q || ''),
    sort_by: String(query.sort_by || ''),
    sort_dir: String(query.sort_dir || ''),
    filters: normalizedFilters,
  });
};

/**
 * Begin a page load and return the version number
 */
export const beginPageLoad = (key: string): number => {
  const nextVersion = (pageLoadVersionRef[key] || 0) + 1;
  pageLoadVersionRef[key] = nextVersion;
  return nextVersion;
};

/**
 * Check if the given version is the latest page load
 */
export const isLatestPageLoad = (key: string, version: number): boolean =>
  pageLoadVersionRef[key] === version;

/**
 * Reset page load versions
 */
export const resetPageLoadVersions = () => {
  Object.keys(pageLoadVersionRef).forEach((key) => {
    pageLoadVersionRef[key] = 0;
  });
};

/**
 * Schedule a page query load with debouncing
 */
export const schedulePageQueryLoad = (
  key: string,
  query: PaginatedQuery,
  loader: (nextQuery: PaginatedQuery) => Promise<void>
) => {
  const currentTimer = pageQueryDebounceRef[key];
  if (typeof currentTimer === 'number') {
    window.clearTimeout(currentTimer);
  }

  pageQueryDebounceRef[key] = window.setTimeout(() => {
    delete pageQueryDebounceRef[key];
    void loader(query);
  }, 250);
};

/**
 * Clear all pending debounce timers
 */
export const clearAllDebounceTimers = () => {
  Object.keys(pageQueryDebounceRef).forEach((key) => {
    const timerId = pageQueryDebounceRef[key];
    if (typeof timerId === 'number') {
      window.clearTimeout(timerId);
    }
  });
  Object.keys(pageQueryDebounceRef).forEach((key) => {
    delete pageQueryDebounceRef[key];
  });
};

/**
 * Check if a query with the same signature is currently in flight
 */
export const isQueryInFlight = (key: string, querySignature: string): boolean => {
  return pageQueryInFlightSignatureRef[key] === querySignature;
};

/**
 * Mark a query as in-flight
 */
export const setQueryInFlight = (key: string, querySignature: string) => {
  pageQueryInFlightSignatureRef[key] = querySignature;
};

/**
 * Clear the in-flight status for a key
 */
export const clearQueryInFlight = (key: string, querySignature: string) => {
  if (pageQueryInFlightSignatureRef[key] === querySignature) {
    delete pageQueryInFlightSignatureRef[key];
  }
};

/**
 * Reset all in-flight signatures
 */
export const resetAllInFlight = () => {
  Object.keys(pageQueryInFlightSignatureRef).forEach((key) => {
    delete pageQueryInFlightSignatureRef[key];
  });
};
