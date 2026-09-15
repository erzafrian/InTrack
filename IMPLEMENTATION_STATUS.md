# Status implementasi InTrack — 15 September 2026

## Hasil verifikasi

- **19/19 tes otomatis lulus**: tanggal lintas zona waktu, cookie, access/refresh token, logout, konsumsi token bersamaan, OAuth state, Notion tiruan, error AI, validasi file, dan rollback upload Logbook.
- **82/83 pemeriksaan live lulus** pada API, Neon, Supabase, dan Face service. Satu kegagalan tersisa: provider AI menolak kredensial dengan HTTP 401.
- **Lint: 0 error, 0 warning.** Build frontend lulus tanpa warning ukuran chunk; halaman dimuat terpisah, bundle utama sekitar 289 kB sebelum gzip.
- Data tiga akun penguji, setting reopen, dan objek storage uji dibersihkan. Absensi sukses diuji dengan bukti wajah fixture yang diterbitkan langsung oleh script internal; ini **bukan uji pengenalan wajah fisik** dan tidak menambah endpoint bypass aplikasi.
- Migrasi tabel sesi, token sekali pakai, dan percobaan wajah diterapkan ke Neon tanpa reset setelah baseline diperiksa tidak memiliki schema drift.

Bukti: [hasil live](docs/live-function-audit-results.json), [hasil lint](docs/lint-audit-results.json), [tes keamanan](server/test/security.test.js), [tes integrasi tiruan](server/test/integrations.test.js).

## Perubahan terhadap rekomendasi R1–R17

| Rekomendasi | Hasil implementasi dan batasnya |
|---|---|
| R1 akses data | Endpoint absensi, evidence, dan task memeriksa pemilik. Intern lain mendapat 404; task tetap utuh. Mentor dapat membaca **semua intern**, sesuai keputusan pengguna. SUPERUSER dapat mengelola objek. File publik masih memiliki batas R11. |
| R2 bukti wajah | Bukti acak berumur 2 menit terikat user/tanggal, hash disimpan, konsumsi satu kali dalam transaksi absensi. Percobaan dibatasi server; 5 percobaan memicu blokir 15 menit. Enrollment/status/remaining menggunakan 15 foto; UI melanjutkan jumlah foto yang sudah tersimpan. Liveness belum dibuat. |
| R3 sesi | Jenis access/refresh wajib sesuai; refresh dirotasi dan hash disimpan. Logout serta perubahan password/role admin mencabut sesi. Frontend mencoba refresh untuk /auth/me dan menggabungkan refresh paralel. |
| R4 OAuth | State acak, hash, expiry, provider, dan cookie browser diperiksa; callback mengonsumsi state satu kali. |
| R5 AI | Error autentikasi/kuota/timeout dibedakan. Pesan gagal dikembalikan ke input; pasangan chat disimpan sesudah provider berhasil. **Key/provider saat ini masih 401.** |
| R6 Google | Callback lokal dibetulkan; update event dikirim ke Google; all-day memakai akhir eksklusif. **Consent nyata, status/retry persisten, dan rekonsiliasi eksternal belum selesai.** Sync tetap satu arah; kegagalan Google masih dapat meninggalkan perubahan hanya di InTrack. |
| R7 Planner | Filter memakai overlap dan seluruh tanggal akhir dalam WIB. Tolak tanggal/jam mustahil, durasi terbalik, dan judul kosong. Form mengirim offset +07:00. |
| R8 Notion | Integrasi bersama dikelola admin; pilihan data source dan validasi kolom; nama intern dari DB; create/update page; status gagal dan retry. **Belum diuji dengan consent/workspace nyata.** |
| R9 Settings/waktu | Jam mulai/akhir dan koordinat kantor dibaca dari AppSetting. Key/input divalidasi. Absensi memakai waktu operasional WIB dan menolak tanggal masa depan. Tanggal tanpa jam disimpan sebagai date-only. |
| R10 evidence | Evidence wajib di backend saat tambah task; update teks mempertahankan evidence lama. |
| R11 file private | **Belum diimplementasikan.** URL evidence masih publik. Perlu endpoint download berizin serta migrasi URL/bucket yang terencana. |
| R12 upload | Validasi sebelum upload; transaksi absensi/evidence/bukti wajah; kompensasi hapus objek baru bila penulisan DB gagal pada absensi, evidence tambahan, task, dan avatar. Belum ada antrean retry apabila kompensasi storage ikut gagal atau proses mati. |
| R13 delete user | Penghapusan DB dalam transaksi; mentor dengan intern harus dialihkan dulu; akun sendiri tidak dapat dihapus. Cleanup objek lama di storage dan event provider belum diantrekan otomatis. |
| R14 validasi | Signature dasar JPG/PNG/WEBP/PDF diperiksa, PDF ditolak untuk avatar/Face ID, batas ukuran 10 MB, error input dipetakan ke 4xx tanpa detail Prisma pada respons. Pemeriksaan signature bukan pemindaian malware atau dekode gambar lengkap. |
| R15 UI | Error ditampilkan di halaman/form utama, respons fetch lama diabaikan pada filter Users/Logbook/Attendance/Progress. Masih perlu uji interaksi browser, kamera, lokasi, dan PDF nyata. |
| R16 pemeriksaan | Lint bersih; tes regresi dan workflow CI ditambahkan. Build dibagi per halaman. Workflow GitHub belum dijalankan di remote; perintahnya telah dijalankan lokal. |
| R17 tanggal lama | **Tidak dikoreksi otomatis.** Perlu ID entri dan tanggal yang benar untuk menghindari perubahan data berdasarkan dugaan. |

