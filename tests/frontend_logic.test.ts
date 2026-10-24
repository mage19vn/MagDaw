/* Node-runnable logic checks for frontend pure modules.
 * Run: esbuild bundle + node (see README). No DOM or Tone.js involved. */
import assert from "node:assert";
import { buildScheduleEvents, drumKindForPitch } from "../frontend/src/audio/schedule";
import { createClip, moveClip } from "../frontend/src/features/clips";
import { addNote, deleteNotes, duplicateNotes, moveNotes, quantizeNotes, resizeNote, setNoteVelocity } from "../frontend/src/features/notes";
import { createProject, validateProject } from "../frontend/src/features/project";
import type { Project } from "../frontend/src/types";

function sampleProject(): Project {
  const project = createProject();
  project.tracks = [
    {
      id: "t1", name: "Melody", program: 0, is_drum: false,
      volume_db: 0, pan: 0, mute: false, solo: false,
      clips: [{
        id: "c1", name: "Clip", start_beat: 0, length_beats: 4,
        notes: [
          { id: "n1", pitch: 60, start_beat: 0, length_beat: 1, velocity: 90 },
          { id: "n2", pitch: 64, start_beat: 1, length_beat: 1, velocity: 80 },
        ],
      }],
    },
    {
      id: "t2", name: "Drums", program: 0, is_drum: true,
      volume_db: 0, pan: 0, mute: false, solo: false,
      clips: [{
        id: "c2", name: "Drums", start_beat: 0, length_beats: 4,
        notes: [
          { id: "d1", pitch: 36, start_beat: 0, length_beat: 0.25, velocity: 100 },
        ],
      }],
    },
  ];
  return project;
}

// addNote clamps a note that would overflow the clip.
{
  const next = addNote(sampleProject(), "t1", "c1", {
    id: "n3", pitch: 67, start_beat: 3.5, length_beat: 2, velocity: 90,
  });
  const added = next.tracks[0].clips[0].notes.find((n) => n.id === "n3")!;
  assert.equal(added.start_beat + added.length_beat <= 4, true);
}

// moveNotes shifts selected notes and clamps at clip start.
{
  const next = moveNotes(sampleProject(), "t1", "c1", new Set(["n1"]), -1, 2);
  const moved = next.tracks[0].clips[0].notes.find((n) => n.id === "n1")!;
  assert.equal(moved.start_beat, 0);
  assert.equal(moved.pitch, 62);
}

// resizeNote grows then deleteNotes removes.
{
  let next = resizeNote(sampleProject(), "t1", "c1", "n1", 2);
  assert.equal(next.tracks[0].clips[0].notes.find((n) => n.id === "n1")!.length_beat, 2);
  next = deleteNotes(next, "t1", "c1", new Set(["n1"]));
  assert.equal(next.tracks[0].clips[0].notes.some((n) => n.id === "n1"), false);
}

// duplicateNotes copies with a beat offset; setNoteVelocity clamps.
{
  const next = duplicateNotes(sampleProject(), "t1", "c1", new Set(["n2"]), 1);
  assert.equal(next.tracks[0].clips[0].notes.length, 3);
  const vel = setNoteVelocity(next, "t1", "c1", new Set(["n2"]), 200);
  assert.equal(vel.tracks[0].clips[0].notes.find((n) => n.id === "n2")!.velocity, 127);
}

// quantizeNotes snaps starts to the grid.
{
  const withOffGrid = addNote(sampleProject(), "t1", "c1", {
    id: "n9", pitch: 60, start_beat: 1.3, length_beat: 0.5, velocity: 90,
  });
  const next = quantizeNotes(withOffGrid, "t1", "c1", new Set(["n9"]), 0.5);
  assert.equal(next.tracks[0].clips[0].notes.find((n) => n.id === "n9")!.start_beat, 1.5);
}

// Clip move/duplicate.
{
  const next = moveClip(sampleProject(), "t1", "c1", 8);
  assert.equal(next.tracks[0].clips[0].start_beat, 8);
  const dup = createClip(sampleProject(), "t1", 4, 4);
  assert.equal(dup.tracks[0].clips.length, 2);
}

// validateProject catches bad data.
{
  const bad = sampleProject() as unknown as Record<string, unknown>;
  (bad as { bpm: number }).bpm = 0;
  assert.ok(validateProject(bad).length > 0);
  assert.deepEqual(validateProject(sampleProject()), []);
}

// Schedule builder: absolute beats, drum kinds, solo rule.
{
  const events = buildScheduleEvents(sampleProject());
  assert.equal(events.length, 3);
  assert.equal(events[0].time, 0);
  assert.equal(events[2].time, 0.6); // beat 1 at 100 BPM, after two beat-0 events
  assert.equal(drumKindForPitch(36), "kick");
  assert.equal(drumKindForPitch(38), "snare");
  assert.equal(drumKindForPitch(42), "hihat");
  const soloed = sampleProject();
  soloed.tracks[1].solo = true;
  const soloEvents = buildScheduleEvents(soloed);
  assert.equal(soloEvents.length, 1);
  assert.equal(soloEvents[0].isDrum, true);
}

console.log("FRONTEND_LOGIC_OK");
