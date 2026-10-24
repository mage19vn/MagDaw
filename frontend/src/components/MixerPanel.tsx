import { useDaw, trackColor } from "../state/store";

export default function MixerPanel() {
  const project = useDaw((s) => s.project);
  const setVolumeAction = useDaw((s) => s.setVolumeAction);
  const setPanAction = useDaw((s) => s.setPanAction);
  const setMuteAction = useDaw((s) => s.setMuteAction);
  const setSoloAction = useDaw((s) => s.setSoloAction);

  if (!project) return null;

  return (
    <div className="mixer">
      {project.tracks.map((track, index) => (
        <div key={track.id} className="mixer-strip" style={{ borderTop: `3px solid ${trackColor(index)}` }}>
          <strong className="mixer-name">{track.name}</strong>
          <label title="Âm lượng track (dB)">
            Vol {track.volume_db.toFixed(1)} dB
            <input
              type="range"
              min={-60}
              max={12}
              step={0.5}
              value={track.volume_db}
              onChange={(e) => setVolumeAction(track.id, Number(e.target.value))}
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
            />
          </label>
          <div className="mixer-buttons">
            <button
              type="button"
              title="Tắt tiếng track"
              className={track.mute ? "active danger" : ""}
              onClick={() => setMuteAction(track.id, !track.mute)}
            >
              Mute
            </button>
            <button
              type="button"
              title="Solo track"
              className={track.solo ? "active" : ""}
              onClick={() => setSoloAction(track.id, !track.solo)}
            >
              Solo
            </button>
          </div>
        </div>
      ))}
      {project.tracks.length === 0 && (
        <p className="hint">Chưa có track nào. Bấm “+ Track” ở danh sách track.</p>
      )}
    </div>
  );
}
