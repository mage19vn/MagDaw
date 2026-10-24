import type { Project } from "../domain/types";
import { validateProject } from "../domain/validation";

const AUTOSAVE_KEY = "magdaw.autosave.v1";
export interface AutosaveRecord {
  format_version: 1;
  saved_at: string;
  project: Project;
}
export interface ProjectRepository {
  parse(source: string): Project;
  serialize(project: Project): string;
  download(project: Project): void;
  saveAutosave(project: Project): AutosaveRecord;
  loadAutosave(): AutosaveRecord | null;
  clearAutosave(): void;
}
export class BrowserProjectRepository implements ProjectRepository {
  constructor(private readonly storage: Storage = localStorage) {}
  parse(source: string): Project {
    let parsed: unknown;
    try {
      parsed = JSON.parse(source);
    } catch {
      throw new Error(
        "Không đọc được JSON. Project hiện tại vẫn được giữ nguyên.",
      );
    }
    return validateProject(parsed);
  }
  serialize(project: Project): string {
    return JSON.stringify(validateProject(project), null, 2);
  }
  download(project: Project): void {
    const content = this.serialize(project);
    const url = URL.createObjectURL(
      new Blob([content], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.name.replace(/[\\/:*?"<>|]/g, "_")}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  saveAutosave(project: Project): AutosaveRecord {
    const record: AutosaveRecord = {
      format_version: 1,
      saved_at: new Date().toISOString(),
      project: validateProject(project),
    };
    try {
      this.storage.setItem(AUTOSAVE_KEY, JSON.stringify(record));
    } catch {
      throw new Error(
        "Không thể tự lưu trong trình duyệt. Hãy tải JSON để giữ bản nhạc.",
      );
    }
    return record;
  }
  loadAutosave(): AutosaveRecord | null {
    let stored: string | null;
    try {
      stored = this.storage.getItem(AUTOSAVE_KEY);
    } catch {
      throw new Error("Trình duyệt chặn quyền đọc bản tự lưu.");
    }
    if (!stored) return null;
    let input: unknown;
    try {
      input = JSON.parse(stored);
    } catch {
      throw new Error(
        "Bản tự lưu bị lỗi JSON. Project hiện tại vẫn được giữ nguyên.",
      );
    }
    if (
      typeof input !== "object" ||
      input === null ||
      !("format_version" in input) ||
      input.format_version !== 1 ||
      !("saved_at" in input) ||
      typeof input.saved_at !== "string" ||
      !("project" in input)
    )
      throw new Error("Định dạng bản tự lưu chưa được hỗ trợ.");
    return {
      format_version: 1,
      saved_at: input.saved_at,
      project: validateProject(input.project),
    };
  }
  clearAutosave(): void {
    try {
      this.storage.removeItem(AUTOSAVE_KEY);
    } catch {
      throw new Error("Không thể xóa bản tự lưu trong trình duyệt.");
    }
  }
}
