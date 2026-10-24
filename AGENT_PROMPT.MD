# MagDaw — đặc tả và hồ sơ tiếp tục triển khai

## Mục tiêu, ngôn ngữ và cách làm
Xây sản phẩm DAW MIDI-first chạy cục bộ trong trình duyệt, tham chiếu thao tác/bố cục/phản hồi BandLab nhưng không sao chép thương hiệu hay tuyên bố ngang toàn bộ BandLab. Giao diện tối, desktop từ 1280×720: transport trên, track trái, arrangement giữa, piano roll dưới, mixer/master thu gọn. Toàn bộ UI, lỗi và tài liệu tiếng Việt; tên file, biến, hàm, lớp, kiểu tiếng Anh. Không bàn giao mockup/scaffold/nút giả. Mỗi chức năng phải thao tác từ UI, sửa domain thật, tác động audio/export, giữ qua save/open nếu thuộc project và được kiểm tra. Đọc repo/AGENTS trước sửa, tái sử dụng phần phù hợp; tiếp tục triển khai sau tài liệu này. File này độc lập hội thoại, phải phân biệt yêu cầu, bằng chứng và việc còn lại; không ghi hoàn thành khi chưa kiểm tra.

Repo ban đầu: trống, nhánh work chưa có commit, không có AGENTS.md (đã tìm /workspace). Môi trường Python/Node được kiểm tra khi triển khai. Quyết định thông thường tự chọn và ghi lý do.

## Phạm vi
Arrangement nhiều track/clip, piano roll, playback/seek/loop/metronome/tempo, mixer volume/pan/mute/solo, master, undo/redo, save/open/autosave recovery, MIDI/WAV export, bài mẫu nghe ngay. Không có tài khoản/cloud/cộng tác, microphone/waveform/time-stretch, VST/native plugin, tempo automation hoặc time signature thay đổi giữa bài; không dựng UI giả cho phần ngoài phạm vi. Kiến trúc cho phép nối thêm về sau.

## Stack và kiến trúc
Backend Python >=3.10: FastAPI, uvicorn, pretty_midi, numpy, soundfile, pedalboard; FluidSynth tùy chọn. Frontend React/TypeScript strict/Vite/Tone.js, lockfile bắt buộc, khai báo dependencies đầy đủ, xác minh API/version thực tế. Không any để né thiết kế, không tự viết DSP hay scheduler, không timer UI phát note. Mặc định offline lúc chạy, synth/trống built-in Tone không CDN/sample tải mạng, không tài khoản/phí.
Domain chứa project/validation/edit thuần, không React/DOM/Tone; application điều phối command/history/playback/persistence/export; infrastructure adapter Tone/API/MIDI/render/pedalboard; UI chỉ hiển thị/gửi thao tác, không xử lý MIDI/render WAV. Domain là nguồn project duy nhất, audio nodes/transport ngoài render; pixel chỉ hiển thị, lưu beat/pitch. Side effect qua service; hàm nhỏ có tên rõ, type hint Python API chính, tránh tên mơ hồ/logic lồng sâu/boolean khó hiểu. Comment chỉ cho lý do/đơn vị/giới hạn/thuật toán khó, docstring API ngắn, hướng dẫn dài README; không hardcode rải rác, except:pass, TODO/mock che thiếu sót. Không ép một dòng/tách vụn, không plugin framework/event bus/DI framework. Interfaces cần thiết: AudioEngine, InstrumentProvider, ProjectRepository, ExportService; effect catalog có ID/params/defaults/validation. Có thể chỉnh cấu trúc thư mục nếu giữ ranh giới.

## Schema và thời gian
Project: schema_version,id,name,bpm,time_signature,tracks,loop,master. Track: id,name,program,is_drum,instrument_config,volume_db,pan,mute,solo,clips. Clip: id,name,start_beat,length_beats,notes. Note: id,pitch,start_beat,length_beat,velocity. ID ổn định; không lưu selection/nodes/playing. Clip start từ đầu project, note start từ đầu clip; beat = quarter note. absolute_beat=clip.start_beat+note.start_beat; seconds=absolute_beat*60/BPM. Nhãn bar/beat theo tử/mẫu time signature. Pitch và GM program nguyên 0..127, velocity nguyên 1..127, pan -1..1, BPM/length dương, start không âm, số hữu hạn. Move/resize note mở rộng clip nếu cần, không âm thầm cắt/mất note. Validate cả frontend/backend, có đường nâng schema, từ chối tương lai rõ ràng.

