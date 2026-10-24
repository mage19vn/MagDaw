import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type KeyboardEvent,
} from "react";
import type { Clip, Note, Project, Selection, Track } from "../../domain/types";
import { beatsPerBar, createId, pitchName } from "../../domain/types";
import {
  addNote,
  deleteNotes,
  duplicateNotes,
  moveNotes,
  pasteNotes,
  quantizeNotes,
  resizeNotes,
  setNoteVelocity,
} from "../../domain/commands";
import "./piano-roll.css";

export interface PianoRollProps {
  project: Project;
  track: Track;
  clip: Clip;
  selection: Selection;
  onSelection: (selection: Selection) => void;
  onEdit: (project: Project, selection?: Selection) => void;
  onAudition: (pitch: number, velocity?: number) => void;
  position: number;
}

interface GridPoint {
  beat: number;
  pitch: number;
  x: number;
  y: number;
}
interface Gesture {
  kind: "move" | "resize" | "empty" | "marquee";
  pointerId: number;
  clientX: number;
  clientY: number;
  start: GridPoint;
  current: GridPoint;
  original: Project;
  noteIds: string[];
  append: boolean;
  moved: boolean;
}
const DRAG_THRESHOLD = 4;
const isTextTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
    target.isContentEditable);
const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(maximum, value));
const snapValue = (value: number, snap: number): number =>
  snap ? Math.round(value / snap) * snap : value;

