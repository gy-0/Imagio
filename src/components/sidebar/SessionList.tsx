import React from 'react';
import type { SessionListItem } from '../../types/session';
import '../Sidebar.css';

interface SessionListProps {
  sessions: SessionListItem[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

export const SessionList: React.FC<SessionListProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
}) => {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  const handleDelete = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (confirm('Delete this session?')) {
      onDeleteSession(sessionId);
    }
  };

  if (sessions.length === 0) {
    return (
      <div className="session-empty">
        No sessions yet.<br />
        Create a new session or import an image.
      </div>
    );
  }

  return (
    <div className="session-list">
      {sessions.map((session) => (
        <div
          key={session.id}
          className={`session-item ${session.id === activeSessionId ? 'active' : ''}`}
          onClick={() => onSelectSession(session.id)}
        >
          <div className="session-item-header">
            <div className="session-item-name" title={session.name}>
              {session.name}
            </div>
            <button
              className="session-item-delete"
              onClick={(e) => handleDelete(e, session.id)}
            >
              Delete
            </button>
          </div>
          <div className="session-item-time">
            {formatTime(session.updatedAt)}
          </div>
          {session.imagePath && (
            <div className="session-item-preview" title={session.imagePath}>
              📷 {session.imagePath.split('/').pop() || session.imagePath}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
