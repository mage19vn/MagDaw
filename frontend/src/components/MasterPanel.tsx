import { useEffect, useState } from "react";
import { getMasterPeak } from "../audio/engine";
import { useDaw } from "../state/store";

const DEFAULT_MASTER = {
  master_gain_db: 0,
  compressor_enabled: true,
  compressor_threshold_db: -18,
  compressor_ratio: 3,
  reverb_enabled: true,
  reverb_wet: 0.2,
  limiter_enabled: true,
  limiter_ceiling_db: -1,
};

export default function MasterPanel() {
  const project = useDaw((s) => s.project);
  const updateMasterAction = useDaw((s) => s.updateMasterAction);
  const [peak, setPeak] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPeak(getMasterPeak());
    }, 100);
    return () => clearInterval(timer);
  }, []);

  if (!project) return null;
  const master = project.master_settings;
  const peakDb = peak > 0 ? 20 * Math.log10(peak) : -Infinity;

  return (
    <div className="master">
      <div className="master-row">
        <strong>Master: Gain → Compressor → Reverb → Limiter</strong>
        <button
          type="button"
          title="Đặt lại master về mặc định"
          onClick={() => updateMasterAction(DEFAULT_MASTER)}
        >
          Reset mặc định
        </button>
      </div>
      <div className="master-grid">
        <label title="Gain tổng (dB)">
          Gain {master.master_gain_db.toFixed(1)} dB
          <input
            type="range"
            min={-24}
            max={12}
            step={0.5}
            value={master.master_gain_db}
            onChange={(e) =>
              updateMasterAction({ master_gain_db: Number(e.target.value) })
            }
          />
        </label>
        <label title="Bật/tắt compressor">
          <input
            type="checkbox"
            checked={master.compressor_enabled}
            onChange={(e) =>
              updateMasterAction({ compressor_enabled: e.target.checked })
            }
          />
          Compressor
        </label>
        <label title="Ngưỡng compressor (dB)">
          Threshold {master.compressor_threshold_db} dB
          <input
            type="range"
            min={-60}
            max={0}
            step={1}
            value={master.compressor_threshold_db}
            onChange={(e) =>
              updateMasterAction({
                compressor_threshold_db: Number(e.target.value),
              })
            }
            disabled={!master.compressor_enabled}
          />
        </label>
        <label title="Tỉ lệ nén compressor">
          Ratio {master.compressor_ratio}:1
          <input
            type="range"
            min={1}
            max={20}
            step={0.5}
            value={master.compressor_ratio}
            onChange={(e) =>
              updateMasterAction({ compressor_ratio: Number(e.target.value) })
            }
            disabled={!master.compressor_enabled}
          />
        </label>
        <label title="Bật/tắt reverb">
          <input
            type="checkbox"
            checked={master.reverb_enabled}
            onChange={(e) =>
              updateMasterAction({ reverb_enabled: e.target.checked })
            }
          />
          Reverb
        </label>
        <label title="Độ ướt reverb (wet 0–1, mặc định 0,2)">
          Wet {master.reverb_wet.toFixed(2)}
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={master.reverb_wet}
            onChange={(e) =>
              updateMasterAction({ reverb_wet: Number(e.target.value) })
            }
            disabled={!master.reverb_enabled}
          />
        </label>
        <label title="Bật/tắt limiter (luôn là effect cuối cùng)">
          <input
            type="checkbox"
            checked={master.limiter_enabled}
            onChange={(e) =>
              updateMasterAction({ limiter_enabled: e.target.checked })
            }
          />
          Limiter
        </label>
        <label title="Ceiling của limiter (dBFS, mặc định −1)">
          Ceiling {master.limiter_ceiling_db} dBFS
          <input
            type="range"
            min={-12}
            max={0}
            step={0.5}
            value={master.limiter_ceiling_db}
            onChange={(e) =>
              updateMasterAction({ limiter_ceiling_db: Number(e.target.value) })
            }
            disabled={!master.limiter_enabled}
          />
        </label>
      </div>
      <div className="meter" title="Peak meter từ dữ liệu âm thanh thực">
        <span>Peak master: </span>
        <div className="meter-bar">
          <div
            className="meter-fill"
            style={{ width: `${Math.min(100, peak * 100)}%` }}
          />
        </div>
        <span>{Number.isFinite(peakDb) ? `${peakDb.toFixed(1)} dBFS` : "−∞ dBFS"}</span>
      </div>
      <p className="hint">
        Lưu ý: bản nghe trực tiếp dùng effects của Tone.js, bản xuất dùng
        pedalboard nên hai bản có thể nghe khác nhau đôi chút, không giống
        tuyệt đối. Không đo LUFS ở đây.
      </p>
    </div>
  );
}
