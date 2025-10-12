import React, { useState } from 'react';
import { SessionList } from './SessionList';
import { SettingsPanel } from './SettingsPanel';
import type { SessionListItem, AppSettings } from '../../types/session';
import '../Sidebar.css';

interface SidebarProps {
  sessions: SessionListItem[];
  activeSessionId: string | null;
  settings: AppSettings;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onUpdateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

type SidebarTab = 'sessions' | 'settings';

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  activeSessionId,
  settings,
  onSelectSession,
  onDeleteSession,
  onCreateSession,
  onUpdateSetting,
}) => {
  const [activeTab, setActiveTab] = useState<SidebarTab>('sessions');
  const [collapsed, setCollapsed] = useState(settings.sidebarCollapsed);

  const handleToggleCollapse = () => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    onUpdateSetting('sidebarCollapsed', newCollapsed);
  };

  return (
    <>
      <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <h2>Imagio</h2>
          <button className="new-session-btn" onClick={onCreateSession}>
            + New Session
          </button>
        </div>

        <div className="sidebar-tabs">
          <button
            className={`sidebar-tab ${activeTab === 'sessions' ? 'active' : ''}`}
            onClick={() => setActiveTab('sessions')}
          >
            Sessions
          </button>
          <button
            className={`sidebar-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </div>

        <div className="sidebar-content">
          {activeTab === 'sessions' ? (
            <SessionList
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelectSession={onSelectSession}
              onDeleteSession={onDeleteSession}
            />
          ) : (
            <SettingsPanel
              settings={settings}
              onUpdateSetting={onUpdateSetting}
            />
          )}
        </div>
      </div>

      <button 
        className="sidebar-toggle" 
        onClick={handleToggleCollapse}
        title={collapsed ? 'Show sidebar' : 'Hide sidebar'}
      >
        {collapsed ? '→' : '←'}
      </button>
    </>
  );
};
