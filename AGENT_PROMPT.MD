# AGENT_PROMPT — DAW chạy trong trình duyệt (MIDI-first)

> Tài liệu này là đặc tả độc lập và đầy đủ của dự án. Một agent khác chỉ cần đọc
> file này là có thể tiếp tục phát triển dự án mà không cần thêm ngữ cảnh nào khác.
> Tài liệu viết bằng tiếng Việt; tên file, biến, hàm, lớp dùng tiếng Anh.

## 0. Lưu ý về hướng kiến trúc (quan trọng)

Dự án này theo hướng **ứng dụng web chạy cục bộ trong trình duyệt**:
backend Python (FastAPI) + frontend React + TypeScript + Vite + Tone.js.

File `~/workspace/your_files/AGENT_PROMPT.MD` cũ mô tả DAW desktop PySide6
**ĐÃ BỊ THAY THẾ** bởi hướng trình duyệt này và **không được dùng lại**.
Không dùng kiến trúc PySide6, không dùng pipeline 5 file desktop cũ.

## 1. Mục tiêu sản phẩm

Xây dựng một DAW (Digital Audio Workstation) thực tế, chạy cục bộ, theo hướng
MIDI-first, để một sinh viên Software Engineering đã biết Python có thể:

- Mở ứng dụng, thấy ngay một bài mẫu có âm thanh.
- Đặt note, soạn bài nhiều track trên arrangement timeline và piano roll.
- Nghe thử trực tiếp trong trình duyệt, chỉnh mixer và master.
- Lưu/mở project, xuất MIDI, WAV preview và WAV final.

### 1.1. Phạm vi phiên bản đầu (bắt buộc)

- Arrangement timeline nhiều track.
- Piano roll soạn và sửa note bằng chuột và bàn phím.
- Transport: play, pause, stop, seek, loop.
- Mixer: volume, pan, mute, solo cho từng track.
- Effects và master chain.
- Lưu/mở project JSON, autosave cục bộ.
- Xuất MIDI, WAV preview (mixer, chưa master) và WAV final (qua master).

### 1.2. Ngoài phạm vi (không triển khai, không hiển thị nút)

Cộng tác trực tuyến, tài khoản, cloud, thu microphone, chỉnh waveform,
time-stretch, hỗ trợ VST. Không hiển thị nút của tính năng chưa triển khai.

## 2. Kiến trúc và công nghệ

### 2.1. Tổng quan

```
Người dùng ──► Frontend (React + TS + Vite, chạy ở http://localhost:5173)
                    │  playback trực tiếp bằng Tone.js (không cần backend)
                    │  lưu/mở project JSON, autosave (localStorage)
                    ▼  REST API (khi cần xuất file)
               Backend (FastAPI + uvicorn, chạy ở http://localhost:8000)
                    │  Project JSON ──► PrettyMIDI ──► render từng track
                    │  ──► áp mixer ──► trộn ──► pedalboard ──► WAV
                    ▼
               output/bai_hat.mid, output/bai_hat_preview.wav,
               output/bai_hat_final.wav
```

### 2.2. Backend — Python 3.10+

- `pretty_midi`: đọc/ghi MIDI, render bằng FluidSynth hoặc synthesize.
- `numpy`: xử lý mảng âm thanh.
- `soundfile`: đọc/ghi WAV.
- `pedalboard`: effects và master khi export.
- `fastapi`, `uvicorn`: API cục bộ.
- `pytest`: kiểm thử.
- Mọi phụ thuộc khai báo đầy đủ trong `backend/requirements.txt`.

### 2.3. Frontend

- React + TypeScript + Vite.
- Tone.js: playback và lập lịch âm thanh trong trình duyệt. Dùng clock của
  `Tone.Transport`; **tuyệt đối không dùng `setInterval` làm clock nhạc chính**
  (chỉ được dùng `requestAnimationFrame` để vẽ playhead trên giao diện).
- `zustand`: quản lý state.
- Mọi phụ thuộc khai báo trong `frontend/package.json`.

### 2.4. Quy ước tổ chức code (bắt buộc)

- Mọi logic nghiệp vụ nằm trong hàm/phương thức có tên rõ ràng, chia module
  theo trách nhiệm. Không gom ứng dụng vào một file lớn. Không đặt toàn bộ
  nghiệp vụ trong component giao diện.
