import { useState, useRef, useEffect, useMemo } from 'react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { callChatCompletion, LLMError, normalizeBaseUrl } from './utils/llmClient';
import { ImageGenerationClient, ImageGenerationError, downloadImageAsBlob } from './utils/imageGenClient';

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

// LLM Settings
interface LLMSettings {
  apiBaseUrl: string;
  apiKey: string;
  modelName: string;
  temperature: number;
}

interface LocalConfig {
  llm?: Partial<LLMSettings>;
  apiBaseUrl?: string;
  apiKey?: string;
  modelName?: string;
  temperature?: number;
  bflApiKey?: string;
}

// Default LLM configuration (fallback if config.local.json is not available)
const DEFAULT_LLM_SETTINGS: LLMSettings = {
  apiBaseUrl: 'http://127.0.0.1:11434/v1',
  apiKey: '',
  modelName: 'llama3.1:8b',
  temperature: 0.7
};

function App() {
  const [imagePath, setImagePath] = useState<string>('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>('');
  const [processedImageUrl, setProcessedImageUrl] = useState<string>('');
  const [ocrText, setOcrText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // LLM and prompt optimization states
  // Will be overridden by config.local.json if present
  const [llmSettings, setLLMSettings] = useState<LLMSettings>(DEFAULT_LLM_SETTINGS);
  const [imageStyle, setImageStyle] = useState<string>('realistic');
  const [customDescription, setCustomDescription] = useState<string>('');
  const [optimizedPrompt, setOptimizedPrompt] = useState<string>('');
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [llmStatus, setLLMStatus] = useState<string>('');
  const [llmError, setLLMError] = useState<string>('');

  // Image generation states
  const [bflApiKey, setBflApiKey] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const [generationError, setGenerationError] = useState<string>('');

  const isLikelyLocalLLM = useMemo(() => {
    try {
      const normalized = normalizeBaseUrl(llmSettings.apiBaseUrl);
      return /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(normalized);
    } catch {
      return false;
    }
  }, [llmSettings.apiBaseUrl]);

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

  // Load local config overrides (e.g. API key) without committing them to git
  useEffect(() => {
    let isMounted = true;

    const loadLocalConfig = async () => {
      try {
        const response = await fetch('/config.local.json', { cache: 'no-store' });
        if (!response.ok) {
          if (response.status !== 404) {
            console.warn(`Failed to load local config: ${response.statusText}`);
          }
          return;
        }

        const parsed: LocalConfig = await response.json();
        const overrides: Partial<LLMSettings> = {
          ...(parsed.llm ?? {})
        };

        const ensureNumber = (value: unknown): number | undefined => {
          if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
          }
          if (typeof value === 'string' && value.trim() !== '') {
            const numeric = Number(value);
            if (Number.isFinite(numeric)) {
              return numeric;
            }
          }
          return undefined;
        };

        if (parsed.apiBaseUrl) overrides.apiBaseUrl = parsed.apiBaseUrl;
        if (parsed.apiKey) overrides.apiKey = parsed.apiKey;
        if (parsed.modelName) overrides.modelName = parsed.modelName;

        const temp = ensureNumber(parsed.temperature ?? overrides.temperature);
        if (temp !== undefined) overrides.temperature = temp;

        if (!isMounted || Object.keys(overrides).length === 0) {
          return;
        }

        setLLMSettings(prev => ({ ...prev, ...overrides }));

        // Load BFL API Key if present
        if (parsed.bflApiKey) {
          setBflApiKey(parsed.bflApiKey);
        }
      } catch (error) {
        console.error('Error loading local config:', error);
      }
    };

    loadLocalConfig();

    return () => {
      isMounted = false;
    };
  }, []);

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

  const updateLLMSetting = <K extends keyof LLMSettings>(key: K, value: LLMSettings[K]) => {
    setLLMSettings(prev => ({ ...prev, [key]: value }));
  };

  const optimizePrompt = async () => {
    setLLMStatus('');
    setLLMError('');

    if (!ocrText.trim()) {
      setLLMError('请先完成 OCR 并获取文本。');
      return;
    }

    if (!llmSettings.apiBaseUrl.trim()) {
      setLLMError('请配置 API Base URL。');
      return;
    }

    if (!llmSettings.modelName.trim()) {
      setLLMError('请配置模型名称。');
      return;
    }

    if (!isLikelyLocalLLM && !llmSettings.apiKey.trim()) {
      setLLMError('远程 LLM 服务需要提供 API Key。');
      return;
    }

    setLLMStatus('正在向 LLM 发送请求...');
    setLLMError('');
    setIsOptimizing(true);

    try {
      const systemPrompt = `You are a prompt optimization expert for image generation models like FLUX. Your task is to transform input text into optimized prompts suitable for image generation.`;

      const userPrompt = `Please optimize the following text for image generation with FLUX model:

Extracted text: ${ocrText}

Image style: ${imageStyle}

Additional description: ${customDescription || 'None'}

Generate a concise, descriptive prompt that captures the essence and key visual elements. Focus on visual details, composition, lighting, and style.`;

      const result = await callChatCompletion({
        baseUrl: llmSettings.apiBaseUrl,
        apiKey: llmSettings.apiKey || undefined,
        model: llmSettings.modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: llmSettings.temperature
      });

      const optimized = result.content.trim();
      setOptimizedPrompt(optimized);
      setLLMStatus('生成成功');
    } catch (error) {
      console.error('Error optimizing prompt:', error);
      setLLMStatus('');

      if (error instanceof LLMError) {
        setLLMError(error.message);
      } else if (error instanceof Error) {
        setLLMError(`意外错误: ${error.message}`);
      } else {
        setLLMError('发生未知错误，请检查控制台。');
      }
    } finally {
      setIsOptimizing(false);
    }
  };

  const generateImage = async () => {
    setGenerationStatus('');
    setGenerationError('');

    if (!optimizedPrompt.trim()) {
      setGenerationError('请先优化 Prompt。');
      return;
    }

    if (!bflApiKey.trim()) {
      setGenerationError('请配置 BFL API Key（在 config.local.json 中设置 bflApiKey）。');
      return;
    }

    setGenerationStatus('正在生成图像...');
    setGenerationError('');
    setIsGenerating(true);
    setGeneratedImageUrl('');

    try {
      const client = new ImageGenerationClient(bflApiKey);

      setGenerationStatus('正在创建生成请求...');
      const imageUrl = await client.generateImage({
        prompt: optimizedPrompt,
        aspectRatio: aspectRatio || undefined,
      });

      setGenerationStatus('正在下载图像...');
      const blobUrl = await downloadImageAsBlob(imageUrl);

      setGeneratedImageUrl(blobUrl);
      setGenerationStatus('图像生成成功！');
    } catch (error) {
      console.error('Error generating image:', error);
      setGenerationStatus('');

      if (error instanceof ImageGenerationError) {
        setGenerationError(error.message);
      } else if (error instanceof Error) {
        setGenerationError(`意外错误: ${error.message}`);
      } else {
        setGenerationError('发生未知错误，请检查控制台。');
      }
    } finally {
      setIsGenerating(false);
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

          <h3 style={{ marginTop: '1.5rem' }}>LLM Settings</h3>
          <div className="controls-grid">
            <div className="control-group">
              <label>
                API Base URL:
                <input
                  type="text"
                  value={llmSettings.apiBaseUrl}
                  onChange={(e) => updateLLMSetting('apiBaseUrl', e.target.value)}
                  placeholder="http://127.0.0.1:11434/v1"
                />
              </label>
            </div>

            <div className="control-group">
              <label>
                API Key:
                <input
                  type="password"
                  value={llmSettings.apiKey}
                  onChange={(e) => updateLLMSetting('apiKey', e.target.value)}
                  placeholder="Enter your API key"
                />
              </label>
            </div>

            <div className="control-group">
              <label>
                Model Name:
                <input
                  type="text"
                  value={llmSettings.modelName}
                  onChange={(e) => updateLLMSetting('modelName', e.target.value)}
                  placeholder="llama3.1:8b"
                />
              </label>
            </div>

            <div className="control-group">
              <label>
                Temperature: {llmSettings.temperature.toFixed(2)}
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.05"
                  value={llmSettings.temperature}
                  onChange={(e) => updateLLMSetting('temperature', parseFloat(e.target.value))}
                />
              </label>
            </div>
          </div>

          {isLikelyLocalLLM ? (
            <div className="llm-hint">
              检测到本地 LLM（例如 Ollama），API Key 可留空。
            </div>
          ) : (
            <div className="llm-hint warning">
              使用远程 LLM 时请确保 API Key 已填写且安全存储。
            </div>
          )}
        </div>
      )}

      {isProcessing && processingStatus && (
        <div className="processing-status">
          {processingStatus}
        </div>
      )}

      {imagePath && (
        <div className="main-content-three-column">
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

          <div className="middle-panel">
            {ocrText && (
              <>
                <div className="result-card extracted-text-card">
                  <div className="result-header">
                    <h2>Extracted Text</h2>
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={ocrText}
                    onChange={(e) => setOcrText(e.target.value)}
                    placeholder="OCR results will appear here..."
                    className="extracted-text-area"
                  />
                  <div className="button-group extracted-actions">
                    <button onClick={copyToClipboard} className="secondary-btn">
                      📋 Copy
                    </button>
                    <button onClick={saveText} className="secondary-btn">
                      💾 Save
                    </button>
                  </div>
                </div>

                <div className="result-card prompt-settings-card">
                  <div className="result-header">
                    <h2>Prompt Settings</h2>
                  </div>

                  <div className="prompt-control-group">
                    <label>
                      Image Style:
                      <select
                        value={imageStyle}
                        onChange={(e) => setImageStyle(e.target.value)}
                        className="style-select"
                      >
                        <option value="realistic">Realistic</option>
                        <option value="artistic">Artistic</option>
                        <option value="anime">Anime</option>
                        <option value="abstract">Abstract</option>
                        <option value="photographic">Photographic</option>
                        <option value="illustration">Illustration</option>
                        <option value="3d-render">3D Render</option>
                        <option value="watercolor">Watercolor</option>
                        <option value="oil-painting">Oil Painting</option>
                      </select>
                    </label>
                  </div>

                  <div className="prompt-control-group">
                    <label>
                      Additional Description:
                      <textarea
                        value={customDescription}
                        onChange={(e) => setCustomDescription(e.target.value)}
                        placeholder="Add custom description or modifications..."
                        className="custom-description-area"
                        rows={3}
                      />
                    </label>
                  </div>

                  <button
                    onClick={optimizePrompt}
                    className="primary-btn optimize-btn"
                    disabled={isOptimizing || !ocrText.trim()}
                  >
                    {isOptimizing ? '⏳ Optimizing...' : '✨ Optimize Prompt'}
                  </button>

                  {llmStatus && (
                    <div className="llm-status success">
                      {llmStatus}
                    </div>
                  )}

                  {llmError && (
                    <div className="llm-status error">
                      {llmError}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="right-panel">
            {optimizedPrompt && (
              <div className="result-card optimized-prompt-card">
                <div className="result-header">
                  <h2>Optimized Prompt</h2>
                </div>
                <div className="optimized-prompt-container">
                  <div className="optimized-prompt-section">
                    <textarea
                      value={optimizedPrompt}
                      onChange={(e) => setOptimizedPrompt(e.target.value)}
                      placeholder="Optimized prompt will appear here..."
                      className="optimized-prompt-area"
                    />
                    <div className="prompt-actions">
                      <div className="aspect-ratio-selector">
                        <label>
                          Aspect Ratio:
                          <select
                            value={aspectRatio}
                            onChange={(e) => setAspectRatio(e.target.value)}
                            className="aspect-ratio-select"
                          >
                            <option value="21:9">21:9 (Ultrawide)</option>
                            <option value="16:9">16:9 (Widescreen)</option>
                            <option value="4:3">4:3 (Standard)</option>
                            <option value="1:1">1:1 (Square)</option>
                            <option value="3:4">3:4 (Portrait)</option>
                            <option value="9:16">9:16 (Mobile)</option>
                            <option value="9:21">9:21 (Tall)</option>
                          </select>
                        </label>
                      </div>
                      <div className="button-group prompt-buttons">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(optimizedPrompt).catch(error => {
                              console.error('Failed to copy optimized prompt:', error);
                            });
                          }}
                          className="secondary-btn"
                        >
                          📋 Copy
                        </button>
                        <button
                          type="button"
                          onClick={generateImage}
                          className="primary-btn"
                          disabled={isGenerating || !optimizedPrompt.trim()}
                        >
                          {isGenerating ? '⏳ Generating...' : '🎨 Generate Image'}
                        </button>
                      </div>
                    </div>
                    {generationStatus && (
                      <div className="generation-status success">
                        {generationStatus}
                      </div>
                    )}
                    {generationError && (
                      <div className="generation-status error">
                        {generationError}
                      </div>
                    )}
                  </div>
                </div>
                <div className="generated-image-section">
                  <h3>Generated Image</h3>
                  <div className="generated-image-container">
                    {isGenerating ? (
                      <div className="generation-loading">
                        <div className="spinner"></div>
                        <p>{generationStatus}</p>
                      </div>
                    ) : generatedImageUrl ? (
                      <img
                        src={generatedImageUrl}
                        alt="Generated"
                        className="generated-image"
                      />
                    ) : (
                      <div className="empty-state">
                        <p>Generated image will appear here</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