## Commands/history
API nghiệp vụ tương đương addNote/updateNote/deleteNotes/moveNotes/resizeNotes/duplicateNotes/quantizeNotes/createClip/moveClip/duplicateClip/addTrack/removeTrack/updateTrackMixer; validation mọi edit. Một gesture drag = một undo, khôi phục project và selection liên quan. Playback position/preferences không phải musical edit. Open project xóa history cũ. Copy/paste nhiều note giữ khoảng cách/pitch/velocity. Quantize quy tắc rõ, length luôn >0.

## Piano roll
Keyboard/grid beat-bar/nhãn pitch; click tạo, chọn đơn/nhiều/marquee, kéo pitch/time, resize mép, xóa/duplicate/copy/paste, velocity selection, snap 1/4(1 beat),1/8(.5),1/16(.25),off, zoom ngang/dọc, scroll hai chiều, audition keyboard/tạo note, highlight selection/playhead, undo/redo. Pointer capture, tọa độ đúng zoom/scroll, click/drag threshold, không tạo note khi thao tác note/resize/marquee; shortcut bỏ qua text inputs; hoạt động trên project dài.

## Arrangement
Thêm/xóa/đổi tên/sắp xếp track; program 0..127 và drum. Tạo/chọn/kéo/duplicate/xóa clip; mở piano roll. Grid/snap/zoom/thước/playhead; volume/mute/solo header. Clip chồng cùng track được cộng dồn note, tài liệu chính sách. Piano roll và arrangement dùng chung domain.

## Playback
Tone clock, context unlock sau user gesture. Play từ vị trí hiện tại; pause giữ vị trí; stop tắt âm về đầu; seek dừng/đang chạy; BPM; loop range; metronome; multitrack; mixer live. Không duplicate schedule sau play/pause/stop. Stop/seek/xóa track/thay project phải tắt/release note. Định nghĩa xử lý note ngân qua seek/loop, edit live cập nhật an toàn tại ranh giới rõ, không giữ lịch cũ vô hạn. BPM không đổi beat. Mute thắng solo, có solo chỉ solo không mute được nghe. Playhead đọc transport, RAF chỉ hiển thị. Dispose nodes/subscriptions khi thay/đóng. Program mapping synth rõ, không quảng cáo 128 nhạc cụ thật.

## Mixer/master
Track volume/pan/mute/solo, master output. Gain → Compressor → Reverb → Limiter, không gain sau limiter. UI rõ đơn vị/range/default; từng effect bypass/reset; reverb wet mặc định .15..25, limiter ceiling khoảng -1 dBFS. Meter từ audio thực, không random, không tuyên bố LUFS chưa đo. Shared master config, adapters Tone/pedalboard; công khai sai khác mapping, không bỏ setting export âm thầm, không hỗ trợ phải báo trước.

## Export
Snapshot immutable lúc tạo job. Validate → audible tracks → compose MIDI → render từng track → mixer volume/pan → mix → pedalboard master → write → verify. Mặc định toàn bài, mute/solo cùng chính sách MIDI; MIDI không chứa đủ timbre/effects. Job ID thư mục riêng output/<id>/bai_hat.mid,bai_hat_preview.wav,bai_hat_final.wav. Preview qua mixer chưa master; final qua master; 44100 Hz; nội bộ float32(channels,samples), soundfile(samples,channels); normalize mono/stereo/length trước mix; tail ~2s chỉ cộng một lần; validate empty/NaN/Inf/peak. Phân biệt mute-all với render lỗi; không tự unmute/báo thành công sai. SOUNDFONT_PATH ở đầu render.py; ưu tiên pretty_midi.fluidsynth khi SF/native có; thiếu/lỗi fallback pretty_midi.synthesize, báo sine thiếu timbre/trống; không viết synth bù. Phân biệt pyfluidsynth/native lib/SF. Browser/Python khác timbre công khai, UI nghe chính final/tải files. MP3 chỉ nếu encoder thật (không bắt buộc). queued/running/completed/failed và progress giai đoạn; CPU job không chặn API event loop.

## Persistence
Save JSON đầy đủ musical/settings, open validate trước thay, lỗi giữ project hiện tại. Autosave debounce/version, dirty status, tùy chọn restore, không database. Không giữ history project cũ.

