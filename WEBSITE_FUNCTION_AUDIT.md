# Audit fungsi InTrack

Tanggal: 15 September 2026. Keputusan pengguna: mulai kosong dengan akun dan layanan baru.

Catatan publikasi GitHub: laporan ini merekam kondisi sebelum publikasi. Snapshot publikasi sudah mengganti seed password demo dengan environment bootstrap, menghapus fallback JWT demo, serta mengeluarkan workflow deploy lama dan rewrite ke backend lama. Bukti konfigurasi lokal tidak dipublikasikan. Temuan fungsi lainnya tetap perlu ditangani.

## Kesimpulan

UI dan build berjalan, tetapi aplikasi belum dapat dinyatakan seluruhnya siap produksi. Terdapat masalah pada pembatasan akses data, absensi/Face ID, konfigurasi OAuth, serta sinkronisasi integrasi. Mengganti akun atau API key saja tidak menyelesaikan masalah tersebut.

Audit ini tidak mengubah logika aplikasi atau kredensial aktif dan tidak memindahkan/menghapus data lama.

## Pengujian dan batas cakupan

| Pemeriksaan | Hasil dan batas |
|---|---|
| Build frontend terbaru | Lulus; warning bundle utama sekitar 819 kB tetap ada |
| API lokal `/api/health`, port 3001 | HTTP 200; endpoint ini tidak memeriksa koneksi database |
| Frontend lokal port 5173 | HTTP 200 |
| Face service lokal port 8001 `/health` | Tidak dapat diakses saat audit |
| HTTP API dengan database/storage/provider tiruan | 18 pemeriksaan: 13 memenuhi ekspektasi, 5 mengungkap defect |
| Tes cookie HTTP/HTTPS | 2 tes lulus |
| UI desktop/mobile | Hasil sesi sebelumnya: 11 route, 1440px dan 390px, tanpa runtime error/overflow; bukan pengujian transaksi database nyata |
| Lint | Hasil sesi sebelumnya: 39 error dan 9 warning; belum bersih |
| Konfigurasi lokal | Seluruh variabel inti terisi; keberadaan nilai bukan bukti kredensial valid |
| OAuth, R2, AI, database baru | Belum diuji end-to-end menggunakan akun baru karena belum dibuat |
| Kamera/geolocation/PDF | Ditinjau dari kode dan UI; belum ada uji wajah fisik, lokasi nyata, atau pembandingan visual PDF dalam audit ini |

Reproduksi pemeriksaan terisolasi, dari root project:

```powershell
node docs/function-audit.cjs
node docs/config-audit.cjs
node --test server/test/auth-cookies.test.js
npm run build --prefix client
```

`function-audit.cjs` memakai user dan penyimpanan tiruan, bukan database aktif. Script melaporkan `passed: false` untuk defect; exit code 0 berarti audit selesai, bukan berarti semua pemeriksaan lulus. Bukti: [hasil API](docs/function-audit-results.json), [konfigurasi tanpa secret](docs/config-audit-results.json), [hasil UI sebelumnya](docs/ui-rebranding/english-results.json).

## Temuan prioritas

### P0 — sebelum dipakai oleh banyak pengguna

1. **Akses objek lintas pengguna belum dibatasi.** GET detail absensi dan upload evidence memakai ID tanpa pemeriksaan pemilik; tambah/edit/hapus task logbook juga belum memeriksa pemilik entry/task. Pada HTTP test, intern membaca absensi asing mendapat 200 dan menghapus task asing mendapat 200. Tambahkan pemeriksaan pemilik dan policy mentor/admin di server, termasuk field whitelist pada update task. Sumber: `server/src/routes/attendance.routes.js`, `controllers/attendance.controller.js`, `controllers/logbook.controller.js`, `services/logbook.service.js`.
2. **Submit absensi tidak mensyaratkan bukti verifikasi wajah di server.** UI memverifikasi wajah, tetapi endpoint submit tidak memvalidasi hasil verifikasi yang terikat pada user/transaksi/waktu. Test submit tanpa verifikasi mendapatkan 201. Batas gagal 5 kali juga hanya state React dan bisa hilang saat reload; belum ada alur approval mentor yang lengkap. Implementasikan token verifikasi sekali pakai, expiry, dan penghitung percobaan di server. Sumber: `controllers/attendance.controller.js`, `pages/intern/Absen.jsx`.
3. **OAuth state menggunakan user ID langsung.** Google/Notion callback publik menerima identitas user dari `state`, tanpa nonce acak, expiry, atau pengikatan pada sesi pemulai. Perlu validasi state sekali pakai sebelum menyimpan token. Ini temuan kode, bukan percobaan mengambil alih akun nyata. Sumber: `services/google.service.js`, `services/notion.service.js`, `routes/google.routes.js`, `routes/auth.routes.js`.

