import { useCallback, useEffect, useRef, useState } from "react";
import type { EditorSnapshot, Project, Selection } from "../domain/types";
import { beatsPerBar, projectEnd } from "../domain/types";
import { validateProject } from "../domain/validation";
import {
  editProject,
  addTrack,
  newTrack,
  createClip,
  duplicateClip,
  deleteClip,
} from "../domain/commands";
import { ProjectHistory } from "../domain/history";
import { BrowserProjectRepository } from "../services/projectRepository";
import { LocalExportService } from "../services/exportService";
import type { ExportJob } from "../services/exportService";
import { ToneAudioEngine } from "../audio";
import { Arrangement } from "../features/arrangement/Arrangement";
import { PianoRoll } from "../features/piano-roll/PianoRoll";
import { Mixer } from "../features/mixer/Mixer";

const hostedPreview = import.meta.env.MODE === "preview";
const audio = new ToneAudioEngine();
const repository = new BrowserProjectRepository();
const exporter = new LocalExportService();
const emptySelection: Selection = { trackId: null, clipId: null, noteIds: [] };
function initialSelection(project: Project): Selection {
  return {
    trackId: project.tracks[0]?.id ?? null,
    clipId: project.tracks[0]?.clips[0]?.id ?? null,
    noteIds: [],
  };
}
function message(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Đã xảy ra lỗi không xác định.";
}

