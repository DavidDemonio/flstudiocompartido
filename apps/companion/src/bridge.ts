import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import { Device, types as MediasoupTypes } from 'mediasoup-client';
import * as wrtc from 'wrtc';
import { AudioInput, SampleFormatFloat32 } from 'naudiodon';
import type { AudioInputOptions } from 'naudiodon';

(globalThis as unknown as { RTCPeerConnection: unknown }).RTCPeerConnection = wrtc.RTCPeerConnection;
(globalThis as unknown as { RTCSessionDescription: unknown }).RTCSessionDescription = wrtc.RTCSessionDescription;
(globalThis as unknown as { RTCIceCandidate: unknown }).RTCIceCandidate = wrtc.RTCIceCandidate;

const { RTCAudioSource } = wrtc.nonstandard;

export interface BridgeConfig {
  signalUrl: string;
  roomId: string;
  deviceId?: number;
  channelCount: number;
  sampleRate: number;
  bufferSize: number;
  hostAPIName?: string;
}

type PendingResolvers = Map<string, (payload: unknown) => void>;

export interface BridgeStats {
  roundTripTimeMs: number | null;
  timestamp: number;
}

export declare interface AsioBridge {
  on(event: 'stats', listener: (stats: BridgeStats) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'connected', listener: () => void): this;
}

export class AsioBridge extends EventEmitter {
  private ws: WebSocket | null = null;

  private device: Device | null = null;

  private sendTransport: MediasoupTypes.Transport | null = null;

  private audioInput: AudioInput | null = null;

  private audioSource: wrtc.nonstandard.RTCAudioSource | null = null;

  private pending: PendingResolvers = new Map();

  private statsInterval: NodeJS.Timeout | null = null;

  private routerCapabilities: MediasoupTypes.RtpCapabilities | null = null;

  private backlog: Map<string, unknown[]> = new Map();

  async start(config: BridgeConfig): Promise<void> {
    this.pending.clear();
    this.backlog.clear();
    try {
      await this.connectSignaling(config);
      await this.setupMediasoup(config);
      await this.startAudio(config);
      this.emit('connected');
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.audioInput?.quit();
    this.audioInput = null;
    this.audioSource = null;
    this.sendTransport?.close();
    this.sendTransport = null;
    this.device?.close();
    this.device = null;
    this.ws?.close();
    this.ws = null;
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
    this.routerCapabilities = null;
    this.pending.clear();
    this.backlog.clear();
  }

  private async connectSignaling(config: BridgeConfig): Promise<void> {
    this.ws = new WebSocket(config.signalUrl);

    this.ws.on('message', (raw) => {
      try {
        const payload = JSON.parse(String(raw));
        const action = payload.action as string;
        const resolver = this.pending.get(action);
        if (resolver) {
          this.pending.delete(action);
          resolver(payload);
        } else {
          const queue = this.backlog.get(action) ?? [];
          queue.push(payload);
          this.backlog.set(action, queue);
        }
      } catch (error) {
        this.emit('error', error as Error);
      }
    });

    this.ws.on('close', () => {
      this.emit('error', new Error('Signaling connection closed'));
    });

    await new Promise<void>((resolve, reject) => {
      this.ws?.once('open', () => resolve());
      this.ws?.once('error', (error) => reject(error));
    });

    const hello = await this.waitFor<'hello'>('hello');
    if (!hello || typeof hello.peerId !== 'string') {
      throw new Error('Invalid hello from SFU');
    }

    this.send({ action: 'joinRoom', roomId: config.roomId });
    const joined = await this.waitFor<{ action: string; routerRtpCapabilities: MediasoupTypes.RtpCapabilities }>(
      'joinedRoom',
    );
    this.routerCapabilities = joined.routerRtpCapabilities;
  }

  private async setupMediasoup(config: BridgeConfig): Promise<void> {
    if (!this.ws) {
      throw new Error('Signaling not connected');
    }

    if (!this.routerCapabilities) {
      throw new Error('Router capabilities missing');
    }

    this.device = new Device({ handlerName: 'Chrome74' });
    await this.device.load({ routerRtpCapabilities: this.routerCapabilities });

    this.send({ action: 'createTransport', roomId: config.roomId });
    const transportCreated = await this.waitFor<{
      action: string;
      transportOptions: MediasoupTypes.TransportOptions;
    }>('transportCreated');

    const transport = this.device.createSendTransport({
      id: transportCreated.transportOptions.id,
      iceCandidates: transportCreated.transportOptions.iceCandidates,
      iceParameters: transportCreated.transportOptions.iceParameters,
      dtlsParameters: transportCreated.transportOptions.dtlsParameters,
    });

    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      this.send({ action: 'connectTransport', transportId: transport.id, dtlsParameters });
      this.waitFor('transportConnected')
        .then(() => callback())
        .catch((error) => errback(error as Error));
    });

