import { test, expect, type Page } from "@playwright/test";
import type { Project } from "../src/domain/types";
async function stored(page: Page): Promise<Project | null> {
  return page.evaluate(() => {
    const raw = localStorage.getItem("magdaw.autosave.v1");
    return raw ? JSON.parse(raw).project : null;
  });
}
test("Arrangement kéo clip, đổi program/drum, thứ tự track và khôi phục autosave", async ({
  page,
}) => {
  await page.goto("/");
  await expect.poll(async () => (await stored(page))?.tracks.length).toBe(4);
  const clip = page.locator(".music-clip").first();
  const bounds = await clip.boundingBox();
  if (!bounds) throw new Error("Clip mẫu không hiển thị");
  await page.mouse.move(bounds.x + 30, bounds.y + 10);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 78, bounds.y + 10, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(async () => (await stored(page))?.tracks[0].clips[0].start_beat)
    .toBe(2);
  await page.getByTitle("Hoàn tác Ctrl+Z").click();
  await expect
    .poll(async () => (await stored(page))?.tracks[0].clips[0].start_beat)
    .toBe(0);
  await page.getByTitle("Làm lại Ctrl+Shift+Z").click();
  await expect
    .poll(async () => (await stored(page))?.tracks[0].clips[0].start_beat)
    .toBe(2);
  await page
    .getByRole("button", { name: "Nhân đôi clip", exact: true })
    .click();
  await expect
    .poll(async () => (await stored(page))?.tracks[0].clips.length)
    .toBe(17);
  await page.getByRole("button", { name: "Xóa clip", exact: true }).click();
  await expect
    .poll(async () => (await stored(page))?.tracks[0].clips.length)
    .toBe(16);
  const title = page.getByLabel("Tên track 1", { exact: true });
  await title.fill("Track đã chỉnh");
  await title.press("Tab");
  await page.getByLabel("Program Track đã chỉnh", { exact: true }).fill("24");
  await page.locator(".track-header").first().getByRole("checkbox").check();
  await page
    .locator(".track-header")
    .first()
    .getByTitle("Đưa track xuống")
    .click();
  await expect
    .poll(async () => (await stored(page))?.tracks[1].name)
    .toBe("Track đã chỉnh");
  const project = await stored(page);
  expect(project?.tracks[1].program).toBe(24);
  expect(project?.tracks[1].is_drum).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Khôi phục", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(900);
  expect((await stored(page))?.tracks[1].name).toBe("Track đã chỉnh");
  await page.getByRole("button", { name: "Khôi phục", exact: true }).click();
  await expect(page.getByLabel("Tên track 2", { exact: true })).toHaveValue(
    "Track đã chỉnh",
  );
  await expect(page.getByTitle("Hoàn tác Ctrl+Z")).toBeDisabled();
  await page
    .getByRole("button", { name: "☷ Mixer & Master", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Bỏ qua gain", exact: true })
    .check();
  await expect
    .poll(async () => (await stored(page))?.master.gain_bypass)
    .toBe(true);
});
