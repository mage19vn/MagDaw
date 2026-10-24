import { useCallback, useEffect, useRef, useState } from "react";
import Arrangement from "./components/Arrangement";
import ExportPanel from "./components/ExportPanel";
import MasterPanel from "./components/MasterPanel";
import MixerPanel from "./components/MixerPanel";
import PianoRoll from "./components/PianoRoll";
import TopBar from "./components/TopBar";
import TrackList from "./components/TrackList";
import TransportBar from "./components/TransportBar";
import { setOnEnded } from "./audio/engine";
import { getPlayheadSeconds } from "./audio/engine";
import {
  createProject,
  ensureTrackAndClipIds,
  readAutosave,
  restoreAutosave,
  writeAutosave,
} from "./features/project";
import { useDaw } from "./state/store";
import { secondsToBeat } from "./utils/music";

const API_BASE = import.meta.env.DEV
  ? `http://${window.location.hostname}:8000`
  : "";

export default function App() {
  const project = useDaw((s) => s.project);
  const playing = useDaw((s) => s.playing);
  const notice = useDaw((s) => s.notice);
  const noticeKind = useDaw((s) => s.noticeKind);
  const setProject = useDaw((s) => s.setProject);
  const setNotice = useDaw((s) => s.setNotice);
  const play = useDaw((s) => s.play);
  const pause = useDaw((s) => s.pause);
  const undo = useDaw((s) => s.undo);
  const redo = useDaw((s) => s.redo);
  const deleteSelectedNotes = useDaw((s) => s.deleteSelectedNotes);
  const copySelectedNotes = useDaw((s) => s.copySelectedNotes);
  const pasteNotes = useDaw((s) => s.pasteNotes);
  const duplicateSelectedNotes = useDaw((s) => s.duplicateSelectedNotes);
  const setPlayheadBeat = useDaw((s) => s.setPlayheadBeat);
  const handlePlaybackEnded = useDaw((s) => s.handlePlaybackEnded);

  const [loadingSample, setLoadingSample] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [autosaveAvailable, setAutosaveAvailable] = useState(
    () => readAutosave() !== null,
  );
  const [showMixer, setShowMixer] = useState(true);
  const [showMaster, setShowMaster] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const autosaveTimer = useRef<number | null>(null);

  const loadSample = useCallback(async () => {
    setLoadingSample(true);
    setLoadError(null);
    try {
      const response = await fetch(`${API_BASE}/api/sample`);
      if (!response.ok) throw new Error(`Backend trả mã ${response.status}`);
      const data = await response.json();
      setProject(ensureTrackAndClipIds(data), false);
    } catch {
      setLoadError(
        "Không tải được bài mẫu từ backend. Hãy chạy backend ở cổng 8000 rồi thử lại, hoặc tạo project trống.",
      );
    } finally {
      setLoadingSample(false);
    }
  }, [setProject]);

  useEffect(() => {
    void loadSample();
  }, [loadSample]);

  useEffect(() => {
    setOnEnded(() => handlePlaybackEnded());
    return () => setOnEnded(null);
  }, [handlePlaybackEnded]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const bpm = useDaw.getState().project?.bpm ?? 100;
      setPlayheadBeat(secondsToBeat(getPlayheadSeconds(), bpm));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, setPlayheadBeat]);

  useEffect(() => {
    if (!project) return;
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      writeAutosave(project);
      setAutosaveAvailable(true);
    }, 1000);
    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    };
  }, [project]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 8000);
    return () => window.clearTimeout(timer);
  }, [notice, setNotice]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (mod && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      } else if (mod && event.key.toLowerCase() === "c") {
        event.preventDefault();
        copySelectedNotes();
      } else if (mod && event.key.toLowerCase() === "v") {
        event.preventDefault();
        pasteNotes();
      } else if (mod && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelectedNotes();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelectedNotes();
      } else if (event.key === " ") {
        event.preventDefault();
        if (playing) pause();
        else void play();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    playing,
    play,
    pause,
    undo,
    redo,
    deleteSelectedNotes,
    copySelectedNotes,
    pasteNotes,
    duplicateSelectedNotes,
  ]);

  const restore = () => {
    try {
      const loaded = restoreAutosave();
      setProject(ensureTrackAndClipIds(loaded), false);
      setNotice("Đã khôi phục bản autosave.", "success");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Không khôi phục được autosave.",
        "error",
      );
    }
  };

  if (loadingSample) {
    return (
      <div className="loading-screen">Đang tải bài mẫu, chờ một chút...</div>
    );
  }

  if (!project) {
    return (
      <div className="loading-screen">
        <p>{loadError ?? "Chưa có project."}</p>
        <button type="button" onClick={() => void loadSample()}>
          Thử tải lại bài mẫu
        </button>{" "}
        <button
          type="button"
          onClick={() => {
            setProject(createProject(), false);
            setLoadError(null);
          }}
        >
          Tạo project trống
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      <TopBar
        onRestoreAutosave={restore}
        autosaveAvailable={autosaveAvailable}
      />
      <TransportBar />
      {notice && (
        <div className={`notice ${noticeKind}`}>
          <span>{notice}</span>
          <button type="button" title="Đóng thông báo" onClick={() => setNotice(null)}>
            ✕
          </button>
        </div>
      )}
      <div className="main-row">
        <TrackList />
        <Arrangement />
      </div>
      <div className="editor-row">
        <PianoRoll />
      </div>
      <div className="panel-tabs">
        <button
          type="button"
          className={showMixer ? "active" : ""}
          onClick={() => setShowMixer(!showMixer)}
        >
          Mixer
        </button>
        <button
          type="button"
          className={showMaster ? "active" : ""}
          onClick={() => setShowMaster(!showMaster)}
        >
          Master
        </button>
        <button
          type="button"
          className={showExport ? "active" : ""}
          onClick={() => setShowExport(!showExport)}
        >
          Export
        </button>
        <span className="hint">
          Âm sắc nghe thử dùng synth có sẵn của Tone.js — không tái tạo chính
          xác mọi program General MIDI.
        </span>
      </div>
      {showMixer && <MixerPanel />}
      {showMaster && <MasterPanel />}
      {showExport && <ExportPanel />}
    </div>
  );
}