export function PianoRoll({
  project,
  track,
  clip,
  selection,
  onSelection,
  onEdit,
  onAudition,
  position,
}: PianoRollProps) {
  const [beatWidth, setBeatWidth] = useState(64);
  const [rowHeight, setRowHeight] = useState(18);
  const [snap, setSnap] = useState(0.25);
  const [tool, setTool] = useState<"pencil" | "select">("pencil");
  const [preview, setPreview] = useState<Project | null>(null);
  const [marquee, setMarquee] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const previewRef = useRef<Project | null>(null);
  const clipboard = useRef<Note[]>([]);
  const pasteBeat = useRef(0);
  const activeClip =
    preview?.tracks
      .find((item) => item.id === track.id)
      ?.clips.find((item) => item.id === clip.id) ?? clip;
  const selectedNotes = clip.notes.filter((note) =>
    selection.noteIds.includes(note.id),
  );
  const beatCount = Math.max(16, Math.ceil(activeClip.length_beats + 4));
  const barLength = beatsPerBar(project.time_signature);
  const contentHeight = 128 * rowHeight;
  const pulseLength = 4 / project.time_signature[1];
  const firstPulse = Math.ceil(clip.start_beat / pulseLength);
  const rulerTicks = Array.from(
    { length: Math.ceil(beatCount / pulseLength) },
    (_, index) => {
      const absoluteBeat = (firstPulse + index) * pulseLength;
      const pulseInBar = Math.round((absoluteBeat % barLength) / pulseLength);
      return {
        offset: absoluteBeat - clip.start_beat,
        label:
          pulseInBar === 0
            ? `${Math.floor(absoluteBeat / barLength) + 1}`
            : `·${pulseInBar + 1}`,
        isBar: pulseInBar === 0,
      };
    },
  );

  useEffect(() => {
    if (!scrollRef.current) return;
    const topPitch = Math.min(
      127,
      (clip.notes.length
        ? Math.max(...clip.notes.map((note) => note.pitch))
        : 72) + 3,
    );
    scrollRef.current.scrollTop = (127 - topPitch) * rowHeight;
    scrollRef.current.scrollLeft = 0;
    setPreview(null);
    previewRef.current = null;
  }, [clip.id]);

  const selectionFor = (noteIds: string[]): Selection => ({
    trackId: track.id,
    clipId: clip.id,
    noteIds,
  });
  const attempt = (action: () => void): void => {
    try {
      action();
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể chỉnh sửa nốt nhạc.",
      );
    }
  };
  const commit = (nextProject: Project, noteIds = selection.noteIds): void =>
    onEdit(nextProject, selectionFor(noteIds));
  const pointAt = (
    event: Pick<PointerEvent, "clientX" | "clientY">,
  ): GridPoint => {
    const bounds = gridRef.current!.getBoundingClientRect();
    const x = Math.max(0, event.clientX - bounds.left);
    const y = clamp(event.clientY - bounds.top, 0, contentHeight - 1);
    return {
      x,
      y,
      beat: x / beatWidth,
      pitch: 127 - Math.floor(y / rowHeight),
    };
  };

  const startGesture = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    sectionRef.current?.focus({ preventScroll: true });
    const point = pointAt(event);
    pasteBeat.current = Math.max(0, snapValue(point.beat, snap));
    const target = event.target as HTMLElement;
    const noteElement = target.closest<HTMLElement>("[data-note-id]");
    const noteId = noteElement?.dataset.noteId;
    let noteIds = selection.noteIds;
    let kind: Gesture["kind"] =
      event.shiftKey || tool === "select" ? "marquee" : "empty";
    if (noteId) {
      kind = target.dataset.resize === "true" ? "resize" : "move";
      noteIds =
        event.ctrlKey || event.metaKey
          ? selection.noteIds.includes(noteId)
            ? selection.noteIds.filter((id) => id !== noteId)
            : [...selection.noteIds, noteId]
          : selection.noteIds.includes(noteId)
            ? selection.noteIds
            : [noteId];
      onSelection(selectionFor(noteIds));
      if (kind === "move") {
        const note = clip.notes.find((item) => item.id === noteId);
        if (note) onAudition(note.pitch, note.velocity);
      }
    } else if (!event.ctrlKey && !event.metaKey) onSelection(selectionFor([]));
    gesture.current = {
      kind,
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      start: point,
      current: point,
      original: project,
      noteIds,
      append: event.ctrlKey || event.metaKey,
      moved: false,
    };
    previewRef.current = null;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const updateGesture = (event: PointerEvent<HTMLDivElement>): void => {
    const currentGesture = gesture.current;
    if (!currentGesture || currentGesture.pointerId !== event.pointerId) return;
    if (
      Math.hypot(
        event.clientX - currentGesture.clientX,
        event.clientY - currentGesture.clientY,
      ) >= DRAG_THRESHOLD
    )
      currentGesture.moved = true;
    if (!currentGesture.moved) return;
    const scroll = scrollRef.current;
    if (scroll) {
      const bounds = scroll.getBoundingClientRect();
      if (event.clientX > bounds.right - 24) scroll.scrollLeft += 14;
      if (event.clientX < bounds.left + 80) scroll.scrollLeft -= 14;
      if (event.clientY > bounds.bottom - 24) scroll.scrollTop += rowHeight;
      if (event.clientY < bounds.top + 40) scroll.scrollTop -= rowHeight;
    }
    const point = pointAt(event);
    currentGesture.current = point;
    if (currentGesture.kind === "empty") currentGesture.kind = "marquee";
    if (currentGesture.kind === "marquee") {
      setMarquee({
        left: Math.min(point.x, currentGesture.start.x),
        top: Math.min(point.y, currentGesture.start.y),
        width: Math.abs(point.x - currentGesture.start.x),
        height: Math.abs(point.y - currentGesture.start.y),
      });
      return;
    }
    attempt(() => {
      const deltaBeat = snapValue(point.beat - currentGesture.start.beat, snap);
      const nextProject =
        currentGesture.kind === "resize"
          ? resizeNotes(
              currentGesture.original,
              track.id,
              clip.id,
              currentGesture.noteIds,
              deltaBeat,
            )
          : moveNotes(
              currentGesture.original,
              track.id,
              clip.id,
              currentGesture.noteIds,
              deltaBeat,
              point.pitch - currentGesture.start.pitch,
            );
      previewRef.current = nextProject;
      setPreview(nextProject);
    });
  };

  const finishGesture = (event: PointerEvent<HTMLDivElement>): void => {
    const currentGesture = gesture.current;
    if (!currentGesture || currentGesture.pointerId !== event.pointerId) return;
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    attempt(() => {
      if (currentGesture.kind === "marquee" && currentGesture.moved) {
        const start = Math.min(
          currentGesture.start.beat,
          currentGesture.current.beat,
        );
        const end = Math.max(
          currentGesture.start.beat,
          currentGesture.current.beat,
        );
        const lowPitch = Math.min(
          currentGesture.start.pitch,
          currentGesture.current.pitch,
        );
        const highPitch = Math.max(
          currentGesture.start.pitch,
          currentGesture.current.pitch,
        );
        const ids = clip.notes
          .filter(
            (note) =>
              note.start_beat < end &&
              note.start_beat + note.length_beat > start &&
              note.pitch >= lowPitch &&
              note.pitch <= highPitch,
          )
          .map((note) => note.id);
        onSelection(
          selectionFor([
            ...new Set([
              ...(currentGesture.append ? currentGesture.noteIds : []),
              ...ids,
            ]),
          ]),
        );
      } else if (currentGesture.kind === "empty" && !currentGesture.moved) {
        const note: Note = {
          id: createId(),
          start_beat: Math.max(0, snapValue(currentGesture.start.beat, snap)),
          length_beat: snap || 0.25,
          pitch: currentGesture.start.pitch,
          velocity: 96,
        };
        commit(addNote(project, track.id, clip.id, note), [note.id]);
        onAudition(note.pitch, note.velocity);
      } else if (currentGesture.moved && previewRef.current)
        commit(previewRef.current, currentGesture.noteIds);
    });
    previewRef.current = null;
    setPreview(null);
    setMarquee(null);
  };

  const cancelGesture = (): void => {
    gesture.current = null;
    previewRef.current = null;
    setPreview(null);
    setMarquee(null);
  };

  const deleteSelection = (): void =>
    attempt(() =>
      commit(deleteNotes(project, track.id, clip.id, selection.noteIds), []),
    );
  const duplicateSelection = (): void =>
    attempt(() => {
      const nextProject = duplicateNotes(
        project,
        track.id,
        clip.id,
        selection.noteIds,
      );
      const oldIds = new Set(clip.notes.map((note) => note.id));
      const ids = nextProject.tracks
        .find((item) => item.id === track.id)!
        .clips.find((item) => item.id === clip.id)!
        .notes.filter((note) => !oldIds.has(note.id))
        .map((note) => note.id);
      commit(nextProject, ids);
    });
  const pasteSelection = (): void =>
    attempt(() => {
      if (!clipboard.current.length) return;
      const nextProject = pasteNotes(
        project,
        track.id,
        clip.id,
        clipboard.current,
        pasteBeat.current,
      );
      const oldIds = new Set(clip.notes.map((note) => note.id));
      const pastedIds = nextProject.tracks
        .find((item) => item.id === track.id)!
        .clips.find((item) => item.id === clip.id)!
        .notes.filter((note) => !oldIds.has(note.id))
        .map((note) => note.id);
      commit(nextProject, pastedIds);
    });
  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (isTextTarget(event.target)) return;
    const modifier = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (modifier && ["a", "c", "x", "v", "d"].includes(key)) {
      event.preventDefault();
      if (key === "a")
        onSelection(selectionFor(clip.notes.map((note) => note.id)));
      if (key === "c" || key === "x")
        clipboard.current = structuredClone(selectedNotes);
      if (key === "x") deleteSelection();
      if (key === "v") pasteSelection();
      if (key === "d") duplicateSelection();
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteSelection();
    }
    if (event.key === "Escape") {
      cancelGesture();
      onSelection(selectionFor([]));
    }
    if (key === "q" && !modifier) {
      event.preventDefault();
      attempt(() =>
        commit(
          quantizeNotes(
            project,
            track.id,
            clip.id,
            selection.noteIds,
            snap || 0.25,
          ),
        ),
      );
    }
    if (
      ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    ) {
      event.preventDefault();
      const deltaBeat =
        event.key === "ArrowLeft"
          ? -(snap || 0.0625)
          : event.key === "ArrowRight"
            ? snap || 0.0625
            : 0;
      const deltaPitch =
        event.key === "ArrowUp"
          ? event.shiftKey
            ? 12
            : 1
          : event.key === "ArrowDown"
            ? event.shiftKey
              ? -12
              : -1
            : 0;
      attempt(() =>
        commit(
          moveNotes(
            project,
            track.id,
            clip.id,
            selection.noteIds,
            deltaBeat,
            deltaPitch,
          ),
        ),
      );
    }
  };
  const setVelocity = (velocity: number): void =>
    attempt(() => {
      commit(
        setNoteVelocity(
          project,
          track.id,
          clip.id,
          selection.noteIds,
          velocity,
        ),
      );
    });

  return (
    <section
      className="piano-roll"
      ref={sectionRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label="Trình chỉnh sửa nốt nhạc"
    >
      <div className="piano-toolbar">
        <div className="piano-title">
          <span className="piano-accent">▦</span>
          <strong>Piano roll</strong>
          <span>
            {track.name} / {clip.name}
          </span>
        </div>
        <div className="piano-tools">
          <button
            type="button"
            className={tool === "pencil" ? "active" : ""}
            onClick={() => setTool("pencil")}
            title="Bút: bấm ô trống tạo nốt; kéo ô trống chọn vùng"
          >
            ✎ Vẽ
          </button>
          <button
            type="button"
            className={tool === "select" ? "active" : ""}
            onClick={() => setTool("select")}
            title="Kéo vùng để chọn nhiều nốt; Ctrl để thêm lựa chọn"
          >
            ▧ Chọn
          </button>
          <label>
            Snap{" "}
            <select
              aria-label="Snap piano roll"
              value={snap}
              onChange={(event) => setSnap(Number(event.target.value))}
            >
              <option value={1}>1/4</option>
              <option value={0.5}>1/8</option>
              <option value={0.25}>1/16</option>
              <option value={0}>Tắt</option>
            </select>
          </label>
          <label title="Độ rộng mỗi beat">
            ↔{" "}
            <input
              aria-label="Zoom ngang piano roll"
              type="range"
              min={24}
              max={160}
              step={8}
              value={beatWidth}
              onChange={(event) => setBeatWidth(Number(event.target.value))}
            />
          </label>
          <label title="Chiều cao mỗi phím">
            ↕{" "}
            <input
              aria-label="Zoom dọc piano roll"
              type="range"
              min={12}
              max={32}
              step={2}
              value={rowHeight}
              onChange={(event) => setRowHeight(Number(event.target.value))}
            />
          </label>
          <button
            type="button"
            disabled={!selectedNotes.length}
            title="Căn đầu và độ dài nốt về lưới gần nhất, dài ít nhất một ô (Q)"
            onClick={() =>
              attempt(() =>
                commit(
                  quantizeNotes(
                    project,
                    track.id,
                    clip.id,
                    selection.noteIds,
                    snap || 0.25,
                  ),
                ),
              )
            }
          >
            Căn nhịp
          </button>
          <button
            type="button"
            disabled={!selectedNotes.length}
            title="Nhân đôi các nốt đã chọn (Ctrl+D)"
            onClick={duplicateSelection}
          >
            Nhân đôi
          </button>
          <button
            type="button"
            disabled={!selectedNotes.length}
            title="Xóa nốt đã chọn (Delete)"
            onClick={deleteSelection}
          >
            Xóa
          </button>
        </div>
      </div>
      <div className="piano-scroll" ref={scrollRef} data-testid="piano-scroll">
        <div
          className="piano-content"
          style={{
            width: beatCount * beatWidth + 64,
            height: contentHeight + 26,
          }}
        >
          <div className="piano-ruler" style={{ width: beatCount * beatWidth }}>
            {rulerTicks.map((tick) => (
              <span
                key={tick.offset}
                className={tick.isBar ? "bar-tick" : "beat-tick"}
                style={{
                  left: tick.offset * beatWidth,
                  width: pulseLength * beatWidth,
                }}
              >
                {tick.label}
              </span>
            ))}
          </div>
          <div className="piano-keyboard" style={{ height: contentHeight }}>
            {Array.from({ length: 128 }, (_, index) => 127 - index).map(
              (pitch) => (
                <button
                  type="button"
                  tabIndex={-1}
                  className={
                    [1, 3, 6, 8, 10].includes(pitch % 12)
                      ? "black-key"
                      : "white-key"
                  }
                  key={pitch}
                  style={{ height: rowHeight }}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    onAudition(pitch, 100);
                  }}
                  title={`Nghe thử ${pitchName(pitch)} · MIDI ${pitch}`}
                >
                  {pitchName(pitch)}
                </button>
              ),
            )}
          </div>
          <div
            ref={gridRef}
            className="piano-grid"
            data-testid="piano-grid"
            style={{
              width: beatCount * beatWidth,
              height: contentHeight,
              backgroundSize: `${barLength * beatWidth}px 100%, ${beatWidth}px 100%, ${Math.max(snap || 0.25, 0.25) * beatWidth}px 100%, 100% ${rowHeight}px`,
              backgroundPosition: `${-(clip.start_beat % barLength) * beatWidth}px 0, ${-(clip.start_beat % 1) * beatWidth}px 0, 0 0, 0 0`,
            }}
            onPointerDown={startGesture}
            onPointerMove={updateGesture}
            onPointerUp={finishGesture}
            onPointerCancel={cancelGesture}
            onContextMenu={(event) => event.preventDefault()}
          >
            {Array.from({ length: 128 }, (_, index) => 127 - index)
              .filter((pitch) => [1, 3, 6, 8, 10].includes(pitch % 12))
              .map((pitch) => (
                <div
                  key={pitch}
                  className="piano-black-row"
                  style={{ top: (127 - pitch) * rowHeight, height: rowHeight }}
                />
              ))}
            <div
              className="piano-clip-end"
              style={{ left: activeClip.length_beats * beatWidth }}
              title="Cuối clip; thêm/kéo nốt sẽ mở rộng clip"
            />
            {activeClip.notes.map((note) => (
              <div
                key={note.id}
                data-note-id={note.id}
                data-testid="piano-note"
                role="button"
                aria-label={`${pitchName(note.pitch)}, beat ${note.start_beat}, dài ${note.length_beat}, velocity ${note.velocity}`}
                className={`piano-note ${selection.noteIds.includes(note.id) ? "selected" : ""}`}
                style={{
                  left: note.start_beat * beatWidth,
                  top: (127 - note.pitch) * rowHeight + 1,
                  width: Math.max(8, note.length_beat * beatWidth),
                  height: rowHeight - 2,
                  opacity: 0.58 + (note.velocity / 127) * 0.42,
                }}
                title={`${pitchName(note.pitch)} · ${note.start_beat.toFixed(2)} beat · dài ${note.length_beat.toFixed(2)} · velocity ${note.velocity}`}
              >
                <span>
                  {rowHeight >= 16 && note.length_beat * beatWidth > 30
                    ? pitchName(note.pitch)
                    : ""}
                </span>
                <i data-resize="true" title="Kéo để đổi độ dài nốt" />
              </div>
            ))}
            {marquee && <div className="piano-marquee" style={marquee} />}
            {position >= clip.start_beat &&
              position <= clip.start_beat + beatCount && (
                <div
                  className="piano-playhead"
                  style={{ left: (position - clip.start_beat) * beatWidth }}
                />
              )}
          </div>
        </div>
      </div>
      <div className="piano-footer">
        <span>
          {selectedNotes.length
            ? `${selectedNotes.length} nốt đã chọn`
            : `${clip.notes.length} nốt · Bấm để vẽ, Shift+kéo để chọn vùng`}
        </span>
        <label>
          Velocity{" "}
          <input
            type="number"
            aria-label="Velocity nốt đã chọn"
            min={1}
            max={127}
            disabled={!selectedNotes.length}
            value={selectedNotes[0]?.velocity ?? 96}
            onChange={(event) => {
              const velocity = Number(event.target.value);
              if (
                Number.isInteger(velocity) &&
                velocity >= 1 &&
                velocity <= 127
              )
                setVelocity(velocity);
            }}
          />
          <span>1–127</span>
        </label>
        <span className="piano-shortcuts">
          Ctrl+C/V · Ctrl+D · Delete · Q căn nhịp · phím mũi tên
        </span>
        {error && (
          <span role="alert" className="piano-error">
            {error}
          </span>
        )}
      </div>
    </section>
  );
}