### P1 — menghambat integrasi dan akurasi fungsi

4. **Callback Google aktif tidak cocok dengan konfigurasi.** Route yang tersedia adalah `/api/google/callback`. Pemeriksaan path `GOOGLE_REDIRECT_URI` lokal menghasilkan mismatch; fallback konfigurasi juga memakai `/api/auth/google/callback`. Set callback baru tepat seperti route aktif, termasuk port/domain.
5. **Notion belum tersambung sebagai alur absensi yang utuh.** Callback kembali ke `/mentor/settings`, padahal halaman ada di `/admin/settings`. Token disimpan per user; tombol Connect ada di Settings admin, sedangkan sync mencari token intern pengirim absensi. Selain itu JWT login pertama hanya memuat ID/role sehingga `req.user.name` untuk judul Notion kosong; test mengonfirmasinya. Ambil nama dari database dan putuskan integrasi terpusat atau per-user. `notionDatabaseId` dipilih dari database pertama hasil search, bukan pilihan eksplisit pengguna.
6. **Face service belum tersedia dan jumlah foto tidak konsisten.** UI dan syarat `faceEnrolled` menggunakan 15 foto, tetapi API status melaporkan `required: 3` dan remaining dihitung dari 3. Perbaiki satu konstanta kebutuhan foto. Model perlu berjalan sebelum enrollment/verification nyata bisa diuji. Sumber: `services/face.service.js`, `ai-service/main.py`.
7. **Jam dan koordinat kantor tidak konsisten dengan Settings.** Jarak dihitung dari environment `OFFICE_LATITUDE/LONGITUDE`, bukan nilai AppSetting yang diedit admin. Submit hanya memeriksa jam selesai, bukan mulai. Tanggal UTC dicampur jam lokal server; deployment UTC bisa berbeda dari WIB. UI subtitle masih 10.00–17.00 tetap. Jadikan Asia/Jakarta dan sumber setting tunggal. Jarak saat ini dicatat, bukan pembatas radius kantor. Sumber: `services/attendance.service.js`, `controllers/attendance.controller.js`, `pages/intern/Absen.jsx`.
8. **Google Calendar belum sinkron penuh.** Create dan delete terhubung; update hanya mengubah database lokal. Tidak ada import, webhook, atau rekonsiliasi perubahan Google ke InTrack. All-day mengirim tanggal akhir hari yang dipilih, sedangkan Google memakai akhir eksklusif; perlu tambah satu hari kalender. Filter planner berdasarkan startDate juga bisa melewatkan event yang mulai sebelum rentang tetapi masih berlangsung. Sumber: `services/google.service.js`, `services/planner.service.js`; [aturan end eksklusif](https://developers.google.com/workspace/calendar/api/v3/reference/events).
9. **Upload gagal bisa menghasilkan data parsial.** Absensi di-upsert sebelum file tersimpan; kegagalan R2 meninggalkan absensi tanpa bukti. Storage yang tidak dikonfigurasi mengembalikan URL `placeholder.local` alih-alih menolak upload. Evidence wajib logbook hanya ditegakkan di UI. Sumber: `services/r2.service.js`, `controllers/attendance.controller.js`, `controllers/logbook.controller.js`.
10. **Hosting masih menunjuk identitas lama.** `client/vercel.json` meneruskan `/api` ke backend GetAbsen lama. Workflow SSH memakai folder dan nama PM2 lama. Konfigurasi backend juga mempunyai fallback AI router GetCore dan nama bucket lama; environment AI lokal saat audit memang sudah override router tersebut. Ganti target deployment sebelum publish InTrack baru.

### P2 — ketahanan dan kelengkapan

11. **Sesi login perlu pengujian expiry lebih kuat.** Interceptor melewati `/auth/me`, sehingga reload setelah access token habis tidak mencoba refresh. Access/refresh JWT memakai secret sama dan tidak memiliki pembeda jenis token yang divalidasi. Logout hanya membersihkan cookie, belum mencabut token server-side. Durasi cookie juga hardcoded, tidak selalu mengikuti env JWT. Sumber: `client/src/api/client.js`, `context/AuthContext.jsx`, `server/src/controllers/auth.controller.js`, `services/auth.service.js`, `middleware/auth.js`.
12. **Penghapusan user tidak atomik.** Banyak delete berjalan berurutan tanpa transaksi. Mentor dengan relasi intern berpotensi gagal di akhir setelah data terkait sudah terhapus; file R2 dan event eksternal tidak ikut dibersihkan. Perlu pengalihan mentor, transaksi, dan keputusan retensi file/event. Sumber: `controllers/users.controller.js`, `prisma/schema.prisma`.
13. **Status Connected hanya berarti token tersimpan.** Belum membuktikan token valid, database Notion bisa ditulis, atau calendar bisa diakses. Kegagalan sync sebagian ditelan/log-only; Notion membuat page baru setiap submit dan tidak menyimpan hasil sync ke ExternalSync. Perlu indikator hasil sinkronisasi, retry, dan idempotensi.
14. **Policy mentor belum dibatasi ke intern bimbingan.** Query daftar/progress/AI mengambil semua intern meskipun schema memiliki mentorId. Tentukan apakah ini memang policy yang diinginkan. Room chat sudah memeriksa kepemilikan; payload AI mengirim konteks nama/email/aktivitas intern ke provider eksternal.
15. **Validasi perlu dilengkapi.** Rentang jam/tanggal planner/task, koordinat numerik, key settings, dan format input belum menyeluruh. Middleware file membatasi MIME deklarasi dan 10 MB; avatar/Face ID ikut menerima PDF padahal membutuhkan gambar. Face API terpisah belum punya autentikasi layanan. Liveness/anti-spoof belum diimplementasikan pada verifikasi wajah.
16. **Bootstrap baru masih beridentitas lama.** Seed bawaan membuat akun GetCore dengan password demo dan menimpa jam/koordinat default. Schema default nama room juga masih `Chat Baru`. Jangan menjalankan seed lama pada database InTrack baru tanpa menyesuaikannya.

## Peta fungsi yang ditinjau

| Modul | Fungsi tersedia | Status audit |
|---|---|---|
| Login/profile | Login, me, refresh, logout, edit nama/departemen/avatar | Cookie lulus; masalah expiry/token dan avatar perlu ditangani |
| Navigasi | Menu menurut role, desktop/mobile, proteksi route | UI sebelumnya lulus; 401/403 dasar API lulus |
| Absensi | HADIR/IZIN/SAKIT, bukti, geolocation, detail, riwayat | Defect P0 akses objek/verifikasi dan P1 jam/storage |
| Face ID | Capture 3 posisi × 5 foto, enroll, verify, reset mentor/admin | Service tidak tersedia lokal; metadata kebutuhan foto salah |
| Logbook | Entry harian, task, evidence, edit/delete API, PDF | Defect ownership dan validasi evidence; PDF belum diuji render baru |
| Planner | Kalender lokal, create/delete UI, update API, Google connect | Ownership delete lulus; sinkron update/all-day/rentang perlu perbaikan |
| Dashboard/progress | Statistik, filter intern/tanggal, logbook/planner/attendance, PDF, reset Face ID | Kode/UI ditinjau; perlu uji data nyata dan policy mentor |
| AI chat | Room create/rename/delete, history, query + database context | Ownership room ada; provider baru dan jawaban berbasis data belum dites live |
| Users | Search, filter, create/update/delete, role/password | Guard role dasar lulus; delete atomik dan bootstrap perlu perbaikan |
| Settings | Jam, kantor, Notion, reopen tanggal tunggal/bulk | Reopen admin dibatasi role; setting kantor dan Notion belum end-to-end |
| R2 | Avatar, evidence absensi/logbook | Konfigurasi terisi; upload/download nyata belum diuji |
| Deployment | Vite, Express, Python, Vercel/SSH workflow | Target lama harus diganti; hanya Node+frontend lokal terdeteksi aktif |

## Urutan tindak lanjut

1. Perbaiki P0 dan mismatch callback/token Notion sebelum menghubungkan akun baru.
2. Siapkan layanan kosong mengikuti [panduan akun baru](INTRACK_NEW_ACCOUNTS_GUIDE.md).
3. Bootstrap akun admin baru dan hidupkan Face service.
4. Uji satu intern dari login → 15 foto → absensi + file → Notion → logbook/PDF → planner/Google → dashboard/AI.
5. Uji user kedua untuk memastikan isolasi data, expiry login, provider failure, dan tanggal WIB/all-day.
6. Baru arahkan domain/deployment InTrack ke layanan baru. Data dan akun lama tetap terpisah.
