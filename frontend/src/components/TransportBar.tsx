import { useDaw } from "../state/store";
import { formatBarBeat } from "../utils/music";

export default function TransportBar() {
  const project = useDaw((s) => s.project);
  const playing = useDaw((s) => s.playing);
  const playheadBeat = useDaw((s) => s.playheadBeat);
  const metronome = useDaw((s) => s.metronome);
  const play = useDaw((s) => s.play);
  const pause = useDaw((s) => s.pause);
  const stop = useDaw((s) => s.stop);
  const seek = useDaw((s) => s.seek);
  const setBpm = useDaw((s) => s.setBpm);
  const setMetronome = useDaw((s) => s.setMetronome);
  const setLoopAction = useDaw((s) => s.setLoopAction);
  const undo = useDaw((s) => s.undo);
  const redo = useDaw((s) => s.redo);
  const past = useDaw((s) => s.past);
  const future = useDaw((s) => s.future);

  if (!project) return null;
  const beatsPerBar = project.time_signature[0];
  const loop = project.loop_range;

  return (
    <div className="transport">
      <button
        type="button"
        title="Undo (Ctrl+Z)"
        onClick={undo}
        disabled={past.length === 0}
      >
        ↩
      </button>
      <button
        type="button"
        title="Redo (Ctrl+Y)"
        onClick={redo}
        disabled={future.length === 0}
      >
        ↪
      </button>
      <span className="transport-sep" />
      <button
        type="button"
        title="Phát"
        className={playing ? "active" : ""}
        onClick={() => void play()}
      >
        ▶
      </button>
      <button type="button" title="Tạm dừng (giữ vị trí)" onClick={pause}>
        ⏸
      </button>
      <button type="button" title="Dừng và về đầu" onClick={stop}>
        ⏹
      </button>
      <label title="Tốc độ (BPM)">
        BPM
        <input
          type="number"
          min={20}
          max={300}
          value={project.bpm}
          onChange={(e) => {
            const value = Number(e.target.value);
            if (value > 0) setBpm(value);
          }}
        />
      </label>
      <span className="position" title="Vị trí: ô nhịp:phách">
        {formatBarBeat(playheadBeat, beatsPerBar)}
      </span>
      <button
        type="button"
        title="Về đầu"
        onClick={() => seek(0)}
      >
        ⏮
      </button>
      <span className="transport-sep" />
      <label title="Bật/tắt metronome">
        <input
          type="checkbox"
          checked={metronome}
          onChange={(e) => setMetronome(e.target.checked)}
        />
        Metronome
      </label>
      <label title="Bật/tắt loop theo vùng chọn">
        <input
          type="checkbox"
          checked={loop.enabled}
          onChange={(e) =>
            setLoopAction(loop.start_beat, loop.end_beat, e.target.checked)
          }
        />
        Loop
      </label>
      <label title="Loop bắt đầu (beat)">
        Từ
        <input
          type="number"
          min={0}
          step={1}
          value={loop.start_beat}
          onChange={(e) =>
            setLoopAction(Number(e.target.value), loop.end_beat, loop.enabled)
          }
        />
      </label>
      <label title="Loop kết thúc (beat)">
        Đến
        <input
          type="number"
          min={0}
          step={1}
          value={loop.end_beat}
          onChange={(e) =>
            setLoopAction(loop.start_beat, Number(e.target.value), loop.enabled)
          }
        />
      </label>
    </div>
  );
}