- Không render âm thanh, đọc/ghi project hay khởi động server khi import module.
  Cấp module chỉ khai báo import, hằng số, kiểu dữ liệu, cấu hình.
- Entry point chỉ điều phối bằng các lời gọi hàm.
- Type hint cho Python, type/interface cho TypeScript.
- Không dùng TODO, placeholder hoặc mock data để giả vờ hoàn thành chức năng.
- Hướng dẫn dài đưa vào README, không chèn thành comment dài trong code.

### 2.5. Cấu trúc thư mục

```
AGENT_PROMPT.MD
README.md
backend/
    main.py             # FastAPI app, entry point (chỉ điều phối)
    models.py           # Pydantic models + validation
    song_data.py        # CHỈ chứa dữ liệu bài mẫu, không chứa logic chuyển đổi
    compose.py          # Project -> PrettyMIDI, quy đổi beat <-> giây
    render.py           # Render từng track thành mảng âm thanh
    effects.py          # Master chain pedalboard
    project_service.py  # create/validate/serialize/load/save project
    export_service.py   # Pipeline export MIDI + WAV
    requirements.txt
frontend/
    package.json
    vite.config.ts
    tsconfig.json
    index.html
    src/
        main.tsx
        App.tsx
        styles.css
        types/          # Project, Track, Clip, Note, MasterSettings...
        state/          # Zustand store + undo/redo
        audio/          # Tone.js engine + schedule builder (pure)
        features/       # notes.ts, clips.ts, project.ts (logic thuần, test được)
        components/     # TransportBar, TrackList, Arrangement, PianoRoll,
                        # MixerPanel, MasterPanel, ExportPanel, TopBar
        utils/          # music.ts (tên nốt, snap, beat/time, id)
tests/
    test_backend.py     # pytest: beat, note, validation, save/load, export
output/
    bai_hat.mid
    bai_hat_preview.wav
    bai_hat_final.wav
```

Có thể điều chỉnh cấu trúc nếu có lý do rõ ràng, nhưng giữ ranh giới trách nhiệm.

## 3. Quy ước dữ liệu project

### 3.1. Project JSON

| Trường | Kiểu | Ràng buộc |
| --- | --- | --- |
| `schema_version` | int | Bắt buộc, hiện tại là `1` |
| `name` | string | Tên project |
| `bpm` | number | `> 0` |
| `time_signature` | [int, int] | Ví dụ `[4, 4]` |
| `tracks` | Track[] | Danh sách track |
| `loop_range` | { start_beat, end_beat, enabled } | Vùng loop, `end_beat > start_beat` |
| `master_settings` | MasterSettings | Xem mục 7 |

### 3.2. Track

`id` (string), `name` (string), `program` (int, General MIDI 0–127),
`is_drum` (bool), `volume_db` (number), `pan` (number, −1..1),
`mute` (bool), `solo` (bool), `clips` (Clip[]).

### 3.3. Clip

`id`, `name`, `start_beat` (tính từ đầu project), `length_beats` (dương),
`notes` (Note[]).

### 3.4. Note

`id`, `pitch` (int MIDI 0–127), `start_beat` (tính từ đầu clip),
`length_beat` (dương), `velocity` (int 1–127).

### 3.5. Quy ước chung

- Thời gian lưu theo **beat**, không theo pixel hoặc giây.
- Khi xuất MIDI: `absolute_beat = clip.start_beat + note.start_beat` và
  `seconds = absolute_beat * 60 / BPM`.
- Note kéo vượt biên clip: **giới hạn note trong clip** (clamp start và độ dài
  sao cho note nằm trọn trong clip); không tự mở rộng clip. Ghi rõ quy tắc này
  trong README.
- Frontend và backend dùng cùng schema; backend kiểm tra lại bằng Pydantic
  và trả lỗi có cấu trúc khi dữ liệu không hợp lệ.

## 4. Đặc tả giao diện

Giao diện tối, hiện đại, lấy cảm hứng từ cách tổ chức workspace của BandLab
(chỉ lấy cảm hứng tổ chức, **không sao chép logo, tài sản hay nhận diện
thương hiệu của BandLab**):

- Thanh transport phía trên: play, pause, stop, BPM, vị trí bar:beat, loop,
  metronome.
- Danh sách track bên trái: tên, màu riêng từng track, nhạc cụ, volume, pan,
  mute, solo.
