import type { ChangeEvent, FC } from 'react';
import { useRef } from 'react';
import type { TextDisplayMode } from '../types';

interface OcrTextPanelProps {
  value: string;
  onChange: (value: string) => void;
  onCopy: () => Promise<void> | void;
  onSave: () => Promise<void> | void;
  optimizedText?: string;
  isOptimizing?: boolean;
  onOptimize?: () => Promise<void> | void;
  textDisplayMode?: TextDisplayMode;
  onTextDisplayModeChange?: (mode: TextDisplayMode) => void;
}

export const OcrTextPanel: FC<OcrTextPanelProps> = ({ 
  value, 
  onChange, 
  onCopy, 
  onSave, 
  optimizedText, 
  isOptimizing, 
  onOptimize, 
  textDisplayMode = 'original', 
  onTextDisplayModeChange 
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCopy = async () => {
    try {
      await onCopy();
      return;
    } catch (error) {
      console.error('Copy handler rejected', error);
    }

    if (textareaRef.current) {
      textareaRef.current.select();
      document.execCommand('copy');
    }
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  const handleOptimize = async () => {
    if (onOptimize) {
      await onOptimize();
    }
  };

  const handleViewModeChange = (mode: TextDisplayMode) => {
    if (onTextDisplayModeChange) {
      onTextDisplayModeChange(mode);
    }
  };

  const displayText = textDisplayMode === 'optimized' && optimizedText ? optimizedText : value;
  const hasOptimizedText = Boolean(optimizedText?.trim());

  return (
    <div className="result-card extracted-text-card">
      <div className="result-header">
        <h2>Extracted Text</h2>
        {hasOptimizedText && (
          <div className="view-mode-toggle">
            <button
              className={`toggle-btn ${textDisplayMode === 'original' ? 'active' : ''}`}
              onClick={() => handleViewModeChange('original')}
            >
              Original
            </button>
            <button
              className={`toggle-btn ${textDisplayMode === 'optimized' ? 'active' : ''}`}
              onClick={() => handleViewModeChange('optimized')}
            >
              Optimized
            </button>
          </div>
        )}
      </div>
      <textarea
        ref={textareaRef}
        value={displayText}
        onChange={handleChange}
        placeholder="OCR results will appear here..."
        className="extracted-text-area"
      />
      <div className="button-group extracted-actions">
        <button onClick={handleCopy} className="secondary-btn">
          📋 Copy
        </button>
        <button onClick={() => { void onSave(); }} className="secondary-btn">
          💾 Save
        </button>
        {onOptimize && (
          <button 
            onClick={() => { void handleOptimize(); }} 
            className="secondary-btn"
            disabled={isOptimizing || !value.trim()}
          >
            {isOptimizing ? '🔄 Optimizing...' : '✨ Optimize'}
          </button>
        )}
      </div>
    </div>
  );
};
