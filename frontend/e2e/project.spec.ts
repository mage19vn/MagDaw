import { test, expect, type Page } from "@playwright/test";
async function saved(page: Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem("magdaw.autosave.v1");
    return raw ? JSON.parse(raw).project : null;
  });
}
test("Mẫu → playback → mixer/master → lưu/mở → export và tải file thật", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Phát", exact: true }),
  ).toBeVisible();
  await expect.poll(async () => (await saved(page))?.tracks?.length).toBe(4);
  await page.getByRole("button", { name: "Phát", exact: true }).click();
  await page.waitForTimeout(700);
  await expect(
    page.getByRole("button", { name: "Tạm dừng", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tạm dừng", exact: true }).click();
  await page.getByRole("button", { name: "Dừng", exact: true }).click();
  await page
    .getByRole("button", { name: "☷ Mixer & Master", exact: true })
    .click();
  const volume = page.getByRole("slider", { name: "Âm lượng Piano" });
  if (await volume.count()) {
    await volume.focus();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Tab");
  }
  await page.getByLabel("Đầu loop", { exact: true }).fill("4");
  await page.getByLabel("Cuối loop", { exact: true }).fill("12");
  await page.getByRole("button", { name: "↻", exact: true }).click();
  const name = page.getByLabel("Tên project", { exact: true });
  await name.fill("Bản kiểm tra cục bộ");
  await name.press("Tab");
  const masterGain = page.getByRole("slider", {
    name: "Master gain",
    exact: true,
  });
  await masterGain.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Tab");
  await expect
    .poll(async () => (await saved(page))?.name)
    .toBe("Bản kiểm tra cục bộ");
  const snapshot = await saved(page);
  expect(snapshot.loop).toEqual({ enabled: true, start_beat: 4, end_beat: 12 });
  expect(snapshot.master.gain_db).toBeGreaterThan(0);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Lưu project", exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "kiem-tra.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(snapshot)),
    });
  await expect(page.getByLabel("Tên project", { exact: true })).toHaveValue(
    snapshot.name,
  );
  await expect(page.getByTitle("Hoàn tác Ctrl+Z")).toBeDisabled();
  // Invalid open must retain the current musical document.
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "loi.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"schema_version":999}'),
    });
  await expect(page.getByRole("alert")).toContainText("schema");
  await expect(page.getByLabel("Tên project", { exact: true })).toHaveValue(
    snapshot.name,
  );
  await page.getByRole("button", { name: "↗ Xuất nhạc", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Bản xuất đã sẵn sàng", exact: true }),
  ).toBeVisible({ timeout: 60000 });
  const audio = page.getByLabel("Nghe bản final WAV", { exact: true });
  await expect(audio).toHaveAttribute("src", /bai_hat_final.wav/);
  await audio.evaluate(async (element: HTMLAudioElement) => {
    await element.play();
  });
  await expect
    .poll(() =>
      audio.evaluate((element: HTMLAudioElement) => element.currentTime),
    )
    .toBeGreaterThan(0.05);
  for (const label of ["↓ MIDI", "↓ WAV preview", "↓ WAV final"]) {
    const link = page.getByRole("link", { name: label, exact: true });
    const response = await page.request.get((await link.getAttribute("href"))!);
    expect(response.ok()).toBeTruthy();
    expect((await response.body()).length).toBeGreaterThan(100);
  }
  await page.screenshot({
    path: "../artifacts/studio-export.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
