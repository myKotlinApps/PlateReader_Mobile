# راهنمای استقرار ارتباط راه دور، کلادفلر، VPS، وب‌هوک و اپ موبایل (Android / iOS)

## ۱. دامنه اول (Cloudflare Free + Tunnel + Worker Relay)
1. یک حساب **رایگان** کلادفلر برای دامنه اصلی بسازید (`NS` دامنه روی Cloudflare تنظیم شود).
2. در سرور شهرک `cloudflared` را نصب کنید و تنظیمات نمونهٔ [config.yml](file:///d:/Dev/Plate_Reader/Plate_Reader/deploy/cloudflare-tunnel/config.yml) را با UUID تونل و نام دامنه پر کنید (بدون باز کردن هیچ پورتی روی روتر!).
3. برای صندوق پیام آفلاین رمزشده (وقتی اینترنت شهرک موقتاً قطع است):
   ```powershell
   cd deploy\cloudflare-worker
   npx wrangler d1 create alpr-relay-db
   # شناسه D1 را داخل wrangler.toml بگذارید
   npx wrangler d1 execute alpr-relay-db --file=./schema.sql
   npx wrangler secret put RELAY_SHARED_TOKEN
   npx wrangler deploy
   ```
   - کلادفلر فقط بسته‌های رمزشدهٔ X25519 + ChaCha20-Poly1305 می‌بیند و هیچ متن ساده‌ای در دیتابیس کلادفلر ذخیره نمی‌شود.

## ۲. دامنه دوم + سرور VPS (مسیر جایگزین + بک‌آپ رمزشده)
1. روی سرور Ubuntu LTS خودتان سرویس بک‌آپ گیرنده را اجرا کنید:
   ```bash
   VPS_BACKUP_SECRET="یک-کلید-بلند-و-امن" VPS_BACKUP_DIR=/var/backups/alpr node deploy/vps/backup-receiver.mjs
   ```
2. فایل [Caddyfile](file:///d:/Dev/Plate_Reader/Plate_Reader/deploy/vps/Caddyfile) را در `/etc/caddy/Caddyfile` بگذارید و `caddy reload` بزنید تا HTTPS خودکار + پراکسی جایگزین روی دامنه دوم فعال شود.
3. در پنل مدیریت سامانه (`/settings/integrations`) هر دو نشانی و کلید بک‌آپ را وارد کنید.

## ۳. استفاده فوری روی گوشی (Android و iPhone) از طریق وب PWA
- مدیران شهرک، مدیران بلوک و انتظامات آدرس زیر را روی گوشی باز می‌کنند:
  `https://m.<YOUR_DOMAIN_1>/m` (یا آدرس محلی `http://<LAN_IP>:3323/m`).
- **روی آیفون (رایگان و بدون نیاز به اپل استور):** در Safari دکمهٔ Share ← **Add to Home Screen** را بزنید (پوش و ظاهر اپلیکیشن پس از نصب روی صفحهٔ اصلی فعال می‌شود).
- **روی اندروید (Chrome):** گزینهٔ **Install App / نصب برنامه** را بزنید یا فایل APK مستقیم را نصب کنید.

## ۴. ساخت اپ بومی اندروید (APK مستقیم + AAB گوگل‌پلی) و iOS
- تمام تنظیمات Capacitor آماده در `mobile-native/` قرار دارد:
  - برای تولید همزمان **APK مستقیم** و **Google Play AAB**:
    ```powershell
    powershell -ExecutionPolicy Bypass -File mobile-native\scripts\build-android.ps1
    ```
  - خروجی آماده در `mobile-native/dist-releases/`.
- **برای iOS بومی / TestFlight:** روی macOS با Xcode دستور `npm install && npx cap add ios && npx cap sync ios` و ادغام مجوزهای [Info.plist.fragment.xml](file:///d:/Dev/Plate_Reader/Plate_Reader/mobile-native/ios-template/Info.plist.fragment.xml) اجرا شود (نیازمند حساب توسعه‌دهنده Apple؛ تا پیش از آن نسخه PWA روی Safari تمام امکانات را رایگان ارائه می‌دهد).

## ۵. مجوز انتظامات و ماژول دوربین
- بخش `/m/guard` و ارسال نامه یا دستور به انتظامات به‌صورت خودکار **هم در UI و هم در هسته Rust** به `alpr_addon_enabled` وابسته است؛ در دانگل یا لایسنس «فقط شهرک بدون دوربین» به کل پنهان و مسدود است (`403 MODULE_DISABLED`).
