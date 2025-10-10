import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

function App() {
  const [imagePath, setImagePath] = useState<string>('');
  const [ocrText, setOcrText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const selectImage = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff']
        }]
      });

      if (selected) {
        setImagePath(selected as string);
        setOcrText('');
      }
    } catch (error) {
      console.error('Error selecting file:', error);
    }
  };

  const performOCR = async () => {
    if (!imagePath) return;

    setIsProcessing(true);
    try {
      const result = await invoke<string>('perform_ocr', { imagePath });
      setOcrText(result);
    } catch (error) {
      console.error('Error performing OCR:', error);
      setOcrText('Error: ' + error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="container">
      <h1>Imagio - OCR Application</h1>
      
      <div className="card">
        <button onClick={selectImage}>
          Select Image
        </button>
        
        {imagePath && (
          <div className="image-preview">
            <p>Selected: {imagePath.split('/').pop()}</p>
            <button onClick={performOCR} disabled={isProcessing}>
              {isProcessing ? 'Processing...' : 'Extract Text'}
            </button>
          </div>
        )}
      </div>

      {ocrText && (
        <div className="result-card">
          <h2>Extracted Text:</h2>
          <textarea
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
