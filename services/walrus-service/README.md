# Walrus Service

Walrus blob storage service for dApps (HTML/JS/WASM) and media assets.

## Features

- **Blob Storage**: Store and retrieve files using Walrus decentralized storage
- **Metadata Management**: Track file metadata, size, content type, and checksums
- **HTTP API**: RESTful API for upload/download operations
- **Content Serving**: Direct file serving with appropriate headers
- **Storage Analytics**: Basic statistics and usage tracking

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment config
cp env.example .env
# Edit .env with your configuration

# Build the service
npm run build

# Start the service
npm start

# Or run in development mode
npm run dev
```

## API Endpoints

### Blob Operations

- `POST /blobs/upload` - Upload a file (multipart/form-data)
- `GET /blobs/:blobId` - Download a blob
- `GET /blobs/:blobId/info` - Get blob metadata
- `GET /blobs` - List blobs (paginated)
- `DELETE /blobs/:blobId` - Delete blob metadata

### Analytics

- `GET /blobs/stats/summary` - Get storage statistics

### Ad Gateway (Privacy-Preserving)

- `GET /ads/click` - Click-through redirect with ZK proof tracking
- `GET /ads/convert` - Conversion tracking with ZK proof
- `POST /ads/consent` - Explicit opt-in consent cookie

### Premium Content (Seal-Encrypted)

- `POST /premium/content` - Upload and encrypt premium content
- `GET /premium/content/:dappId` - List premium content for a dApp
- `POST /premium/purchase` - Purchase access to premium content
- `GET /premium/access/:contentId` - Access purchased premium content
- `GET /premium/purchases/:user` - Get user's premium content purchases
- `DELETE /premium/content/:contentId` - Delete premium content (owner only)

## Upload Example

```bash
curl -X POST http://localhost:3002/blobs/upload \
  -F "file=@myfile.html" \
  -F "uploader=0x123..."
```

Response:
```json
{
  "blobId": "0xabc123...",
  "size": 1024,
  "contentType": "text/html",
  "uploadedAt": "2024-01-13T..."
}
```

## Download Example

```bash
curl http://localhost:3002/blobs/0xabc123... -o downloaded_file.html
```

## Environment Variables

See `env.example` for all available configuration options.

### Blob persistence across restarts

By default, blob metadata and content are stored **in memory** and are lost when the process restarts (e.g. after `deploy-server.sh`). To persist blobs to disk so dApp assets survive restarts, set:

- **`WALRUS_DATA_DIR`** – directory for blob files (e.g. `/home/ubuntu/dlux-sui/data/walrus` or `./data/walrus`).

Add it to `services/walrus-service/.env`. The service will create `blobs/` inside that directory and store one `.meta.json` and one `.bin` per blob. On startup it loads existing blobs from disk.

## Walrus Integration

This service integrates with the Walrus decentralized storage network:

- **Testnet**: `https://walrus-testnet.mrgnlabs.xyz`
- **Mainnet**: `https://walrus-mainnet.mrgnlabs.xyz` (when available)

## Architecture

- **Client**: Walrus HTTP API wrapper
- **Repository**: Blob metadata storage
- **Routes**: REST API endpoints
- **Storage**: Walrus decentralized network

## Development

```bash
# Run tests
npm test

# Run linter
npm run lint

# Clean build
npm run clean
```

## Premium Content Features

### Seal Integration

This service integrates with Sui's Seal protocol for programmable encryption/decryption of premium content:

- **Encryption**: Content is encrypted server-side using Seal before storage
- **Access Control**: Granular access control with Seal grants
- **Decryption**: Authorized users can decrypt content on-demand
- **Audit Trail**: All access grants and revocations are tracked

### Premium Content Workflow

1. **Upload**: Creator uploads content with price and metadata
2. **Encryption**: Content is encrypted with Seal and stored on Walrus
3. **Purchase**: Users pay in SUI for access grants
4. **Access**: Authorized users can decrypt and view content
5. **Management**: Creators can manage content and view analytics

### Example Usage

```javascript
// Create premium content (from dApp)
const formData = new FormData();
formData.append('file', videoFile);
formData.append('name', 'Premium Video');
formData.append('price', '0.1');
formData.append('owner', userAddress);
formData.append('dappId', dappId);

const response = await fetch('/premium/content', {
  method: 'POST',
  body: formData
});

// Purchase access
const purchase = await fetch('/premium/purchase', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contentId,
    buyer: userAddress,
    paymentTxId
  })
});

// Access content
const content = await fetch(`/premium/access/${contentId}?user=${userAddress}`);
const blob = await content.blob();
```

## File Types Supported

- **dApps**: HTML, JavaScript, WebAssembly (WASM)
- **Media**: Images, videos, audio files
- **Documents**: JSON, text files, configuration files
- **Assets**: Any binary data up to 50MB
- **Premium Content**: Any file type (encrypted with Seal)

## Security Considerations

- File size limits (50MB default)
- Content type validation
- Checksum verification
- Rate limiting (TODO)
- CORS configuration

## Future Enhancements

- Database persistence for metadata
- CDN integration for faster downloads
- Compression support
- Encryption at rest
- Access control and permissions
- Batch upload operations