# InterruptLab

InterruptLab, bilgisayar organizasyonu dersi için geliştirilen Tauri tabanlı bir kesme denetleyici simülatörüdür. Simülasyon çekirdeği React arayüzünden bağımsızdır ve 8 IRQ hattı, NMI, IRR/IMR/ISR kayıtları, fixed priority çözümleme, gerçek ISR cycle akışı, CPU context stack, nested interrupt, event log, sinyal akışı ve timeline görünümü içerir.

## Öne Çıkanlar

- IRQ0-IRQ7 için vector address, ISR cycle süresi, trigger mode ve mask durumu
- NMI için maske ve global interrupt flag dışı öncelikli akış
- CPU register modeli: PC, SP, FLAGS, ACC, R1, R2, R3
- Context save/restore sırasında gerçek stack frame push/pop
- Nested interrupt desteği ve aktif ISR stack
- ISR progress bar, kalan cycle ve vector göstergesi
- Sinyal akışı: IRQ Device, IRR, IMR Filter, Priority Resolver, CPU, Context, ISR, EOI
- Son 50 cycle için timeline

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
