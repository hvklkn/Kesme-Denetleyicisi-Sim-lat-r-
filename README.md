# InterruptLab

InterruptLab, bilgisayar organizasyonu dersi için geliştirilen Tauri tabanlı bir kesme denetleyici simülatörüdür. İlk aşama; bağımsız simülasyon çekirdeği, fixed priority çözümleyici, register gösterimleri, Türkçe koyu tema arayüzü ve temel test kapsamını içerir.

## Kurulum

```bash
npm install
```

Tauri masaüstü derlemesi için Rust toolchain gerekir:

```bash
rustup install stable
```

## Çalıştırma

```bash
npm run dev
```

Tauri geliştirme modu:

```bash
npm run tauri:dev
```

## Test

```bash
npm run test
npm run test:e2e
```

## Build

Frontend build:

```bash
npm run build
```

Tauri masaüstü build:

```bash
npm run tauri:build
```
