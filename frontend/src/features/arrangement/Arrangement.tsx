import { useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { Project, Selection, Track, Clip } from "../../domain/types";
import { beatsPerBar, projectEnd } from "../../domain/types";
import {
  editProject,
  moveClip,
  removeTrack,
  reorderTrack,
  createClip,
} from "../../domain/commands";

interface Props {
  project: Project;
  selection: Selection;
  position: number;
  onEdit: (project: Project, selection?: Selection) => void;
  onSelection: (selection: Selection) => void;
  onSeek: (beat: number) => void;
  onAddTrack: () => void;
}
const COLORS = [
  "#a997ff",
  "#58cbb7",
  "#f0b567",
  "#ed879c",
  "#81b7f5",
  "#b4d47c",
];
export function Arrangement({
  project,
  selection,
  position,
  onEdit,
  onSelection,
  onSeek,
  onAddTrack,
}: Props) {
  const [zoom, setZoom] = useState(24);
  const [snap, setSnap] = useState(1);
  const [drag, setDrag] = useState<{ id: string; start: number } | null>(null);
  const gesture = useRef<{
    trackId: string;
    clip: Clip;
    x: number;
    start: number;
    pointer: number;
  } | null>(null);
  const bar = beatsPerBar(project.time_signature);
  const end = Math.max(80, projectEnd(project) + 16);
  const width = end * zoom;
  const editTrack = (id: string, recipe: (track: Track) => void) =>
    onEdit(
      editProject(project, (draft) => {
        const track = draft.tracks.find((t) => t.id === id);
        if (track) recipe(track);
      }),
    );
  function startDrag(
    event: PointerEvent<HTMLButtonElement>,
    track: Track,
    clip: Clip,
  ) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = {
      trackId: track.id,
      clip,
      x: event.clientX,
      start: clip.start_beat,
      pointer: event.pointerId,
    };
    onSelection({ trackId: track.id, clipId: clip.id, noteIds: [] });
  }
  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const state = gesture.current;
    if (!state || Math.abs(event.clientX - state.x) < 4) return;
    const beat = Math.max(0, state.start + (event.clientX - state.x) / zoom);
    setDrag({
      id: state.clip.id,
      start: snap ? Math.round(beat / snap) * snap : beat,
    });
  }
  function endDrag() {
    const state = gesture.current;
    if (state && drag) {
      onEdit(moveClip(project, state.trackId, state.clip.id, drag.start), {
        trackId: state.trackId,
        clipId: state.clip.id,
        noteIds: [],
      });
    }
    gesture.current = null;
    setDrag(null);
  }
  function createAt(event: React.MouseEvent<HTMLDivElement>, track: Track) {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const start = Math.max(
      0,
      Math.floor((event.clientX - rect.left) / zoom / bar) * bar,
    );
    const id = crypto.randomUUID();
    onEdit(
      createClip(project, track.id, {
        id,
        name: "Clip mới",
        start_beat: start,
        length_beats: bar * 2,
        notes: [],
      }),
      { trackId: track.id, clipId: id, noteIds: [] },
    );
  }
  return (
    <section className="arrangement panel" aria-label="Arrangement">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">KHÔNG GIAN SÁNG TÁC</span>
          <h2>
            Bản phối{" "}
            <span>
              {project.tracks.length} track ·{" "}
              {Math.ceil(projectEnd(project) / bar)} ô nhịp
            </span>
          </h2>
        </div>
        <div className="toolbar">
          <label>
            Snap{" "}
            <select
              aria-label="Snap arrangement"
              value={snap}
              onChange={(e) => setSnap(Number(e.target.value))}
            >
              <option value="1">1/4</option>
              <option value="0.5">1/8</option>
              <option value="0.25">1/16</option>
              <option value="0">Tắt</option>
            </select>
          </label>
          <label>
            Zoom{" "}
            <input
              aria-label="Zoom arrangement"
              type="range"
              min="12"
              max="64"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </label>
          <button onClick={onAddTrack}>＋ Track</button>
        </div>
      </div>
      <div className="arrangement-scroll">
        <div className="arrangement-inner" style={{ width: width + 244 }}>
          <div className="ruler-row">
            <div className="track-label">TRACK / NHẠC CỤ</div>
            <div
              className="ruler"
              style={{ width }}
              onClick={(e) =>
                onSeek(
                  Math.max(
                    0,
                    (e.clientX - e.currentTarget.getBoundingClientRect().left) /
                      zoom,
                  ),
                )
              }
              title="Bấm thước để đặt vị trí phát"
            >
              {Array.from({ length: Math.ceil(end / bar) }, (_, i) => (
                <span
                  key={i}
                  style={{ left: i * bar * zoom, width: bar * zoom }}
                >
                  {i + 1}
                </span>
              ))}
              <i className="playhead" style={{ left: position * zoom }} />
            </div>
          </div>
          {project.tracks.map((track, index) => (
            <div
              className="track-row"
              key={track.id}
              style={
                {
                  "--track-color": COLORS[index % COLORS.length],
                } as React.CSSProperties
              }
            >
              <div
                className={`track-header ${selection.trackId === track.id ? "active" : ""}`}
                onClick={() =>
                  onSelection({
                    trackId: track.id,
                    clipId: track.clips[0]?.id ?? null,
                    noteIds: [],
                  })
                }
              >
                <div className="track-title">
                  <b className="track-number">
                    {String(index + 1).padStart(2, "0")}
                  </b>
                  <input
                    aria-label={`Tên track ${index + 1}`}
                    key={`${track.id}-${track.name}`}
                    defaultValue={track.name}
                    onBlur={(e) => {
                      if (
                        e.target.value.trim() &&
                        e.target.value !== track.name
                      )
                        editTrack(track.id, (t) => {
                          t.name = e.target.value;
                        });
                    }}
                  />
                  <button
                    className="icon-button"
                    title="Xóa track"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(removeTrack(project, track.id), {
                        trackId: null,
                        clipId: null,
                        noteIds: [],
                      });
                    }}
                  >
                    ×
                  </button>
                </div>
                <div className="track-options">
                  <label title="General MIDI program, từ 0 đến 127">
                    GM{" "}
                    <input
                      aria-label={`Program ${track.name}`}
                      type="number"
                      min="0"
                      max="127"
                      value={track.program}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isInteger(n) && n >= 0 && n <= 127)
                          editTrack(track.id, (t) => {
                            t.program = n;
                          });
                      }}
                    />
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={track.is_drum}
                      onChange={(e) =>
                        editTrack(track.id, (t) => {
                          t.is_drum = e.target.checked;
                        })
                      }
                    />
                    Trống
                  </label>
                  <button
                    className={track.mute ? "toggled" : ""}
                    title="Tắt tiếng"
                    onClick={() =>
                      editTrack(track.id, (t) => {
                        t.mute = !t.mute;
                      })
                    }
                  >
                    M
                  </button>
                  <button
                    className={track.solo ? "toggled" : ""}
                    title="Nghe riêng"
                    onClick={() =>
                      editTrack(track.id, (t) => {
                        t.solo = !t.solo;
                      })
                    }
                  >
                    S
                  </button>
                </div>
                <div className="track-bottom">
                  <label title="Âm lượng track (dB)">
                    dB{" "}
                    <input
                      aria-label={`Volume ${track.name}`}
                      type="number"
                      min="-60"
                      max="6"
                      step="1"
                      value={track.volume_db}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (v >= -60 && v <= 6)
                          editTrack(track.id, (t) => {
                            t.volume_db = v;
                          });
                      }}
                    />
                  </label>
                  <button
                    title="Đưa track lên"
                    disabled={index === 0}
                    onClick={() =>
                      onEdit(reorderTrack(project, track.id, index - 1))
                    }
                  >
                    ↑
                  </button>
                  <button
                    title="Đưa track xuống"
                    disabled={index === project.tracks.length - 1}
                    onClick={() =>
                      onEdit(reorderTrack(project, track.id, index + 1))
                    }
                  >
                    ↓
                  </button>
                </div>
              </div>
              <div
                className="track-lane"
                style={{
                  width,
                  backgroundSize: `${zoom}px 100%, ${bar * zoom}px 100%`,
                }}
                onDoubleClick={(e) => createAt(e, track)}
                title="Bấm đúp vùng trống để tạo clip"
              >
                {track.clips.map((clip) => (
                  <button
                    key={clip.id}
                    className={`music-clip ${selection.clipId === clip.id ? "selected" : ""} ${track.mute ? "muted" : ""}`}
                    style={{
                      left:
                        (drag?.id === clip.id ? drag.start : clip.start_beat) *
                        zoom,
                      width: Math.max(20, clip.length_beats * zoom - 2),
                    }}
                    onPointerDown={(e) => startDrag(e, track, clip)}
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={() => {
                      gesture.current = null;
                      setDrag(null);
                    }}
                    title={`${clip.name} · ${clip.notes.length} note · kéo để di chuyển`}
                  >
                    <span>{clip.name}</span>
                    <svg
                      viewBox={`0 0 ${clip.length_beats * 10} 45`}
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      {clip.notes.map((note) => (
                        <rect
                          key={note.id}
                          x={note.start_beat * 10}
                          y={40 - (note.pitch % 36)}
                          width={Math.max(0.5, note.length_beat * 10)}
                          height="2"
                        />
                      ))}
                    </svg>
                  </button>
                ))}
                <i className="playhead" style={{ left: position * zoom }} />
              </div>
            </div>
          ))}
          {!project.tracks.length && (
            <div className="empty">Thêm track để bắt đầu sáng tác.</div>
          )}
        </div>
      </div>
      <div className="arrangement-footer">
        <span>
          ↔ Kéo clip để sắp xếp · Bấm đúp vùng trống để tạo clip · Chọn clip để
          chỉnh note phía dưới
        </span>
        <span>BEAT / QUARTER NOTE</span>
      </div>
    </section>
  );
}
