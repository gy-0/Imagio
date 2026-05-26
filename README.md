# Imagio - OCR & AI Image Generation Application

A modern desktop OCR (Optical Character Recognition) and AI image generation application built with Tauri, React, and Tesseract. This is a rewrite of the [Tesseract-macOS](https://github.com/scott0123/Tesseract-macOS) app using modern web technologies and Rust, enhanced with AI-powered features.

## ✨ Features

### 🖼️ Multiple Input Methods
- Select images from your filesystem
- Capture screenshots directly (macOS screencapture integration)
- Drag & drop image support

### 🔍 Advanced OCR
- Powered by Tesseract 5.5.1
- Multi-language support (English, Chinese, Japanese, Korean, French, German, Spanish)
- Real-time text extraction with progress indicators
- **Skew correction** using Hough Transform (significantly improves OCR accuracy for scanned documents)

### 🎨 Advanced Image Processing (10+ Algorithms)
- **Skew Correction** - Automatic document rotation correction (0.5° - 15° detection range)
- **Contrast adjustment** (0.5 - 2.0x)
- **Brightness adjustment** (-0.5 - +0.5)
- **Sharpness enhancement** (0.5 - 2.0x, unsharp mask)
- **Adaptive threshold** - Binary conversion for better text recognition
- **CLAHE** - Contrast Limited Adaptive Histogram Equalization
- **Gaussian blur** (0-5.0 sigma) - Noise reduction
- **Bilateral filter** - Edge-preserving noise reduction
- **Morphological operations** - Erosion and dilation for text refinement
- **Preset configurations** for common scenarios:
  - 📄 Printed Document
  - ✍️ Handwriting
  - 📷 Low Quality / Scanned
  - 📸 Photo of Text

### 🤖 AI-Powered Features
- **OCR Text Optimization** - Clean and enhance OCR text using LLM
- **Prompt Optimization** - Transform OCR text into optimized image generation prompts using LLM
- **Image Generation** - Generate images from optimized prompts using FLUX Pro 1.1 Ultra / Gemini API
- Support for multiple aspect ratios (21:9, 16:9, 4:3, 1:1, 3:4, 9:16, 9:21)
- Integration with multiple APIs:
  - Black Forest Labs (FLUX) API
  - Google Gemini API
  - Custom LLM endpoints (OpenAI-compatible)
- Customizable image styles (realistic, artistic, anime, abstract, etc.)

### 📑 Session Management
- **Multi-session support** - Work with multiple images simultaneously
- **Session history** - Quick access to previous OCR sessions
- **Session sorting** - Sort by creation time or last update
- **Session persistence** - All sessions saved automatically with localStorage
- **Quick session switching** - Sidebar with session list

### ⚙️ Automation Features
- **Auto-optimize OCR text** - Automatically clean OCR results
- **Auto-generate prompt** - Automatically create image generation prompts
- **Auto-generate image** - Automatically generate images from prompts
- **Auto-save images** - Automatically save generated images to specified directory

### 📝 Text Management
- Copy extracted text to clipboard
- Save results to text files
- Editable text display with monospace font
- Toggle between original and optimized OCR text

### 🎨 Modern UI/UX
- Clean, responsive three-column layout
- Light/Dark mode support
- Smooth animations and transitions
- Collapsible advanced controls
- Before/after image comparison view
- Processing progress indicator with real-time status
- Comprehensive keyboard shortcuts (⌘O, ⌘⇧S, ⌘↵, etc.)
- Settings persistence (localStorage)

## 📸 Screenshots

*(Coming soon)*

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v20.19+ or v22.12+
- [Rust](https://www.rust-lang.org/tools/install) 1.77.2+
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) 5.5.1+

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/gy-0/Imagio.git
   cd Imagio
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure API keys** (optional, for AI features)
   ```bash
   cp public/config.local.json.example public/config.local.json
   # Edit config.local.json with your API keys
   ```

4. **Run in development mode**
   ```bash
   npm run tauri:dev
   ```

### Project Structure

```
Imagio/
├── src/                        # React frontend source code
│   ├── App.tsx                # Application shell orchestrating feature modules
│   ├── components/            # Reusable UI building blocks (toolbar, status, overlays)
│   ├── features/              # Feature-oriented folders (ocr, promptOptimization, imageGeneration)
│   │   ├── ocr/
│   │   │   ├── components/    # OCR-specific panels and advanced controls
│   │   │   └── useOcrProcessing.ts
│   │   ├── promptOptimization/
│   │   │   ├── components/    # Prompt settings and optimized prompt panels
│   │   │   └── usePromptOptimization.ts
│   │   └── imageGeneration/
│   │       └── useImageGeneration.ts
│   ├── hooks/                 # Cross-cutting hooks (config loading, keyboard shortcuts)
│   ├── utils/                 # API clients for OCR-adjacent services
│   └── main.tsx               # React entry point
├── src-tauri/                 # Tauri/Rust backend
│   ├── src/
│   │   ├── lib.rs             # OCR bindings, image processing, and command handlers
│   │   └── main.rs            # Tauri entry point
│   ├── Cargo.toml             # Rust dependencies
│   └── tauri.conf.json        # Tauri configuration
```

### 🧱 Frontend Architecture

The React layer follows a feature-first structure:

- **Shared UI components** live in `src/components` and stay presentation-only
- **Feature folders** bundle logic, hooks, and screens for OCR, prompt optimization, and image generation
- **Custom hooks** (`src/hooks`) encapsulate cross-cutting concerns such as config loading, keyboard shortcuts, and session management
- `App.tsx` acts as a lightweight coordinator, composing features via the hooks and UI primitives

## 🎯 Usage

### Basic OCR Workflow

1. **Select an Image**
   - Click "📁 Select Image" (⌘O) to choose an image file
   - OR click "📸 Take Screenshot" (⌘⇧S) to capture a screenshot
   - OR drag & drop an image file directly

2. **Adjust Processing** (Optional)
   - Click "⚙️ Settings" to open settings modal
   - Configure LLM settings for prompt optimization
   - OR manually adjust OCR preprocessing parameters:
     - **Enable skew correction** (recommended for scanned documents/photos) - Automatically corrects rotated documents up to 15°
     - Adjust contrast, brightness, sharpness
     - Apply preset configurations for common scenarios:
       - 📄 Printed Document - Optimized for clear printed text
       - ✍️ Handwriting - Enhanced for handwritten text
       - 📷 Low Quality / Scanned - Maximum preprocessing for scans
       - 📸 Photo of Text - Balanced settings for photos
     - Choose recognition language (8 languages supported)

3. **Extract Text**
   - OCR automatically runs when an image is selected
   - View the extracted text in the middle panel
   - Toggle between original and processed image view
   - Edit the text if needed

4. **Export Results**
   - Click "📋 Copy" (⌘C) to copy text to clipboard
   - Click "💾 Save" (⌘S) to save as a text file

### AI Image Generation Workflow

1. **Optimize OCR Text** (Optional)
   - After extracting text, click "✨ Optimize" to clean and enhance OCR text using LLM
   - Toggle between original and optimized text views

2. **Generate Prompt**
   - Configure your desired image style (realistic, artistic, anime, etc.)
   - Add additional description (optional)
   - Click "✨ Generate Prompt" to create an optimized prompt using LLM
   - Review and edit the optimized prompt if needed

3. **Generate Image**
   - Select your desired aspect ratio (21:9, 16:9, 4:3, 1:1, 3:4, 9:16, 9:21)
   - Click "🎨 Generate Image" to create an image using FLUX Pro 1.1 Ultra or Gemini API
   - Wait for the generation to complete (usually 10-30 seconds)
   - View the generated image in the right panel
   - Copy to clipboard, save to file, or copy image URL

### Session Management

- **View Sessions**: Click the sidebar icon to open session history
- **Switch Sessions**: Click any session in the sidebar to restore it
- **Delete Sessions**: Right-click or use delete button to remove sessions
- **Sort Sessions**: Sort by creation time or last update time
- Each session maintains its own OCR results, prompts, and generated images

### Automation Setup

Enable automation features in the sidebar:
- **Auto-optimize OCR**: Automatically clean OCR text after extraction
- **Auto-generate prompt**: Automatically create prompts after OCR
- **Auto-generate image**: Automatically generate images after prompt creation
- **Auto-save images**: Automatically save generated images to a specified directory

**Note:** Image generation requires valid API keys configured in `public/config.local.json`

## ⌨️ Keyboard Shortcuts

- `⌘O` - Open image file
- `⌘⇧S` - Take screenshot
- `⌘↵` - Extract text (when image loaded)
- `⌘C` - Copy text to clipboard (when text available)
- `⌘S` - Save text to file (when text available)
- `⌘A` - Toggle advanced settings (when no text)

## 📦 Supported Image Formats

- PNG
- JPG/JPEG
- GIF
- BMP
- TIFF
- WebP

## 🌍 Supported Languages

- 🇬🇧 English (eng)
- 🇨🇳 Chinese Simplified (chi_sim)
- 🇹🇼 Chinese Traditional (chi_tra)
- 🇯🇵 Japanese (jpn)
- 🇰🇷 Korean (kor)
- 🇫🇷 French (fra)
- 🇩🇪 German (deu)
- 🇪🇸 Spanish (spa)

*Note: Additional language packs can be installed via Tesseract*

## 🏗️ Building

### Development
```bash
npm run tauri:dev
```

### Production Build
```bash
npm run tauri:build
```

The built application will be available in `src-tauri/target/release/bundle/`.

## 🔐 Local API Configuration

Create a `public/config.local.json` file (this path is `.gitignore`d) to store your API credentials without committing them:

```json
{
  "llm": {
    "apiBaseUrl": "https://api.openai.com/v1",
    "apiKey": "sk-your-key",
    "modelName": "gpt-4"
  },
  "bflApiKey": "your-bfl-api-key-here",
  "geminiApiKey": "your-gemini-api-key-here",
  "bltcyApiKey": "your-bltcy-api-key-here",
  "selectedModel": "flux"
}
```

**Configuration Options:**
- `llm.apiBaseUrl`: LLM API endpoint (default: `http://127.0.0.1:11434/v1` for local Ollama)
- `llm.apiKey`: Your LLM API key (optional for local models like Ollama)
- `llm.modelName`: Model name to use (e.g., `llama3.1:8b`, `gpt-4`, `gpt-4o`)
- `bflApiKey`: Your [Black Forest Labs](https://api.bfl.ai/) API key for FLUX image generation
- `geminiApiKey`: Your [Google Gemini](https://aistudio.google.com/app/apikey) API key for Gemini image generation
- `bltcyApiKey`: Your BLTCY API key (alternative image generation service)
- `selectedModel`: Default image generation model (`"flux"`, `"gemini"`, or `"bltcy"`)

The app will merge these values with its defaults at startup. Keep this file local—never add it to git.

**Note:** You can also configure these settings through the Settings modal (⌘,) in the app.

## 📂 Project Structure

```
Imagio/
├── src/                    # React frontend source code
│   ├── App.tsx            # Main application component (session orchestrator)
│   ├── App.css            # Application styles
│   ├── main.tsx           # React entry point
│   ├── components/        # Shared UI components
│   │   ├── Toolbar.tsx
│   │   ├── OverlaySidebar.tsx
│   │   ├── SettingsModal.tsx
│   │   └── ...
│   ├── features/          # Feature modules
│   │   ├── ocr/           # OCR functionality
│   │   ├── promptOptimization/  # Prompt optimization
│   │   └── imageGeneration/     # Image generation
│   ├── hooks/             # Custom React hooks
│   │   ├── useSessionManagement.ts
│   │   ├── useAutomationSettings.ts
│   │   └── ...
│   ├── utils/             # Utility functions
│   │   ├── sessionUtils.ts
│   │   └── ...
│   └── types/             # TypeScript type definitions
│       └── appSession.ts
├── src-tauri/             # Tauri/Rust backend
│   ├── src/
│   │   ├── lib.rs         # OCR bindings, image processing (skew correction, etc.)
│   │   └── main.rs        # Tauri entry point
│   ├── Cargo.toml         # Rust dependencies
│   ├── tauri.conf.json    # Tauri configuration
│   └── icons/             # App icons
├── public/                # Static assets
│   └── config.local.json.example  # API config template
├── index.html             # HTML entry point
├── package.json           # Node.js dependencies
├── vite.config.ts         # Vite configuration
├── README.md              # This file
```

## 🛠️ Technology Stack

### Frontend
- **React 19.2.0** - UI framework
- **TypeScript 5.9.3** - Type-safe JavaScript
- **Vite 7.1.9** - Fast build tool and dev server
- **Pure CSS** - Modern styling with CSS variables and gradients

### Backend
- **Rust 1.77.2+** - Systems programming language
- **Tauri 2.8.5** - Desktop app framework
- **Tesseract 5.5.1** - OCR engine (via `tesseract` crate v0.15)
- **Image Processing Libraries**:
  - `image` v0.25 - Core image manipulation
  - `imageproc` v0.25 - Advanced algorithms (Hough transform, morphological operations, etc.)

### Tauri Plugins
- `@tauri-apps/plugin-dialog` - File picker and dialogs
- `@tauri-apps/plugin-fs` - Filesystem access
- `@tauri-apps/plugin-clipboard-manager` - Clipboard operations
- `@tauri-apps/plugin-http` - HTTP requests for API integration

### API Integrations
- **OpenAI-compatible LLM APIs** - For text optimization and prompt generation
- **Black Forest Labs API** - FLUX Pro 1.1 Ultra image generation
- **Google Gemini API** - Alternative image generation
- **BLTCY API** - Additional image generation service

## 🔄 Development Status

### ✅ Completed Features
- ✅ Core OCR functionality with 8 languages
- ✅ Screenshot capture
- ✅ Image preview with before/after comparison
- ✅ Advanced image preprocessing (10+ algorithms, including skew correction)
- ✅ Preset configurations
- ✅ Text export (copy/save)
- ✅ Drag & drop support
- ✅ Keyboard shortcuts
- ✅ Settings persistence
- ✅ Processing progress indicator
- ✅ Modern responsive UI/UX
- ✅ Multi-session management
- ✅ OCR text optimization
- ✅ AI-powered prompt optimization
- ✅ AI image generation (FLUX, Gemini, BLTCY)
- ✅ Automation features (auto-optimize, auto-generate, auto-save)
- ✅ Session history and persistence

### 🎉 Status: **Production Ready!**

All core features are implemented and functional. The app now matches and exceeds the original Tesseract-macOS feature set, with additional AI-powered capabilities and modern session management.

## 🤝 Acknowledgments

- Original [Tesseract-macOS](https://github.com/scott0123/Tesseract-macOS) project by [Scott Liu](https://github.com/scott0123)
- [Tauri](https://tauri.app/) - For the amazing framework
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) - For the OCR engine
- [React](https://react.dev/) - For the UI framework

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🐛 Known Issues & Limitations

All major issues have been resolved! ✅

Minor considerations:
- Bilateral filter may be slow on very large images (>10MP)
- Temp processed images are cleaned up on app exit
- Skew correction works best for angles between 0.5° - 15°
- Image generation requires stable internet connection

### Performance Tips
- For very large images, consider resizing before OCR processing
- Skew correction adds ~15-30ms processing time but significantly improves OCR accuracy
- Bilateral filter is recommended for photos, but may be slow on large images


## 💡 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Contact

For questions or feedback, please open an issue on GitHub.