    transport.on('produce', ({ kind, rtpParameters }, callback, errback) => {
      this.send({
        action: 'produce',
        transportId: transport.id,
        kind,
        rtpParameters,
        roomId: config.roomId,
      });
      this.waitFor<{ action: string; id: string }>('produced')
        .then((payload) => callback({ id: payload.id }))
        .catch((error) => errback(error as Error));
    });

    this.sendTransport = transport;

    this.statsInterval = setInterval(async () => {
      if (!this.sendTransport) {
        return;
      }
      const stats = await this.sendTransport.getStats();
      let roundTripTimeMs: number | null = null;
      stats.forEach((report) => {
        if (report.type === 'transport' && typeof report.roundTripTime === 'number') {
          roundTripTimeMs = report.roundTripTime * 1000;
        }
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          const rtt = Number(report.currentRoundTripTime ?? report.totalRoundTripTime);
          if (!Number.isNaN(rtt)) {
            roundTripTimeMs = rtt * 1000;
          }
        }
      });
      this.emit('stats', { roundTripTimeMs, timestamp: Date.now() });
    }, 2000);
  }

  private async startAudio(config: BridgeConfig): Promise<void> {
    if (!this.sendTransport) {
      throw new Error('Transport not ready');
    }

    this.audioSource = new RTCAudioSource();
    const track = this.audioSource.createTrack();
    await this.sendTransport.produce({ track });

    const options: AudioInputOptions = {
      channelCount: config.channelCount,
      sampleRate: config.sampleRate,
      framesPerBuffer: config.bufferSize,
      sampleFormat: SampleFormatFloat32,
    } as AudioInputOptions;

    if (typeof config.deviceId === 'number') {
      options.deviceId = config.deviceId;
    }
    if (config.hostAPIName) {
      options.hostAPIName = config.hostAPIName;
    }

    try {
      this.audioInput = new AudioInput(options);
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
    this.audioInput.on('error', (error: Error) => {
      this.emit('error', error);
    });
    this.audioInput.on('data', (buffer: Buffer) => {
      if (!this.audioSource) {
        return;
      }

      const sampleCount = buffer.byteLength / Float32Array.BYTES_PER_ELEMENT;
      if (!Number.isInteger(sampleCount)) {
        this.emit('error', new Error('Received audio buffer with unexpected length'));
        return;
      }

      const samples = new Float32Array(buffer.buffer, buffer.byteOffset, sampleCount);
      this.audioSource.onData({
        samples,
        sampleRate: config.sampleRate,
        bitsPerSample: 32,
        channelCount: config.channelCount,
      });
    });
    this.audioInput.start();
  }

  private send(payload: Record<string, unknown>) {
    if (!this.ws) {
      throw new Error('WebSocket not initialised');
    }
    this.ws.send(JSON.stringify(payload));
  }

  private waitFor<T>(action: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const queue = this.backlog.get(action);
      if (queue && queue.length > 0) {
        const payload = queue.shift();
        if (queue.length === 0) {
          this.backlog.delete(action);
        }
        resolve(payload as T);
        return;
      }

      const timeout = setTimeout(() => {
        this.pending.delete(action);
        reject(new Error(`Timeout waiting for ${action}`));
      }, 5000);

      this.pending.set(action, (payload) => {
        clearTimeout(timeout);
        resolve(payload as T);
      });
    });
  }
}
