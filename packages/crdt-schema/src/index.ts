import * as Y from 'yjs';

export type ProjectMeta = {
  id: string;
  name: string;
  bpm: number;
  timeSignature: [number, number];
  createdAt: number;
  updatedAt: number;
};

export type ClipType = 'audio' | 'midi';

export type Clip = {
  id: string;
  trackId: string;
  start: number;
  length: number;
  type: ClipType;
  payload: unknown;
};

export type Track = {
  id: string;
  name: string;
  kind: 'audio' | 'instrument' | 'bus';
  color: string;
};

export type MixerChannel = {
  id: string;
  gain: number;
  pan: number;
};

export interface ProjectDoc {
  meta: Y.Map<ProjectMeta>;
  clips: Y.Array<Clip>;
  tracks: Y.Array<Track>;
  mixer: Y.Map<MixerChannel>;
}

export function createProjectDocument(): { doc: Y.Doc; schema: ProjectDoc } {
  const doc = new Y.Doc();
  const meta = doc.getMap<ProjectMeta>('meta');
  const clips = doc.getArray<Clip>('clips');
  const tracks = doc.getArray<Track>('tracks');
  const mixer = doc.getMap<MixerChannel>('mixer');

  if (!meta.has('project')) {
    meta.set('project', {
      id: crypto.randomUUID(),
      name: 'Nuevo Proyecto',
      bpm: 120,
      timeSignature: [4, 4],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  return {
    doc,
    schema: {
      meta,
      clips,
      tracks,
      mixer,
    },
  };
}

export function applySnapshot(doc: Y.Doc, snapshot: Uint8Array): void {
  Y.applyUpdate(doc, snapshot);
}

export function encodeSnapshot(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(doc);
}
