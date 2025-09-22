import { createServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import dotenv from 'dotenv';
import {
  createWorker,
  type Router,
  type WebRtcTransport,
  type RtpCapabilities,
  type Producer,
  type Consumer,
  type Worker,
} from 'mediasoup';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const SIGNAL_PORT = Number(process.env.SFU_SIGNAL_PORT ?? 4443);
const LISTEN_IP = process.env.SFU_LISTEN_IP ?? '0.0.0.0';
const ANNOUNCED_IP = process.env.SFU_ANNOUNCED_IP ?? '127.0.0.1';

type Peer = {
  id: string;
  transports: Map<string, WebRtcTransport>;
  producers: Map<string, Producer>;
  consumers: Map<string, Consumer>;
  socket: WebSocket;
};

type Room = {
  id: string;
  router: Router;
  peers: Map<string, Peer>;
};

const rooms = new Map<string, Room>();
let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker({
      rtcMinPort: 40000,
      rtcMaxPort: 49999,
    });
    workerPromise.then((worker) => {
      worker.on('died', () => {
        console.error('Mediasoup worker died, exiting...');
        process.exit(1);
      });
    });
  }
  return workerPromise;
}

async function getOrCreateRoom(roomId: string): Promise<Room> {
  const existing = rooms.get(roomId);
  if (existing) {
    return existing;
  }

  const worker = await getWorker();

  const router = await worker.createRouter({
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 1000,
        },
      },
    ],
  });

  const room: Room = { id: roomId, router, peers: new Map() };
  rooms.set(roomId, room);
  router.observer.on('close', () => rooms.delete(roomId));
  return room;
}

function createPeer(socket: WebSocket): Peer {
  return {
    id: uuidv4(),
    transports: new Map(),
    producers: new Map(),
    consumers: new Map(),
    socket,
  };
}

type Message = {
  action: string;
  [key: string]: unknown;
};

function send(ws: WebSocket, payload: unknown) {
  ws.send(JSON.stringify(payload));
}

async function handleMessage(ws: WebSocket, peer: Peer, message: Message) {
  switch (message.action) {
    case 'joinRoom': {
      const roomId = String(message.roomId ?? 'default');
      const room = await getOrCreateRoom(roomId);
      room.peers.set(peer.id, peer);
      send(ws, { action: 'joinedRoom', peerId: peer.id, routerRtpCapabilities: room.router.rtpCapabilities });
      break;
    }
    case 'createTransport': {
      const roomId = String(message.roomId ?? 'default');
      const room = await getOrCreateRoom(roomId);
      const transport = await room.router.createWebRtcTransport({
        listenIps: [{ ip: LISTEN_IP, announcedIp: ANNOUNCED_IP }],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
      });
      peer.transports.set(transport.id, transport);
      send(ws, {
        action: 'transportCreated',
        transportOptions: {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        },
      });
      break;
    }
    case 'connectTransport': {
      const transportId = String(message.transportId);
      const dtlsParameters = message.dtlsParameters as Record<string, unknown>;
      const transport = peer.transports.get(transportId);
      if (!transport) {
        send(ws, { action: 'error', error: 'transport-not-found' });
        break;
      }
      await transport.connect({ dtlsParameters });
      send(ws, { action: 'transportConnected', transportId });
      break;
    }
    case 'produce': {
      const transportId = String(message.transportId);
      const kind = String(message.kind);
      const rtpParameters = message.rtpParameters as Record<string, unknown>;
      const roomId = String(message.roomId ?? 'default');
      const room = await getOrCreateRoom(roomId);
      const transport = peer.transports.get(transportId);
      if (!transport) {
        send(ws, { action: 'error', error: 'transport-not-found' });
        break;
      }
      const producer = await transport.produce({ kind, rtpParameters });
      peer.producers.set(producer.id, producer);
      producer.on('transportclose', () => peer.producers.delete(producer.id));
      send(ws, { action: 'produced', id: producer.id });
      room.peers.forEach((otherPeer, otherPeerId) => {
        if (otherPeerId === peer.id) {
          return;
        }
        send(otherPeer.socket, {
          action: 'newProducer',
          producerId: producer.id,
          peerId: peer.id,
          kind: producer.kind,
        });
      });
      break;
    }
    case 'consume': {
      const roomId = String(message.roomId ?? 'default');
      const producerId = String(message.producerId);
      const rtpCapabilities = message.rtpCapabilities as RtpCapabilities;
      const room = await getOrCreateRoom(roomId);
      if (!room.router.canConsume({ producerId, rtpCapabilities })) {
        send(ws, { action: 'error', error: 'cannot-consume' });
        break;
      }
      const transportId = String(message.transportId);
      const transport = peer.transports.get(transportId);
      if (!transport) {
        send(ws, { action: 'error', error: 'transport-not-found' });
        break;
      }
      const consumer = await transport.consume({ producerId, rtpCapabilities, paused: true });
      peer.consumers.set(consumer.id, consumer);
      consumer.on('transportclose', () => peer.consumers.delete(consumer.id));
      send(ws, {
        action: 'consumed',
        id: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      });
      break;
    }
    case 'resumeConsumer': {
      const consumerId = String(message.consumerId);
      const consumer = peer.consumers.get(consumerId);
      await consumer?.resume();
      send(ws, { action: 'consumerResumed', consumerId });
      break;
    }
    default:
      send(ws, { action: 'error', error: `unknown-action:${message.action}` });
  }
}

function cleanupPeer(roomId: string, peer: Peer) {
  const room = rooms.get(roomId);
  if (!room) {
    return;
  }
  peer.consumers.forEach((consumer) => consumer.close());
  peer.producers.forEach((producer) => producer.close());
  peer.transports.forEach((transport) => transport.close());
  room.peers.delete(peer.id);
  if (room.peers.size === 0) {
    room.router.close();
    rooms.delete(roomId);
  }
}

async function start() {
  const httpServer = createServer();
  const wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (socket) => {
    const peer = createPeer(socket);
    let roomId = 'default';

    socket.on('message', async (raw) => {
      try {
        const message = JSON.parse(String(raw)) as Message;
        if (typeof message.roomId === 'string') {
          roomId = message.roomId;
        }
        await handleMessage(socket, peer, message);
      } catch (error) {
        console.error('Failed to handle message', error);
        send(socket, { action: 'error', error: 'internal-error' });
      }
    });

    socket.on('close', () => {
      cleanupPeer(roomId, peer);
    });

    send(socket, { action: 'hello', peerId: peer.id });
  });

  httpServer.listen(SIGNAL_PORT, () => {
    console.log(`SFU signaling listening on ws://0.0.0.0:${SIGNAL_PORT}`);
  });
}

start().catch((error) => {
  console.error('SFU failed to start', error);
  process.exit(1);
});
