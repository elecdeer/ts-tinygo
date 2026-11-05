| Command | Mean Wall Time [ms] | Change | Factor |
|:---|---:|---:|:---|
| `TS6.0` | 425.8 ± 10.5 |  |  |
| `TS7.0 (Go)` | 1046.2 ± 28.8 | +145.7% | (2.5x slower) |
| `TS7.0 (TinyGo)` | 1266.4 ± 14.4 | +197.4% | (3.0x slower) |
| `TS7.0 (TinyGo -opt=2)` | 1401.3 ± 15.9 | +229.1% | (3.3x slower) |
| `TS7.0 (TinyGo, initial memory 2GB)` | 803.8 ± 9.9 | +88.8% | (1.9x slower) |
| `TS7.0 (TinyGo -gc=leaking)` | 628.2 ± 13.9 | +47.5% | (1.5x slower) |
| `TS7.1 (Go)` | 900.7 ± 32.5 | +111.5% | (2.1x slower) |
| `TS7.1 (TinyGo)` | 859.5 ± 10.8 | +101.8% | (2.0x slower) |
| `TS7.1 (TinyGo -opt=2)` | 849.5 ± 7.0 | +99.5% | (2.0x slower) |
| `TS7.1 (TinyGo, initial memory 2GB)` | 726.1 ± 7.6 | +70.5% | (1.7x slower) |
| `TS7.1 (TinyGo -gc=leaking)` | 571.1 ± 2.3 | +34.1% | (1.3x slower) |
| `TS7.1 dev (official wasm)` | 934.8 ± 12.5 | +119.5% | (2.2x slower) |
| `tsrs` | 221.9 ± 5.7 | -47.9% | (1.9x faster) |
| `ts-rust` | 336.0 ± 7.7 | -21.1% |  |
| `tsrs opt-level=z` | 241.2 ± 2.9 | -43.4% | (1.8x faster) |
| `ts-rust opt-level=s` | 301.8 ± 2.4 | -29.1% |  |
