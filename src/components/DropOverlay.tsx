import type { FC } from 'react';

interface DropOverlayProps {
  isVisible: boolean;
  message?: string;
}

export const DropOverlay: FC<DropOverlayProps> = ({ isVisible, message = '📁 Drop image here' }) => {
  if (!isVisible) {
    return null;
  }

  return (
    <div className="drop-overlay">
      <div className="drop-message">{message}</div>
    </div>
  );
};
