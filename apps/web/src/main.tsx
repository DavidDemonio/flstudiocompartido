import { StrictMode, useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Timeline, PianoRoll, Mixer } from '@flstudio/ui';
import './index.css';
import { create } from 'zustand';
import { createWorkletWasmMessage } from '@flstudio/dsp-wasm';

interface AudioEngine {
  context: AudioContext;
  node: AudioWorkletNode;
}

interface ProjectState {
  bpm: number;
  playhead: number;
  isPlaying: boolean;
  toggleTransport: () => void;
}

const useProjectStore = create<ProjectState>((set, get) => ({
  bpm: 128,
  playhead: 0,
  isPlaying: false,
  toggleTransport: () => set({ isPlaying: !get().isPlaying }),
}));

function useAudioEngine(): AudioEngine | null {
  const [engine, setEngine] = useState<AudioEngine | null>(null);

  useEffect(() => {
    let disposed = false;
    const setup = async () => {
      const context = new AudioContext({ latencyHint: 'interactive' });
      await context.audioWorklet.addModule('/worklets/saw-processor.js');
      const node = new AudioWorkletNode(context, 'saw-synth-processor', {
        outputChannelCount: [1],
        parameterData: {
          frequency: 220,
        },
      });
      const wasm = createWorkletWasmMessage();
      node.port.postMessage({ type: 'load-wasm', wasm }, [wasm]);
      node.port.postMessage({ type: 'configure', sampleRate: context.sampleRate });
      node.connect(context.destination);
      await context.resume().catch(() => undefined);
      if (!disposed) {
        setEngine({ context, node });
      }
    };

    void setup();

    return () => {
      disposed = true;
      setEngine((current) => {
        current?.node.disconnect();
        current?.context.close().catch(() => undefined);
        return null;
      });
    };
  }, []);

  return engine;
}

function SynthControls({ engine }: { engine: AudioEngine | null }) {
  const [frequency, setFrequency] = useState(220);

  useEffect(() => {
    if (engine) {
      engine.node.parameters.get('frequency')?.setValueAtTime(frequency, engine.context.currentTime);
    }
  }, [engine, frequency]);

  return (
    <div className="flex items-center gap-4 rounded-lg bg-slate-800/60 p-4">
      <div className="text-sm uppercase tracking-wide text-slate-400">Frecuencia</div>
      <input
        type="range"
        min="80"
        max="1200"
        value={frequency}
        onChange={(event) => setFrequency(Number(event.target.value))}
      />
      <span className="text-emerald-400">{frequency.toFixed(1)} Hz</span>
    </div>
  );
}

function App() {
  const engine = useAudioEngine();
  const { isPlaying, toggleTransport } = useProjectStore();

  const timelineClips = useMemo(
    () => [
      { id: 'clip-1', start: 0, length: 4, label: 'Intro Pad', color: '#38bdf8' },
      { id: 'clip-2', start: 4, length: 4, label: 'Lead', color: '#818cf8' },
    ],
    [],
  );

  const notes = useMemo(
    () => [
      { id: 'n1', pitch: 69, start: 0, length: 1, velocity: 0.9 },
      { id: 'n2', pitch: 71, start: 1, length: 1, velocity: 0.8 },
      { id: 'n3', pitch: 72, start: 2, length: 2, velocity: 0.85 },
    ],
    [],
  );

  const strips = useMemo(
    () => [
      { id: 's1', name: 'Sintetizador', volume: -6, pan: 0, meterPeak: 0.85, meterRms: 0.65 },
      { id: 's2', name: 'Batería', volume: -8, pan: -0.1, meterPeak: 0.9, meterRms: 0.6 },
      { id: 's3', name: 'Voz', volume: -10, pan: 0.1, meterPeak: 0.7, meterRms: 0.5 },
    ],
    [],
  );

  return (
    <div className="flex min-h-screen flex-col gap-6 bg-slate-950 p-6 text-slate-100">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">FL Studio Compartido</h1>
        <button
          className="rounded-full bg-emerald-500 px-4 py-2 font-semibold text-slate-900 transition hover:bg-emerald-400"
          type="button"
          onClick={() => toggleTransport()}
        >
          {isPlaying ? 'Detener' : 'Reproducir'}
        </button>
      </header>

      <SynthControls engine={engine} />

      <section>
        <h2 className="mb-2 text-lg font-semibold">Timeline</h2>
        <Timeline clips={timelineClips} pixelsPerBeat={80} beats={16} />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Piano Roll</h2>
        <PianoRoll notes={notes} pixelsPerBeat={80} />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Mixer</h2>
        <Mixer strips={strips} />
      </section>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
