import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_MASTER,
  type Master,
  type Project,
  type Track,
} from "../../domain/types";
import {
  updateMaster,
  updateMasterEffect,
  updateTrackMixer,
} from "../../domain/commands";
import { EFFECT_CATALOG } from "../../domain/effects";
import "./Mixer.css";

interface MeterValues {
  master: number;
  tracks: Record<string, number>;
}

interface MixerProps {
  project: Project;
  onEdit: (project: Project) => void;
  meters: MeterValues;
}

interface RangeControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  precision?: number;
  onCommit: (value: number) => void;
}

function parameterRange(
  effectId: keyof Master,
  parameterId: string,
): Pick<RangeControlProps, "min" | "max" | "unit"> {
  const parameter = EFFECT_CATALOG.find(
    (effect) => effect.id === effectId,
  )?.parameters.find((item) => item.id === parameterId);
  if (!parameter)
    throw new Error("Không tìm thấy tham số hiệu ứng trong danh mục.");
  return { min: parameter.min, max: parameter.max, unit: parameter.unit };
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  unit = "",
  precision = 1,
  onCommit,
}: RangeControlProps) {
  const [draft, setDraft] = useState(value);
  const editing = useRef(false);
  const draftValue = useRef(value);
  const committedValue = useRef(value);

  useEffect(() => {
    committedValue.current = value;
    if (!editing.current) {
      draftValue.current = value;
      setDraft(value);
    }
  }, [value]);

  function commit() {
    editing.current = false;
    if (draftValue.current !== committedValue.current) {
      committedValue.current = draftValue.current;
      onCommit(draftValue.current);
    }
  }

  return (
    <label className="mixer-range">
      <span>
        {label}
        <output>
          {draft.toFixed(precision)}
          {unit && ` ${unit}`}
        </output>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={draft}
        title={`${label}: ${min} – ${max} ${unit}; mặc định theo từng thiết bị`}
        onPointerDown={() => {
          editing.current = true;
        }}
        onChange={(event) => {
          editing.current = true;
          draftValue.current = Number(event.target.value);
          setDraft(draftValue.current);
        }}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        onPointerCancel={() => {
          editing.current = false;
          draftValue.current = value;
          setDraft(value);
        }}
      />
    </label>
  );
}

function PeakMeter({ amplitude, label }: { amplitude: number; label: string }) {
  const finiteAmplitude = Number.isFinite(amplitude)
    ? Math.max(0, amplitude)
    : 0;
  const decibels =
    finiteAmplitude > 0 ? 20 * Math.log10(finiteAmplitude) : -Infinity;
  const percentage = Math.min(100, Math.max(0, ((decibels + 60) / 60) * 100));
  const text = decibels > -60 ? `${decibels.toFixed(1)} dBFS` : "−∞ dBFS";
  return (
    <div className="mixer-meter" title={`${label}: ${text}`}>
      <div
        className="mixer-meter-rail"
        role="meter"
        aria-label={label}
        aria-valuemin={-60}
        aria-valuemax={0}
        aria-valuenow={Math.min(0, Math.max(-60, decibels))}
        aria-valuetext={text}
      >
        <span
          style={{ width: `${percentage}%` }}
          className={decibels >= 0 ? "mixer-meter-clip" : ""}
        />
      </div>
      <output>{text}</output>
    </div>
  );
}

