# Slush Extension Setup for E2E Tests

Run these commands to install Slush and run the real-wallet E2E tests.

## Quick start (recommended)

```bash
# 1. Download Slush extension
npm run slush:download

# 2. Create test wallet config (contains 12-word mnemonic for consistent wallet across runs)
cp tests/e2e/env.slush.example tests/e2e/.env.slush

# 3. Get address and fund it on testnet
npm run slush:address
# Copy address, fund at https://faucet.testnet.sui.io

# 4. Run tests (wallet is auto-imported into persistent profile on first run)
npm run test:e2e:slush
```

The tests use a **persistent profile** (`playwright-slush-profile`) with **automated wallet import** from `TEST_SLUSH_MNEMONIC`. The wallet is imported once and persists across runs. If auto-import fails (e.g. Slush UI changed), run `npm run slush:setup` manually once.

## Option A: Install in Chrome, then copy (Linux/macOS)

```bash
# 1. Install Slush in Chrome
#    Open: https://chromewebstore.google.com/detail/slush/opcgpfmipidbgpenhmajoajpbobppdil
#    Click "Add to Chrome"

# 2. Copy extension to tests (Linux)
mkdir -p tests/e2e/slush-extension
cp -r ~/.config/google-chrome/Default/Extensions/opcgpfmipidbgpenhmajoajpbobppdil/*/ tests/e2e/slush-extension/opcgpfmipidbgpenhmajoajpbobppdil/ 2>/dev/null || \
cp -r ~/.config/chromium/Default/Extensions/opcgpfmipidbgpenhmajoajpbobppdil/*/ tests/e2e/slush-extension/opcgpfmipidbgpenhmajoajpbobppdil/ 2>/dev/null

# macOS:
# cp -r ~/Library/Application\ Support/Google/Chrome/Default/Extensions/opcgpfmipidbgpenhmajoajpbobppdil/*/ tests/e2e/slush-extension/opcgpfmipidbgpenhmajoajpbobppdil/

# 3. Run tests
npm run test:e2e:slush
```

## Option B: Set SLUSH_EXTENSION_PATH directly

```bash
# After installing Slush in Chrome, set the path to the version folder, e.g.:
export SLUSH_EXTENSION_PATH="$HOME/.config/google-chrome/Default/Extensions/opcgpfmipidbgpenhmajoajpbobppdil/26.2.2.1_0"
# (Replace 26.2.2.1_0 with the actual version folder name - list with: ls ~/.config/google-chrome/Default/Extensions/opcgpfmipidbgpenhmajoajpbobppdil/)

npm run test:e2e:slush
```

## Option C: Download as ZIP from CRX Viewer

1. Go to https://crxdownload.com/detail/opcgpfmipidbgpenhmajoajpbobppdil
2. Click "Download as" → "Extension ZIP"
3. Unzip into `tests/e2e/slush-extension/opcgpfmipidbgpenhmajoajpbobppdil/`
4. Run: `npm run test:e2e:slush`
