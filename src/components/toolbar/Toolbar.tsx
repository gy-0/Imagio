import type { FC } from 'react';

interface ToolbarProps {
  onSelectImage: () => void;
  onTakeScreenshot: () => void;
  language: string;
  onLanguageChange: (language: string) => void;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
}

export const Toolbar: FC<ToolbarProps> = ({
  onSelectImage,
  onTakeScreenshot,
  language,
  onLanguageChange,
  showAdvanced,
  onToggleAdvanced
}) => {
  return (
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
          <option value="chi_sim">简体中文</option>
          <option value="chi_tra">繁體中文</option>
          <option value="jpn">日本語</option>
          <option value="kor">한국어</option>
          <option value="fra">Français</option>
          <option value="deu">Deutsch</option>
          <option value="spa">Español</option>
        </select>
      </div>
      <button onClick={onToggleAdvanced} className="toolbar-btn advanced-btn">
        <span className="btn-icon">⚙️</span>
        <span className="btn-text">{showAdvanced ? 'Hide' : 'Show'} Advanced</span>
      </button>
    </div>
  );
};
