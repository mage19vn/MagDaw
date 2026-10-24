# MagDaw

MagDaw là DAW MIDI-first chạy cục bộ: sắp xếp clip, viết note, nghe nhiều track bằng Tone.js, chỉnh mixer/master, lưu JSON và xuất MIDI/WAV bằng Python. Bố cục tham chiếu cách làm việc trong một phòng thu trình duyệt; không dùng logo/tài sản BandLab và không tuyên bố tương đương toàn bộ sản phẩm đó.

Bản xem thử điện thoại: https://magdaw-midi-studio.bravestork65.chatgpt.site (Sites riêng tư, có thể cần cùng tài khoản ChatGPT). Bản này hỗ trợ chỉnh sửa/phát/lưu JSON; xuất MIDI/WAV bằng Python cần chạy cục bộ. Xoay ngang để có thêm không gian.

Bản cục bộ không cần tài khoản hay dịch vụ trả phí. Sau khi cài dependencies, synth và bài mẫu hoạt động không cần CDN hoặc tải nhạc cụ qua mạng. Xuất WAV cần máy chủ Python cục bộ đang chạy.

## Cài đặt và chạy

Yêu cầu Python 3.10 trở lên và Node.js 20.19 trở lên; môi trường triển khai dùng Python 3.12, Node.js 24. Các lệnh dưới đây chạy từ thư mục gốc repository, trừ khi có `cd` rõ ràng. `requirements.txt` ghim cả `setuptools==80.9.0` để tương thích `pkg_resources` mà pretty_midi 0.2.10 sử dụng.

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
cd frontend
npm ci
```

Trên Windows, dùng `.venv\Scripts\python.exe` thay `.venv/bin/python`. Hai terminal cho chế độ phát triển:

```bash
# Terminal 1, thư mục gốc
.venv/bin/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

```bash
# Terminal 2
cd frontend
npm run dev
```

Mở `http://localhost:5173`. Vite chuyển `/api` tới Python cổng 8000; API chỉ dùng cho xuất nhạc và dữ liệu mẫu. Nếu 5173 đã được dùng, chọn cổng cố định bằng `npm run dev -- --port 5173 --strictPort` hoặc đóng phiên cũ.

Build frontend:

```bash
cd frontend
npm run build
```

Sau build, máy chủ FastAPI phục vụ ứng dụng từ `frontend/dist`; mở `http://127.0.0.1:8000`. Khi đổi mã nguồn frontend, cần build lại trước khi chạy bản production.

## Bắt đầu một bài nhạc

Ứng dụng mở bài mẫu **100 BPM, 4/4, 16 ô nhịp**, khoảng 38,4 giây chưa tính đuôi render. Hòa âm C–Am–F–G, mỗi hợp âm một ô nhịp, lặp bốn lần; piano program 0, strings 48, bass 32 và trống GM kick 36/snare 38/hi-hat 42. Giai điệu C major có mô-típ, biến tấu, khoảng nghỉ và câu kết. Dữ liệu nguồn nằm trong `backend/app/song_data.py`; bản JSON offline nằm ở `frontend/public/sample-project.json`.

1. Bấm **Phát** hoặc Space để mở AudioContext và nghe. Tạm dừng giữ vị trí; nút vuông dừng và về beat 0.
2. Bấm thước arrangement để seek, kể cả khi đang phát. Chọn clip để mở trong piano roll phía dưới.
3. Bấm **＋ Track**, đặt tên, chọn số program GM và đánh dấu **Trống** nếu cần. Nút ↑/↓ đổi thứ tự; × xóa track.
4. Bấm **＋ Clip** cho track đang chọn, hoặc bấm đúp vùng trống trên arrangement. Kéo clip để đổi thời gian; dùng **Nhân đôi clip** và **Xóa clip** để sắp xếp bài.
5. Trong piano roll, bấm ô trống để tạo note, kéo thân note để đổi beat/pitch, kéo mép phải để đổi độ dài. Bấm phím đàn để nghe thử.
6. Mở **Mixer & Master** để chỉnh âm lượng, pan, mute/solo và chuỗi master. Slider ghi một thao tác khi thả chuột hoặc kết thúc phím điều chỉnh; thay đổi có hiệu lực trong khi playback tiếp tục.
7. **Lưu project** tải JSON đầy đủ. **Mở** đọc và validate JSON trước khi thay bài đang soạn.
8. **Xuất nhạc** tạo job riêng. Theo dõi tiến trình, nghe **chính WAV final** bằng audio player rồi tải MIDI, WAV preview hoặc WAV final.

