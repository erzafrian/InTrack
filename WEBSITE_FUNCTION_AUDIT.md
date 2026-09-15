# Audit fungsi InTrack

## Pembaruan setelah implementasi

**82/83 pemeriksaan live dan 19/19 tes otomatis lulus; lint 0 error/0 warning; build lulus tanpa warning ukuran bundle.** Satu pemeriksaan gagal adalah autentikasi provider AI (HTTP 401). Mentor melihat semua intern dan Notion memakai satu integrasi admin, sesuai keputusan pengguna.

Lihat [status implementasi dan batas pekerjaan](IMPLEMENTATION_STATUS.md) untuk rincian R1?R17 serta langkah tes. OAuth dengan akun nyata, kamera/lokasi/PDF, file private, dan koreksi tanggal historis masih memerlukan tindak lanjut.

## Arsip audit sebelum perbaikan

**Seluruh angka dan temuan di bawah ini adalah kondisi sebelum implementasi.** JSON live/lint sekarang berisi hasil pengujian terbaru; angka lama dipertahankan sebagai riwayat temuan. Harness terisolasi lama belum disesuaikan dengan tabel sesi baru; gunakan `npm test` untuk tes regresi saat ini.

Tanggal audit: 15 September 2026. Audit ini menggantikan ringkasan lama agar sesuai kode dan konfigurasi terbaru.

## Kesimpulan

**Web dapat dijalankan untuk pengujian, tetapi belum semua fitur berfungsi benar dan belum siap digunakan banyak pengguna.** Login, operasi dasar data, koneksi database, dan upload Supabase bekerja. Masih ada cacat akses data lintas pengguna, verifikasi absensi, refresh token, filter Planner, OAuth, dan autentikasi provider AI.

Audit ini tidak memperbaiki logika aplikasi. Pengujian live memakai tiga akun sementara (dua intern dan satu mentor), tanggal/data dummy, satu objek Supabase, dan satu prompt AI tanpa konteks data intern. Semua akun sementara, data terkait, setting reopen uji, serta objek storage uji sudah dibersihkan. Akun/data pengguna yang sudah ada tidak diedit.

## Bukti dan cakupan

| Pemeriksaan | Hasil |
|---|---|
| Build frontend | Lulus; bundle utama sekitar 819 kB, warning ukuran tetap ada |
| Tes otomatis tanggal dan cookie | 9/9 lulus |
| Audit HTTP terisolasi dengan database/provider tiruan | 13/18 lulus; 5 pemeriksaan mengungkap defect |
| Audit API dengan database dan storage nyata | 49/61 lulus; 12 pemeriksaan gagal, beberapa menguji masalah yang sama pada modul berbeda |
| ESLint frontend | 39 error, 9 warning; bukan berarti ada 39 bug runtime |
| Konfigurasi | Environment root terbaca, port/proxy cocok, database Neon dan storage Supabase; callback Google tidak cocok |
| Browser | Tidak tersedia pada alat UI sesi ini; tidak ada klaim pengujian klik/visual baru |
| Face ID | Endpoint aktif, input bukan gambar ditolak 400; pengenalan wajah fisik/liveness belum diuji |

Bukti lengkap: [audit live](docs/live-function-audit-results.json), [audit terisolasi](docs/function-audit-results.json), [lint](docs/lint-audit-results.json), [konfigurasi tanpa secret](docs/config-audit-results.json).

## Status setiap fitur

