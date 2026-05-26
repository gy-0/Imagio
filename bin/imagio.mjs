#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const packagePath = fileURLToPath(new URL('../package.json', import.meta.url));
const { version } = JSON.parse(readFileSync(packagePath, 'utf8'));
const repo = 'gy-0/Imagio';
const appName = 'Imagio.app';
const assetName = `Imagio-${version}-macos-arm64.zip`;
const assetUrl = `https://github.com/${repo}/releases/download/v${version}/${assetName}`;
const brewPath = '/opt/homebrew/bin/brew';
const installOnly = process.argv.includes('--install-only');

function fail(message) {
  console.error(`Imagio installation failed: ${message}`);
  process.exit(1);
}

function ensureFormula(formula) {
  try {
    execFileSync(brewPath, ['list', '--versions', formula], { stdio: 'ignore' });
  } catch {
    execFileSync(brewPath, ['install', formula], { stdio: 'inherit' });
  }
}

if (process.platform !== 'darwin') {
  fail('the published desktop build currently supports macOS only.');
}

if (process.arch !== 'arm64') {
  fail('the published desktop build currently supports Apple silicon Macs only.');
}

if (!existsSync(brewPath)) {
  fail('Homebrew is required for the OCR runtime. Install Homebrew from https://brew.sh and run this command again.');
}

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'imagio-install-'));
const archivePath = join(temporaryDirectory, assetName);
const extractedPath = join(temporaryDirectory, 'extracted');
const destinationDirectory = join(homedir(), 'Applications');
const destinationPath = join(destinationDirectory, appName);

try {
  console.log('Preparing the Tesseract OCR runtime...');
  ensureFormula('tesseract');
  ensureFormula('tesseract-lang');

  console.log(`Downloading Imagio ${version}...`);
  const response = await fetch(assetUrl, { redirect: 'follow' });
  if (!response.ok || !response.body) {
    fail(`unable to download ${basename(assetUrl)} (HTTP ${response.status}).`);
  }

  await pipeline(response.body, createWriteStream(archivePath));
  mkdirSync(extractedPath, { recursive: true });
  execFileSync('ditto', ['-x', '-k', archivePath, extractedPath], { stdio: 'inherit' });

  const extractedAppPath = join(extractedPath, appName);
  if (!existsSync(extractedAppPath)) {
    fail(`the release archive did not contain ${appName}.`);
  }

  mkdirSync(destinationDirectory, { recursive: true });
  rmSync(destinationPath, { recursive: true, force: true });
  execFileSync('ditto', [extractedAppPath, destinationPath], { stdio: 'inherit' });

  console.log(`Installed Imagio to ${destinationPath}`);
  if (!installOnly) {
    console.log('Opening Imagio...');
    execFileSync('open', [destinationPath], { stdio: 'inherit' });
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
