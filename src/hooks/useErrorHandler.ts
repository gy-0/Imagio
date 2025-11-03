import { useCallback, useState } from 'react';

export interface AppError {
  id: string;
  message: string;
  code?: string;
  timestamp: number;
  context?: Record<string, unknown>;
  recoverable: boolean;
}

/**
 * Custom hook for centralized error handling and recovery
 * Manages error state, logging, and provides recovery mechanisms
 */
export const useErrorHandler = () => {
  const [errors, setErrors] = useState<AppError[]>([]);
  const [lastError, setLastError] = useState<AppError | null>(null);

  /**
   * Report an error with context
   */
  const reportError = useCallback(
    (
      message: string,
      options: {
        code?: string;
        context?: Record<string, unknown>;
        recoverable?: boolean;
        throwError?: boolean;
      } = {}
    ): string => {
      const { code, context, recoverable = false, throwError = false } = options;

      const error: AppError = {
        id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        message,
        code,
        timestamp: Date.now(),
        context,
        recoverable
      };

      setErrors(prev => [...prev, error].slice(-10)); // Keep last 10 errors
      setLastError(error);

      // Log to console for debugging
      const logMessage = `[${error.code || 'ERROR'}] ${message}`;
      const logData = context ? { context } : undefined;

      if (throwError) {
        console.error(logMessage, logData);
      } else {
        console.warn(logMessage, logData);
      }

      return error.id;
    },
    []
  );

  /**
   * Clear all errors
   */
  const clearErrors = useCallback(() => {
    setErrors([]);
    setLastError(null);
  }, []);

  /**
   * Clear a specific error by ID
   */
  const clearError = useCallback((errorId: string) => {
    setErrors(prev => prev.filter(e => e.id !== errorId));
  }, []);

  /**
   * Attempt to recover from an error
   * This is a placeholder for custom recovery logic
   */
  const recoverFromError = useCallback((errorId: string, recoveryAction: () => Promise<void>) => {
    return recoveryAction()
      .then(() => {
        clearError(errorId);
      })
      .catch(recoveryError => {
        reportError(`Recovery failed: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`, {
          code: 'RECOVERY_FAILED',
          context: { originalErrorId: errorId }
        });
      });
  }, [clearError, reportError]);

  return {
    errors,
    lastError,
    reportError,
    clearErrors,
    clearError,
    recoverFromError
  };
};
