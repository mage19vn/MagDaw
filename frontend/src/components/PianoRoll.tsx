import { useEffect, useRef, useState } from "react";
import { previewNote } from "../audio/engine";
import { useDaw } from "../state/store";
import type { SnapValue } from "../types";
import { pitchName } from "../utils/music";
import { snapBeat } from "../utils/music";

const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);

interface DragPreview {
  kind: "move" | "resize";
  noteId: string;
  startX: number;
  startY: number;
  originBeat: number;
  originPitch: number;
  originLength: number;
  deltaBeat: number;
  deltaPitch: number;
  newLength: number;
}

export default function PianoRoll() {
  const project = useDaw((s) => s.project);
  const selectedTrackId = useDaw((s) => s.selectedTrackId);
  const selectedClipId = useDaw((s) => s.selectedClipId);
  const selectedNoteIds = useDaw((s) => s.selectedNoteIds);
  const snap = useDaw((s) => s.snap);
  const setSnap = useDaw((s) => s.setSnap);
  const setSelectedNoteIds = useDaw((s) => s.setSelectedNoteIds);
  const addNoteToClip = useDaw((s) => s.addNoteToClip);
  const moveSelectedNotes = useDaw((s) => s.moveSelectedNotes);
  const resizeSelectedNote = useDaw((s) => s.resizeSelectedNote);
  const setSelectedVelocity = useDaw((s) => s.setSelectedVelocity);
  const quantizeSelectedNotes = useDaw((s) => s.quantizeSelectedNotes);
  const duplicateSelectedNotes = useDaw((s) => s.duplicateSelectedNotes);

  const [zoomX, setZoomX] = useState(1);
  const [zoomY, setZoomY] = useState(1);
  const [drag, setDrag] = useState<DragPreview | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const track = project?.tracks.find((t) => t.id === selectedTrackId);
  const clip = track?.clips.find((c) => c.id === selectedClipId);

  useEffect(() => {
    const container = scrollRef.current;
    if (container) {
      container.scrollTop = (127 - 60 - 12) * 18 * zoomY;
    }
  }, [selectedClipId, zoomY]);

  if (!project || !track || !clip) {
    return (
      <div className="piano-roll empty">
        Chưa chọn clip nào. Hãy bấm một clip ở arrangement để mở piano roll.
      </div>
    );
  }

  const pxPerBeat = 36 * zoomX;
  const rowHeight = 18 * zoomY;
  const gridWidth = clip.length_beats * pxPerBeat;
  const gridHeight = 128 * rowHeight;
  const selectedNotes = clip.notes.filter((n) => selectedNoteIds.has(n.id));
  const firstSelected = selectedNotes[0];

  const beatFromClientX = (clientX: number, rectLeft: number) =>
    (clientX - rectLeft) / pxPerBeat;
  const pitchFromClientY = (clientY: number, rectTop: number) =>
    127 - Math.floor((clientY - rectTop) / rowHeight);

  const gridPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (drag) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const beat = snapBeat(beatFromClientX(event.clientX, rect.left), snap);
    const pitch = pitchFromClientY(event.clientY, rect.top);
    if (pitch < 0 || pitch > 127 || beat >= clip.length_beats) return;
    const length = snap > 0 ? snap : 1;
    void previewNote(pitch, track.is_drum, 90);
    addNoteToClip(track.id, clip.id, {
      pitch,
      start_beat: beat,
      length_beat: length,
      velocity: 90,
    });
  };

  const notePointerDown = (
    event: React.PointerEvent<HTMLElement>,
    noteId: string,
    startBeat: number,
    pitch: number,
    length: number,
  ) => {
    event.stopPropagation();
    let nextSelected: Set<string>;
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      nextSelected = new Set(selectedNoteIds);
      if (nextSelected.has(noteId)) nextSelected.delete(noteId);
      else nextSelected.add(noteId);
    } else if (selectedNoteIds.has(noteId)) {
      nextSelected = selectedNoteIds;
    } else {
      nextSelected = new Set([noteId]);
    }
    setSelectedNoteIds(nextSelected);
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    setDrag({
      kind: "move",
      noteId,
      startX: event.clientX,
      startY: event.clientY,
      originBeat: startBeat,
      originPitch: pitch,
      originLength: length,
      deltaBeat: 0,
      deltaPitch: 0,
      newLength: length,
    });
  };

  const resizePointerDown = (
    event: React.PointerEvent<HTMLElement>,
    noteId: string,
    startBeat: number,
    pitch: number,
    length: number,
  ) => {
    event.stopPropagation();
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    setDrag({
      kind: "resize",
      noteId,
      startX: event.clientX,
      startY: event.clientY,
      originBeat: startBeat,
      originPitch: pitch,
      originLength: length,
      deltaBeat: 0,
      deltaPitch: 0,
      newLength: length,
    });
  };

  const notePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!drag) return;
    const gridRect = (event.currentTarget as HTMLElement)
      .closest(".piano-grid")
      ?.getBoundingClientRect();
    if (!gridRect) return;
    const currentBeat = (event.clientX - gridRect.left) / pxPerBeat;
    const pointerBeatAtStart = (drag.startX - gridRect.left) / pxPerBeat;
    const rawDelta = currentBeat - pointerBeatAtStart;
    if (drag.kind === "move") {
      const snappedDelta =
        snap > 0 ? Math.round(rawDelta / snap) * snap : rawDelta;
      const deltaPitch = Math.round((drag.startY - event.clientY) / rowHeight);
      setDrag({ ...drag, deltaBeat: snappedDelta, deltaPitch });
    } else {
      const snapped =
        snap > 0 ? Math.round(rawDelta / snap) * snap : rawDelta;
      setDrag({
        ...drag,
        newLength: Math.max(0.25, drag.originLength + snapped),
      });
    }
  };

  const notePointerUp = () => {
    if (!drag) return;
    if (drag.kind === "move") {
      if (drag.deltaBeat !== 0 || drag.deltaPitch !== 0) {
        moveSelectedNotes(drag.deltaBeat, drag.deltaPitch);
      }
    } else if (drag.newLength !== drag.originLength) {
      resizeSelectedNote(drag.noteId, drag.newLength);
    }
    setDrag(null);
  };

  const renderNotePosition = (note: {
    id: string;
    start_beat: number;
    pitch: number;
    length_beat: number;
  }) => {
    let start = note.start_beat;
    let pitch = note.pitch;
    let length = note.length_beat;
    if (drag && selectedNoteIds.has(note.id)) {
      if (drag.kind === "move") {
        start += drag.deltaBeat;
        pitch += drag.deltaPitch;
      } else if (drag.noteId === note.id) {
        length = drag.newLength;
      }
    }
    return { start, pitch, length };
  };

  return (
    <div className="piano-roll">
      <div className="piano-toolbar">
        <strong>
          {track.name} — {clip.name}
        </strong>
        <label title="Snap theo lưới">
          Snap
          <select
            value={snap}
            onChange={(e) => setSnap(Number(e.target.value) as SnapValue)}
          >
            <option value={0}>Tắt</option>
            <option value={1}>1/4</option>
            <option value={0.5}>1/8</option>
            <option value={0.25}>1/16</option>
          </select>
        </label>
        <label title="Zoom ngang">
          Zoom X
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.25}
            value={zoomX}
            onChange={(e) => setZoomX(Number(e.target.value))}
          />
        </label>
        <label title="Zoom dọc">
          Zoom Y
          <input
            type="range"
            min={0.75}
            max={1.5}
            step={0.25}
            value={zoomY}
            onChange={(e) => setZoomY(Number(e.target.value))}
          />
        </label>
        {firstSelected && (
          <label title="Velocity của note đang chọn">
            Velocity {firstSelected.velocity}
            <input
              type="range"
              min={1}
              max={127}
              value={firstSelected.velocity}
              onChange={(e) =>
                setSelectedVelocity(Number(e.target.value))
              }
            />
          </label>
        )}
        <button
          type="button"
          title="Lượng tử hóa note đang chọn theo snap"
          onClick={quantizeSelectedNotes}
          disabled={selectedNoteIds.size === 0 || snap === 0}
        >
          Quantize
        </button>
        <button
          type="button"
          title="Nhân đôi note đang chọn"
          onClick={duplicateSelectedNotes}
          disabled={selectedNoteIds.size === 0}
        >
          Duplicate
        </button>
        <span className="hint">
          Click vùng trống để tạo note • Kéo note để dời • Kéo mép phải để
          đổi độ dài • Shift+Click để chọn nhiều • Delete để xóa
        </span>
      </div>
      <div className="piano-scroll" ref={scrollRef}>
        <div className="piano-body" style={{ height: gridHeight }}>
          <div className="piano-keys">
            {Array.from({ length: 128 }, (_, i) => {
              const pitch = 127 - i;
              const isBlack = BLACK_KEYS.has(pitch % 12);
              return (
                <div
                  key={pitch}
                  className={`piano-key ${isBlack ? "black" : "white"}`}
                  style={{ height: rowHeight }}
                  title={`${pitchName(pitch)} (MIDI ${pitch}) — bấm để nghe thử`}
                  onPointerDown={() => {
                    void previewNote(pitch, track.is_drum, 90);
                  }}
                >
                  {!isBlack && pitch % 12 === 0 && (
                    <span>{pitchName(pitch)}</span>
                  )}
                </div>
              );
            })}
          </div>
          <div
            className="piano-grid"
            style={{ width: gridWidth, height: gridHeight }}
            onPointerDown={gridPointerDown}
          >
            {Array.from({ length: 128 }, (_, i) => {
              const pitch = 127 - i;
              return (
                <div
                  key={pitch}
                  className={`piano-row ${BLACK_KEYS.has(pitch % 12) ? "black" : "white"}`}
                  style={{ top: i * rowHeight, height: rowHeight }}
                />
              );
            })}
            {Array.from(
              { length: Math.floor(clip.length_beats) + 1 },
              (_, beat) => (
                <div
                  key={beat}
                  className={`piano-beat-line ${beat % project.time_signature[0] === 0 ? "bar" : ""}`}
                  style={{ left: beat * pxPerBeat, height: gridHeight }}
                />
              ),
            )}
            {clip.notes.map((note) => {
              const pos = renderNotePosition(note);
              const selected = selectedNoteIds.has(note.id);
              return (
                <div
                  key={note.id}
                  className={`piano-note ${selected ? "selected" : ""}`}
                  style={{
                    left: pos.start * pxPerBeat,
                    top: (127 - pos.pitch) * rowHeight + 1,
                    width: Math.max(8, pos.length * pxPerBeat - 2),
                    height: rowHeight - 2,
                    opacity: 0.45 + 0.55 * (note.velocity / 127),
                  }}
                  title={`${pitchName(note.pitch)} — vel ${note.velocity}`}
                  onPointerDown={(e) =>
                    notePointerDown(
                      e,
                      note.id,
                      note.start_beat,
                      note.pitch,
                      note.length_beat,
                    )
                  }
                  onPointerMove={notePointerMove}
                  onPointerUp={notePointerUp}
                >
                  <span className="note-label">{pitchName(note.pitch)}</span>
                  <span
                    className="note-resize"
                    title="Kéo để đổi độ dài"
                    onPointerDown={(e) =>
                      resizePointerDown(
                        e,
                        note.id,
                        note.start_beat,
                        note.pitch,
                        note.length_beat,
                      )
                    }
                    onPointerMove={notePointerMove}
                    onPointerUp={notePointerUp}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
