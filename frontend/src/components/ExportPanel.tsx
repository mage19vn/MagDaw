import { useState } from "react";
import { useDaw } from "../state/store";

const API_BASE = import.meta.env.DEV
  ? `http://${window.location.hostname}:8000`
  : "";

interface ExportResult {
  midi: string;
  preview_wav: string;
  final_wav: string;
  warnings: string[];
  peaks: { preview_db: number; final_db: number };
  duration_seconds: number;
  sample_rate: number;
}

export default function ExportPanel() {
  const project = useDaw((s) => s.project);
  const setNotice = useDaw((s) => s.setNotice);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);

  if (!project) return null;

  const runExport = async () => {
    setExporting(true);
    setResult(null);
    try {
      const response = await fetch(`${API_BASE}/api/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(project),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail ?? "Export thất bại.");
      }
      setResult(data as ExportResult);
      setNotice("Export xong. Bấm nút tải file bên dưới.", "success");
    } catch (error) {
      setNotice(
        `Export thất bại: ${error instanceof Error ? error.message : "lỗi không xác định"}. Hãy kiểm tra backend đang chạy ở cổng 8000 rồi thử lại — project của bạn vẫn còn nguyên.`,
        "error",
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="export-panel">
      <p>
        Xuất MIDI và WAV từ project hiện tại. MIDI chỉ chứa note, track,
        program và tempo — <strong>không chứa hiệu ứng âm thanh</strong>
        (mixer, reverb, limiter không nằm trong file MIDI).
      </p>
      <button
        type="button"
        title="Xuất MIDI và hai file WAV qua backend"
        onClick={() => void runExport()}
        disabled={exporting}
      >
        {exporting ? "Đang xuất..." : "Xuất MIDI + WAV"}
      </button>
      {result && (
        <div className="export-result">
          <p>
            Thời lượng: {result.duration_seconds.toFixed(1)} giây • Sample
            rate: {result.sample_rate} Hz • Peak preview:{" "}
            {result.peaks.preview_db.toFixed(1)} dBFS • Peak final:{" "}
            {result.peaks.final_db.toFixed(1)} dBFS
          </p>
          {result.warnings.map((warning, index) => (
            <p key={index} className="warning">
              ⚠ {warning}
            </p>
          ))}
          <div className="download-row">
            <a href={`${API_BASE}/api/download/${result.midi}`} download>
              Tải {result.midi} (MIDI)
            </a>
            <a href={`${API_BASE}/api/download/${result.preview_wav}`} download>
              Tải {result.preview_wav} (preview, chưa qua master)
            </a>
            <a href={`${API_BASE}/api/download/${result.final_wav}`} download>
              Tải {result.final_wav} (final, đã qua master)
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
