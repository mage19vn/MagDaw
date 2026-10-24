import { expect, test, type Page } from "@playwright/test";
import type { Clip, Project, Track } from "../src/domain/types";

const APP_URL = process.env.APP_URL ?? "http://127.0.0.1:5173";
const AUTOSAVE_KEY = "magdaw.autosave.v1";
async function readProject(page: Page): Promise<Project> {
  await page.waitForFunction(
    (key) => Boolean(localStorage.getItem(key)),
    AUTOSAVE_KEY,
  );
  return page.evaluate((key) => {
    const stored = localStorage.getItem(key);
    if (!stored) throw new Error("Chưa có bản tự lưu.");
    return JSON.parse(stored).project;
  }, AUTOSAVE_KEY) as Promise<Project>;
}
async function readClip(page: Page): Promise<Clip> {
  const project = await readProject(page);
  const track = project.tracks.at(-1) as Track;
  return track.clips.at(-1) as Clip;
}
async function awaitNotes(page: Page, count: number): Promise<void> {
  await expect
    .poll(async () => (await readClip(page)).notes.length)
    .toBe(count);
}
async function focusPitch(
  page: Page,
  pitch: number,
  rowHeight = 18,
): Promise<void> {
  await page.getByTestId("piano-scroll").evaluate(
    (element, top) => {
      element.scrollTop = top;
    },
    (127 - pitch - 5) * rowHeight,
  );
}
async function gridPoint(
  page: Page,
  beat: number,
  pitch: number,
  beatWidth = 64,
  rowHeight = 18,
): Promise<{ x: number; y: number }> {
  const bounds = await page.getByTestId("piano-grid").boundingBox();
  if (!bounds) throw new Error("Không tìm thấy lưới piano roll.");
  return {
    x: bounds.x + beat * beatWidth,
    y: bounds.y + (127 - pitch + 0.5) * rowHeight,
  };
}

test("Piano roll sửa dữ liệu thật, một drag một undo, giữ đúng tọa độ sau zoom và cuộn", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.addInitScript(() => localStorage.clear());
  await page.goto(APP_URL);
  await expect(
    page.getByRole("button", { name: "＋ Track", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "＋ Track", exact: true }).click();
  await page.getByRole("button", { name: "＋ Clip", exact: true }).click();
  await expect(page.getByTestId("piano-grid")).toBeVisible();
  await focusPitch(page, 60);
  const start = await gridPoint(page, 2.26, 60);
  await page.mouse.click(start.x, start.y);
  await awaitNotes(page, 1);
  let clip = await readClip(page);
  expect(clip.notes[0]).toMatchObject({
    pitch: 60,
    start_beat: 2.25,
    length_beat: 0.25,
    velocity: 96,
  });
  const noteId = clip.notes[0].id;
  const note = page.locator(`[data-note-id="${noteId}"]`);
  let bounds = await note.boundingBox();
  if (!bounds) throw new Error("Nốt vừa tạo không hiển thị.");
  await page.mouse.move(bounds.x + 4, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 68, bounds.y + bounds.height / 2 - 36, {
    steps: 12,
  });
  await page.mouse.up();
  await expect.poll(async () => (await readClip(page)).notes[0].pitch).toBe(62);
  clip = await readClip(page);
  expect(clip.notes[0].start_beat).toBe(3.25);
  await page.keyboard.press("Control+z");
  await expect
    .poll(async () => (await readClip(page)).notes[0].start_beat)
    .toBe(2.25);
  expect((await readClip(page)).notes[0].pitch).toBe(60);
  await page.keyboard.press("Control+Shift+z");
  await expect
    .poll(async () => (await readClip(page)).notes[0].start_beat)
    .toBe(3.25);
  bounds = await note.boundingBox();
  if (!bounds) throw new Error("Không hiển thị nốt sau redo.");
  await page.mouse.move(
    bounds.x + bounds.width - 2,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width - 2 + 64,
    bounds.y + bounds.height / 2,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect
    .poll(async () => (await readClip(page)).notes[0].length_beat)
    .toBe(1.25);
  await page
    .getByRole("spinbutton", { name: "Velocity nốt đã chọn" })
    .fill("80");
  await expect
    .poll(async () => (await readClip(page)).notes[0].velocity)
    .toBe(80);
  await page.getByRole("region", { name: "Trình chỉnh sửa nốt nhạc" }).focus();
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  await awaitNotes(page, 2);
  clip = await readClip(page);
  expect(clip.notes[1]).toMatchObject({
    pitch: 62,
    velocity: 80,
    length_beat: 1.25,
  });
  await page.keyboard.press("Delete");
  await awaitNotes(page, 1);

  const horizontalZoom = page.getByRole("slider", {
    name: "Zoom ngang piano roll",
  });
  await horizontalZoom.focus();
  await horizontalZoom.press("End");
  for (let index = 0; index < 4; index++)
    await horizontalZoom.press("ArrowLeft");
  const verticalZoom = page.getByRole("slider", {
    name: "Zoom dọc piano roll",
  });
  await verticalZoom.focus();
  await verticalZoom.press("End");
  for (let index = 0; index < 4; index++) await verticalZoom.press("ArrowLeft");
  await page.getByTestId("piano-scroll").evaluate((element) => {
    element.scrollLeft = 800;
    element.scrollTop = (127 - 65) * 24;
  });
  const afterZoom = await gridPoint(page, 8.5, 60, 128, 24);
  await page.mouse.click(afterZoom.x, afterZoom.y);
  await awaitNotes(page, 2);
  clip = await readClip(page);
  const newNote = clip.notes.find((item) => item.id !== noteId);
  expect(newNote).toMatchObject({
    pitch: 60,
    start_beat: 8.5,
    length_beat: 0.25,
  });
  expect(clip.length_beats).toBeGreaterThanOrEqual(8.75);
  await page.getByTestId("piano-scroll").evaluate((element) => {
    element.scrollLeft = 0;
  });
  const zoomedNote = page.locator(`[data-note-id="${noteId}"]`);
  await zoomedNote.click({ position: { x: 4, y: 8 } });
  await page.getByRole("button", { name: "Nhân đôi", exact: true }).click();
  await awaitNotes(page, 3);
  const marqueeStart = await gridPoint(page, 3, 64, 128, 24);
  const marqueeEnd = await gridPoint(page, 6, 61, 128, 24);
  await page.keyboard.down("Shift");
  await page.mouse.move(marqueeStart.x, marqueeStart.y);
  await page.mouse.down();
  await page.mouse.move(marqueeEnd.x, marqueeEnd.y, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  await expect(page.locator(".piano-note.selected")).toHaveCount(2);
  const beforePaste = await readClip(page);
  const originalIds = new Set(beforePaste.notes.map((item) => item.id));
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  await awaitNotes(page, 5);
  const pastedNotes = (await readClip(page)).notes
    .filter((item) => !originalIds.has(item.id))
    .sort((a, b) => a.start_beat - b.start_beat);
  expect(pastedNotes).toHaveLength(2);
  expect(pastedNotes[1].start_beat - pastedNotes[0].start_beat).toBe(1.25);
  expect(
    pastedNotes.every(
      (item) =>
        item.pitch === 62 && item.velocity === 80 && item.length_beat === 1.25,
    ),
  ).toBe(true);
  await page.keyboard.press("Control+z");
  await awaitNotes(page, 3);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