| Fitur | Yang sudah dibuktikan | Batas / masalah |
|---|---|---|
| Login, profil, logout | Admin/intern/mentor login, profil diperbarui, me/refresh/logout memberi respons sukses | Pemisahan jenis JWT rusak; reload setelah token expired bermasalah dari tinjauan kode |
| Users | Create, update, login, delete akun dummy sukses; intern ditolak akses admin | Penghapusan mentor dengan relasi belum diuji; operasi delete tidak atomik |
| Dashboard | Endpoint user/attendance yang memasok dashboard berhasil dibaca | Tampilan dan perhitungan visual belum diuji; tanggal default masih UTC sebelum 07.00 WIB |
| Intern Attendance | Baca data dan filter tanggal sukses; tanggal absensi uji tetap benar | Detail milik user lain dapat dibaca; bukti wajah tidak diwajibkan backend |
| Reopen Attendance | Open/close satu tanggal berhasil | Bulk open/close baru ditinjau kode; validasi tanggal perlu diperkuat |
| Face ID | Status dan penolakan gambar invalid bekerja | Status meminta 3 foto, enrollment memakai 15; enrollment/verification orang nyata belum diuji |
| Logbook | Create, simpan tanggal, filter tanggal yang sama, edit task berhasil | Task bisa dihapus user lain; evidence wajib hanya di UI |
| Planner | Create/update/delete event lokal berhasil; delete lintas user ditolak | Filter akhir hari salah; rentang terbalik diterima; sync Google belum lengkap |
| AI chat rooms | Create, rename, baca history, delete berhasil; history akun lain ditolak | Jawaban AI belum bekerja: provider mengembalikan HTTP 401 |
| Settings | Read dan pembatasan role berhasil | Save koordinat/jam dan bulk belum diuji live; koordinat tersimpan tidak menjadi sumber kalkulasi jarak |
| Supabase Storage | Upload evidence lewat API dan akses URL objek berhasil HTTP 200; objek uji berhasil dihapus | Bucket publik dapat dibaca tanpa login; alur private download belum tersedia |
| Google Calendar | Status dan pembuatan consent URL berhasil | Callback lokal mismatch, state tidak aman; consent/sync akun Google nyata belum diuji |
| Notion | Status dan pembuatan consent URL berhasil; path callback cocok | State, pemilik token, redirect halaman, dan pemilihan database belum benar |
| PDF | Kode ekspor ter-bundle; formatter tanggal Logbook diperbaiki dan diuji | PDF belum dihasilkan/render pada audit ini; layout/isi belum dinyatakan lolos |
| Kamera/lokasi | Pemanggilan browser ditinjau lewat source | Izin browser, akurasi GPS, kamera fisik, dan anti-spoof belum diuji |

## P0 ? perbaiki sebelum akses banyak pengguna

### 1. Intern dapat membaca detail absensi pengguna lain

**Terbukti live dan terisolasi.** Intern B meminta ID absensi milik akun dummy A dan mendapat HTTP 200, bukan 403/404. Endpoint detail hanya mencari berdasarkan ID. Upload evidence berdasarkan ID juga tidak memeriksa pemilik dari tinjauan kode.

Dampak: data dan URL bukti pengguna lain dapat diakses jika ID diketahui. Tambahkan policy pemilik/mentor/admin sebelum membaca atau mengubah objek. Sumber: [attendance.controller.js](server/src/controllers/attendance.controller.js), [attendance.routes.js](server/src/routes/attendance.routes.js).

### 2. Task logbook dapat dihapus pengguna lain

**Terbukti live dan terisolasi.** Intern B berhasil DELETE task dummy A dengan HTTP 200. Add/update task juga belum memeriksa pemilik entry/task; update menerima payload luas dari req.body.

Tambahkan pemeriksaan pemilik dan whitelist field update di backend. Sumber: [logbook.controller.js](server/src/controllers/logbook.controller.js), [logbook.service.js](server/src/services/logbook.service.js).

### 3. Absensi HADIR dapat dikirim tanpa verifikasi wajah

**Terbukti live dan terisolasi.** Akun dummy belum enroll wajah berhasil submit HADIR dengan lokasi dan gambar dummy pada tanggal uji yang dibuka admin: HTTP 201. Endpoint submit tidak menerima/memvalidasi bukti Face ID yang terikat ke transaksi.

Perlu bukti verifikasi sekali pakai dengan expiry dan user binding. Batas gagal 5 kali saat ini hanya state frontend, bukan pembatas server. Sumber: [attendance.controller.js](server/src/controllers/attendance.controller.js), [Absen.jsx](client/src/pages/intern/Absen.jsx).

### 4. Access token diterima sebagai refresh token

**Terbukti live.** Access JWT ditempatkan dalam cookie refreshToken lalu POST /auth/refresh menghasilkan HTTP 200. Kedua token memakai secret sama dan tidak memvalidasi jenis token.