export function Mixer({ project, onEdit, meters }: MixerProps) {
  const [collapsed, setCollapsed] = useState(false);
  const soloActive = project.tracks.some((track) => track.solo);

  function editTrack(
    trackId: string,
    changes: Partial<Pick<Track, "volume_db" | "pan" | "mute" | "solo">>,
  ) {
    onEdit(updateTrackMixer(project, trackId, changes));
  }

  function editMaster(changes: Partial<Master>) {
    onEdit(updateMaster(project, changes));
  }

  function editCompressor(changes: Partial<Master["compressor"]>) {
    onEdit(updateMasterEffect(project, "compressor", changes));
  }

  function editReverb(changes: Partial<Master["reverb"]>) {
    onEdit(updateMasterEffect(project, "reverb", changes));
  }

  function editLimiter(changes: Partial<Master["limiter"]>) {
    onEdit(updateMasterEffect(project, "limiter", changes));
  }

  return (
    <section className="mixer-panel" aria-label="Mixer và master">
      <header className="mixer-panel-header">
        <div>
          <span className="mixer-eyebrow">BÀN TRỘN</span>
          <h2>Mixer &amp; master</h2>
        </div>
        <span className="mixer-live-label">Mức đỉnh âm thanh thực</span>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
        >
          {collapsed ? "Mở rộng" : "Thu gọn"}
        </button>
      </header>
      {!collapsed && (
        <div className="mixer-content">
          <div className="mixer-tracks">
            {project.tracks.length === 0 && (
              <p className="mixer-empty">
                Thêm track để bắt đầu trộn âm thanh.
              </p>
            )}
            {project.tracks.map((track, index) => {
              const audible = !track.mute && (!soloActive || track.solo);
              return (
                <article
                  className={`mixer-strip ${audible ? "" : "mixer-strip-muted"}`}
                  key={track.id}
                >
                  <div className="mixer-strip-heading">
                    <span className="mixer-track-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <strong title={track.name}>{track.name}</strong>
                  </div>
                  <div className="mixer-switches">
                    <button
                      type="button"
                      className={track.mute ? "mixer-mute-active" : ""}
                      aria-label={`Tắt tiếng ${track.name}`}
                      aria-pressed={track.mute}
                      title="Mute luôn chặn track, kể cả khi solo"
                      onClick={() => editTrack(track.id, { mute: !track.mute })}
                    >
                      M
                    </button>
                    <button
                      type="button"
                      className={track.solo ? "mixer-solo-active" : ""}
                      aria-label={`Solo ${track.name}`}
                      aria-pressed={track.solo}
                      title="Khi có solo, chỉ nghe các track solo không mute"
                      onClick={() => editTrack(track.id, { solo: !track.solo })}
                    >
                      S
                    </button>
                    <span>{audible ? "Đang mở" : "Đã chặn"}</span>
                  </div>
                  <RangeControl
                    label={`Âm lượng ${track.name}`}
                    value={track.volume_db}
                    min={-60}
                    max={6}
                    step={0.1}
                    unit="dB"
                    onCommit={(volume_db) => editTrack(track.id, { volume_db })}
                  />
                  <RangeControl
                    label={`Pan ${track.name}`}
                    value={track.pan}
                    min={-1}
                    max={1}
                    step={0.01}
                    precision={2}
                    onCommit={(pan) => editTrack(track.id, { pan })}
                  />
                  <div className="mixer-pan-labels">
                    <span>Trái −1</span>
                    <span>Giữa 0</span>
                    <span>Phải +1</span>
                  </div>
                  <PeakMeter
                    label={`Mức đỉnh ${track.name}`}
                    amplitude={meters.tracks[track.id] ?? 0}
                  />
                  <small className="mixer-track-defaults">
                    Track mới: −9 dB · pan 0
                  </small>
                </article>
              );
            })}
          </div>
          <div className="mixer-master">
            <div className="mixer-master-heading">
              <div>
                <span className="mixer-eyebrow">ĐẦU RA</span>
                <h3>Master</h3>
              </div>
              <PeakMeter label="Mức đỉnh master" amplitude={meters.master} />
            </div>
            <p className="mixer-chain">
              Gain <span>→</span> Compressor <span>→</span> Reverb{" "}
              <span>→</span> Limiter
            </p>
            <div className="mixer-effects">
              <article
                className={`mixer-effect ${project.master.gain_bypass ? "mixer-effect-bypassed" : ""}`}
              >
                <header>
                  <strong>Gain</strong>
                  <button
                    type="button"
                    title="Đặt gain về mặc định 0 dB"
                    onClick={() =>
                      editMaster({
                        gain_db: DEFAULT_MASTER.gain_db,
                        gain_bypass: false,
                      })
                    }
                  >
                    Đặt lại
                  </button>
                </header>
                <label className="mixer-bypass">
                  <input
                    type="checkbox"
                    checked={project.master.gain_bypass}
                    onChange={(event) =>
                      editMaster({ gain_bypass: event.target.checked })
                    }
                  />{" "}
                  Bỏ qua gain
                </label>
                <RangeControl
                  label="Master gain"
                  value={project.master.gain_db}
                  {...parameterRange("gain_db", "gain_db")}
                  step={0.1}
                  onCommit={(gain_db) => editMaster({ gain_db })}
                />
                <small>Mặc định 0 dB · không tăng gain sau limiter</small>
              </article>
              <article
                className={`mixer-effect ${project.master.compressor.bypass ? "mixer-effect-bypassed" : ""}`}
              >
                <header>
                  <strong>Compressor</strong>
                  <button
                    type="button"
                    title="Khôi phục compressor mặc định"
                    onClick={() =>
                      editMaster({
                        compressor: { ...DEFAULT_MASTER.compressor },
                      })
                    }
                  >
                    Đặt lại
                  </button>
                </header>
                <label className="mixer-bypass">
                  <input
                    type="checkbox"
                    checked={project.master.compressor.bypass}
                    onChange={(event) =>
                      editCompressor({ bypass: event.target.checked })
                    }
                  />{" "}
                  Bỏ qua compressor
                </label>
                <RangeControl
                  label="Ngưỡng compressor"
                  value={project.master.compressor.threshold_db}
                  {...parameterRange("compressor", "threshold_db")}
                  step={1}
                  precision={0}
                  onCommit={(threshold_db) => editCompressor({ threshold_db })}
                />
                <RangeControl
                  label="Tỉ lệ compressor"
                  value={project.master.compressor.ratio}
                  {...parameterRange("compressor", "ratio")}
                  step={0.1}
                  onCommit={(ratio) => editCompressor({ ratio })}
                />
                <RangeControl
                  label="Attack compressor"
                  value={project.master.compressor.attack_ms}
                  {...parameterRange("compressor", "attack_ms")}
                  step={0.1}
                  onCommit={(attack_ms) => editCompressor({ attack_ms })}
                />
                <RangeControl
                  label="Release compressor"
                  value={project.master.compressor.release_ms}
                  {...parameterRange("compressor", "release_ms")}
                  step={1}
                  precision={0}
                  onCommit={(release_ms) => editCompressor({ release_ms })}
                />
                <small>Mặc định −18 dB · 3:1 · 10 / 100 ms</small>
              </article>
              <article
                className={`mixer-effect ${project.master.reverb.bypass ? "mixer-effect-bypassed" : ""}`}
              >
                <header>
                  <strong>Reverb</strong>
                  <button
                    type="button"
                    title="Khôi phục reverb mặc định"
                    onClick={() =>
                      editMaster({ reverb: { ...DEFAULT_MASTER.reverb } })
                    }
                  >
                    Đặt lại
                  </button>
                </header>
                <label className="mixer-bypass">
                  <input
                    type="checkbox"
                    checked={project.master.reverb.bypass}
                    onChange={(event) =>
                      editReverb({ bypass: event.target.checked })
                    }
                  />{" "}
                  Bỏ qua reverb
                </label>
                <RangeControl
                  label="Reverb wet"
                  value={project.master.reverb.wet}
                  {...parameterRange("reverb", "wet")}
                  step={0.01}
                  precision={2}
                  onCommit={(wet) => editReverb({ wet })}
                />
                <RangeControl
                  label="Kích thước phòng"
                  value={project.master.reverb.room_size}
                  {...parameterRange("reverb", "room_size")}
                  step={0.01}
                  precision={2}
                  onCommit={(room_size) => editReverb({ room_size })}
                />
                <small>Mặc định wet 0,20 · phòng 0,50</small>
              </article>
              <article
                className={`mixer-effect ${project.master.limiter.bypass ? "mixer-effect-bypassed" : ""}`}
              >
                <header>
                  <strong>Limiter</strong>
                  <button
                    type="button"
                    title="Khôi phục limiter mặc định"
                    onClick={() =>
                      editMaster({ limiter: { ...DEFAULT_MASTER.limiter } })
                    }
                  >
                    Đặt lại
                  </button>
                </header>
                <label className="mixer-bypass">
                  <input
                    type="checkbox"
                    checked={project.master.limiter.bypass}
                    onChange={(event) =>
                      editLimiter({ bypass: event.target.checked })
                    }
                  />{" "}
                  Bỏ qua limiter
                </label>
                <RangeControl
                  label="Ceiling limiter"
                  value={project.master.limiter.ceiling_db}
                  {...parameterRange("limiter", "ceiling_db")}
                  step={0.1}
                  onCommit={(ceiling_db) => editLimiter({ ceiling_db })}
                />
                <small>Mặc định −1 dBFS · cuối chuỗi</small>
              </article>
            </div>
            <p className="mixer-adapter-note">
              Âm sắc và độ vang khi xuất Python có thể khác bản nghe Tone.js.
              Nghe file final sau khi xuất để đánh giá bản giao; meter không đo
              LUFS.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
