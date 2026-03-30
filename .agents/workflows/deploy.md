---
description: Deploy code changes to Vercel production via git push
---

# Deploy to Production

Setelah selesai mengubah kode, jalankan langkah-langkah berikut untuk deploy ke Vercel production:

// turbo-all

1. Build terlebih dahulu untuk memastikan tidak ada error:
```
cd e:\CODE BASE WEB\web katalog akun sharing dan private\app
npx next build
```

2. Stage semua perubahan:
```
cd e:\CODE BASE WEB\web katalog akun sharing dan private\app
git add -A
```

3. Commit dengan pesan deskriptif:
```
cd e:\CODE BASE WEB\web katalog akun sharing dan private\app
git commit -m "<describe changes>"
```

4. Push ke GitHub (otomatis trigger Vercel deploy):
```
cd e:\CODE BASE WEB\web katalog akun sharing dan private\app
git push origin main
```

> **Note:** Vercel sudah terhubung ke repo GitHub `ggsradik-alt/app`. Setiap push ke `main` akan otomatis trigger deployment di Vercel.