Tambahkan klaim jenis token dan pemeriksaan ketat; tentukan pencabutan/rotasi sesi. Logout yang hanya menghapus cookie belum membuktikan token lama tidak dapat digunakan lagi. Sumber: [auth.service.js](server/src/services/auth.service.js), [auth.controller.js](server/src/controllers/auth.controller.js).

### 5. OAuth state Google dan Notion adalah user ID mentah

**Terbukti dari URL hasil API live dan kode.** Kedua consent URL memakai state sama dengan ID user. Callback publik tidak memvalidasi nonce acak yang terikat sesi, expiry, dan sekali pakai.

Ini bukti kekurangan kontrol OAuth, bukan klaim bahwa akun provider nyata telah diambil alih. Sumber: [google.service.js](server/src/services/google.service.js), [google.routes.js](server/src/routes/google.routes.js), [notion.service.js](server/src/services/notion.service.js), [auth.routes.js](server/src/routes/auth.routes.js).

## P1 ? menghambat fungsi pengguna

### 6. AI belum dapat menghasilkan jawaban

**Terbukti live.** Request minimal chat/completions menggunakan konfigurasi provider/model/key backend menghasilkan **HTTP 401**. Tidak ada data intern yang dikirim pada tes ini. Periksa kecocokan provider, API key, hak akses, dan endpoint. Keberadaan nilai AI_API_KEY tidak membuktikan autentikasi valid. CRUD room tetap bekerja.

### 7. Callback Google salah

**Terbukti konfigurasi dan consent URL live.** Path redirect yang dipakai tidak sama dengan route aktif **/api/google/callback**. Untuk lokal gunakan **http://localhost:3001/api/google/callback**, dan samakan dengan Authorized redirect URIs di Google Cloud. Mengubah salah satu sisi saja tidak cukup.

### 8. Filter Planner melewatkan event di tanggal akhir

**Terbukti live.** Event dummy tanggal 15 pukul 10.00 WIB dibuat sukses, tetapi filter startDate=2098-09-15 dan endDate=2098-09-15 tidak mengembalikannya. Batas akhir dibentuk dari new Date(endDate), yakni awal hari UTC, bukan akhir hari pilihan.

Query juga hanya memfilter startDate, sehingga event yang mulai sebelum rentang tetapi masih berlangsung bisa terlewat. Gunakan rentang waktu yang konsisten dan logika overlap. Sumber: [planner.service.js](server/src/services/planner.service.js).

### 9. Rentang tanggal Planner terbalik tetap disimpan

**Terbukti live.** Event dengan mulai tanggal 16 dan selesai tanggal 15 mendapat HTTP 201. Validasi urutan tanggal/jam harus dilakukan server, tidak cukup dari input browser. Sumber: [planner.controller.js](server/src/controllers/planner.controller.js).

### 10. Evidence logbook tidak wajib di backend

**Terbukti live.** Task tanpa evidence dibuat dengan HTTP 201, meskipun UI mewajibkan evidence. Terapkan aturan yang sama pada endpoint add/update task. Sumber: [logbook.controller.js](server/src/controllers/logbook.controller.js).

### 11. Jumlah foto Face ID tidak konsisten

**Terbukti live dan terisolasi.** GET /face/status mengembalikan required=3; kode baru mengatur faceEnrolled=true setelah count >= 15. Remaining juga dihitung dari 3. Gunakan satu konstanta untuk UI dan backend. Sumber: [face.service.js](server/src/services/face.service.js).

### 12. Notion belum tersambung sebagai alur absensi yang utuh

**Kode + audit terisolasi.** Connect tersedia pada Settings admin, token disimpan di user admin, tetapi sync mencari token intern yang submit. Callback kembali ke /mentor/settings yang tidak ada, bukan /admin/settings. Nama user untuk sync diambil dari JWT login awal yang hanya memuat ID/role; tes terisolasi menerima nama kosong. Database dipilih dari hasil search pertama.

Putuskan integrasi terpusat/per-user, ambil nama dari database, pilih database eksplisit, dan sesuaikan API Notion bila menggunakan data source baru. Belum ada uji consent/sync workspace nyata.

