// Mock dialog plugin for browser development
export const open = async (options?: any): Promise<string | null> => {
  console.log('[Mock Dialog] open called with options:', options);

  // Create a file input that triggers browser's native file picker
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = options?.filters?.[0]?.extensions?.map((ext: string) => `.${ext}`).join(',') || 'image/*';
    input.multiple = options?.multiple || false;

    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        const file = files[0];
        const mockPath = `/mock/${file.name}`;
        (window as any).__mockFiles = (window as any).__mockFiles || {};
        (window as any).__mockFiles[mockPath] = file;

        // Also create a data URL for the image preview
        const reader = new FileReader();
        reader.onload = (event) => {
          (window as any).__mockFiles[mockPath].dataUrl = event.target?.result;
          resolve(mockPath);
        };
        reader.readAsDataURL(file);
      } else {
        resolve(null);
      }
    };

    input.oncancel = () => {
      resolve(null);
    };

    // Remove any existing input elements
    const existingInputs = document.querySelectorAll('input[type="file"][data-mock-dialog]');
    existingInputs.forEach(el => el.remove());

    input.setAttribute('data-mock-dialog', 'true');
    input.style.display = 'none';
    document.body.appendChild(input);
    input.click();

    // Clean up after use
    setTimeout(() => {
      if (document.body.contains(input)) {
        document.body.removeChild(input);
      }
    }, 1000);
  });
};

export const save = async (options?: any): Promise<string | null> => {
  console.log('[Mock Dialog] save called with options:', options);

  // Mock save dialog - in browser, we'll use download API
  const defaultName = options?.defaultPath || 'file.txt';

  // Create a mock download
  const link = document.createElement('a');
  link.download = defaultName;
  link.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent('Mock file content');
  link.click();

  return `/mock/${defaultName}`;
};
