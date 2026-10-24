import type { Project } from "../domain/types";
export interface ExportJob {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  stage: string;
  progress: number;
  warnings: string[];
  error: string | null;
  files: Record<string, string>;
  analysis?: Record<string, unknown>;
}
export interface ExportService {
  start(project: Project): Promise<ExportJob>;
  get(id: string): Promise<ExportJob>;
}
async function readResponse(response: Response): Promise<ExportJob> {
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new Error(
      body && typeof body === "object" && "detail" in body
        ? JSON.stringify(body.detail)
        : `Máy xuất nhạc trả lỗi ${response.status}.`,
    );
  }
  return response.json() as Promise<ExportJob>;
}
export class LocalExportService implements ExportService {
  async start(project: Project): Promise<ExportJob> {
    return readResponse(
      await fetch("/api/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(structuredClone(project)),
      }),
    );
  }
  async get(id: string): Promise<ExportJob> {
    return readResponse(await fetch(`/api/exports/${encodeURIComponent(id)}`));
  }
}
