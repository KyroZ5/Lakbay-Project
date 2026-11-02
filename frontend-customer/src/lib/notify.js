import { toast } from 'sonner';

const NETWORK_MESSAGE = 'Unable to reach the server. Check your connection and try again.';

/**
 * Convert any thrown value into a message that is safe to show users.
 * - Network failures get a connectivity hint.
 * - 4xx API errors carry user-facing business/validation messages from the backend.
 * - 5xx errors, Firebase SDK errors and programming errors fall back to a generic message
 *   so internal details never reach the UI.
 */
export function getErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback;
  if (err.isNetworkError) return NETWORK_MESSAGE;
  if (typeof err.status === 'number') {
    return err.status >= 500 ? fallback : err.message || fallback;
  }
  if (err.code || err instanceof TypeError || err instanceof ReferenceError) return fallback;
  return err.message || fallback;
}

export const notify = {
  success: (message, options) => toast.success(message, options),
  info: (message, options) => toast.info(message, options),
  warning: (message, options) => toast.warning(message, options),
  /** Show an error toast for a caught error, logging the raw error for debugging. */
  error: (err, fallback, options) => {
    if (err && typeof err !== 'string') console.error(err);
    const message = typeof err === 'string' ? err : getErrorMessage(err, fallback);
    return toast.error(message, options);
  },
  /**
   * Loading → success / error transition for longer operations.
   * Returns the original promise so callers can still await the result or catch the error.
   */
  promise: (promise, { loading, success, error }) => {
    toast.promise(promise, {
      loading,
      success,
      error: (err) => {
        console.error(err);
        return getErrorMessage(err, error);
      },
    });
    return promise;
  },
};
