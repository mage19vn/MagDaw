# DAW — Studio làm nhạc trong trình duyệt (MIDI-first)

DAW chạy cục bộ, theo hướng MIDI-first: soạn nhạc nhiều track trên
arrangement timeline và piano roll, nghe thử trực tiếp trong trình duyệt,
chỉnh mixer và master, lưu/mở project, xuất MIDI và WAV.

> **Lưu ý về hướng kiến trúc:** dự án này theo hướng **web** (backend Python +
> frontend React). File `~/workspace/your_files/AGENT_PROMPT.MD` cũ mô tả DAW
> desktop PySide6 **đã bị thay thế** bởi hướng trình duyệt này và không được
> dùng lại. Đặc tả đầy đủ của dự án nằm ở `AGENT_PROMPT.MD` tại gốc repo này.

Giao diện lấy cảm hứng từ cách tổ chức workspace của BandLab (transport trên
cùng, track bên trái, timeline ở giữa, piano roll phía dưới, mixer/master ở
panel mở/đóng được). Dự án không sao chép logo hay tài sản thương hiệu nào
của BandLab.

## Yêu cầu

- Python 3.10+ (đã kiểm tra với Python 3.12).
- Node.js 18+ và npm (đã kiểm tra với Node 24, npm 10).
- Không cần SoundFont để chạy và xuất bản nghe thử (xem mục SoundFont).

## Cài đặt và chạy

```bash
# Backend (cổng 8000)
cd backend
python3 -m venv ../.venv
../.venv/bin/pip install -r requirements.txt
../.venv/bin/uvicorn main:app --port 8000

# Frontend (cổng 5173) — mở terminal thứ hai
cd frontend
npm install
npm run dev        # mở http://localhost:5173
npm run build      # kiểm tra TypeScript + build production
```

Mở `http://localhost:5173`, ứng dụng tự tải bài mẫu từ backend và bấm Play
là nghe được ngay. Nếu backend chưa chạy, giao diện báo lỗi và cho phép tạo
project trống hoặc thử tải lại.

## Test trên điện thoại (cùng mạng Wi-Fi với máy tính)

Backend đã tích hợp sẵn bản build production của frontend (`frontend/dist`),
nên chỉ cần chạy backend là đủ, không cần chạy riêng frontend:

```bash
cd backend
../.venv/bin/uvicorn main:app --port 8000 --host 0.0.0.0
```

Sau đó trên điện thoại (cùng Wi-Fi), mở trình duyệt và truy cập
`http://<địa-chỉ-IP-LAN-của-máy-tính>:8000` (ví dụ `http://192.168.1.10:8000`).
Bài mẫu tự tải, bấm Play là nghe được ngay — trình duyệt chỉ cho phát âm
thanh sau một lần chạm của người dùng nên lần Play đầu tiên phải bấm nút Play.
Chức năng export (MIDI, WAV) cũng chạy qua cùng địa chỉ này, không cần cấu
hình thêm. Lưu ý: cách này chỉ dùng để test trong mạng nội bộ, không phải
địa chỉ công khai trên Internet.

## Cách sử dụng

### Arrangement

- Bấm tên track ở danh sách bên trái để chọn track.
- Bấm clip để chọn và mở piano roll của clip đó.
- Kéo clip theo timeline để dời vị trí (snap theo beat).
- Nút “+ Clip rỗng (4 beat)” tạo clip tại vị trí playhead trên track đang
  chọn; “Nhân đôi clip” / “Xóa clip” tác động lên clip đang chọn.
- Bấm ruler để tua (seek) đến vị trí đó; playhead đồng bộ giữa arrangement
  và piano roll.

### Piano roll

