import { QueryClient } from '@tanstack/react-query';
import { ApiError, setUnauthorizedHandler } from './api';
import { endSession } from './queries';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
      // Don't retry client errors (bad input, expired session); retry network/server hiccups twice.
      retry: (failureCount, error) => !(error instanceof ApiError && error.status > 0 && error.status < 500) && failureCount < 2,
    },
  },
});

// If the session cookie expires mid-use, any 401 clears the cache and sends the owner back to sign in.
setUnauthorizedHandler(() => endSession(queryClient));
