import type { FC } from 'react';
import './EmptyState.css';

interface EmptyStateProps {
  onSelectImage: () => void;
  onTakeScreenshot: () => void;
  language: string;
  onLanguageChange: (language: string) => void;
  onOpenSettings: () => void;
  onToggleSidebar: () => void;
}

export const EmptyState: FC<EmptyStateProps> = ({
  onSelectImage,
  onTakeScreenshot,
  language,
  onLanguageChange,
  onOpenSettings,
  onToggleSidebar
}) => {
  return (
    <div className="empty-state-container">
      <button
        onClick={onToggleSidebar}
        className="hamburger-btn"
        aria-label="Toggle sidebar"
        title="History & Settings"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>
      <div className="empty-state-content">
        <div className="empty-state-icon">
          <div className="icon-wrapper">
            <span className="icon-emoji">🖼️</span>
          </div>
        </div>
        <h2 className="empty-state-title">
          <span className="emoji">🪄</span> Imagio <span className="emoji">✨</span>
        </h2>
        <p className="empty-state-description">
          Select an image or take a screenshot to start your OCR and image generation journey
        </p>
        <div className="empty-state-actions">
          <button
            onClick={onSelectImage}
            className="empty-state-btn primary"
          >
            <span className="btn-icon">📁</span>
            <span className="btn-text">Select Image</span>
          </button>
          <button
            onClick={onTakeScreenshot}
            className="empty-state-btn secondary"
          >
            <span className="btn-icon">📸</span>
            <span className="btn-text">Screenshot</span>
          </button>
          <div className="empty-state-btn language-btn-wrapper">
            <span className="btn-icon">🌐</span>
            <select
              className="language-select"
              value={language}
              onChange={(event) => onLanguageChange(event.target.value)}
            >
              <option value="eng">English</option>
              <option value="chi_sim">简体中文</option>
              <option value="chi_tra">繁體中文</option>
              <option value="jpn">日本語</option>
              <option value="kor">한국어</option>
              <option value="fra">Français</option>
              <option value="deu">Deutsch</option>
              <option value="spa">Español</option>
            </select>
          </div>
          <button
            onClick={onOpenSettings}
            className="empty-state-btn secondary"
          >
            <span className="btn-icon">⚙️</span>
            <span className="btn-text">Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};