- Click vùng trống để tạo note (độ dài mặc định bằng snap đang chọn).
- Click note để chọn; Shift+Click hoặc Ctrl+Click để chọn nhiều note.
- Kéo note để đổi pitch và thời điểm; kéo mép phải của note để đổi độ dài.
- Delete/Backspace xóa note đang chọn.
- Nút Quantize đưa note đang chọn về lưới snap; nút Duplicate nhân đôi note.
- Click phím đàn bên trái để nghe thử note đó.
- Snap: Tắt, 1/4, 1/8, 1/16. Zoom ngang/dọc bằng thanh trượt.
- **Quy tắc biên clip:** note kéo vượt biên clip sẽ bị giới hạn trong clip
  (clamp), clip không tự mở rộng.

### Track và mixer

- Mỗi track có tên, nhạc cụ (program GM 0–127), drum track, volume (dB),
  pan (−1..1), mute, solo — chỉnh ngay tại track header hoặc panel Mixer.
- **Quy tắc solo:** nếu có track solo thì chỉ phát các track solo không bị
  mute. Nếu không có track solo thì phát mọi track không bị mute.
- **Clip chồng nhau:** các clip chồng nhau trên cùng một track đều được phát
  (cộng dồn note). Tránh xếp chồng clip nếu không muốn note trùng nhau.
- Chỉnh volume/pan/mute/solo có tác dụng cả khi phát trực tiếp và khi xuất.

### Transport

- Play / Pause (giữ vị trí) / Stop (dừng sạch note đang phát, playhead về
  đầu). Phím Space cũng phát/tạm dừng.
- BPM chỉnh trực tiếp trên thanh transport.
- Loop: bật checkbox Loop và nhập vùng bắt đầu/kết thúc theo beat.
- Metronome: bật/tắt, gõ theo phách 4n.
- AudioContext chỉ khởi tạo sau thao tác người dùng (theo chính sách trình
  duyệt) — lần bấm Play đầu tiên có thể cần bấm lại nếu trình duyệt chặn.

### Master

Chuỗi master theo đúng thứ tự: Gain → Compressor → Reverb → Limiter.

- Reverb mặc định wet 0,2 (khoảng khuyến nghị 0,15–0,25).
- Limiter luôn là effect cuối cùng, ceiling mặc định −1 dBFS. Không có bước
  normalize hay tăng gain nào sau limiter.
- Peak meter lấy từ dữ liệu âm thanh thực (Tone.Meter), không phải animation
  giả. Dự án không tuyên bố đạt chuẩn LUFS vì chưa đo LUFS.
- Nút “Reset mặc định” đưa toàn bộ master về thiết lập gốc.

### Lưu / mở project

- “Lưu project (.json)” tải file JSON về máy. “Mở project” đọc lại file JSON
  và khôi phục đầy đủ note, clip, mixer, loop và master settings.
- Autosave: project tự lưu vào localStorage của trình duyệt sau mỗi thay đổi
  (debounce 1 giây). Nút “Khôi phục autosave” xuất hiện khi có bản autosave.
  Autosave chỉ nằm trong trình duyệt đang dùng, không đồng bộ lên server hay
  thiết bị khác.
- File project không hợp lệ sẽ báo lỗi rõ ràng và project hiện tại không bị
  xóa.

### Export

- Panel Export → “Xuất MIDI + WAV”. Backend chạy pipeline:
  Project → PrettyMIDI → render từng track → áp mixer (pan, volume) →
  trộn → pedalboard master → WAV.
- File ra: `output/bai_hat.mid`, `output/bai_hat_preview.wav`
  (đã áp mixer, chưa qua master), `output/bai_hat_final.wav` (sau master).
- MIDI chỉ chứa note, track, program, drum flag và tempo — **không chứa
  hiệu ứng âm thanh**. Muốn giữ nguyên âm sắc master thì dùng file WAV final.
- Xuất mặc định theo các track đang nghe được sau mute/solo.
- Export thất bại vẫn giữ nguyên project, bấm lại là được.

## Phím tắt

