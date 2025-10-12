import type { FC } from 'react';

interface ProcessingStatusProps {
  isProcessing: boolean;
  statusMessage: string;
}

export const ProcessingStatus: FC<ProcessingStatusProps> = ({ isProcessing, statusMessage }) => {
  if (!isProcessing || !statusMessage) {
    return null;
  }

  return <div className="processing-status">{statusMessage}</div>;
};
