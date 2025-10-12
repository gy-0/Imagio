// Mock Tauri API for browser development
export const invoke = async (cmd: string, args?: any): Promise<any> => {
  console.log(`[Mock Tauri] invoke: ${cmd}`, args);

  switch (cmd) {
    case 'perform_ocr':
      // Mock OCR result
      return {
        text: '这是模拟的OCR识别结果。在浏览器环境中，真实的OCR功能需要Tauri后端支持。\n\nThis is mock OCR result. Real OCR functionality requires Tauri backend.',
        processedImagePath: '/mock/processed-image.png'
      };

    case 'take_screenshot':
      return {
        path: '/mock/screenshot.png',
        text: '模拟截图OCR结果\n\nMock screenshot OCR result'
      };

    case 'save_text_to_path':
      console.log('Mock: Text saved to', args?.filePath);
      return true;

    default:
      throw new Error(`Unknown command: ${cmd}`);
  }
};

export const convertFileSrc = (path: string): string => {
  // In browser, check if we have a mock file with data URL
  if (path.startsWith('/mock/') && (window as any).__mockFiles?.[path]?.dataUrl) {
    return (window as any).__mockFiles[path].dataUrl;
  }

  // Fallback to mock placeholder
  if (path.startsWith('/mock/')) {
    return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==`; // 1x1 transparent PNG
  }

  return path;
};

export const isTauri = (): boolean => false;