| Phím | Tác dụng |
| --- | --- |
| Space | Phát / tạm dừng |
| Delete / Backspace | Xóa note đang chọn |
| Ctrl+Z / Ctrl+Shift+Z | Undo / Redo |
| Ctrl+Y | Redo |
| Ctrl+C / Ctrl+V | Copy / Paste note |
| Ctrl+D | Nhân đôi note |

Phím tắt không kích hoạt khi đang nhập trong ô text.

## Bảng pitch C4–C5 (quy ước C4 = MIDI 60)

| Nốt | C4 | C#4 | D4 | D#4 | E4 | F4 | F#4 | G4 | G#4 | A4 | A#4 | B4 | C5 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MIDI | 60 | 61 | 62 | 63 | 64 | 65 | 66 | 67 | 68 | 69 | 70 | 71 | 72 |

## Một số program General MIDI (chỉ số 0–127)

| Program | Nhạc cụ |
| --- | --- |
| 0 | Acoustic Grand Piano |
| 6 | Harpsichord |
| 24 | Nylon Guitar |
| 32 | Acoustic Bass |
| 40 | Violin |
| 48 | String Ensemble 1 |
| 56 | Trumpet |
| 73 | Flute |
| 80 | Lead 1 (square) |
| 118 | Synth Drum |

Track trống dùng `is_drum = true` (kênh trống MIDI), pitch 36 = kick,
38 = snare, 42 = hi-hat.

## Bài mẫu

Bài mẫu 100 BPM, 4/4, 16 ô nhịp (64 beat, khoảng 38,4 giây chưa tính đuôi):
vòng C – Am – F – G, mỗi hợp âm một ô nhịp, lặp 4 lần. Melody (piano,
program 0) tự sáng tác trên C major có mô-típ và câu kết; Chords (strings,
program 48); Bass (acoustic bass, program 32); Drums (kick 36, snare 38,
hi-hat 42). Dữ liệu bài mẫu nằm ở `backend/song_data.py`; muốn sửa bài mẫu
thì sửa file đó rồi tải lại trang (backend tự đọc lại khi khởi động).

## SoundFont / FluidSynth (tùy chọn)

Mặc định backend render bằng sóng sine (`pretty_midi.synthesize()`). Muốn
nghe đúng tiếng nhạc cụ General MIDI và tiếng trống, cần SoundFont + FluidSynth:

```bash
pip install pyfluidsynth
# Cài thư viện native FluidSynth của hệ điều hành, ví dụ Ubuntu:
# sudo apt install fluidsynth
# Tải một SoundFont, ví dụ GeneralUser GS, rồi đặt biến môi trường:
export SOUNDFONT_PATH=/duong/dan/toi/GeneralUser-GS.sf2
```

`SOUNDFONT_PATH` được đặt ở đầu `backend/render.py`. Nếu SoundFont hợp lệ
và FluidSynth dùng được, backend render bằng `pretty_midi.fluidsynth()`;
nếu thiếu hoặc lỗi, backend tự chuyển sang render sine và trả cảnh báo bằng
tiếng Việt trong kết quả export.

## Khác biệt giữa các bản nghe

| Bản nghe | Engine | Đặc điểm |
| --- | --- | --- |
| Nghe trực tiếp trong trình duyệt | Tone.js synth có sẵn | Âm sắc nghe thử, không tái tạo chính xác mọi program GM; trống dùng kick/snare/hi-hat tổng hợp sẵn. |
| Render SoundFont (khi có SF2) | pretty_midi + FluidSynth | Gần với nhạc cụ GM thật nhất. |
| Render sine (mặc định khi thiếu SF2) | pretty_midi.synthesize() | Âm sine đơn giản, không giống nhạc cụ GM; track trống gần như im lặng. |

**Ba bản không hứa giống nhau tuyệt đối.** Dùng file WAV final làm bản
chuẩn khi cần âm sắc sau master.

## Cấu trúc project

