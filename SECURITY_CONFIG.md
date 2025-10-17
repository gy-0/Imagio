# Imagio Security Configuration

**Last Updated**: 2025-10-17

This document explains the security-related configuration choices in `src-tauri/tauri.conf.json`.

---

## Content Security Policy (CSP)

### Current Setting
```json
"csp": null
```

### Rationale
CSP is **disabled** to support the following use cases:

1. **Remote Image Loading**: The application loads generated images from Black Forest Labs (BFL) API via remote URLs
2. **Flexible LLM Endpoints**: Users can configure arbitrary LLM API endpoints (local or remote)
3. **Dynamic Content**: All network requests are user-initiated and controlled

### Security Considerations
- All HTTP requests go through Tauri's HTTP plugin
- User explicitly configures API endpoints
- No untrusted third-party scripts are loaded

### Recommendation for Production
Consider enabling CSP with an appropriate allowlist:
```json
"csp": "default-src 'self'; img-src 'self' https://api.bfl.ai data: blob:; connect-src 'self' https://api.bfl.ai https://*"
```

---

## Asset Protocol Scope

### Current Setting
```json
"assetProtocol": {
  "enable": true,
  "scope": ["**"]
}
```

### Rationale
Wide scope (`**`) is necessary for:
- Loading processed images from system temp directory (`$TMPDIR/imagio_*`)
- Displaying OCR preview images
- Reading user-selected images from arbitrary locations

### Security Considerations
- Assets are only loaded from paths the app creates or user explicitly selects
- Tauri's asset protocol has built-in protections against path traversal
- User always controls which files are opened

---

## Filesystem Permissions

### Current Settings
```json
"permissions": [
  "fs:default",
  "fs:allow-write-file",
  "fs:write-all"
]
```

### Rationale
Broad filesystem write permissions are required for:

1. **OCR Results Export**: Users can save OCR text to any location they choose
2. **Temp File Creation**: Application writes processed images to system temp directory
3. **Auto-Save Feature**: Generated images can be auto-saved to user-configured directory

### Security Model
- All write locations are either:
  - User-selected via file dialog
  - System temp directory (cleaned up on exit)
  - User-configured auto-save directory
- Application never writes to hardcoded or hidden locations

### Restrictions in Place
- Only Tauri-approved filesystem operations allowed
- No shell command execution with user input
- No arbitrary file deletion (only temp file cleanup)

---

## Network Permissions

### Current Settings
```json
{
  "identifier": "http:default",
  "allow": [
    { "url": "https://**" },
    { "url": "http://**" }
  ]
}
```

### Rationale
Wide network access allows:
- BFL API for image generation (`https://api.bfl.ai`)
- User-configured LLM endpoints (local or remote)
- Dynamic API endpoint configuration

### Security Considerations
- All requests use Tauri's HTTP plugin (not browser fetch)
- API keys stored in local config, never hardcoded
- User explicitly configures and controls endpoints

---

## Clipboard Permissions

### Current Settings
```json
"clipboard-manager:default",
"clipboard-manager:allow-write-image"
```

### Rationale
Clipboard permissions enable:
- Copying OCR text to clipboard
- Copying generated images to clipboard
- Standard copy/paste functionality

### Restrictions
- Only write permissions granted
- No clipboard reading (prevents data leakage)
- Operations are explicit user actions (button clicks)

---

## Summary

The current security configuration prioritizes **flexibility and user control** over strict sandboxing:

- ✅ User controls all file locations
- ✅ User controls all API endpoints
- ✅ No untrusted code execution
- ✅ All operations are explicit user actions
- ⚠️ Wide permissions required for core features

### Threat Model

**Mitigated Risks:**
- Accidental file deletion (temp files only)
- Credential leakage (no clipboard read)
- Code injection (no eval or shell commands)

**Accepted Risks:**
- Application can write to user-selected locations (by design)
- Application can connect to user-configured endpoints (by design)

---

## Recommendations

If deploying to untrusted environments, consider:

1. Enable CSP with strict allowlist
2. Restrict `fs:write-all` to specific directories
3. Implement API endpoint validation
4. Add network request logging
5. Implement file operation audit trail

For the current use case (personal OCR tool with user-controlled configuration), the current security model is appropriate.

---

**Related Files:**
- `src-tauri/tauri.conf.json` - Security configuration
- `src/hooks/useApplicationConfig.ts` - API configuration
- `src-tauri/src/lib.rs` - Filesystem operations

**References:**
- [Tauri Security Documentation](https://tauri.app/v1/guides/security/)
- [Content Security Policy Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
