import { useRef } from "react";
import { loadProject, readAutosave, saveProject } from "../features/project";
import { useDaw } from "../state/store";

export default function TopBar({
  onRestoreAutosave,
  autosaveAvailable,
}: {
  onRestoreAutosave: () => void;
  autosaveAvailable: boolean;
}) {
  const project = useDaw((s) => s.project);
  const dirty = useDaw((s) => s.dirty);
  const setProject = useDaw((s) => s.setProject);
  const setNotice = useDaw((s) => s.setNotice);
  const applyEdit = useDaw((s) => s.applyEdit);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!project) return null;

  const openFile = async (file: File) => {
    const text = await file.text();
    try {
      const loaded = loadProject(text);
      setProject(loaded, false);
      setNotice(`Đã mở project "${loaded.name}".`, "success");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Không mở được file.",
        "error",
      );
    }
  };

  return (
    <div className="topbar">
      <strong className="logo">DAW Studio</strong>
      <label title="Tên project">
        <input
          type="text"
          aria-label="Tên project"
          value={project.name}
          onChange={(e) =>
            applyEdit({ ...project, name: e.target.value })
          }
        />
      </label>
      {dirty && <span className="dirty" title="Project có thay đổi chưa lưu">• Chưa lưu</span>}
      <button
        type="button"
        title="Lưu project thành file JSON và tải về máy"
        onClick={() => {
          saveProject(project);
          setNotice("Đã tải file project JSON về máy.", "success");
        }}
      >
        Lưu project (.json)
      </button>
      <button
        type="button"
        title="Mở file project JSON"
        onClick={() => fileRef.current?.click()}
      >
        Mở project
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void openFile(file);
          e.target.value = "";
        }}
      />
      {autosaveAvailable && (
        <button
          type="button"
          title="Khôi phục bản autosave trong trình duyệt"
          onClick={onRestoreAutosave}
        >
          Khôi phục autosave
        </button>
      )}
      <span className="hint">
        Autosave: {readAutosave() ? "đã lưu trong trình duyệt" : "chưa có"}
      </span>
    </div>
  );
}