## Langkah pengujian pengguna

1. Buka **http://localhost:5173**. Login ulang karena format sesi lama sudah tidak berlaku. Akun admin yang diminta tetap `admin@example.com`, password `admin123`.
2. Admin → Users: buat intern penguji. Admin → Settings: periksa jam absensi dan lokasi kantor.
3. Login intern → Face ID: selesaikan 15 foto → Attendance: verifikasi wajah, unggah evidence, lalu submit dalam jam aktif. Untuk tanggal lampau, admin harus membuka tanggal tersebut dulu.
4. Uji Logbook dengan evidence; Planner pada tanggal yang dipilih; masuk mentor dan periksa semua intern. Unduh PDF dan periksa tanggal.
5. Notion: admin → Settings → Connect → izinkan database → pilih Shared attendance database → Save database. Periksa Recent syncs. Ikuti [panduan platform](INTRACK_NEW_ACCOUNTS_GUIDE.md).
6. Google: samakan Authorized redirect URI di Google Cloud dengan `http://localhost:3001/api/google/callback`, lalu Connect Calendar dari akun intern. Uji create/update/delete dan all-day di akun Google nyata.
7. AI: perbaiki kecocokan `AI_API_KEY`, `AI_BASE_URL`, dan `AI_MODEL`, restart backend, lalu uji prompt minimal sebelum memakai konteks intern.

Jika proses lokal sudah berhenti: jalankan `npm run dev`; jalankan Face service terpisah dari `ai-service` menggunakan `venv/Scripts/python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001`.

## Mengulangi pemeriksaan

```powershell
npm test
npm run lint --prefix client
npm run build --prefix client
```

Audit live memakai `docs/live-function-audit.cjs`, dengan `AUDIT_ADMIN_EMAIL` dan `AUDIT_ADMIN_PASSWORD` dari environment terminal. Ini membuat/menghapus data sementara dan memanggil provider; jangan menjalankannya sebagai tes unit atau CI production. Periksa `passed` dalam JSON, bukan hanya exit code script. Harness `docs/function-audit.cjs` dan angka audit awal adalah arsip sebelum migrasi keamanan.

Untuk database baru kosong, gunakan `npm run db:migrate --prefix server`, lalu seed jika diperlukan. Database lama lain harus diperiksa sebelum baseline; jangan menjalankan reset. Current local Neon sudah dimigrasikan.

Referensi implementasi: [Notion API resmi](https://www.postman.com/notionhq/notion-s-api-workspace/documentation/52041987-03f70d8f-b6e5-4306-805c-f95f7cdf05b9), [setup-node](https://github.com/actions/setup-node), [checkout](https://github.com/actions/checkout).
