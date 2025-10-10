import { useState, useRef, useEffect } from 'react';
import { open, save } from '@tauri-apps/plugin-dialog';
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

  // OCR preprocessing best practices defaults
  // Always reset to these defaults (do not persist user changes)
  const getDefaultParams = (): ProcessingParams => {
    return {
      contrast: 1.3,              // Enhance text/background separation
      brightness: 0.0,            // No brightness adjustment by default
      sharpness: 1.2,             // Slight sharpening for text clarity
      useAdaptiveThreshold: true, // Critical for OCR: binarize text
      useClahe: true,             // Adaptive histogram equalization
      gaussianBlur: 0.5,          // Light noise reduction
      bilateralFilter: false,     // Off by default (use Gaussian instead)
      morphology: 'none',         // No morphological operations by default
      language: 'eng'
    };
  };

  // Processing parameters - always use defaults (never remember user choices)
  const [params, setParams] = useState<ProcessingParams>(getDefaultParams());

  // Auto-update processed image when params change (if image is loaded)
  useEffect(() => {
    if (imagePath && !isProcessing) {
      // Debounce the OCR call to avoid too many requests
      const timer = setTimeout(() => {
        performOCROnPath(imagePath);
      }, 500);
      return () => clearTimeout(timer);
    }
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
        setProcessedImageUrl('');

        // Convert file path to URL for preview
        const assetUrl = convertFileSrc(path);
        setImagePreviewUrl(assetUrl);

        // Automatically perform OCR
        await performOCROnPath(path);
      }
    } catch (error) {
      console.error('Error selecting file:', error);
    }
  };

  const takeScreenshot = async () => {
    setIsProcessing(true);
    setProcessingStatus('Taking screenshot...');
    try {
      const result = await invoke<{ path: string; text: string }>('take_screenshot');
      setImagePath(result.path);
      const assetUrl = convertFileSrc(result.path);
      setImagePreviewUrl(assetUrl);
      setOcrText('');
      setProcessedImageUrl('');

      // Automatically perform OCR with current params
      setProcessingStatus('Processing image...');
      await performOCROnPath(result.path);
    } catch (error) {
      console.error('Error taking screenshot:', error);
      alert('Error: ' + error);
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const performOCROnPath = async (path: string) => {
    setIsProcessing(true);
    setProcessingStatus('Loading image...');

    try {
      setProcessingStatus('Preprocessing image...');
      await new Promise(resolve => setTimeout(resolve, 100)); // Allow UI to update

      const result = await invoke<OcrResult>('perform_ocr', {
        imagePath: path,
        params
      });

      setProcessingStatus('Extracting text...');
      setOcrText(result.text);

      // Set processed image for comparison
      const processedUrl = convertFileSrc(result.processedImagePath);
      setProcessedImageUrl(processedUrl);
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

  const performOCR = async () => {
    if (!imagePath) return;
    await performOCROnPath(imagePath);
  };

  const copyToClipboard = async () => {
    if (ocrText && textareaRef.current) {
      try {
        await navigator.clipboard.writeText(ocrText);
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
      const filePath = await save({
        filters: [{
          name: 'Text',
          extensions: ['txt']
        }],
        defaultPath: 'ocr_result.txt'
      });

      if (filePath) {
        await invoke('save_text_to_path', { text: ocrText, filePath });
      }
    } catch (error) {
      console.error('Error saving text:', error);
      alert('Error: ' + error);
    }
  };

  const updateParam = (key: keyof ProcessingParams, value: number | boolean | string) => {
    setParams(prev => ({ ...prev, [key]: value }));
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
        setProcessedImageUrl('');

        // Convert file path to URL for preview
        const assetUrl = convertFileSrc(path);
        setImagePreviewUrl(assetUrl);

        // Automatically perform OCR
        await performOCROnPath(path);
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
        ⌨️ Shortcuts: <kbd>⌘O</kbd> Open | <kbd>⌘⇧S</kbd> Screenshot | <kbd>⌘C</kbd> Copy | <kbd>⌘S</kbd> Save
      </div>

      {isDragging && (
        <div className="drop-overlay">
          <div className="drop-message">
            📁 Drop image here
          </div>
        </div>
      )}

      <div className="toolbar">
        <button onClick={selectImage} className="toolbar-btn">
          <span className="btn-icon">📁</span>
          <span className="btn-text">Select Image</span>
        </button>
        <button onClick={takeScreenshot} className="toolbar-btn">
          <span className="btn-icon">📸</span>
          <span className="btn-text">Screenshot</span>
        </button>
        <div className="toolbar-btn language-btn">
          <span className="btn-icon">🌐</span>
          <select
            className="language-select"
            value={params.language}
            onChange={(e) => updateParam('language', e.target.value)}
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
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="toolbar-btn advanced-btn"
        >
          <span className="btn-icon">⚙️</span>
          <span className="btn-text">{showAdvanced ? 'Hide' : 'Show'} Advanced</span>
        </button>
      </div>

      {showAdvanced && (
        <div className="advanced-controls">
          <h3>Advanced Processing</h3>

          <div className="controls-grid">
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
                  <option value="erode">Erode (Thin)</option>
                  <option value="dilate">Dilate (Thicken)</option>
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
                CLAHE
              </label>
            </div>

            <div className="control-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={params.bilateralFilter}
                  onChange={(e) => updateParam('bilateralFilter', e.target.checked)}
                />
                Bilateral Filter
              </label>
            </div>

            <div className="control-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={params.useAdaptiveThreshold}
                  onChange={(e) => updateParam('useAdaptiveThreshold', e.target.checked)}
                />
                Adaptive Threshold
              </label>
            </div>
          </div>
        </div>
      )}

      {isProcessing && processingStatus && (
        <div className="processing-status">
          {processingStatus}
        </div>
      )}

      {imagePath && (
        <div className="main-content">
          <div className="left-panel">
            <div className="preview-section">
              <h2>Selected Image</h2>

              <div className="images-vertical">
                <div className="image-block">
                  <h3>Original</h3>
                  <div className="image-container">
                    {imagePreviewUrl && (
                      <img src={imagePreviewUrl} alt="Original" className="preview-image" />
                    )}
                  </div>
                </div>

                {processedImageUrl && (
                  <div className="image-block">
                    <h3>Processed</h3>
                    <div className="image-container">
                      <img src={processedImageUrl} alt="Processed" className="preview-image" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="right-panel">
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
                  onChange={(e) => setOcrText(e.target.value)}
                  placeholder="OCR results will appear here..."
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