Clip có thể chồng nhau trên cùng track; các note được cộng dồn, kể cả cùng pitch. Note lưu beat tương đối với clip. Khi kéo hoặc resize note vượt cuối clip, clip mở rộng, không cắt note. Beat dữ liệu luôn là quarter note; ví dụ 6/8 có ba quarter note mỗi ô nhịp, trong khi thước hiển thị sáu phách eighth note.

## Piano roll và phím tắt

Bút **Vẽ** tạo note khi bấm; kéo vùng trống tạo vùng chọn. Công cụ **Chọn** hoặc Shift+kéo dùng để chọn vùng. Ctrl/Cmd+bấm thêm/bớt note khỏi selection. Snap có 1/4 = 1 beat, 1/8 = 0,5 beat, 1/16 = 0,25 beat và tắt. Zoom ngang/dọc chỉ thay hiển thị; dùng thanh cuộn để tới note xa hoặc pitch khác.

|Phím|Thao tác|
|---|---|
|Space|Phát / tạm dừng|
|Ctrl/Cmd+S|Tải project JSON|
|Ctrl/Cmd+Z|Hoàn tác|
|Ctrl/Cmd+Shift+Z hoặc Ctrl/Cmd+Y|Làm lại|
|Ctrl/Cmd+A trong piano roll|Chọn toàn bộ note của clip|
|Ctrl/Cmd+C / X / V|Sao chép / cắt / dán các note đã chọn|
|Ctrl/Cmd+D|Nhân đôi selection|
|Delete hoặc Backspace|Xóa selection|
|Q|Căn nhịp theo snap; khi snap tắt dùng 1/16|
|← / →|Dịch theo snap; khi tắt snap dùng 1/16 beat|
|↑ / ↓|Dịch một semitone|
|Shift+↑ / ↓|Dịch một octave|
|Escape|Hủy gesture đang kéo và bỏ selection|

Phím sửa note cần focus piano roll. Phím tắt không chiếm thao tác khi đang nhập tên hoặc giá trị trong input/select. Copy/paste nhiều note giữ khoảng cách tương đối, pitch, độ dài và velocity; vị trí dán là beat đã bấm gần nhất trong lưới. Quantize làm tròn đầu và độ dài note tới lưới gần nhất, trường hợp đúng giữa chọn mốc sau; độ dài tối thiểu một ô snap. Một lần kéo note tương ứng một bước undo; lựa chọn liên quan được khôi phục cùng lịch sử. Mở bài khác xóa lịch sử cũ.

## Mixer và master

Mute luôn chặn track. Khi bất kỳ track nào solo, chỉ các track solo không mute được nghe. Export dùng cùng chính sách. Volume track từ −60 đến +6 dB, mặc định track mới −9 dB; pan −1 trái, 0 giữa, +1 phải. Meter đo peak thật từ buffer âm thanh, hiển thị dBFS, không phải đo LUFS hay minh chứng âm nhạc nghe hay.

Chuỗi chung: **Gain → Compressor → Reverb → Limiter**. Không đặt gain sau limiter. Mỗi stage có **Bỏ qua** và **Đặt lại**. Gain bypass được lưu trong project; đặt lại đưa gain về 0 dB và tắt bypass.

|Tham số|Miền giá trị|Mặc định|
|---|---|---|
|Master gain|−24…+12 dB|0 dB|
|Compressor threshold|−60…0 dB|−18 dB|
|Compressor ratio|1…20:1|3:1|
|Attack|0,1…100 ms|10 ms|
|Release|10…1000 ms|100 ms|
|Reverb wet|0…1|0,20|
|Reverb room size|0…1|0,50|
|Limiter ceiling|−12…0 dBFS|−1 dBFS|

Tone.js dùng `Gain`, `Compressor`, `Freeverb` và `Limiter`. Python chuyển cùng cấu hình sang pedalboard: gain dB/bypass, compressor threshold/ratio/attack/release, reverb wet/dry và room size. Tầng limiter ghép `Limiter` với `Clipping` có sẵn để giữ ceiling, vì `Limiter` tự bù gain về 0 dBFS; không đặt gain sau tầng này. Trạng thái bỏ qua effect được giữ nguyên. Hai thư viện có thuật toán và cách đáp ứng khác nhau; đặc biệt reverb/limiter không bảo đảm waveform trùng nhau. Cấu hình không bị âm thầm bỏ khi export; cảnh báo của job giải thích sai khác. Nên giữ limiter bật và nghe lại file final.

