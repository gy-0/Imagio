import { useState, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';

// OCR processing parameters
interface ProcessingParams {
  contrast: number;
  brightness: number;
  sharpness: number;
  useAdaptiveThreshold: boolean;
  language: string;
}

function App() {
  const [imagePath, setImagePath] = useState<string>('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>('');
  const [ocrText, setOcrText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  
  // Processing parameters
  const [params, setParams] = useState<ProcessingParams>({
    contrast: 1.0,
    brightness: 0.0,
    sharpness: 1.0,
    useAdaptiveThreshold: false,
    language: 'eng'
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectImage = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'webp']
        }]
      });

      if (selected) {
        const path = selected as string;
        setImagePath(path);
        setOcrText('');
        
        // Convert file path to URL for preview
        const assetUrl = convertFileSrc(path);
        setImagePreviewUrl(assetUrl);
      }
    } catch (error) {
      console.error('Error selecting file:', error);
    }
  };

  const takeScreenshot = async () => {
    setIsProcessing(true);
    try {
      const result = await invoke<{ path: string; text: string }>('take_screenshot');
      setImagePath(result.path);
      const assetUrl = convertFileSrc(result.path);
      setImagePreviewUrl(assetUrl);
      
      if (result.text) {
        setOcrText(result.text);
      }
    } catch (error) {
      console.error('Error taking screenshot:', error);
      alert('Error: ' + error);
    } finally {
      setIsProcessing(false);
    }
  };

  const performOCR = async () => {
    if (!imagePath) return;

    setIsProcessing(true);
    try {
      const result = await invoke<string>('perform_ocr', { 
        imagePath,
        params
      });
      setOcrText(result);
    } catch (error) {
      console.error('Error performing OCR:', error);
      setOcrText('Error: ' + error);
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = async () => {
    if (ocrText && textareaRef.current) {
      try {
        await navigator.clipboard.writeText(ocrText);
        alert('Text copied to clipboard!');
      } catch (error) {
        console.error('Failed to copy:', error);
        textareaRef.current.select();
        document.execCommand('copy');
      }
    }
  };

  const saveText = async () => {
    if (!ocrText) return;
    
    try {
      await invoke('save_text', { text: ocrText });
    } catch (error) {
      console.error('Error saving text:', error);
      alert('Error: ' + error);
    }
  };

  const updateParam = (key: keyof ProcessingParams, value: number | boolean | string) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="container">
      <h1>Imagio - OCR Application</h1>
      
      <div className="toolbar">
        <button onClick={selectImage} className="primary-btn">
          📁 Select Image
        </button>
        <button onClick={takeScreenshot} className="primary-btn">
          📸 Take Screenshot
        </button>
        <button 
          onClick={() => setShowAdvanced(!showAdvanced)} 
          className="secondary-btn"
        >
          ⚙️ {showAdvanced ? 'Hide' : 'Show'} Advanced
        </button>
      </div>

      {imagePath && (
        <div className="preview-section">
          <h2>Selected Image</h2>
          <div className="image-container">
            {imagePreviewUrl && (
              <img src={imagePreviewUrl} alt="Selected" className="preview-image" />
            )}
          </div>
          <p className="image-path">{imagePath.split('/').pop()}</p>
        </div>
      )}

      {showAdvanced && (
        <div className="advanced-controls">
          <h3>Advanced Processing</h3>
          
          <div className="control-group">
            <label>
              Language:
              <select 
                value={params.language} 
                onChange={(e) => updateParam('language', e.target.value)}
              >
                <option value="eng">English</option>
                <option value="chi_sim">Chinese (Simplified)</option>
                <option value="chi_tra">Chinese (Traditional)</option>
                <option value="jpn">Japanese</option>
                <option value="kor">Korean</option>
                <option value="fra">French</option>
                <option value="deu">German</option>
                <option value="spa">Spanish</option>
              </select>
            </label>
          </div>

          <div className="control-group">
            <label>
              Contrast: {params.contrast.toFixed(1)}
              <input 
                type="range" 
                min="0.5" 
                max="2.0" 
                step="0.1" 
                value={params.contrast}
                onChange={(e) => updateParam('contrast', parseFloat(e.target.value))}
              />
            </label>
          </div>

          <div className="control-group">
            <label>
              Brightness: {params.brightness.toFixed(1)}
              <input 
                type="range" 
                min="-0.5" 
                max="0.5" 
                step="0.1" 
                value={params.brightness}
                onChange={(e) => updateParam('brightness', parseFloat(e.target.value))}
              />
            </label>
          </div>

          <div className="control-group">
            <label>
              Sharpness: {params.sharpness.toFixed(1)}
              <input 
                type="range" 
                min="0.5" 
                max="2.0" 
                step="0.1" 
                value={params.sharpness}
                onChange={(e) => updateParam('sharpness', parseFloat(e.target.value))}
              />
            </label>
          </div>

          <div className="control-group">
            <label className="checkbox-label">
              <input 
                type="checkbox" 
                checked={params.useAdaptiveThreshold}
                onChange={(e) => updateParam('useAdaptiveThreshold', e.target.checked)}
              />
              Use Adaptive Threshold
            </label>
          </div>
        </div>
      )}

      {imagePath && (
        <div className="action-section">
          <button 
            onClick={performOCR} 
            disabled={isProcessing}
            className="primary-btn large"
          >
            {isProcessing ? '⏳ Processing...' : '🔍 Extract Text'}
          </button>
        </div>
      )}

      {ocrText && (
        <div className="result-card">
          <div className="result-header">
            <h2>Extracted Text</h2>
            <div className="button-group">
              <button onClick={copyToClipboard} className="secondary-btn">
                📋 Copy
              </button>
              <button onClick={saveText} className="secondary-btn">
                💾 Save
              </button>
            </div>
          </div>
          <textarea
            ref={textareaRef}
            value={ocrText}
            readOnly
            rows={15}
            placeholder="OCR results will appear here..."
          />
        </div>
      )}
    </div>
  );
}

export default App;
