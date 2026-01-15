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

## File Types Supported

- **dApps**: HTML, JavaScript, WebAssembly (WASM)
- **Media**: Images, videos, audio files
- **Documents**: JSON, text files, configuration files
- **Assets**: Any binary data up to 50MB

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