## Âm sắc, SoundFont và render

Bản nghe mặc định dùng thành phần có sẵn của Tone.js, không phải bộ 128 sample GM:

|Program ở chế độ tự động|Âm sắc nghe thử|
|---|---|
|0–7|Sóng tam giác, envelope gõ kiểu piano|
|32–39|Sóng tam giác, envelope bass ngắn|
|40–55|Sóng răng cưa, attack chậm kiểu strings|
|56–79|Sóng vuông kiểu lead/kèn|
|Các program còn lại|Sóng sine|
|Track trống|MembraneSynth cho kick/tom, NoiseSynth cho snare/hi-hat|

Có thể chọn trực tiếp sine, triangle, sawtooth hoặc square trong **Âm sắc nghe thử**. Program GM vẫn được lưu và xuất MIDI; chọn synth không biến renderer Python thành cùng nhạc cụ đó.

Renderer ưu tiên `pretty_midi.fluidsynth()` khi `SOUNDFONT_PATH` chỉ tới SoundFont hợp lệ và FluidSynth khả dụng. Ba thành phần độc lập:

- **pyfluidsynth** là Python binding, cài bằng `.venv/bin/python -m pip install -r backend/requirements-fluidsynth.txt`.
- **FluidSynth native** là thư viện hệ điều hành. Ví dụ Debian/Ubuntu: cài `libfluidsynth3`; macOS có thể dùng `brew install fluidsynth`. Việc chỉ cài Python binding không cung cấp native library.
- **SoundFont .sf2** là ngân hàng sample, cần tự cung cấp từ nguồn có giấy phép phù hợp. Repo không tải hoặc phân phối SoundFont lúc chạy.

Ví dụ chạy với ngân hàng âm thanh đã có trên máy:

```bash
SOUNDFONT_PATH=/duong/dan/ngan-hang.sf2 .venv/bin/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

`SOUNDFONT_PATH` được đọc ở đầu `backend/app/audio/render.py` lúc khởi động; cần khởi động lại API khi đổi biến. Khi thiếu SF/native/binding hoặc FluidSynth lỗi, renderer chuyển sang `pretty_midi.synthesize()` và báo rõ: bản sine không tái hiện đủ nhạc cụ, drum có thể im lặng. Với drum fallback, adapter gọi `pretty_midi.Instrument.synthesize()` để lấy tín hiệu im lặng trực tiếp, tránh phép chuẩn hóa 0/0 của `PrettyMIDI.synthesize()` phiên bản 0.2.10; không có synth DSP tự viết để che giới hạn. Vì Tone.js và renderer Python khác âm sắc, audio player sau export mới là bản giao thực tế.

## Lưu, mở và khôi phục

JSON chứa schema version, ID ổn định, tracks/clips/notes, BPM/time signature, loop, instrument config và mixer/master. Selection, vị trí đang phát, audio nodes và zoom không nằm trong dữ liệu âm nhạc. Phiên bản hiện tại là 1; schema 0 có đường nâng các setting còn thiếu, phiên bản tương lai bị từ chối rõ ràng. Frontend và backend đều validate số hữu hạn, range, ID và độ dài.

Autosave debounce khoảng 700 ms vào localStorage, có version envelope và thời điểm lưu. Khi mở ứng dụng, chọn **Khôi phục** nếu có bản cũ; **Bỏ qua** tiếp tục bài hiện tại. Trạng thái **Chưa lưu JSON** nhắc rằng autosave chưa thay thế file backup tải về. Nếu trình duyệt chặn hoặc hết dung lượng lưu, lỗi được hiển thị và có thể tiếp tục tải JSON. File JSON lỗi không thay project đang soạn. Mỗi trình duyệt/origin có kho autosave riêng; xóa dữ liệu website sẽ xóa bản tự lưu.

## Đầu ra export

Job chụp snapshot ngay khi bắt đầu; sửa tiếp bài trên UI không làm đổi job đang chạy. Các giai đoạn: validate → lọc track nghe được → compose MIDI → render từng track → volume/pan → mix → master pedalboard → ghi và kiểm tra file. Công việc chạy ở worker, không giữ event loop API trong render.

```text
output/<export-id>/
    bai_hat.mid
    bai_hat_preview.wav
    bai_hat_final.wav