- Arrangement timeline ở giữa: các clip theo track, ruler bar/beat, playhead.
- Piano roll ở vùng chỉnh sửa phía dưới: phím đàn, lưới pitch/time.
- Mixer, effects và master ở panel có thể mở/đóng.
- Trạng thái selection, hover, mute, solo và playback dễ nhận biết.
- Ưu tiên desktop từ 1280×720 trở lên; màn hình nhỏ hơn vẫn truy cập được
  chức năng bằng cuộn hoặc thu gọn panel.
- Nút chỉ dùng icon phải có tooltip; focus rõ ràng; độ tương phản dễ đọc.
- Thông báo bằng tiếng Việt, chỉ rõ nguyên nhân và cách khắc phục. Không để
  traceback hiện trên giao diện. Không dùng `except: pass`.

## 5. Piano roll

Thao tác thật bằng chuột và bàn phím:

- Hiển thị phím đàn và hàng pitch; cuộn tới các vùng pitch và thời gian khác.
- Click vùng trống để tạo note; click để chọn; Shift/Ctrl-click để chọn nhiều.
- Kéo note để đổi pitch và thời điểm; kéo mép phải để đổi độ dài.
- Delete/Backspace xóa note đang chọn.
- Copy/paste (Ctrl+C/Ctrl+V) và duplicate (Ctrl+D).
- Chỉnh velocity của note đang chọn.
- Snap: 1/4, 1/8, 1/16 và tắt snap.
- Zoom ngang và dọc.
- Audition note khi click phím đàn hoặc khi tạo note.
- Undo/redo mọi thao tác chỉnh sửa.
- Phím tắt không kích hoạt khi người dùng đang nhập trong ô text.

Các hàm tương đương (đổi tên được nếu giữ rõ trách nhiệm): `addNote`,
`updateNote`, `deleteNotes`, `moveNotes`, `resizeNote`, `duplicateNotes`,
`setNoteVelocity`, `quantizeNotes`. Logic thuần đặt trong `features/notes.ts`,
không đặt trong component.

## 6. Arrangement và quản lý track

- Thêm, xóa, đổi tên, sắp xếp track (lên/xuống).
- Chọn nhạc cụ (program GM) và chuyển track thành drum track.
- Tạo clip MIDI rỗng; chọn clip để mở piano roll; kéo clip theo timeline
  (snap theo beat); duplicate và xóa clip.
- Zoom timeline, hiển thị bar/beat; playhead đồng bộ giữa arrangement và
  piano roll.
- Mute, solo, volume ngay tại track header.
- Mọi thao tác chỉnh sửa có undo/redo.

## 7. Playback thời gian thực (Tone.js)

- `initializeAudio`, `playProject`, `pausePlayback`, `stopPlayback`,
  `seekToBeat`, `setTempo`, `setLoopRange`, `previewNote`, `disposeAudio`.
- Play, pause (giữ vị trí), stop (dừng sạch note đang phát, playhead về đầu).
- Seek bằng click trên timeline ruler.
- Chỉnh BPM; loop theo vùng chọn; metronome bật/tắt.
- Phát nhiều track đồng thời; chỉnh volume, pan, mute, solo trong lúc phát.
- Dừng sạch các note đang phát khi stop, seek hoặc thay project.
- Không nhân đôi lịch phát sau nhiều lần play/stop: mỗi lần play phải hủy
  lịch cũ trước khi lập lịch mới.
- AudioContext chỉ khởi tạo sau thao tác người dùng (theo chính sách trình
  duyệt).
- Quy tắc solo: nếu có track solo thì chỉ phát các track solo không bị mute.
- Quy tắc clip chồng nhau: các clip chồng nhau trên cùng một track đều được
  phát (cộng dồn note); người dùng tránh chồng clip nếu không muốn note trùng.
- Bản mặc định phát được ngay, không phụ thuộc SoundFont ngoài hay CDN tải
  nhạc cụ lúc chạy: dùng synth có sẵn của Tone.js (PolySynth cho track có cao
  độ; MembraneSynth/NoiseSynth/MetalSynth cho kick/snare/hi-hat). Nói rõ trong
  README và giao diện rằng đây là **âm sắc nghe thử, không tái tạo chính xác
  mọi program General MIDI**.

## 8. Mixer, effects và master

