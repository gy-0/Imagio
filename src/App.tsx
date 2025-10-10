import { useState, useRef, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';

// OCR processing parameters
interface ProcessingParams {
  contrast: number;
  brightness: number;
  sharpness: number;
  useAdaptiveThreshold: boolean;
  useClahe: boolean;
  gaussianBlur: number;
  bilateralFilter: boolean;
  morphology: string;
  language: string;
}

interface OcrResult {
  text: string;
  processedImagePath: string;
}

function App() {
  const [imagePath, setImagePath] = useState<string>('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>('');
  const [processedImageUrl, setProcessedImageUrl] = useState<string>('');
  const [ocrText, setOcrText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showComparison, setShowComparison] = useState<boolean>(false);

  // Load params from localStorage or use defaults
  const getInitialParams = (): ProcessingParams => {
    const saved = localStorage.getItem('imagio_params');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fall through to defaults
      }
    }
    return {
      contrast: 1.0,
      brightness: 0.0,
      sharpness: 1.0,
      useAdaptiveThreshold: false,
      useClahe: false,
      gaussianBlur: 0.0,
      bilateralFilter: false,
      morphology: 'none',
      language: 'eng'
    };
  };

  // Processing parameters
  const [params, setParams] = useState<ProcessingParams>(getInitialParams());

  // Save params to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('imagio_params', JSON.stringify(params));
  }, [params]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + O: Select Image
      if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
        e.preventDefault();
        selectImage();
      }
      // Cmd/Ctrl + Shift + S: Take Screenshot
      else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 's') {
        e.preventDefault();
        takeScreenshot();
      }
      // Cmd/Ctrl + Enter: Perform OCR
      else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && imagePath) {
        e.preventDefault();
        performOCR();
      }
      // Cmd/Ctrl + C: Copy (when OCR text exists)
      else if ((e.metaKey || e.ctrlKey) && e.key === 'c' && ocrText && !window.getSelection()?.toString()) {
        e.preventDefault();
        copyToClipboard();
      }
      // Cmd/Ctrl + S: Save
      else if ((e.metaKey || e.ctrlKey) && e.key === 's' && ocrText) {
        e.preventDefault();
        saveText();
      }
      // Cmd/Ctrl + A: Toggle Advanced
      else if ((e.metaKey || e.ctrlKey) && e.key === 'a' && !ocrText) {
        e.preventDefault();
        setShowAdvanced(!showAdvanced);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [imagePath, ocrText, showAdvanced]);

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
    setProcessingStatus('Loading image...');

    try {
      setProcessingStatus('Preprocessing image...');
      await new Promise(resolve => setTimeout(resolve, 100)); // Allow UI to update

      const result = await invoke<OcrResult>('perform_ocr', {
        imagePath,
        params
      });

      setProcessingStatus('Extracting text...');
      setOcrText(result.text);

      // Set processed image for comparison
      const processedUrl = convertFileSrc(result.processedImagePath);
      setProcessedImageUrl(processedUrl);
      setShowComparison(true);
      setProcessingStatus('Complete!');
    } catch (error) {
      console.error('Error performing OCR:', error);
      setOcrText('Error: ' + error);
      setProcessingStatus('Error occurred');
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setProcessingStatus('');
      }, 500);
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

  // Preset configurations for different scenarios
  const applyPreset = (preset: string) => {
    switch (preset) {
      case 'document':
        setParams({
          ...params,
          contrast: 1.3,
          brightness: 0.1,
          sharpness: 1.2,
          useAdaptiveThreshold: true,
          useClahe: false,
          gaussianBlur: 0.5,
          bilateralFilter: false,
          morphology: 'none',
        });
        break;
      case 'handwriting':
        setParams({
          ...params,
          contrast: 1.5,
          brightness: 0.2,
          sharpness: 1.5,
          useAdaptiveThreshold: true,
          useClahe: true,
          gaussianBlur: 1.0,
          bilateralFilter: false,
          morphology: 'dilate',
        });
        break;
      case 'lowquality':
        setParams({
          ...params,
          contrast: 1.4,
          brightness: 0.15,
          sharpness: 1.8,
          useAdaptiveThreshold: true,
          useClahe: true,
          gaussianBlur: 0.5,
          bilateralFilter: true,
          morphology: 'none',
        });
        break;
      case 'photo':
        setParams({
          ...params,
          contrast: 1.2,
          brightness: 0.0,
          sharpness: 1.3,
          useAdaptiveThreshold: false,
          useClahe: true,
          gaussianBlur: 0.5,
          bilateralFilter: true,
          morphology: 'none',
        });
        break;
      case 'default':
      default:
        setParams({
          ...params,
          contrast: 1.0,
          brightness: 0.0,
          sharpness: 1.0,
          useAdaptiveThreshold: false,
          useClahe: false,
          gaussianBlur: 0.0,
          bilateralFilter: false,
          morphology: 'none',
        });
        break;
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file =>
      file.type.startsWith('image/')
    );

    if (imageFile) {
      try {
        // Get the file path from the dropped file
        const path = (imageFile as any).path || imageFile.name;
        setImagePath(path);
        setOcrText('');

        // Convert file path to URL for preview
        const assetUrl = convertFileSrc(path);
        setImagePreviewUrl(assetUrl);
      } catch (error) {
        console.error('Error handling dropped file:', error);
      }
    }
  };

  return (
    <div
      className="container"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <h1>Imagio - OCR Application</h1>

      <div className="shortcuts-hint">
        ⌨️ Shortcuts: ⌘O Open | ⌘⇧S Screenshot | ⌘↵ Extract | ⌘C Copy | ⌘S Save
      </div>

      {isDragging && (
        <div className="drop-overlay">
          <div className="drop-message">
            📁 Drop image here
          </div>
        </div>
      )}

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
          <div className="preview-header">
            <h2>Selected Image</h2>
            {processedImageUrl && (
              <button
                onClick={() => setShowComparison(!showComparison)}
                className="secondary-btn"
              >
                {showComparison ? '👁️ Hide Comparison' : '👁️ Show Comparison'}
              </button>
            )}
          </div>

          {showComparison && processedImageUrl ? (
            <div className="comparison-container">
              <div className="comparison-side">
                <h3>Original</h3>
                <div className="image-container">
                  {imagePreviewUrl && (
                    <img src={imagePreviewUrl} alt="Original" className="preview-image" />
                  )}
                </div>
              </div>
              <div className="comparison-side">
                <h3>Processed</h3>
                <div className="image-container">
                  <img src={processedImageUrl} alt="Processed" className="preview-image" />
                </div>
              </div>
            </div>
          ) : (
            <div className="image-container">
              {imagePreviewUrl && (
                <img src={imagePreviewUrl} alt="Selected" className="preview-image" />
              )}
            </div>
          )}

          <p className="image-path">{imagePath.split('/').pop()}</p>
        </div>
      )}

      {showAdvanced && (
        <div className="advanced-controls">
          <h3>Advanced Processing</h3>

          <div className="control-group">
            <label>
              Preset:
              <select onChange={(e) => applyPreset(e.target.value)} defaultValue="">
                <option value="">Select a preset...</option>
                <option value="default">Default (No Processing)</option>
                <option value="document">📄 Printed Document</option>
                <option value="handwriting">✍️ Handwriting</option>
                <option value="lowquality">📷 Low Quality / Scanned</option>
                <option value="photo">📸 Photo of Text</option>
              </select>
            </label>
          </div>

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
            <label>
              Gaussian Blur: {params.gaussianBlur.toFixed(1)}
              <input
                type="range"
                min="0"
                max="5.0"
                step="0.5"
                value={params.gaussianBlur}
                onChange={(e) => updateParam('gaussianBlur', parseFloat(e.target.value))}
              />
            </label>
          </div>

          <div className="control-group">
            <label>
              Morphology:
              <select
                value={params.morphology}
                onChange={(e) => updateParam('morphology', e.target.value)}
              >
                <option value="none">None</option>
                <option value="erode">Erode (Thin Text)</option>
                <option value="dilate">Dilate (Thicken Text)</option>
              </select>
            </label>
          </div>

          <div className="control-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={params.useClahe}
                onChange={(e) => updateParam('useClahe', e.target.checked)}
              />
              Use CLAHE (Contrast Enhancement)
            </label>
          </div>

          <div className="control-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={params.bilateralFilter}
                onChange={(e) => updateParam('bilateralFilter', e.target.checked)}
              />
              Bilateral Filter (Noise Reduction)
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
          {isProcessing && processingStatus && (
            <div className="processing-status">
              {processingStatus}
            </div>
          )}
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