```

Mỗi job có ID/thư mục riêng. WAV stereo 44.100 Hz, nội bộ float32 dạng `(channels, samples)`, ghi soundfile dạng `(samples, channels)`. Preview đã qua mixer, chưa qua master; final qua master. Đuôi khoảng hai giây chỉ cộng một lần, nên bài mẫu dài khoảng 40,4 giây trong WAV. Dữ liệu được kiểm tra rỗng/NaN/Inf/peak và đọc lại file sau ghi. Silence do mute/solo được phân biệt với renderer không tạo được tín hiệu; không tự bật lại track. Drums-only thiếu SoundFont được cảnh báo rõ nếu fallback không có tín hiệu trống.

MIDI giữ note/program/drum flag/tempo/time signature của các track nghe được. Tên track MIDI được chuyển ASCII theo giới hạn charset của thư viện; tên tiếng Việt giữ nguyên JSON. MIDI không chứa toàn bộ âm sắc synth, mixer hay master effects; không kỳ vọng mở MIDI ở ứng dụng khác sẽ nghe giống final. MP3 không được cung cấp trong bản này.

API cục bộ:

|Đường dẫn|Ý nghĩa|
|---|---|
|`GET /api/sample`|Project mẫu|
|`POST /api/exports`|Gửi snapshot Project JSON, tạo job|
|`GET /api/exports/{id}`|Trạng thái `queued/running/completed/failed`, giai đoạn, tiến trình, cảnh báo/lỗi|
|`GET /api/exports/{id}/files/{filename}`|Tải kết quả của job hoàn thành|

Job state lưu trong bộ nhớ của phiên API; file kết quả nằm trên đĩa. Khởi động lại API không khôi phục danh sách job cũ, nhưng file đã xuất vẫn ở `output/`. Nếu export báo không kết nối, kiểm tra API cổng 8000 và proxy Vite. Không cần tương tác với đường dẫn backend để sử dụng giao diện.

## Cấu trúc và điểm mở rộng

```text
AGENT_PROMPT.MD                  Đặc tả độc lập và tiến độ có bằng chứng
backend/app/domain/             Schema Pydantic, validation và chính sách audible tracks
backend/app/audio/              Compose MIDI, render, mixer và pedalboard adapter
backend/app/services/           Export service và job lifecycle
backend/app/main.py             FastAPI routes và phục vụ frontend production
backend/app/song_data.py        Chỉ chứa dữ liệu bài mẫu
frontend/src/domain/            Types, validation, commands thuần, time, history, effect catalog
frontend/src/audio/             AudioEngine, InstrumentProvider và Tone adapter
frontend/src/services/          ProjectRepository và ExportService adapters
frontend/src/app/               Điều phối UI, lifecycle, autosave và playback
frontend/src/features/          Arrangement, piano roll và mixer
frontend/e2e/                   Kiểm tra browser
frontend/public/                Project mẫu offline
tests/                          Kiểm tra backend
output/                         File export theo job
```

Domain lưu beat/pitch, độc lập React/DOM/Tone. UI gửi commands đã validate; mỗi gesture commit một snapshot vào history. Audio nodes sống ngoài render React. `AudioEngine`, `InstrumentProvider`, `ProjectRepository`, `ExportService` là các ranh giới có thể thay adapter. `EFFECT_CATALOG` công bố ID, tham số, miền giá trị và mặc định; thêm effect phải thêm validation cùng adapter playback/export, không chỉ dựng control.

- **Sample instruments:** thêm `InstrumentProvider` dùng asset local; giữ schema cấu hình instrument có version, quản lý tải và giải phóng tài nguyên trong adapter.
- **Automation:** thêm lane/point theo beat qua nâng schema và commands; adapter playback đặt audio parameter theo transport, renderer áp cùng đường cong. Không dùng vòng render UI làm clock.
- **Audio tracks:** thêm kiểu clip có asset reference và metadata thời gian; nối renderer/audio engine ở ranh giới hiện có, không nhét waveform hay audio nodes vào note domain.
- **Cloud persistence:** thay `ProjectRepository`, thêm version/conflict policy và auth ở hạ tầng; không đổi logic chỉnh note hoặc đưa request mạng vào component.

Các phần trên là hướng mở rộng, chưa có tài khoản, cloud/cộng tác, ghi microphone, waveform/time-stretch, VST/native plugin, tempo automation hay số chỉ nhịp thay đổi giữa bài.

## Pitch và General MIDI

Quy ước MIDI 60 = C4. Pitch là số nguyên 0–127, velocity 1–127; program GM dùng chỉ số **0–127**, nên số hiển thị ở phần mềm dùng 1–128 có thể lệch một đơn vị.

|Note|Pitch MIDI|Note|Pitch MIDI|
|---|---:|---|---:|
|C4|60|C♯4|61|
|D4|62|D♯4|63|
|E4|64|F4|65|
|F♯4|66|G4|67|
|G♯4|68|A4|69|
|A♯4|70|B4|71|
|C5|72|||

|Program 0-based|Tên GM|
|---:|---|
|0|Acoustic Grand Piano|
|4|Electric Piano 1|
|24|Nylon Guitar|
|32|Acoustic Bass|
|40|Violin|
|48|String Ensemble 1|
|56|Trumpet|
|73|Flute|

## Kiểm tra và giới hạn xác minh

Chạy unit tests/backend từ gốc và frontend tests/build từ thư mục frontend:

```bash
.venv/bin/python -m pytest tests -q
cd frontend
npm test
npm run build
```

Browser tests cần frontend và API đang chạy theo hướng dẫn dev ở cổng 5173/8000. Cả ba kịch bản dùng `frontend/playwright.config.ts`. Mặc định chạy Chromium hệ thống `/usr/bin/chromium`; chọn executable khác bằng `CHROMIUM_PATH`:

```bash
cd frontend
npm run test:e2e
# Khi Chromium nằm ở nơi khác:
CHROMIUM_PATH=/duong/dan/chromium npm run test:e2e
```

Nếu chưa có Chromium, có thể cài bằng `npx playwright install chromium`, rồi đặt `CHROMIUM_PATH` tới executable vừa cài. Cài browser cần mạng lúc cài; ứng dụng chạy thường không dùng mạng ngoài máy. `audio.spec.ts` kiểm tra tín hiệu Web Audio, `piano.spec.ts` kiểm tra gesture và dữ liệu sau zoom/cuộn, `project.spec.ts` kiểm tra luồng lưu/mở/export/player/download. Player chuyển sang trạng thái phát được kiểm tra tự động; chưa có người nghe bằng tai.

Xuất bài mẫu bằng CLI, không cần trình duyệt:

```bash
# Từ thư mục gốc repository
.venv/bin/python -m backend.export_sample
```

|Nhóm nghiệm thu|Cách tái kiểm tra|Kết quả đã chạy/giới hạn|
|---|---|---|
|Schema/time/note edits/quantize/history/repository|`npm test`|**15 kiểm thử frontend đạt**; gồm round-trip và autosave|
|Production TypeScript/Vite|`npm run build`|**Đạt** strict TypeScript và production build|
|Piano roll/zoom/scroll/undo|`npx playwright test e2e/piano.spec.ts`|**1 kiểm thử đạt, 17,3 giây**; gesture và dữ liệu thật|
|Playback/mute/solo/pan/seek/loop/dispose|`npx playwright test e2e/audio.spec.ts`|**1 kiểm thử đạt, 6,3 giây** sau sửa analyser routing; đo tín hiệu thật|
|Mẫu→mixer/master→lưu/mở→export/player/tải|`npx playwright test e2e/project.spec.ts`|**1 kiểm thử đạt, 11,4 giây**; file JSON lỗi giữ nguyên project|
|MIDI/WAV/snapshot/job errors/fallback/API|`.venv/bin/python -m pytest tests -q` từ gốc|**15 kiểm thử Python đạt**; môi trường sandbox dùng network permission cho socket của TestClient|
|Export mẫu thật|`.venv/bin/python -m backend.export_sample`|Job `f818de73-c5cf-479e-9690-dc511164baec`: WAV stereo 44.100 Hz, 40,4 giây, hữu hạn; MIDI 4 track/419 note|
|Nghe sample và WAV final bằng tai người|Phát trên UI và audio player kết quả|**Chưa kiểm tra thủ công**; không suy ra chất lượng cảm nhận từ file/signal tests|
|FluidSynth với SoundFont thật|Đặt `SOUNDFONT_PATH`, cài binding/native và export|**Chưa kiểm tra**; fallback sine thiếu SF đã đạt, có cảnh báo âm sắc/trống|

Bằng chứng đã chạy và các bước còn lại được ghi trong `AGENT_PROMPT.MD`; không coi hàng trong bảng là đạt nếu chưa có kết quả chạy tương ứng. Khi kiểm tra thủ công, đi hết luồng: bài mẫu/phát → tạo track/clip → thêm/kéo/resize/velocity → undo/redo → loop → mixer/master → lưu/mở → export → nghe final/tải file. Giới hạn âm sắc fallback, khác biệt Tone/pedalboard và job state trong bộ nhớ được công khai ở trên.
