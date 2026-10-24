import { useDaw, trackColor } from "../state/store";

const GM_NAMES: Record<number, string> = {
  0: "Acoustic Grand Piano",
  32: "Acoustic Bass",
  48: "String Ensemble 1",
};

export default function TrackList() {
  const project = useDaw((s) => s.project);
  const selectedTrackId = useDaw((s) => s.selectedTrackId);
  const addTrackAction = useDaw((s) => s.addTrackAction);
  const removeTrackAction = useDaw((s) => s.removeTrackAction);
  const renameTrackAction = useDaw((s) => s.renameTrackAction);
  const moveTrackAction = useDaw((s) => s.moveTrackAction);
  const setInstrumentAction = useDaw((s) => s.setInstrumentAction);
  const setVolumeAction = useDaw((s) => s.setVolumeAction);
  const setPanAction = useDaw((s) => s.setPanAction);
  const setMuteAction = useDaw((s) => s.setMuteAction);
  const setSoloAction = useDaw((s) => s.setSoloAction);
  const selectClip = useDaw((s) => s.selectClip);

  if (!project) return null;

  return (
    <div className="track-list">
      <div className="track-list-head">
        <strong>Track</strong>
        <button type="button" title="Thêm track" onClick={addTrackAction}>
          + Track
        </button>
      </div>
      {project.tracks.map((track, index) => {
        const color = trackColor(index);
        const selected = track.id === selectedTrackId;
        return (
          <div
            key={track.id}
            className={`track-header ${selected ? "selected" : ""} ${track.mute ? "muted" : ""}`}
            style={{ borderLeft: `4px solid ${color}` }}
            onClick={() => selectClip(track.id, track.clips[0]?.id ?? null)}
          >
            <div className="track-header-row">
              <input
                type="text"
                aria-label="Tên track"
                value={track.name}
                onChange={(e) => renameTrackAction(track.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              <button
                type="button"
                title="Dời track lên"
                onClick={(e) => {
                  e.stopPropagation();
                  moveTrackAction(track.id, -1);
                }}
              >
                ↑
              </button>
              <button
                type="button"
                title="Dời track xuống"
                onClick={(e) => {
                  e.stopPropagation();
                  moveTrackAction(track.id, 1);
                }}
              >
                ↓
              </button>
              <button
                type="button"
                title="Xóa track"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTrackAction(track.id);
                }}
              >
                ✕
              </button>
            </div>
            <label title="Nhạc cụ General MIDI (program 0–127)">
              Nhạc cụ
              <input
                type="number"
                min={0}
                max={127}
                value={track.program}
                disabled={track.is_drum}
                onChange={(e) =>
                  setInstrumentAction(track.id, Number(e.target.value), track.is_drum)
                }
                onClick={(e) => e.stopPropagation()}
              />
              <span className="gm-name">
                {track.is_drum
                  ? "Drum Kit"
                  : (GM_NAMES[track.program] ?? `Program ${track.program}`)}
              </span>
            </label>
            <label title="Chuyển track thành drum track">
              <input
                type="checkbox"
                checked={track.is_drum}
                onChange={(e) =>
                  setInstrumentAction(track.id, track.program, e.target.checked)
                }
                onClick={(e) => e.stopPropagation()}
              />
              Drum track
            </label>
            <label title="Âm lượng track (dB)">
              Vol {track.volume_db.toFixed(1)} dB
              <input
                type="range"
                min={-60}
                max={12}
                step={0.5}
                value={track.volume_db}
                onChange={(e) => setVolumeAction(track.id, Number(e.target.value))}
                onClick={(e) => e.stopPropagation()}
              />
            </label>
            <label title="Pan trái/phải (−1..1)">
              Pan {track.pan.toFixed(2)}
              <input
                type="range"
                min={-1}
                max={1}
                step={0.05}
                value={track.pan}
                onChange={(e) => setPanAction(track.id, Number(e.target.value))}
                onClick={(e) => e.stopPropagation()}
              />
            </label>
            <div className="track-header-row">
              <button
                type="button"
                title="Tắt tiếng track"
                className={track.mute ? "active danger" : ""}
                onClick={(e) => {
                  e.stopPropagation();
                  setMuteAction(track.id, !track.mute);
                }}
              >
                M
              </button>
              <button
                type="button"
                title="Solo track"
                className={track.solo ? "active" : ""}
                onClick={(e) => {
                  e.stopPropagation();
                  setSoloAction(track.id, !track.solo);
                }}
              >
                S
              </button>
              <span className="clip-count">
                {track.clips.length} clip
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