## Bài mẫu
song_data.py chỉ dữ liệu mẫu. 100 BPM,4/4,16 bars=64 beats=38.4s; C-Am-F-G mỗi chord một bar lặp 4 lần. Piano program0,Strings48,Bass32,drums kick36/snare38/hat42. Melody C major có motif/variation/rest/cadence. Có project JSON mẫu.

## UI/accessibility
Dark/compact, tooltip/focus/contrast/loading/empty/error; người dùng không cần hiểu backend. Không fake controls. Hướng dẫn phím tắt, pitch C4..C5 và ví dụ GM trong README.

## Kiểm thử/điều kiện bàn giao
Bắt buộc: TS/build production; domain edits/quantize/beat/validation; undo/redo drag một bước; save/open round-trip; mute/solo/volume/pan mapping; snapshot/error jobs; MIDI reread tracks/program/drums/notes; WAV tồn tại/readable/rate/duration/finite; missing SoundFont; playback repeat không chồng/hanging; UI zoom/scroll. E2E: mẫu/play → track/clip → add/move/resize/velocity → undo/redo → loop → mixer/master → save/reload → export → nghe final/download. Browser automation nếu có; phân biệt nghe thủ công và signal tests; không tuyên bố hay vì file tồn tại. Bước bị chặn phải ghi nguyên nhân/ảnh hưởng/lệnh chạy thay thế, không bịa.
Bàn giao full source, file này cập nhật, README Việt, requirements/package/lock, lệnh install/dev/build/test/run chính xác, sample và exports thực, bảng nghiệm thu tính năng/cách kiểm tra/kết quả/giới hạn. README mô tả cấu trúc, SoundFont, cách mở rộng sample instruments/automation/audio tracks/cloud qua adapter, chưa triển khai trước.

## Kế hoạch thực hiện
1. Ghi đặc tả và chốt schema chung; triển khai song sample, domain/commands/history/validation.
2. Backend compose/render/effects/jobs/API và tests, tạo export thật.
3. Tone instruments/playback/meter/master và interfaces.
4. UI arrangement/piano roll/mixer/transport/persistence/export nối service thật.
5. Build/tests/browser E2E, sửa lỗi, cập nhật bằng chứng/bàn giao.

## Bảng nghiệm thu đã xác minh (2026-10-24)
|Nhóm|Cách kiểm tra|Kết quả và giới hạn|
|---|---|---|
|Domain/schema/time/commands/quantize/history|`cd frontend && npm test`; `pytest tests -q`|15 kiểm thử frontend và 15 kiểm thử Python đạt; số kiểm thử là tổng của từng bộ, không cộng lại theo từng hàng|
|History/selection/một drag một undo|Unit history và `piano.spec.ts`|Đạt; browser gesture kiểm tra dữ liệu thật và undo/redo|
|Piano/arrangement/zoom/scroll/copy-paste|`piano.spec.ts`|1 kiểm thử browser đạt trong 17,3 giây; tọa độ sau zoom/cuộn, move/resize/velocity và save được đối chiếu|
|Tone/play/pause/stop/seek/loop/mute/solo/pan/dispose|`audio.spec.ts`|1 kiểm thử browser tín hiệu đạt trong 6,3 giây; sau sửa giải phóng analyser khi đổi master routing; không thay kiểm tra nghe bằng tai|
|Save/open/autosave/JSON lỗi|Unit repository/round-trip và `project.spec.ts`|Đạt; save/open giữ setting, mở file lỗi giữ nguyên project, history được xóa khi mở project; autosave kiểm tra bằng unit|
|Mixer/master/export player/download|`project.spec.ts`|1 kiểm thử browser đạt trong 11,4 giây: mẫu→phát→mixer/master→lưu/mở→export→player final phát→tải file thật|
|Export/snapshot/errors/fallback/MIDI/WAV/API|`.venv/bin/python -m pytest tests -q`|15 kiểm thử Python đạt khi chạy với quyền network cho TestClient; snapshot, failed job, mute-all, missing SoundFont, file/readback và limiter ceiling đã kiểm tra|
|Production TypeScript/Vite|`cd frontend && npm run build`|Đạt strict TypeScript và production build|
|Nghe sample và final bằng tai người|Người dùng nghe sample và WAV final trên UI|Chưa thực hiện; các kiểm tra tín hiệu/player không đánh giá âm nhạc hay/chất lượng cảm nhận|
|FluidSynth với SoundFont thật|Cài binding/native/SF, đặt SOUNDFONT_PATH rồi export|Chưa thực hiện; nhánh thiếu SF và fallback sine đã kiểm tra, trống của bản WAV fallback có thể im lặng|

