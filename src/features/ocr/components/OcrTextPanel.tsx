import type { ChangeEvent, FC } from 'react';
import { useRef } from 'react';

interface OcrTextPanelProps {
  value: string;
  onChange: (value: string) => void;
  onCopy: () => Promise<void> | void;
  onSave: () => Promise<void> | void;
}

export const OcrTextPanel: FC<OcrTextPanelProps> = ({ value, onChange, onCopy, onSave }) => {
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

  return (
    <div className="result-card extracted-text-card">
      <div className="result-header">
        <h2>Extracted Text</h2>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
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
      </div>
    </div>
  );
};
