import { useEffect, useState } from 'react';
import type { AppError } from '../hooks/useErrorHandler';

interface ErrorNotificationProps {
  errors: AppError[];
  onErrorDismiss: (errorId: string) => void;
  autoDismissSeconds?: number;
}

/**
 * Component for displaying error notifications
 * Shows recent errors with automatic dismissal option
 */
export const ErrorNotification = ({
  errors,
  onErrorDismiss,
  autoDismissSeconds = 5
}: ErrorNotificationProps) => {
  const [visibleErrors, setVisibleErrors] = useState<AppError[]>([]);

  useEffect(() => {
    setVisibleErrors(errors);

    // Auto-dismiss non-critical errors
    if (errors.length > 0) {
      const timer = setTimeout(() => {
        const lastError = errors[errors.length - 1];
        if (!lastError.recoverable) {
          onErrorDismiss(lastError.id);
        }
      }, autoDismissSeconds * 1000);

      return () => clearTimeout(timer);
    }
  }, [errors, onErrorDismiss, autoDismissSeconds]);

  if (visibleErrors.length === 0) {
    return null;
  }

  return (
    <div className="error-notification-container">
      {visibleErrors.map(error => (
        <div
          key={error.id}
          className={`error-notification ${error.recoverable ? 'recoverable' : 'critical'}`}
          role="alert"
        >
          <div className="error-notification-content">
            <p className="error-message">{error.message}</p>
            {error.code && <p className="error-code">[{error.code}]</p>}
          </div>
          <button
            className="error-notification-dismiss"
            onClick={() => onErrorDismiss(error.id)}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};