## P2 ? temuan tambahan dari kode, belum direproduksi live seluruhnya

| Masalah | Dampak / sumber |
|---|---|
| Reload setelah access token habis tidak mencoba refresh untuk /auth/me | Pengguna dapat dianggap logout meski refresh token masih valid; client/src/api/client.js, context/AuthContext.jsx |
| Koordinat kantor Settings tidak dipakai menghitung jarak | Kalkulasi membaca config.office dari environment; server/src/services/attendance.service.js |
| Jam absensi hanya memeriksa batas akhir, mencampur tanggal UTC dan jam lokal | Batas mulai tidak ditegakkan; perilaku dapat berbeda pada server zona UTC; attendance.controller.js |
| Dashboard memakai tanggal UTC untuk filter | Sebelum 07.00 WIB bisa menampilkan data hari sebelumnya; Dashboard.jsx |
| Planner form mengirim timestamp tanpa offset | Waktu dapat bergeser ketika backend dipindahkan dari WIB ke UTC; Planner.jsx dan planner.controller.js |
| Google Calendar update tidak disinkronkan | Update hanya database lokal; tidak ada rekonsiliasi dua arah; planner.service.js |
| Payload Google all-day memakai tanggal akhir hari yang dipilih | Perlu menyesuaikan [end eksklusif Calendar](https://developers.google.com/workspace/calendar/api/v3/reference/events); belum diuji pada akun Google nyata; google.service.js |
| Upload absensi tidak atomik | Row absensi dibuat sebelum storage; upload gagal dapat meninggalkan data parsial; attendance.controller.js |
| Storage tanpa konfigurasi menghasilkan URL placeholder.local | Bisa tampak berhasil meski file tidak disimpan; r2.service.js |
| Delete user tidak memakai transaksi | Kegagalan relasi mentor dapat menyisakan penghapusan parsial; file storage/event eksternal tidak ikut dibersihkan; users.controller.js |
| Mentor belum dibatasi pada intern bimbingannya | Query daftar/progress/AI belum memfilter mentorId; perlu keputusan policy |
| Validasi upload/input belum merata | PDF diterima middleware yang juga dipakai avatar/Face ID; tipe file mengandalkan MIME deklarasi; error upload dapat menjadi 500 |
| Pesan error sering ditelan catch kosong | Gagal fetch/create/delete bisa terlihat seperti tidak ada data atau tidak ada respons; sesuai temuan lint |
| Face API tidak memiliki autentikasi layanan/liveness | Tetap bind lokal untuk uji; jangan menganggap health sukses sebagai jaminan anti-spoof |

## Perbaikan sebelumnya yang tetap terverifikasi

- Backend dan script Prisma memakai environment proses, override server/.env, kemudian .env root.
- Database Neon sudah memiliki tabel dan akun admin dapat login.
- Storage yang dipakai adalah Supabase melalui S3; upload/read dummy sukses.
- Kalender Planner memakai tanggal lokal; tes lintas zona waktu lulus.
- Logbook baru menyimpan tanggal tanpa bergeser; tes dan round trip API live lulus.
- Default From/To Intern Attendance memakai hari saat halaman dibuka.
- Label Gemini Flash sudah dihapus dari header/greeting UI; penghapusan label tidak memperbaiki autentikasi provider AI.
- Tanggal entri lama yang sudah terlanjur salah belum dimigrasikan otomatis.

## Reproduksi

Pemeriksaan lokal/terisolasi:

```powershell
node --test server/test/*.test.js client/test/*.test.mjs
node docs/function-audit.cjs
node docs/config-audit.cjs
npm run lint --prefix client -- --format json --output-file ../docs/lint-audit-results.json
npm run build --prefix client
```

Audit live: jalankan docs/live-function-audit.cjs dengan AUDIT_ADMIN_EMAIL dan AUDIT_ADMIN_PASSWORD dari environment terminal. Script ini membuat dan membersihkan data uji pada backend/database/storage yang sedang dikonfigurasi serta mengirim satu prompt minimal ke provider AI. Jangan menganggapnya read-only. Server frontend/backend/Face ID harus sudah berjalan. Tidak ada kredensial nyata di script atau JSON laporan.

Exit code nol pada script audit berarti proses selesai, bukan semua pemeriksaan lulus; lihat field passed pada hasil JSON. Unit test menggunakan penyimpanan tiruan, sedangkan hasil live berasal dari database/storage aktual.

## Urutan perbaikan

1. Ownership absensi/logbook, bukti verifikasi wajah server, jenis JWT, dan OAuth state.
2. Autentikasi AI, callback Google, alur Notion, filter/validasi Planner, konsistensi foto Face ID, evidence logbook.
3. Konsistensi zona waktu tersisa, sumber Settings, transaksi, penanganan error, dan lint.
4. Uji ulang dua user, browser desktop/mobile, kamera/lokasi fisik, PDF, serta OAuth dan sync provider nyata.

## Rekomendasi perbaikan yang dapat dikerjakan

Bagian ini adalah rencana implementasi berdasarkan temuan audit, **belum merupakan perubahan pada fungsi aplikasi**. Prioritas pertama adalah mencegah akses/perubahan data yang salah, kemudian memperbaiki alur pengguna dan integrasi.

### Tahap 1 — pembatasan akses dan sesi

#### R1. Terapkan pemeriksaan pemilik pada seluruh objek

- Buat policy akses bersama di backend. Jangan hanya mengandalkan menu atau ProtectedRoute frontend.
- Usulan policy: intern membaca/mengubah data sendiri; mentor membaca intern bimbingannya; SUPERUSER mengelola semua sesuai fungsi admin. Kebijakan mentor ini perlu ditetapkan sebagai aturan produk sebelum diterapkan.
- Untuk task, cari task beserta entry pemiliknya; untuk evidence, cari attendance pemiliknya. Terapkan juga pada add, update, delete, dan download.
- Batasi field update task pada jam, aktivitas, output, dan evidence. Tolak perubahan entryId/userId dari payload pengguna.
- Gabungkan pemeriksaan dan perubahan dalam transaksi atau query bersyarat agar kepemilikan tidak bisa berubah di antara keduanya.
- **File utama:** [attendance.controller.js](server/src/controllers/attendance.controller.js), [logbook.controller.js](server/src/controllers/logbook.controller.js), [logbook.service.js](server/src/services/logbook.service.js), [auth.js](server/src/middleware/auth.js).
- **Selesai jika:** akun B mendapat 403/404 saat membaca, menambah evidence, mengedit, atau menghapus objek A; data A tetap sama. Uji pula mentor bimbingan/nonbimbingan dan admin.

#### R2. Ikat hasil verifikasi wajah ke submit absensi

- Setelah verifikasi berhasil, backend membuat bukti verifikasi dengan ID acak, userId, tanggal absensi, masa berlaku singkat, serta status belum digunakan.
- Submit absensi wajib memeriksa bukti tersebut. Konsumsi bukti dan penyimpanan absensi harus atomik agar dua request bersamaan tidak memakai bukti yang sama.
- Simpan penghitung gagal dan masa blokir di server. Reload halaman tidak boleh menghapus batas percobaan.
- Jika approval mentor dibutuhkan, buat alur approval eksplisit dengan pemberi izin, alasan, dan masa berlaku; pesan “hubungi mentor” saja belum cukup.
- Satukan kebutuhan foto menjadi 15 pada frontend/backend. Pemeriksaan liveness merupakan pekerjaan terpisah dari kesamaan wajah.
- **File utama:** [face.service.js](server/src/services/face.service.js), [attendance.controller.js](server/src/controllers/attendance.controller.js), [Absen.jsx](client/src/pages/intern/Absen.jsx), [schema.prisma](server/prisma/schema.prisma).
- **Selesai jika:** bukti kosong, expired, milik user/tanggal lain, dan bukti yang digunakan ulang ditolak; verifikasi sah memungkinkan satu submit. Jumlah foto/remaining konsisten.

#### R3. Perbaiki access token, refresh token, dan pemulihan sesi

- Tambahkan klaim jenis token yang wajib divalidasi pada masing-masing endpoint. Gunakan identitas sesi agar token dapat dicabut setelah logout atau penggantian password.
- Simpan hash refresh token atau pengenal sesi di database; lakukan rotasi refresh token dan tangani percobaan memakai token lama.
- Izinkan pemulihan sesi ketika /auth/me mendapat 401. Kecualikan login/refresh dari retry berulang, bukan seluruh path /auth/.
- Antrekan request yang gagal bersamaan pada satu proses refresh, lalu ulangi masing-masing satu kali. Sesuaikan masa cookie dengan expiry token.
- **File utama:** [auth.service.js](server/src/services/auth.service.js), [auth.controller.js](server/src/controllers/auth.controller.js), [auth.js](server/src/middleware/auth.js), [client.js](client/src/api/client.js), [AuthContext.jsx](client/src/context/AuthContext.jsx).
- **Selesai jika:** access JWT tidak dapat dipakai untuk refresh; reload setelah access token habis tetap memulihkan sesi sah; logout mencabut sesi; request paralel tidak menghasilkan refresh berulang.

#### R4. Ganti OAuth state dengan nonce sekali pakai

- Generate nilai acak dan simpan hubungan nonce, user pemulai, provider, expiry, serta tujuan kembali yang diizinkan.
- Pada callback, verifikasi dan konsumsi nonce secara atomik sebelum menyimpan token provider. Jangan menerima userId dari state sebagai bukti identitas.
- Tangani consent ditolak/expired dengan pesan yang bisa ditindaklanjuti, tanpa menampilkan token atau secret.
- **File utama:** [google.service.js](server/src/services/google.service.js), [google.routes.js](server/src/routes/google.routes.js), [notion.service.js](server/src/services/notion.service.js), [auth.routes.js](server/src/routes/auth.routes.js).
- **Selesai jika:** state palsu, kedaluwarsa, provider salah, dan callback ulang ditolak; consent sah terhubung hanya ke user pemulai.

### Tahap 2 — fungsi tanggal, Settings, dan integrasi

#### R5. Pulihkan koneksi AI dengan pemeriksaan yang terukur

- Cocokkan API key dengan provider pada AI_BASE_URL dan model pada AI_MODEL. Uji request minimal tanpa data intern terlebih dahulu.
- Bedakan pesan autentikasi 401/403, kuota 429, timeout, dan kegagalan provider di UI. Jangan menampilkan pesan seolah jawaban berhasil.
- Untuk pesan yang gagal, sediakan status gagal/retry; hindari duplikasi pesan pengguna ketika retry.
- Setelah provider berhasil, uji konteks sintetis melalui endpoint AI InTrack dan pastikan konteks mengikuti policy mentor R1.
- **File utama:** [ai.service.js](server/src/services/ai.service.js), [ai.context.js](server/src/services/ai.context.js), [admin.controller.js](server/src/controllers/admin.controller.js), [AiChat.jsx](client/src/pages/mentor/AiChat.jsx), environment backend.
- **Selesai jika:** prompt minimal berhasil, chat tersimpan berpasangan dengan jawaban, error tampil jelas, dan retry tidak menggandakan pesan.

#### R6. Selesaikan konfigurasi dan sinkronisasi Google Calendar

- Samakan GOOGLE_REDIRECT_URI lokal dan dashboard Google menjadi http://localhost:3001/api/google/callback. Untuk production gunakan domain backend sebenarnya.
- Setelah R4, uji consent dengan akun penguji, create/update/delete event, dan disconnect.
- Tambahkan sync update; simpan hasil/status sinkronisasi agar pengguna mengetahui jika perubahan lokal belum sampai Google.
- Untuk all-day, perlakukan tanggal sebagai tanggal kalender dan kirim akhir eksklusif. Jangan menghitung hari kalender dengan menambah 24 jam pada timestamp lokal.
- Nyatakan dengan jelas jika fitur tetap satu arah. Sinkron dua arah memerlukan desain import/notifikasi/rekonsiliasi tersendiri.
- **File utama:** [google.service.js](server/src/services/google.service.js), [planner.service.js](server/src/services/planner.service.js), environment backend, Google Cloud OAuth client.
- **Selesai jika:** event berdurasi biasa dan all-day satu/beberapa hari memiliki tanggal/jam sama di InTrack dan Google; update/delete tidak meninggalkan perbedaan tanpa status error.

#### R7. Perbaiki filter dan validasi Planner

- Bentuk batas filter sebagai awal hari pertama sampai awal hari sesudah tanggal akhir, berdasarkan zona waktu yang ditetapkan. Jangan memakai tengah malam tanggal akhir sebagai batas seluruh hari.
- Gunakan query overlap agar event yang dimulai sebelum rentang tetapi masih berlangsung ikut muncul. Tetapkan makna endDate inklusif/eksklusif secara konsisten pada API.
- Tolak endDate sebelum startDate, tanggal invalid, judul kosong, dan jam yang tidak sesuai aturan durasi.
- Timestamp event berjam harus menyertakan offset atau dikonversi ke UTC secara eksplisit; timestamp tanpa zona jangan bergantung pada lokasi server.
- **File utama:** [planner.controller.js](server/src/controllers/planner.controller.js), [planner.service.js](server/src/services/planner.service.js), [Planner.jsx](client/src/pages/intern/Planner.jsx).
- **Selesai jika:** filter tanggal 15 mencakup event pagi/malam tanggal 15; event lintas hari muncul pada rentang yang dilaluinya; tanggal terbalik ditolak; server UTC dan WIB memberi hasil yang sama.

#### R8. Putuskan dan selesaikan model integrasi Notion

- Untuk satu tim, usulan paling sederhana adalah satu koneksi/database milik organisasi yang dikelola admin. Token disimpan sebagai konfigurasi integrasi server, bukan atribut intern pengirim absensi.
- Jika tetap per-user, sediakan Connect dan pemilihan database untuk setiap intern. Kedua pendekatan tidak boleh tercampur seperti sekarang.
- Arahkan callback kembali ke /admin/settings untuk model admin, ambil nama intern dari database, dan pilih database/data source secara eksplisit.
- Simpan ID page eksternal untuk memperbarui record yang sama; tambahkan status sync dan retry supaya submit ulang tidak membuat duplikasi.
- Tinjau kebutuhan API data source dan refresh token sesuai versi Notion yang dipilih sebelum implementasi.
- **File utama:** [notion.service.js](server/src/services/notion.service.js), [auth.routes.js](server/src/routes/auth.routes.js), [Settings.jsx](client/src/pages/admin/Settings.jsx), [schema.prisma](server/prisma/schema.prisma).
- **Selesai jika:** absensi dua intern masuk database yang dipilih admin dengan identitas benar; submit ulang tidak menggandakan page; kegagalan izin/token tampil jelas.

#### R9. Gunakan satu sumber Settings dan aturan zona waktu

- Tetapkan Asia/Jakarta sebagai zona waktu operasional absensi jika memang semua aktivitas memakai WIB.
- Ambil jam mulai/selesai dan koordinat kantor dari AppSetting melalui satu service bersama. Environment dapat menjadi nilai awal, bukan sumber yang mengabaikan perubahan admin.
- Validasi jam, rentang lintang/bujur, dan key setting yang boleh diedit. Tentukan apakah jarak hanya informasi atau batas radius absensi.
- Terapkan pemeriksaan batas mulai dan akhir pada server, lalu tampilkan nilai yang sama di UI.
- Bedakan tanggal tanpa jam (Logbook/Attendance) dari timestamp event. Ganti filter hari ini Dashboard yang masih memakai tanggal UTC.
- **File utama:** [admin.controller.js](server/src/controllers/admin.controller.js), [attendance.controller.js](server/src/controllers/attendance.controller.js), [attendance.service.js](server/src/services/attendance.service.js), [Dashboard.jsx](client/src/pages/mentor/Dashboard.jsx), [Settings.jsx](client/src/pages/admin/Settings.jsx).
- **Selesai jika:** perubahan koordinat/jam admin benar-benar memengaruhi kalkulasi dan batas submit; pengujian 00.30 WIB, batas mulai, batas akhir, serta server UTC memberikan hasil yang diharapkan.

### Tahap 3 — ketahanan data dan pengalaman pengguna

| Rekomendasi | Perubahan konkret | Kriteria selesai |
|---|---|---|
| R10. Evidence Logbook | Wajibkan evidence pada create task di backend; pada update pertahankan evidence lama yang sah atau minta pengganti | Request langsung tanpa evidence ditolak; update teks tidak menghapus bukti lama |
| R11. Download file private | Setelah policy R1, sediakan endpoint yang memeriksa user sebelum signed URL/proxy download; pisahkan kebutuhan avatar publik dari dokumen privat | User B tidak bisa memperoleh file A; migrasi URL lama terencana; mengganti bucket menjadi private tidak merusak semua tautan |
| R12. Upload dan transaksi | Validasi dahulu, upload ke object key sementara/unik, lalu simpan perubahan database dalam transaksi; hapus objek baru bila transaksi gagal | Storage/DB gagal tidak meninggalkan absensi sukses palsu atau file tanpa pemilik; retry tidak menggandakan data |
| R13. Hapus user dengan aman | Periksa relasi mentor dan tentukan pengalihan intern sebelum delete; transaksi untuk data DB; antrekan cleanup file/event eksternal dengan retry | Kegagalan di tengah tidak menghapus sebagian data; akun lain tetap utuh |
| R14. Validasi file dan error | Bedakan tipe file per endpoint, periksa signature file, petakan input buruk/ukuran berlebih ke status 4xx yang sesuai | Avatar/Face ID menolak PDF; file terlalu besar mendapat pesan jelas; exception tidak dibocorkan ke pengguna |
| R15. Loading, error, dan retry UI | Ganti catch kosong; bedakan keadaan loading, kosong, gagal; abaikan respons fetch lama setelah pengguna mengganti filter | Gagal API tidak tampak seperti data kosong; pindah tanggal cepat tidak menampilkan entri tanggal sebelumnya |
| R16. Lint dan pengujian otomatis | Bersihkan import/state tak terpakai, perbaiki dependency hooks tanpa sekadar menonaktifkan aturan; tambahkan CI build/unit/integration terisolasi | Lint bersih, tes regresi tanggal/ownership/token lulus, dan CI tidak memakai kredensial production |
| R17. Data tanggal historis | Identifikasi ID entri dan tanggal yang seharusnya, periksa benturan pasangan user/tanggal, lalu koreksi terbatas dengan backup | Tidak ada pergeseran massal berdasarkan dugaan; task tetap terhubung ke entri yang benar |

Untuk file dan database, transaksi DB tidak mencakup Supabase Storage/Google/Notion. Karena itu tetap diperlukan pembersihan atau retry terpisah ketika salah satu layanan gagal.

### Urutan pengerjaan yang disarankan

1. **Batch akses:** R1, R3, dan R4. Tambahkan tes negatif dua akun sebelum menambah integrasi baru.
2. **Batch absensi:** R2, R9, R10, dan R14. Pastikan semua aturan penting ditegakkan server.
3. **Batch fungsi pengguna:** R5, R7, R6, dan R8. R6/R8 diselesaikan setelah OAuth state diperbaiki.
4. **Batch ketahanan:** R11–R13, R15–R17, lalu uji browser dan transaksi end-to-end.

Perubahan yang menambah tabel sesi/bukti wajah/integrasi perlu migration Prisma yang ditinjau. Database sekarang sudah berisi data pengguna: jangan menjalankan reset atau menerima penghapusan data untuk menyelesaikan perubahan schema.

### Syarat dinyatakan siap digunakan

- Semua pemeriksaan akses lintas pengguna, token, verifikasi wajah, dan validasi input lulus.
- Audit live tidak lagi mengungkap defect yang ditargetkan; tambahkan tes untuk perbaikan baru, bukan mengubah expected agar menerima bug.
- Login sampai absensi dengan wajah/lokasi nyata, evidence, Logbook, Planner, dashboard, dan PDF diuji lewat browser desktop/mobile.
- Google/Notion diuji dengan akun penguji sebenarnya; AI diuji dari UI setelah autentikasi provider berhasil.
- File private dan tanggal historis ditangani sesuai keputusan produk; backup dan cara pemulihan perubahan tersedia.