```
AGENT_PROMPT.MD
README.md
backend/
    main.py            # FastAPI app, entry point
    models.py          # Pydantic models + validation
    song_data.py       # Chỉ chứa dữ liệu bài mẫu
    compose.py         # Project -> PrettyMIDI, quy đổi beat <-> giây
    render.py          # Render từng track (SoundFont hoặc sine)
    effects.py         # Master chain pedalboard
    project_service.py # create/validate/serialize/load/save project
    export_service.py  # Pipeline export MIDI + WAV
    requirements.txt
frontend/
    package.json
    src/
        components/    # TransportBar, TrackList, Arrangement, PianoRoll,
                       # MixerPanel, MasterPanel, ExportPanel, TopBar
        features/      # notes, clips, tracks, project (logic thuần)
        audio/         # engine Tone.js + schedule builder
        state/         # Zustand store + undo/redo
        types/         # Project, Track, Clip, Note...
        utils/         # music.ts
tests/
    test_backend.py          # pytest
    frontend_logic.test.ts   # logic TS, chạy bằng esbuild + node
output/
    bai_hat.mid, bai_hat_preview.wav, bai_hat_final.wav
```

## Kiểm thử

```bash
# Backend (từ gốc dự án, cần venv đã cài requirements)
.venv/bin/python -m pytest tests/test_backend.py -v

# Logic frontend thuần (không cần trình duyệt)
./frontend/node_modules/.bin/esbuild tests/frontend_logic.test.ts \
  --bundle --platform=node --format=cjs \
  --outfile=/tmp/daw_frontend_logic.cjs --log-level=warning
node /tmp/daw_frontend_logic.cjs

# Build frontend (kiểm tra TypeScript)
cd frontend && npm run build
```

## Lỗi thường gặp

| Triệu chứng | Nguyên nhân và cách khắc phục |
| --- | --- |
| “Không tải được bài mẫu từ backend” | Backend chưa chạy. Chạy `uvicorn main:app --port 8000` trong `backend/`, rồi bấm “Thử tải lại bài mẫu”. |
| Bấm Play không nghe tiếng | Trình duyệt chặn AudioContext. Bấm lại Play sau một thao tác chuột; kiểm tra loa/tai nghe và tab không bị mute. |
| Export báo “Không có track nào đang nghe được” | Tất cả track đang bị mute (hoặc track solo duy nhất cũng bị mute). Bỏ mute ít nhất một track rồi export lại. |
| Export chỉ có cảnh báo SoundFont | Bình thường khi chưa đặt SOUNDFONT_PATH. Bản WAV vẫn xuất được bằng sine; muốn đúng tiếng GM thì làm theo mục SoundFont. |
| Bản WAV final nghe khác bản nghe trực tiếp | Đúng thiết kế: playback dùng Tone.js, export dùng pedalboard (xem bảng khác biệt ở trên). |
| Mở file project báo không hợp lệ | File sai schema (thiếu schema_version, BPM ≤ 0, pitch/velocity ngoài khoảng, note vượt clip). Sửa file theo schema ở AGENT_PROMPT.MD rồi mở lại; project hiện tại không bị xóa. |

## Những giới hạn còn tồn tại

- Playback trình duyệt dùng synth của Tone.js: âm sắc nghe thử, khác với
  render SoundFont và render sine của backend.
- Render sine không tái tạo chính xác nhạc cụ GM và có thể không có tiếng
  trống (track drum render sine cho ra âm gần như im lặng).
- MIDI không chứa hiệu ứng âm thanh.
- Chưa đo LUFS; peak meter và limiter không thay thế đo LUFS.
- Autosave chỉ lưu trong trình duyệt đang dùng.
- Ngoài phạm vi bản đầu: cộng tác trực tuyến, tài khoản, cloud, thu
  microphone, chỉnh waveform, time-stretch, hỗ trợ VST — các nút này không
  xuất hiện trong giao diện.
- Playback/loop/seek đã kiểm tra ở mức code và logic lập lịch; kiểm tra bằng
  trình duyệt thật chưa thực hiện trong môi trường này (xem báo cáo bàn giao).