- Mỗi track có volume, pan, mute, solo; có tác dụng cả khi playback và export.
- Master chain (theo đúng thứ tự): Gain → Compressor → Reverb → Limiter.
- UI chỉnh tham số, bật/tắt từng effect, reset về mặc định.
- Reverb mặc định wet khoảng 0,15–0,25 (mặc định 0,2).
- Limiter là effect cuối cùng, ceiling khoảng −1 dBFS (mặc định −1,0).
- Không normalize hoặc tăng gain sau limiter. Không tuyên bố đạt chuẩn LUFS
  khi chưa đo.
- Peak meter dùng dữ liệu âm thanh thực (Tone.Meter), không dùng animation giả.
- Playback dùng effects tương đương trong Tone.js; export chính thức dùng
  pedalboard. **Phải nói rõ trong README rằng hai bản nghe có thể khác nhau,
  không hứa giống tuyệt đối.**
- Các hàm tương đương: `setTrackVolume`, `setTrackPan`, `setTrackMute`,
  `setTrackSolo`, `updateMasterSettings`, `buildEffectsChain`, `applyMaster`.

## 9. Xuất MIDI và âm thanh (backend)

Pipeline bắt buộc:

```
Project → PrettyMIDI → render từng track → áp mixer (pan, volume)
       → trộn → pedalboard (master) → WAV
```

- Áp dụng pan và volume theo từng track **trước khi trộn**; không render một
  bản MIDI gộp rồi giả định mixer đã được giữ nguyên.
- MIDI giữ đủ track, program, drum flag, tempo, thời gian note.
- Xuất mặc định theo các track đang nghe được sau mute/solo (track mute bị
  loại; nếu có track solo thì chỉ xuất các track solo không bị mute).
- MIDI không chứa hiệu ứng âm thanh; giải thích rõ giới hạn đó trong README
  và giao diện.
- Sample rate mặc định 44100 Hz.
- `SOUNDFONT_PATH` đặt ở đầu `render.py`. Nếu SoundFont hợp lệ và FluidSynth
  dùng được thì render bằng `pretty_midi.fluidsynth()`. Nếu thiếu hoặc lỗi thì
  chuyển sang `pretty_midi.synthesize()` và trả cảnh báo bằng tiếng Việt.
  `pyfluidsynth`, thư viện native FluidSynth và SoundFont là tùy chọn, hướng
  dẫn riêng trong README.
- Nhánh sine **không tái tạo chính xác nhạc cụ General MIDI và có thể không
  có tiếng trống**; vẫn phải xuất được bản nghe thử từ các track có cao độ;
  không tự viết engine DSP thay thế; không âm thầm bỏ qua giới hạn này.
- Mảng âm thanh nội bộ: float32, shape `(channels, samples)`. Khi ghi bằng
  soundfile: chuyển sang `(samples, channels)`. Chuẩn hóa mono/stereo trước
  khi trộn. Kiểm tra âm thanh rỗng, NaN/Inf và im lặng.
- Đuôi âm thanh khoảng 2 giây để giữ reverb.
- File đầu ra: `output/bai_hat.mid`, `output/bai_hat_preview.wav`
  (đã áp mixer, chưa qua master), `output/bai_hat_final.wav` (sau pedalboard).
- Chỉ xuất MP3 nếu môi trường thực sự hỗ trợ ghi MP3; không đổi đuôi WAV
  để giả MP3.
- UI hiển thị tiến trình/trạng thái export, lỗi rõ ràng, nút tải file sau khi
  hoàn thành. Export thất bại cho phép thử lại mà không mất project.
- Không ghi đè tùy ý đường dẫn ngoài thư mục export.

## 10. Bài mẫu khi mở ứng dụng lần đầu

- 100 BPM, 4/4, 16 ô nhịp (64 beat, phần nhạc khoảng 38,4 giây chưa tính đuôi).
- Vòng C – Am – F – G; mỗi hợp âm một ô nhịp, lặp 4 lần.
- Melody: piano, program 0. Chords: strings, program 48. Bass: acoustic bass,
  program 32. Drums: `is_drum=True`, kick 36, snare 38, hi-hat 42.
- Giai điệu tự sáng tác trên C major, có mô-típ, biến tấu nhẹ, khoảng nghỉ
  và câu kết. Bấm Play là nghe được ngay.
