import client from '../client';

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface RelayCredentialsResponse {
  iceServers: IceServer[];
}

export interface InitiateCallResponse {
  callId: string;
  status: string;
}

export interface QualityStats {
  avgRttMs?: number;
  avgJitterMs?: number;
  avgPacketLossPct?: number;
  maxFreezeMs?: number;
  iceSelectedCandidateType?: string;
  audioFallbackUsed?: boolean;
}

export const callsApi = {
  initiateCall: (recipientId: string, type: 'video' | 'audio'): Promise<InitiateCallResponse> =>
    client.post('/api/calls/initiate', { recipientId, type }).then(r => r.data),

  getRelayCredentials: (callId: string): Promise<RelayCredentialsResponse> =>
    client.post(`/api/calls/${callId}/relay-credentials`).then(r => r.data),

  uploadQuality: (callId: string, stats: QualityStats): Promise<void> =>
    client.post(`/api/calls/${callId}/quality`, stats).then(r => r.data),
};
