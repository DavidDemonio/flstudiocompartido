import { memo } from 'react';
import clsx from 'clsx';

export type TimelineClip = {
  id: string;
  start: number;
  length: number;
  label: string;
  color: string;
};

export interface TimelineProps {
  clips: TimelineClip[];
  pixelsPerBeat: number;
  beats: number;
}

const gridBeats = Array.from({ length: 64 }, (_, i) => i);

export const Timeline = memo(function Timeline({ clips, pixelsPerBeat, beats }: TimelineProps) {
  return (
    <div className="w-full overflow-x-auto bg-slate-900 text-slate-200">
      <div
        className="relative h-40 min-w-full border-b border-slate-700"
        style={{ width: `${beats * pixelsPerBeat}px` }}
      >
        {gridBeats.slice(0, beats).map((beat) => (
          <div
            key={`grid-${beat}`}
            className={clsx(
              'absolute top-0 h-full border-r border-slate-800',
              beat % 4 === 0 && 'border-slate-600'
            )}
            style={{ left: `${beat * pixelsPerBeat}px`, width: `${pixelsPerBeat}px` }}
          />
        ))}
        {clips.map((clip) => (
          <div
            key={clip.id}
            className="absolute top-6 h-24 rounded-md bg-slate-500/70 px-2 py-1 text-sm font-medium shadow-lg"
            style={{
              left: `${clip.start * pixelsPerBeat}px`,
              width: `${clip.length * pixelsPerBeat}px`,
              backgroundColor: clip.color,
            }}
          >
            {clip.label}
          </div>
        ))}
      </div>
    </div>
  );
});
