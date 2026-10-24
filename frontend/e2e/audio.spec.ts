import { test, expect, type Page } from "@playwright/test";

async function audioState(page: Page) {
  return page.evaluate(() => {
    const engine = (
      window as unknown as {
        audioTestEngine: import("../src/audio/ToneAudioEngine").ToneAudioEngine;
      }
    ).audioTestEngine;
    return {
      ...engine.getDiagnostics(),
      position: engine.getPosition(),
      meters: engine.getMeters(),
    };
  });
}

test("Tone clock, tín hiệu thật, lặp playback và giải phóng tài nguyên", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.evaluate(async () => {
    const { ToneAudioEngine } = await import("/src/audio/ToneAudioEngine.ts");
    const response = await fetch("/sample-project.json");
    const project =
      (await response.json()) as import("../src/domain/types").Project;
    project.bpm = 120;
    project.loop = { enabled: false, start_beat: 2, end_beat: 4 };
    project.master.compressor.bypass = true;
    project.master.reverb.bypass = true;
    project.master.limiter.bypass = true;
    project.tracks = project.tracks.slice(0, 2).map((track, index) => ({
      ...track,
      volume_db: -9,
      pan: 0,
      mute: false,
      solo: false,
      instrument_config: { preset: "sine" },
      clips: [
        {
          id: `test-clip-${index}`,
          name: "Kiểm tín hiệu",
          start_beat: 0,
          length_beats: 16,
          notes: [
            {
              id: `test-note-${index}`,
              pitch: 60 + index * 7,
              start_beat: 0,
              length_beat: 16,
              velocity: 100,
            },
          ],
        },
      ],
    }));
    const engine = new ToneAudioEngine();
    engine.setProject(project);
    Object.assign(window, {
      audioTestEngine: engine,
      audioTestProject: project,
    });
    const button = document.createElement("button");
    button.textContent = "Khởi chạy kiểm âm thanh";
    button.id = "audio-test-start";
    button.onclick = () => {
      void engine.play();
    };
    document.body.prepend(button);
  });
  await page.locator("#audio-test-start").click();
  await expect
    .poll(async () => (await audioState(page)).position)
    .toBeGreaterThan(0.3);
  expect((await audioState(page)).meters.master).toBeGreaterThan(0.0001);
  const scheduledEvents = (await audioState(page)).scheduledEvents;
  await page.evaluate(() =>
    (
      window as unknown as {
        audioTestEngine: import("../src/audio/ToneAudioEngine").ToneAudioEngine;
      }
    ).audioTestEngine.pause(),
  );
  const paused = (await audioState(page)).position;
  await page.waitForTimeout(250);
  expect((await audioState(page)).position).toBeCloseTo(paused, 1);
  for (let iteration = 0; iteration < 4; iteration += 1) {
    await page.evaluate(async () => {
      const engine = (
        window as unknown as {
          audioTestEngine: import("../src/audio/ToneAudioEngine").ToneAudioEngine;
        }
      ).audioTestEngine;
      await engine.play();
    });
    await page.waitForTimeout(80);
    await page.evaluate(() =>
      (
        window as unknown as {
          audioTestEngine: import("../src/audio/ToneAudioEngine").ToneAudioEngine;
        }
      ).audioTestEngine.pause(),
    );
  }
  expect((await audioState(page)).scheduledEvents).toBe(scheduledEvents);
  await page.evaluate(async () => {
    const engine = (
      window as unknown as {
        audioTestEngine: import("../src/audio/ToneAudioEngine").ToneAudioEngine;
      }
    ).audioTestEngine;
    engine.seek(3);
    await engine.play();
  });
  await page.waitForTimeout(250);
  expect((await audioState(page)).position).toBeGreaterThan(3.1);
  expect((await audioState(page)).meters.master).toBeGreaterThan(0.0001);
  await page.evaluate(() => {
    const { audioTestEngine: engine, audioTestProject: project } =
      window as unknown as {
        audioTestEngine: import("../src/audio/ToneAudioEngine").ToneAudioEngine;
        audioTestProject: import("../src/domain/types").Project;
      };
    project.tracks[0].pan = -1;
    project.tracks[1].mute = true;
    engine.setProject(project);
  });
  await page.waitForTimeout(200);
  const stereo = await page.evaluate(() => {
    const engine = (
      window as unknown as {
        audioTestEngine: { master: { meter: { getValue(): Float32Array[] } } };
      }
    ).audioTestEngine;
    return engine.master.meter
      .getValue()
      .map((channel) =>
        Array.from(channel).reduce(
          (peak, sample) => Math.max(peak, Math.abs(sample)),
          0,
        ),
      );
  });
  expect(stereo[0]).toBeGreaterThan(0.0001);
  expect(stereo[1]).toBeLessThan(0.00001);
  await page.evaluate(() => {
    const { audioTestEngine: engine, audioTestProject: project } =
      window as unknown as {
        audioTestEngine: import("../src/audio/ToneAudioEngine").ToneAudioEngine;
        audioTestProject: import("../src/domain/types").Project;
      };
    project.tracks[0].solo = true;
    project.tracks[0].mute = true;
    project.tracks[1].mute = false;
    engine.setProject(project);
  });
  await page.waitForTimeout(200);
  expect((await audioState(page)).meters.master).toBeLessThan(0.00001);
  await page.evaluate(() => {
    const { audioTestEngine: engine, audioTestProject: project } =
      window as unknown as {
        audioTestEngine: import("../src/audio/ToneAudioEngine").ToneAudioEngine;
        audioTestProject: import("../src/domain/types").Project;
      };
    project.tracks[0].mute = false;
    project.bpm = 90;
    project.loop.enabled = true;
    engine.setProject(project);
    engine.seek(3.8);
  });
  await page.waitForTimeout(500);
  const looped = await audioState(page);
  expect(looped.position).toBeGreaterThanOrEqual(2);
  expect(looped.position).toBeLessThan(3.5);
  expect(looped.meters.master).toBeGreaterThan(0.0001);
  await page.evaluate(() => {
    const engine = (
      window as unknown as {
        audioTestEngine: import("../src/audio/ToneAudioEngine").ToneAudioEngine;
      }
    ).audioTestEngine;
    engine.stop();
  });
  expect((await audioState(page)).position).toBe(0);
  await page.evaluate(() =>
    (
      window as unknown as {
        audioTestEngine: import("../src/audio/ToneAudioEngine").ToneAudioEngine;
      }
    ).audioTestEngine.dispose(),
  );
  const disposed = await audioState(page);
  expect(disposed.channels).toBe(0);
  expect(disposed.scheduledEvents).toBe(0);
  expect(disposed.meters.master).toBe(0);
  expect(errors).toEqual([]);
});
