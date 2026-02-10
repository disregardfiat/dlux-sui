# Presence Service

Real-time presence service with WebRTC, Hocuspocus, TURN/STUN for VR voice, 6DOF tracking, and video streaming.

## Features

- **WebRTC Integration**: Peer-to-peer audio/video communication
- **TURN/STUN Servers**: NAT traversal for WebRTC connections
- **Hocuspocus**: Real-time collaborative editing and state synchronization
- **6DOF Tracking**: Six degrees of freedom position/orientation data
- **Voice Communication**: High-quality audio streaming
- **Video Streaming**: Real-time video with multiple participants
- **Session Management**: Multi-user presence sessions

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

## Architecture

The service consists of several components:

- **Presence Manager**: Handles user sessions and participant management
- **TURN Server**: Provides NAT traversal for WebRTC connections
- **Signaling Server**: Manages WebRTC connection establishment
- **Hocuspocus Server**: Real-time collaborative state management

## API Endpoints

### TURN/STUN Configuration
```http
GET /turn
```
Returns TURN/STUN server configuration for WebRTC.

### WebRTC Signaling
```http
POST /signal
Content-Type: application/json

{
  "type": "offer",
  "from": "participant-id",
  "to": "recipient-id",
  "sessionId": "session-id",
  "payload": { /* SDP or ICE candidate */ }
}
```

## Hocuspocus Integration

Hocuspocus runs on a separate port (default: 3005) and provides:

- **Real-time Collaboration**: Shared document editing
- **Conflict Resolution**: Operational transformation
- **Extensions**: Custom functionality through extensions

## WebRTC Flow

1. **Discovery**: Clients get TURN/STUN config from `/turn`
2. **Signaling**: Participants exchange offers/answers via `/signal`
3. **Connection**: Direct peer-to-peer or relayed through TURN
4. **Media**: Audio/video streams established
5. **Data**: Position/orientation data synchronized

## Session Management

### Creating a Session
```javascript
const session = await presenceManager.createSession(dappId, userId);
```

### Joining a Session
```javascript
const success = await presenceManager.joinSession(sessionId, {
  id: userId,
  suiAddress: address,
  displayName: name,
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  mediaStreams: []
});
```

### Updating Position
```javascript
await presenceManager.updateParticipant(sessionId, userId, {
  position: { x: 1, y: 2, z: 3 },
  rotation: { x: 0, y: 0, z: 0, w: 1 }
});
```

## VR/AR Integration

The service supports:

- **6DOF Tracking**: Position (x,y,z) and rotation (quaternion)
- **Voice Chat**: Spatial audio with positional cues
- **Video Streaming**: Multiple video streams with quality adaptation
- **Data Channels**: Custom data synchronization

## Environment Variables

See `env.example` for all available configuration options.

## Development

```bash
# Run tests
npm test

# Run linter
npm run lint

# Clean build
npm run clean
```

## WebRTC Configuration

### ICE Servers
```javascript
const configuration = {
  iceServers: [
    {
      urls: 'stun:stun.l.google.com:19302'
    },
    {
      urls: 'turn:your-turn-server.com:3478',
      username: 'username',
      credential: 'password'
    }
  ]
};
```

### Media Constraints
```javascript
const constraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    sampleRate: 44100
  },
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 }
  }
};
```

## Security Considerations

- **Authentication**: All endpoints should be protected
- **Rate Limiting**: Prevent signaling spam
- **TURN Credentials**: Temporary, rotating credentials
- **Session Limits**: Maximum participants per session
- **Data Validation**: Validate all signaling messages

## Performance Optimization

- **Connection Pooling**: Reuse WebRTC connections
- **Bandwidth Adaptation**: Adjust quality based on network
- **Spatial Audio**: Optimize for positional audio
- **LOD (Level of Detail)**: Reduce data for distant participants

## Future Enhancements

- **Mesh Networking**: Multiple peer connections
- **SFU Integration**: Selective Forwarding Unit for large sessions
- **Recording**: Session recording and playback
- **Analytics**: Usage and performance metrics
- **Mobile Support**: Optimized for mobile VR/AR
- **WebXR Integration**: Native WebXR device support