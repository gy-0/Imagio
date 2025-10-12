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

  const displayText = textDisplayMode === 'optimized' ? (optimizedText || '') : value;
  const hasOptimizedText = Boolean(optimizedText?.trim());
  const isShowingOptimizedView = textDisplayMode === 'optimized';

  return (
    <div className="result-card extracted-text-card">
      <div className="result-header">
        <h2 className="panel-title">Extracted Text</h2>
        {(hasOptimizedText || isOptimizing) && (
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
              {isOptimizing ? 'Optimized (Generating...)' : 'Optimized'}
            </button>
          </div>
        )}
      </div>
      <textarea
        ref={textareaRef}
        value={displayText}
        onChange={handleChange}
        placeholder={isOptimizing && isShowingOptimizedView ? "Generating optimized text..." : "OCR results will appear here..."}
        className="text-area-unified text-area-large"
        disabled={isOptimizing && isShowingOptimizedView}
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
