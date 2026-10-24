import { useRef, useState } from "react";
import { useDaw, trackColor } from "../state/store";
import { projectEndBeat } from "../utils/music";

interface DragState {
  clipId: string;
  trackId: string;
  startX: number;
  startBeat: number;
  moved: boolean;
}

export default function Arrangement() {
  const project = useDaw((s) => s.project);
  const selectedTrackId = useDaw((s) => s.selectedTrackId);
  const selectedClipId = useDaw((s) => s.selectedClipId);
  const playheadBeat = useDaw((s) => s.playheadBeat);
  const selectClip = useDaw((s) => s.selectClip);
  const seek = useDaw((s) => s.seek);
  const moveClipAction = useDaw((s) => s.moveClipAction);
  const duplicateClipAction = useDaw((s) => s.duplicateClipAction);
  const deleteClipAction = useDaw((s) => s.deleteClipAction);
  const createClipAction = useDaw((s) => s.createClipAction);

  const [pxPerBeat, setPxPerBeat] = useState(24);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dragBeat, setDragBeat] = useState(0);
  const rulerRef = useRef<HTMLDivElement>(null);

  if (!project) return null;
  const beatsPerBar = project.time_signature[0];
  const totalBeats = Math.max(64, projectEndBeat(project.tracks) + 16);
  const width = totalBeats * pxPerBeat;

  const rulerClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const beat = Math.max(0, (event.clientX - rect.left) / pxPerBeat);
    seek(beat);
  };

  const clipPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
    trackId: string,
    clipId: string,
    startBeat: number,
  ) => {
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    setDrag({ clipId, trackId, startX: event.clientX, startBeat, moved: false });
    setDragBeat(startBeat);
  };

  const clipPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const deltaBeats = (event.clientX - drag.startX) / pxPerBeat;
    if (Math.abs(deltaBeats) > 0.1) {
      setDrag({ ...drag, moved: true });
    }
    setDragBeat(Math.max(0, Math.round(drag.startBeat + deltaBeats)));
  };

  const clipPointerUp = () => {
    if (!drag) return;
    if (drag.moved) {
      moveClipAction(drag.trackId, drag.clipId, dragBeat);
    } else {
      selectClip(drag.trackId, drag.clipId);
    }
    setDrag(null);
  };

  return (
    <div className="arrangement">
      <div className="arrangement-toolbar">
        <label title="Zoom timeline">
          Zoom
          <input
            type="range"
            min={8}
            max={64}
            value={pxPerBeat}
            onChange={(e) => setPxPerBeat(Number(e.target.value))}
          />
        </label>
        <span className="hint">
          Bấm ruler để tua • Bấm clip để mở piano roll • Kéo clip để dời
        </span>
      </div>
      <div className="arrangement-scroll">
        <div style={{ width, minWidth: "100%" }}>
          <div
            ref={rulerRef}
            className="ruler"
            onClick={rulerClick}
            title="Bấm để tua đến vị trí này"
          >
            {Array.from({ length: totalBeats + 1 }, (_, beat) => (
              <span
                key={beat}
                className={beat % beatsPerBar === 0 ? "bar-mark" : "beat-mark"}
                style={{ left: beat * pxPerBeat }}
              >
                {beat % beatsPerBar === 0 ? beat / beatsPerBar + 1 : ""}
              </span>
            ))}
          </div>
          <div
            className="playhead"
            style={{ left: playheadBeat * pxPerBeat }}
            title="Playhead"
          />
          {project.tracks.map((track, index) => (
            <div key={track.id} className="arr-row">
              {track.clips.map((clip) => {
                const isSelected =
                  track.id === selectedTrackId && clip.id === selectedClipId;
                const displayStart =
                  drag?.clipId === clip.id ? dragBeat : clip.start_beat;
                return (
                  <div
                    key={clip.id}
                    className={`clip ${isSelected ? "selected" : ""}`}
                    style={{
                      left: displayStart * pxPerBeat,
                      width: clip.length_beats * pxPerBeat,
                      background: trackColor(index),
                    }}
                    title={`${clip.name} — ${clip.notes.length} note`}
                    onPointerDown={(e) =>
                      clipPointerDown(e, track.id, clip.id, clip.start_beat)
                    }
                    onPointerMove={clipPointerMove}
                    onPointerUp={clipPointerUp}
                  >
                    <span className="clip-name">{clip.name}</span>
                    <span className="clip-notes">{clip.notes.length}♪</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="arrangement-actions">
        <button
          type="button"
          title="Tạo clip MIDI rỗng 4 beat tại vị trí playhead trên track đang chọn"
          onClick={() => {
            if (selectedTrackId) {
              createClipAction(
                selectedTrackId,
                Math.floor(playheadBeat),
                4,
              );
            }
          }}
          disabled={!selectedTrackId}
        >
          + Clip rỗng (4 beat)
        </button>
        <button
          type="button"
          title="Nhân đôi clip đang chọn"
          onClick={() => {
            if (selectedTrackId && selectedClipId) {
              duplicateClipAction(selectedTrackId, selectedClipId);
            }
          }}
          disabled={!selectedTrackId || !selectedClipId}
        >
          Nhân đôi clip
        </button>
        <button
          type="button"
          title="Xóa clip đang chọn"
          onClick={() => {
            if (selectedTrackId && selectedClipId) {
              deleteClipAction(selectedTrackId, selectedClipId);
            }
          }}
          disabled={!selectedTrackId || !selectedClipId}
        >
          Xóa clip
        </button>
      </div>
    </div>
  );
}