- `song_data.py` chỉ chứa dữ liệu bài mẫu; logic chuyển dữ liệu đặt ở module
  khác (`compose.py`, `project_service.py`).

## 11. Lưu và mở project

- Lưu project thành JSON và tải về máy; mở lại JSON, khôi phục đầy đủ note,
  clip, mixer, loop và master settings.
- Autosave cục bộ với debounce (localStorage); thông báo project chưa lưu và
  lựa chọn khôi phục autosave khi phù hợp.
- Kiểm tra schema và báo lỗi dễ hiểu nếu file không hợp lệ; không âm thầm
  xóa project hiện tại khi mở file lỗi.
- Các hàm tương đương: `createProject`, `validateProject`,
  `serializeProject`, `loadProject`, `saveProject`, `restoreAutosave`.

## 12. API backend

- `GET /api/sample` — trả bài mẫu (JSON project).
- `POST /api/validate` — kiểm tra project, trả `{ valid, errors }`.
- `POST /api/export` — nhận project JSON, chạy pipeline export, trả
  `{ midi, preview_wav, final_wav, warnings, peaks }` (đường dẫn tải tương đối).
- `GET /api/download/{name}` — tải file trong `output/` (`bai_hat.mid`,
  `bai_hat_preview.wav`, `bai_hat_final.wav`); từ chối tên file ngoài danh
  sách cho phép.
- Lỗi trả JSON có cấu trúc `{ detail }` với thông điệp tiếng Việt; không lộ
  traceback ra client.

## 13. Thứ tự triển khai

1. `AGENT_PROMPT.MD` (file này) và `README.md`.
2. Backend: `models.py` → `song_data.py` → `compose.py` → `render.py` →
   `effects.py` → `project_service.py` → `export_service.py` → `main.py`.
3. Frontend: `types` → `utils` → `features` (notes, clips, project) →
   `state` (store + undo/redo) → `audio` (engine) → `components` → `App`.
4. Tests backend (pytest) và kiểm tra build frontend (`npm run build`).
5. Chạy export bài mẫu, kiểm tra lại MIDI/WAV, ghi kết quả vào README/báo cáo.

## 14. Tiêu chí nghiệm thu và lệnh kiểm tra

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev        # http://localhost:5173
npm run build      # kiểm tra TypeScript + build

# Tests
python -m pytest tests/ -v
```

Kiểm tra thực tế (chỉ ghi "đạt" khi đã chạy thật):

1. Cài phụ thuộc, chạy backend và frontend.
2. Build frontend và kiểm tra TypeScript.
3. Mở bài mẫu, phát/dừng/seek/loop.
4. Tạo, kéo, resize, xóa note và undo/redo.
5. Chỉnh volume, pan, mute, solo.
6. Lưu project, mở lại và so sánh dữ liệu.
7. Xuất MIDI và hai WAV.
8. Đọc lại MIDI: đúng track, program, drum flag và note.
9. Đọc lại WAV: đúng sample rate, có âm thanh, không NaN/Inf, thời lượng
   hợp lý.
10. Kiểm tra peak final tương ứng thiết lập limiter (ceiling −1 dBFS, dung
    sai hợp lý).
11. Kiểm tra thiếu SoundFont vẫn xuất được bằng sine và có cảnh báo.
12. Kiểm tra nhiều lần play/stop không gây note treo hoặc phát chồng lịch.

Nếu môi trường chặn cài đặt hoặc chạy bước nào, nêu rõ nguyên nhân, phần bị
ảnh hưởng và lệnh để người dùng kiểm tra tại máy mình. Tuyệt đối không tuyên
bố "đã kiểm thử" với bước chưa chạy.

## 15. Giới hạn kỹ thuật phải công khai (ghi trong README)

- Playback trình duyệt dùng synth của Tone.js: âm sắc nghe thử, khác với
  render SoundFont và render sine của backend; không hứa ba bản giống nhau.
- Render sine không tái tạo chính xác nhạc cụ GM và có thể không có tiếng
  trống (track drum render sine cho ra âm gần như im lặng).
- MIDI không chứa hiệu ứng âm thanh (mixer, reverb, limiter không nằm trong
  file MIDI).
- Peak meter và limiter đo trên dữ liệu thực, không phải chuẩn LUFS.
- Autosave chỉ lưu trong trình duyệt đang dùng (localStorage), không đồng bộ
  lên server hay thiết bị khác.
