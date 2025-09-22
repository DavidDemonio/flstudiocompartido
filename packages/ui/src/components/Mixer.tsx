import { memo } from 'react';

export type MixerStrip = {
  id: string;
  name: string;
  volume: number;
  pan: number;
  meterPeak: number;
  meterRms: number;
};

export interface MixerProps {
  strips: MixerStrip[];
}

export const Mixer = memo(function Mixer({ strips }: MixerProps) {
  return (
    <div className="flex gap-4 overflow-x-auto bg-slate-900 p-4 text-slate-100">
      {strips.map((strip) => (
        <div key={strip.id} className="flex w-40 flex-col items-center rounded-lg bg-slate-800 p-4">
          <div className="mb-2 text-sm font-semibold">{strip.name}</div>
          <div className="relative mb-2 h-32 w-8 overflow-hidden rounded-full bg-slate-950">
            <div
              className="absolute bottom-0 left-0 right-0 bg-emerald-500"
              style={{ height: `${Math.min(Math.max(strip.meterRms, 0), 1) * 100}%` }}
            />
            <div
              className="absolute left-0 right-0 border-t-2 border-emerald-200"
              style={{ bottom: `${Math.min(Math.max(strip.meterPeak, 0), 1) * 100}%` }}
            />
          </div>
          <label className="mb-1 text-xs uppercase tracking-wide">Volumen</label>
          <input
            type="range"
            className="w-full"
            min="-60"
            max="6"
            value={strip.volume}
            readOnly
          />
          <label className="mt-3 mb-1 text-xs uppercase tracking-wide">Pan</label>
          <input type="range" className="w-full" min="-1" max="1" step="0.01" value={strip.pan} readOnly />
        </div>
      ))}
    </div>
  );
});