export function App() {
  const [snapshot, setSnapshot] = useState<EditorSnapshot | null>(null);
  const history = useRef<ProjectHistory | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState("");
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [metronome, setMetronome] = useState(false);
  const [meters, setMeters] = useState({
    master: 0,
    tracks: {} as Record<string, number>,
  });
  const [mixerOpen, setMixerOpen] = useState(false);
  const [job, setJob] = useState<ExportJob | null>(null);
  const [exportStarting, setExportStarting] = useState(false);
  const [recovery, setRecovery] = useState<Project | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const project = snapshot?.project;
  const installProject = useCallback((next: Project, markSaved = true) => {
    audio.stop();
    setPlaying(false);
    setPosition(0);
    const state = { project: next, selection: initialSelection(next) };
    history.current = new ProjectHistory(state);
    setSnapshot(state);
    setSaved(markSaved ? JSON.stringify(next) : "");
    setError("");
    setNotice("");
  }, []);
  useEffect(() => {
    let live = true;
    fetch("/sample-project.json")
      .then((r) => {
        if (!r.ok)
          throw new Error(
            "Không đọc được bài mẫu. Hãy kiểm tra cài đặt ứng dụng.",
          );
        return r.json();
      })
      .then((input: unknown) => {
        if (live) installProject(validateProject(input));
      })
      .catch((e) => setError(message(e)));
    try {
      setRecovery(repository.loadAutosave()?.project ?? null);
    } catch (e) {
      setError(message(e));
    }
    return () => {
      live = false;
      audio.dispose();
    };
  }, [installProject]);
  useEffect(() => {
    if (!project) return;
    try {
      audio.setProject(project);
    } catch (e) {
      setError(message(e));
    }
    if (recovery) return;
    const timer = window.setTimeout(() => {
      try {
        repository.saveAutosave(project);
        setNotice("Đã tự lưu trên trình duyệt");
      } catch (e) {
        setError(message(e));
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [project, recovery]);
  useEffect(() => {
    let frame = 0;
    let lastMeter = 0;
    const draw = (now: number) => {
      setPosition(audio.getPosition());
      setPlaying(audio.isPlaying());
      if (now - lastMeter > 90) {
        setMeters(audio.getMeters());
        lastMeter = now;
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (!job || !["queued", "running"].includes(job.status)) return;
    let cancelled = false;
    const id = window.setTimeout(() => {
      exporter
        .get(job.id)
        .then((next) => {
          if (!cancelled) setJob(next);
        })
        .catch((e) => {
          if (!cancelled) {
            setError(message(e));
            setJob({ ...job, status: "failed", error: message(e) });
          }
        });
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [job]);
  const commit = useCallback((next: Project, selection?: Selection) => {
    try {
      if (!history.current) return;
      const current = history.current.current;
      const valid = validateProject(next);
      const chosen = selection ?? current.selection;
      const track = valid.tracks.find((t) => t.id === chosen.trackId);
      const clip = track?.clips.find((c) => c.id === chosen.clipId);
      const corrected: Selection = {
        trackId: track?.id ?? null,
        clipId: clip?.id ?? null,
        noteIds: chosen.noteIds.filter((id) =>
          clip?.notes.some((n) => n.id === id),
        ),
      };
      history.current.commit({ project: valid, selection: corrected });
      setSnapshot(history.current.current);
      setError("");
    } catch (e) {
      setError(message(e));
    }
  }, []);
  const select = useCallback((selection: Selection) => {
    if (!history.current) return;
    history.current.setSelection(selection);
    setSnapshot(history.current.current);
  }, []);
  const undo = useCallback(() => {
    if (history.current) setSnapshot(history.current.undo());
  }, []);
  const redo = useCallback(() => {
    if (history.current) setSnapshot(history.current.redo());
  }, []);
  const togglePlay = useCallback(async () => {
    try {
      if (audio.isPlaying()) audio.pause();
      else await audio.play();
      setPlaying(audio.isPlaying());
      setError("");
    } catch (e) {
      setError(`Không thể phát nhạc: ${message(e)}`);
    }
  }, []);
  const save = useCallback(() => {
    if (!history.current) return;
    try {
      repository.download(history.current.current.project);
      setSaved(JSON.stringify(history.current.current.project));
      setNotice("Đã tải project JSON");
    } catch (e) {
      setError(message(e));
    }
  }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest('input,textarea,select,[contenteditable="true"]')
      )
        return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        save();
      } else if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "z"
      ) {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "y"
      ) {
        event.preventDefault();
        redo();
      } else if (event.code === "Space") {
        event.preventDefault();
        void togglePlay();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [save, undo, redo, togglePlay]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (project && JSON.stringify(project) !== saved) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [project, saved]);
  async function openFile(file: File) {
    try {
      const next = repository.parse(await file.text());
      installProject(next);
    } catch (e) {
      setError(
        `Không mở được project: ${message(e)} Project hiện tại vẫn được giữ nguyên.`,
      );
    }
  }
  async function loadSample() {
    try {
      const r = await fetch("/sample-project.json");
      installProject(validateProject(await r.json()));
    } catch (e) {
      setError(message(e));
    }
  }
  async function startExport() {
    if (!project) return;
    setExportStarting(true);
    setError("");
    try {
      setJob(await exporter.start(project));
    } catch (e) {
      setError(
        `Không thể xuất nhạc: ${message(e)} Kiểm tra máy chủ cục bộ đang chạy.`,
      );
    } finally {
      setExportStarting(false);
    }
  }
  function addNewTrack() {
    if (!project) return;
    const track = newTrack();
    track.name = `Nhạc cụ ${project.tracks.length + 1}`;
    commit(addTrack(project, track), {
      trackId: track.id,
      clipId: null,
      noteIds: [],
    });
  }
  if (!snapshot || !project)
    return (
      <main className="loading-screen">
        <div className="brand-mark">M</div>
        <h1>MagDaw</h1>
        <p>{error || "Đang mở phòng thu…"}</p>
        {error && <button onClick={() => location.reload()}>Thử lại</button>}
      </main>
    );
  const { selection } = snapshot;
  const selectedTrack = project.tracks.find((t) => t.id === selection.trackId);
  const selectedClip = selectedTrack?.clips.find(
    (c) => c.id === selection.clipId,
  );
  const bar = beatsPerBar(project.time_signature);
  const barIndex = Math.floor(position / bar);
  const withinBar = (position % bar) / (4 / project.time_signature[1]);
  const updateSettings = (recipe: (draft: Project) => void) => {
    try {
      commit(editProject(project, recipe));
    } catch (e) {
      setError(message(e));
    }
  };
  return (
    <main className="studio">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark">M</div>
          <div>
            <b>MagDaw</b>
            <span>PHÒNG THU CỦA BẠN</span>
          </div>
        </div>
        <div className="project-identity">
          <input
            aria-label="Tên project"
            key={project.id + project.name}
            defaultValue={project.name}
            onBlur={(e) => {
              if (e.target.value.trim() && e.target.value !== project.name)
                updateSettings((p) => {
                  p.name = e.target.value;
                });
            }}
          />
          <span
            className={`save-state ${JSON.stringify(project) !== saved ? "dirty" : ""}`}
          >
            {JSON.stringify(project) !== saved
              ? "● Chưa lưu JSON"
              : "✓ Đã lưu JSON"}{" "}
            · {notice || "Làm việc cục bộ"}
          </span>
        </div>
        <nav>
          <button
            title="Mở bài mẫu 16 ô nhịp"
            onClick={() => void loadSample()}
          >
            Bài mẫu
          </button>
          <button onClick={() => fileInput.current?.click()}>Mở</button>
          <button onClick={save} title="Ctrl+S">
            Lưu project
          </button>
          <button
            className="primary"
            onClick={() => void startExport()}
            disabled={
              hostedPreview ||
              exportStarting ||
              (!!job && ["running", "queued"].includes(job.status))
            }
          >
            ↗ {exportStarting ? "Đang gửi…" : "Xuất nhạc"}
          </button>
        </nav>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void openFile(file);
            e.target.value = "";
          }}
        />
      </header>
      <section className="transport" aria-label="Điều khiển phát">
        <div className="transport-buttons">
          <button
            title="Dừng và về đầu"
            aria-label="Dừng"
            onClick={() => {
              audio.stop();
              setPlaying(false);
              setPosition(0);
            }}
          >
            ■
          </button>
          <button
            className={`play-button ${playing ? "toggled" : ""}`}
            title="Phát / tạm dừng (Space)"
            aria-label={playing ? "Tạm dừng" : "Phát"}
            onClick={() => void togglePlay()}
          >
            {playing ? "Ⅱ" : "▶"}
          </button>
          <button
            className={project.loop.enabled ? "toggled" : ""}
            title="Bật/tắt lặp"
            onClick={() =>
              updateSettings((p) => {
                p.loop.enabled = !p.loop.enabled;
              })
            }
          >
            ↻
          </button>
        </div>
        <div className="time-display">
          <b>
            {String(barIndex + 1).padStart(2, "0")}
            <em>:</em>
            {String(Math.floor(withinBar) + 1).padStart(2, "0")}
            <em>:</em>
            {String(Math.floor((withinBar % 1) * 100)).padStart(2, "0")}
          </b>
          <span>Ô NHỊP · PHÁCH · PHẦN</span>
        </div>
        <label className="bpm-control">
          <input
            aria-label="BPM"
            type="number"
            min="20"
            max="300"
            step="1"
            value={project.bpm}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (n > 0 && n <= 1000)
                updateSettings((p) => {
                  p.bpm = n;
                });
            }}
          />
          <span>BPM</span>
        </label>
        <label className="signature-control">
          <select
            aria-label="Số chỉ nhịp"
            value={project.time_signature.join("/")}
            onChange={(e) => {
              const [n, d] = e.target.value.split("/").map(Number);
              updateSettings((p) => {
                p.time_signature = [n, d];
              });
            }}
          >
            {["4/4", "3/4", "6/8", "5/4", "7/8"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <span>NHỊP</span>
        </label>
        <button
          className={metronome ? "toggled" : ""}
          title="Metronome"
          onClick={() => {
            setMetronome(!metronome);
            audio.setMetronome(!metronome);
          }}
        >
          ♩ Nhịp đếm
        </button>
        <div className="loop-control">
          <span>Lặp (beat)</span>
          <input
            aria-label="Đầu loop"
            type="number"
            min="0"
            max={project.loop.end_beat - 0.25}
            step=".25"
            value={project.loop.start_beat}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v >= 0 && v < project.loop.end_beat)
                updateSettings((p) => {
                  p.loop.start_beat = v;
                });
            }}
          />
          <span>→</span>
          <input
            aria-label="Cuối loop"
            type="number"
            min={project.loop.start_beat + 0.25}
            step=".25"
            value={project.loop.end_beat}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v > project.loop.start_beat)
                updateSettings((p) => {
                  p.loop.end_beat = v;
                });
            }}
          />
        </div>
        <div className="history-controls">
          <button
            title="Hoàn tác Ctrl+Z"
            disabled={!history.current?.canUndo}
            onClick={undo}
          >
            ↶
          </button>
          <button
            title="Làm lại Ctrl+Shift+Z"
            disabled={!history.current?.canRedo}
            onClick={redo}
          >
            ↷
          </button>
        </div>
        <button
          className={mixerOpen ? "toggled" : ""}
          onClick={() => setMixerOpen(!mixerOpen)}
        >
          ☷ Mixer & Master
        </button>
      </section>
      {error && (
        <div role="alert" className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError("")}>×</button>
        </div>
      )}
      {recovery && (
        <div className="recovery-banner">
          <span>
            Có bản tự lưu “{recovery.name}”. Khôi phục để tiếp tục phiên trước.
          </span>
          <button
            onClick={() => {
              installProject(recovery, false);
              setRecovery(null);
            }}
          >
            Khôi phục
          </button>
          <button onClick={() => setRecovery(null)}>Bỏ qua</button>
        </div>
      )}
      {hostedPreview && (
        <div className="preview-banner" role="status">
          Bản xem thử trên điện thoại · Chỉnh note, phát nhạc và lưu JSON hoạt
          động tại trình duyệt. Xuất MIDI/WAV cần chạy bản Python cục bộ trên
          máy tính. Xoay ngang để có thêm không gian.
        </div>
      )}
      <Arrangement
        project={project}
        selection={selection}
        position={position}
        onEdit={commit}
        onSelection={select}
        onSeek={(beat) => {
          audio.seek(beat);
          setPosition(beat);
        }}
        onAddTrack={addNewTrack}
      />
      <div className="clip-actions">
        <span className="eyebrow">TRÌNH CHỈNH MIDI</span>
        <strong>{selectedTrack?.name ?? "Chưa chọn track"}</strong>
        <span className="separator">/</span>
        {selectedClip ? (
          <input
            aria-label="Tên clip"
            key={selectedClip.id + selectedClip.name}
            defaultValue={selectedClip.name}
            onBlur={(e) => {
              if (e.target.value.trim() && e.target.value !== selectedClip.name)
                updateSettings((p) => {
                  const c = p.tracks
                    .find((t) => t.id === selectedTrack?.id)
                    ?.clips.find((c) => c.id === selectedClip.id);
                  if (c) c.name = e.target.value;
                });
            }}
          />
        ) : (
          <span>Chọn hoặc tạo một clip</span>
        )}
        <div className="spacer" />
        {selectedTrack && (
          <>
            <label title="Âm sắc synth nghe thử; không phải sample GM">
              Âm sắc{" "}
              <select
                aria-label="Âm sắc nghe thử"
                value={selectedTrack.instrument_config.preset}
                onChange={(e) =>
                  updateSettings((p) => {
                    p.tracks.find(
                      (t) => t.id === selectedTrack.id,
                    )!.instrument_config.preset = e.target.value as
                      | "auto"
                      | "sine"
                      | "triangle"
                      | "square"
                      | "sawtooth";
                  })
                }
              >
                {[
                  ["auto", "Tự động theo GM"],
                  ["sine", "Sine"],
                  ["triangle", "Triangle"],
                  ["sawtooth", "Sawtooth"],
                  ["square", "Square"],
                ].map(([v, n]) => (
                  <option value={v} key={v}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => {
                const id = crypto.randomUUID();
                commit(
                  createClip(project, selectedTrack.id, {
                    id,
                    name: "Clip mới",
                    start_beat: Math.floor(position / bar) * bar,
                    length_beats: bar * 2,
                    notes: [],
                  }),
                  { trackId: selectedTrack.id, clipId: id, noteIds: [] },
                );
              }}
            >
              ＋ Clip
            </button>
          </>
        )}
        {selectedTrack && selectedClip && (
          <>
            <button
              title="Nhân đôi clip và note"
              onClick={() => {
                const next = duplicateClip(
                  project,
                  selectedTrack.id,
                  selectedClip.id,
                );
                const clip = next.tracks
                  .find((t) => t.id === selectedTrack.id)!
                  .clips.at(-1)!;
                commit(next, {
                  trackId: selectedTrack.id,
                  clipId: clip.id,
                  noteIds: [],
                });
              }}
            >
              Nhân đôi clip
            </button>
            <button
              title="Xóa clip"
              onClick={() =>
                commit(deleteClip(project, selectedTrack.id, selectedClip.id), {
                  ...selection,
                  clipId: null,
                  noteIds: [],
                })
              }
            >
              Xóa clip
            </button>
          </>
        )}
      </div>
      {selectedTrack && selectedClip ? (
        <PianoRoll
          project={project}
          track={selectedTrack}
          clip={selectedClip}
          selection={selection}
          onSelection={select}
          onEdit={commit}
          onAudition={(pitch, velocity) => {
            void audio
              .audition(selectedTrack, pitch, velocity)
              .catch((e) => setError(message(e)));
          }}
          position={position}
        />
      ) : (
        <div className="piano-empty panel">
          <span>♬</span>
          <h3>Ý tưởng bắt đầu từ một note</h3>
          <p>Chọn clip trên bản phối, hoặc thêm track và clip mới.</p>
          <button onClick={addNewTrack}>＋ Thêm track</button>
        </div>
      )}
      {mixerOpen && <Mixer project={project} onEdit={commit} meters={meters} />}
      {job && (
        <section className="export-panel panel" aria-label="Kết quả xuất nhạc">
          <div>
            <span className="eyebrow">XUẤT MIDI & WAV</span>
            <h3>
              {job.status === "completed"
                ? "Bản xuất đã sẵn sàng"
                : job.status === "failed"
                  ? "Xuất nhạc thất bại"
                  : job.status === "queued"
                    ? "Đang chờ xử lý"
                    : "Đang dựng âm thanh…"}
            </h3>
            <p>{job.stage}</p>
            <progress value={job.progress} max="1" />
            {job.error && (
              <p role="alert" className="error-text">
                {job.error}
              </p>
            )}
          </div>
          <div className="export-results">
            {job.warnings?.map((warning, i) => (
              <p key={i} className="warning-text">
                {warning}
              </p>
            ))}
            {job.status === "completed" && (
              <>
                <audio
                  aria-label="Nghe bản final WAV"
                  controls
                  src={job.files.final}
                />
                <div className="download-links">
                  {Object.entries(job.files).map(([key, url]) => (
                    <a key={key} href={url} download>
                      {key === "midi"
                        ? "↓ MIDI"
                        : key === "preview"
                          ? "↓ WAV preview"
                          : "↓ WAV final"}
                    </a>
                  ))}
                </div>
              </>
            )}
          </div>
          <button
            title="Đóng kết quả"
            disabled={["queued", "running"].includes(job.status)}
            onClick={() => setJob(null)}
          >
            ×
          </button>
        </section>
      )}
      <footer className="status-footer">
        <span>
          <i className={playing ? "signal on" : "signal"} />{" "}
          {playing ? "Đang phát" : "Sẵn sàng"} · Tone.js · Synth cục bộ
        </span>
        <span>
          {project.time_signature.join("/")} · {projectEnd(project)} beat ·{" "}
          {((projectEnd(project) * 60) / project.bpm).toFixed(1)} giây
        </span>
        <span>Space phát/dừng tạm · Ctrl+S lưu · Ctrl+Z hoàn tác</span>
      </footer>
    </main>
  );
}
