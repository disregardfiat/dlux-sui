export interface PresenceSession {
  id: string;
  dappId: string;
  participants: Participant[];
  createdAt: Date;
  endedAt?: Date;
}

export interface Participant {
  id: string;
  suiAddress: string;
  displayName: string;
  avatar?: string;
  position: Vector3;
  rotation: Quaternion;
  joinedAt: Date;
  lastSeen: Date;
  mediaStreams: MediaStream[];
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface MediaStream {
  id: string;
  type: MediaStreamType;
  quality: MediaQuality;
  enabled: boolean;
}

export type MediaStreamType = 'audio' | 'video' | 'screen' | 'data';

export interface MediaQuality {
  bitrate?: number;
  resolution?: { width: number; height: number };
  framerate?: number;
}

export interface WebRTCMessage {
  type: WebRTCMessageType;
  from: string;
  to?: string;
  sessionId: string;
  payload: any;
}

export type WebRTCMessageType =
  | 'offer'
  | 'answer'
  | 'candidate'
  | 'position-update'
  | 'voice-data'
  | 'custom-event';

export interface SignalingServer {
  id: string;
  url: string;
  iceServers: WebRTCIceServer[];
  protocols: SignalingProtocol[];
}

export type SignalingProtocol = 'webrtc' | 'hocuspocus' | 'socket.io';

export interface WebRTCIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
  credentialType?: 'password' | 'oauth';
}

export interface TURNConfig {
  urls: string[];
  username?: string;
  credential?: string;
  credentialType?: 'password' | 'oauth';
}