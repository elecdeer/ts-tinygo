| Command | Mean Wall Time [s] | Change | Factor |
|:---|---:|---:|:---|
| `TS6.0` | 10.313 ± 0.150 |  |  |
| `TS7.0 (Go)` | 20.406 ± 0.585 | +97.9% | (2.0x slower) |
| `TS7.0 (TinyGo)` | 34.791 ± 0.122 | +237.3% | (3.4x slower) |
| `TS7.0 (TinyGo -opt=2)` | 35.061 ± 0.802 | +240.0% | (3.4x slower) |
| `TS7.0 (TinyGo, initial memory 2GB)` | 27.293 ± 0.238 | +164.6% | (2.6x slower) |
| `TS7.0 (TinyGo -gc=leaking)` | 4.388 ± 0.163 | -57.5% | (2.4x faster) |
| `TS7.1 (Go)` | 15.214 ± 0.381 | +47.5% | (1.5x slower) |
| `TS7.1 (TinyGo)` | 20.251 ± 0.767 | +96.4% | (2.0x slower) |
| `TS7.1 (TinyGo -opt=2)` | 18.000 ± 0.767 | +74.5% | (1.7x slower) |
| `TS7.1 (TinyGo, initial memory 2GB)` | 15.003 ± 0.674 | +45.5% | (1.5x slower) |
| `TS7.1 (TinyGo -gc=leaking)` | 9.221 ± 0.031 | -10.6% |  |
| `TS7.1 dev (official wasm)` | 15.533 ± 0.751 | +50.6% | (1.5x slower) |
| `tsrs` | 2.747 ± 0.018 | -73.4% | (3.8x faster) |
| `ts-rust` | 6.381 ± 0.048 | -38.1% | (1.6x faster) |
| `tsrs opt-level=z` | 3.410 ± 0.032 | -66.9% | (3.0x faster) |
| `ts-rust opt-level=s` | 5.456 ± 0.047 | -47.1% | (1.9x faster) |