## Tiến độ đã xác minh
- Đã kiểm tra repository ban đầu trống, không có AGENTS.md; đã đọc cloud-environment-runtime và network policy trước triển khai.
- Đã triển khai các lớp domain/application/infrastructure/UI, lưu beat/pitch, commands/history và các adapter audio/persistence/export; frontend production build đạt.
- Agent gốc đã chạy `npm test`: **15 passed**; `.venv/bin/python -m pytest tests -q`: **15 passed** với network permission để TestClient dùng socket/self-pipe.
- Ba kịch bản browser đã chạy riêng và đạt: piano **17,3 giây**, project xuyên suốt **11,4 giây**, audio/tín hiệu **6,3 giây**. Không diễn giải các thời gian này là một lượt chạy E2E gộp.
- Có export thật bài mẫu và báo cáo tín hiệu ở phần bằng chứng bên dưới; chưa có kiểm tra nghe thủ công hoặc FluidSynth với ngân hàng thật.

## Việc còn lại và giới hạn bàn giao
- Nghe thủ công sample và WAV final để đánh giá nhạc cụ, cân bằng và master trên thiết bị âm thanh thực. Không thể suy chất lượng cảm nhận từ peak hay file tồn tại.
- Chạy nhánh FluidSynth với `pyfluidsynth`, native library và file `.sf2` có sẵn để kiểm tra âm sắc và trống thực; hướng dẫn/lệnh trong README. Hiện môi trường kiểm thử chỉ xác minh fallback.
- Theo yêu cầu tiếp theo của người dùng, agent gốc đang chuẩn bị preview HTTPS cho điện thoại bằng Sites. Đây là bản static riêng: chỉnh MIDI/playback/lưu JSON có thể dùng trong trình duyệt, xuất Python cần chạy bản local; phải thông báo rõ nếu backend không có. Chưa đánh dấu preview đã xuất bản hoặc đã kiểm tra điện thoại khi chưa có bằng chứng.
- Bản local vẫn ưu tiên desktop từ 1280×720; kiểm thử browser hiện có dùng Chromium. Kiểm tra cảm ứng/iOS/Safari chưa được xác minh.

## Bằng chứng backend đã chạy (2026-10-24)
- `.venv/bin/python -m pytest tests/test_backend.py -q -k 'not api'`: **5 passed, 1 deselected**. Bao gồm validation/migration/JSON round-trip/beat conversion, mute thắng solo, snapshot giữ nguyên khi sửa project gốc, đọc MIDI và WAV, trạng thái renderer lỗi và mute-all xuất im lặng có cảnh báo.
- `.venv/bin/python -m backend.export_sample`: **completed**, job `f818de73-c5cf-479e-9690-dc511164baec`. Kết quả thật trong `output/f818de73-c5cf-479e-9690-dc511164baec/`: MIDI, preview WAV, final WAV, snapshot JSON và báo cáo tín hiệu.
- WAV đọc lại: **44100 Hz, stereo, 1.781.640 samples = 40,4 giây** (38,4 giây phần nhạc + 2 giây đuôi), float, toàn bộ hữu hạn; preview peak `0.2657966`, final peak `0.7060936`. Đây là kiểm tra tín hiệu, **chưa nghe thủ công**.
- Môi trường chưa có SoundFont/native FluidSynth: bản WAV dùng fallback `pretty_midi.synthesize`, có cảnh báo sine không tái tạo đầy đủ nhạc cụ và thiếu trống. MIDI vẫn chứa drum/program/note. Drum-only không có tín hiệu sẽ thất bại rõ ràng, phân biệt với mute-all chủ động.
- Các API job dùng snapshot độc lập và ThreadPoolExecutor một worker; trạng thái queued/running/completed/failed, progress theo giai đoạn và URL tải MIDI/preview/final. File xuất mỗi job riêng, lưu cả snapshot và báo cáo. Giới hạn bảo vệ export: 20 phút hoặc 200.000 note; vượt giới hạn báo failed rõ ràng.
- PrettyMIDI 0.2.10 ghi metadata Latin-1, không có tham số charset trong constructor; tên track MIDI được chuyển ASCII, tên tiếng Việt giữ nguyên JSON. Pedalboard Limiter có auto makeup về 0 dBFS: adapter tầng limiter dùng thêm `pedalboard.Clipping` cuối tầng để giữ ceiling đã chọn; không có gain sau limiter.
- Lượt sandbox mặc định từng chặn socket/self-pipe của TestClient; sau đó agent gốc đã chạy lại toàn bộ `.venv/bin/python -m pytest tests -q` với network permission: **15 passed**, bao gồm API validation/job/download. Không còn bước API chưa xác minh vì giới hạn này. Máy local chạy cùng lệnh không cần cấu hình sandbox.
- Đọc lại MIDI của bài mẫu: 4 track; Piano `(program 0, drum false, 115 note)`, Strings `(48, false, 48)`, Bass `(32, false, 64)`, Drums `(0, true, 192)`; tổng 419 note.

