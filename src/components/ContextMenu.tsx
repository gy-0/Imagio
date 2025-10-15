import type { FC, MouseEvent } from 'react';
import { useEffect, useRef } from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onDelete: () => void;
}

export const ContextMenu: FC<ContextMenuProps> = ({ x, y, onClose, onDelete }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | Event) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        event.preventDefault();
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    // Use capture phase to ensure we catch events before they bubble up
    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('keydown', handleEscape, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscape, true);
    };
  }, [onClose]);

  const handleDelete = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    console.log('Delete button clicked in ContextMenu'); // Debug log
    onDelete();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ top: y, left: x }}
    >
      <button
        type="button"
        className="context-menu-item delete"
        onClick={handleDelete}
      >
        🗑️ Delete
      </button>
    </div>
  );
};
