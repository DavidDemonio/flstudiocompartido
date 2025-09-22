import { memo } from 'react';

export type PianoNote = {
  id: string;
  pitch: number;
  start: number;
  length: number;
  velocity: number;
};

export interface PianoRollProps {
  notes: PianoNote[];
  pixelsPerBeat: number;
  rows?: number;
}

const midiNotes = Array.from({ length: 24 }, (_, i) => 72 - i);

function noteColor(pitch: number): string {
  const scale = pitch % 12;
  return [1, 3, 6, 8, 10].includes(scale) ? '#1e293b' : '#0f172a';
}

export const PianoRoll = memo(function PianoRoll({ notes, pixelsPerBeat, rows = midiNotes.length }: PianoRollProps) {
  return (
    <div className="relative h-80 overflow-x-auto overflow-y-auto bg-slate-950 text-slate-200">
      <div style={{ width: `${16 * pixelsPerBeat}px`, height: `${rows * 24}px` }} className="relative">
        {midiNotes.slice(0, rows).map((note, index) => (
          <div
            key={note}
            className="absolute left-0 flex h-6 w-full items-center border-b border-slate-800 px-2 text-xs uppercase"
            style={{ top: `${index * 24}px`, backgroundColor: noteColor(note) }}
          >
            {`M${note}`}
          </div>
        ))}
        {notes.map((note) => (
          <div
            key={note.id}
            className="absolute h-6 rounded-sm bg-emerald-500/80"
            style={{
              left: `${note.start * pixelsPerBeat}px`,
              top: `${(midiNotes.indexOf(note.pitch) ?? 0) * 24}px`,
              width: `${Math.max(note.length * pixelsPerBeat, 12)}px`,
            }}
          />
        ))}
      </div>
    </div>
  );
});
