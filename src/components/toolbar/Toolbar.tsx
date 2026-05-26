import type { FC } from 'react';

interface ToolbarProps {
  onSelectImage: () => void;
  onTakeScreenshot: () => void;
  language: string;
  onLanguageChange: (language: string) => void;
  onOpenSettings: () => void;
  onToggleSidebar: () => void;
}

export const Toolbar: FC<ToolbarProps> = ({
  onSelectImage,
  onTakeScreenshot,
  language,
  onLanguageChange,
  onOpenSettings,
  onToggleSidebar
}) => {
  return (
    <>
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
      <div className="toolbar">
        <button onClick={onSelectImage} className="toolbar-btn">
        <span className="btn-icon">📁</span>
        <span className="btn-text">Select Image</span>
      </button>
      <button onClick={onTakeScreenshot} className="toolbar-btn">
        <span className="btn-icon">📸</span>
        <span className="btn-text">Screenshot</span>
      </button>
      <div className="toolbar-btn language-btn">
        <span className="btn-icon">🌐</span>
        <select
          className="language-select"
          value={language}
          onChange={(event) => onLanguageChange(event.target.value)}
        >
          <option value="eng">English</option>
          <option value="eng_degraded">English (Degraded Images)</option>
          <option value="chi_sim">Simplified Chinese</option>
          <option value="chi_tra">Traditional Chinese</option>
          <option value="jpn">Japanese</option>
          <option value="kor">한국어</option>
          <option value="fra">Français</option>
          <option value="deu">Deutsch</option>
          <option value="spa">Español</option>
        </select>
      </div>
      <button onClick={onOpenSettings} className="toolbar-btn settings-btn">
        <span className="btn-icon">⚙️</span>
        <span className="btn-text">Settings</span>
      </button>
      </div>
    </>
  );
};