## Quyết định kỹ thuật và cách tiếp tục
- Ghim `pretty_midi==0.2.10` cùng `setuptools==80.9.0`: phiên bản pretty_midi này nhập `pkg_resources`, chưa tương thích setuptools đã loại API đó. Khai báo rõ trong requirements thay vì phụ thuộc ngầm vào môi trường.
- Drum fallback dùng `pretty_midi.Instrument.synthesize()` để tránh phép chuẩn hóa tín hiệu zero thành NaN của `PrettyMIDI.synthesize()` 0.2.10; nhạc cụ có pitch vẫn dùng `PrettyMIDI.synthesize()`. Không viết synth riêng hoặc biến NaN bất kỳ thành zero.
- MIDI metadata dùng ASCII để tương thích API ghi MIDI đã kiểm tra; project JSON vẫn lưu nguyên tên tiếng Việt. MIDI không chứa toàn bộ mixer/master hoặc âm sắc synth.
- Master export giữ chuỗi logic Gain→Compressor→Reverb→Limiter. Do `pedalboard.Limiter` tự bù gain về 0 dBFS, tầng limiter ghép với `pedalboard.Clipping` có sẵn để giữ hard ceiling. Không có gain sau tầng limiter, không có DSP tự viết; sai khác với Tone đã công bố trong UI/job và README.
- Tone master routing giữ nguyên kết nối nội bộ của analyser; không gọi disconnect trên meter khi thay chuỗi, vì thao tác đó cắt gain→split bên trong Tone.Analyser và làm meter luôn bằng zero; browser audio test sau sửa đã đạt. Khi sửa audio routing tiếp, chạy lại `audio.spec.ts` cùng build, không chỉ unit tests.
- Dùng một `playwright.config.ts` chung cho ba kịch bản. `CHROMIUM_PATH` chọn executable; mặc định `/usr/bin/chromium`. Frontend test dùng cổng 5173 và API cổng 8000.

## Bản xem thử HTTPS đã xuất bản
- Người dùng yêu cầu link thử trên điện thoại ngày 2026-10-24. Sites đã xác nhận deployment **succeeded**: https://magdaw-midi-studio.bravestork65.chatgpt.site . Audience mặc định owner-private; có thể cần cùng tài khoản ChatGPT.
- Source preview riêng `/workspace/sites/magdaw-preview`, project ID `appgprj_6adc763fa77c81918ab0164949ebdc42`, commit `70528f4f3682cb400f8c02d842d29ba20ca8b61a`, deployment `appgdep_6adc76c51a408191b85d42d193ef0f6a`. Không tạo Site mới khi cập nhật; đọc `.openai/hosting.json` ở checkout đó.
- Hosting chỉ build tĩnh: mode `preview` hiển thị giới hạn và vô hiệu hóa xuất Python rõ ràng; sửa note/clip, playback, mixer/master, JSON hoạt động trong trình duyệt. Bản local production không bị vô hiệu hóa export. Không tuyên bố hosting chạy Python.
- Thêm layout màn hình hẹp; chưa thử trên điện thoại vật lý. Bản local vẫn ưu tiên desktop. Build local thường đã được khôi phục sau đóng gói preview.
- Skill Sites không có helper filesystem trong môi trường; dùng Git đẩy source chính xác và tar `.openai/hosting.json` + dist từ cùng commit, credential chỉ truyền stdin vào process tạm, không lưu vào repo.
