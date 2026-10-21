| Command | Mean Wall Time [ms] | Change | Factor |
|:---|---:|---:|:---|
| `TS6.0` | 411.0 ± 3.4 |  |  |
| `TS7.0 (Go)` | 983.5 ± 52.6 | +139.3% | (2.4x slower) |
| `TS7.0 (TinyGo)` | 1262.5 ± 4.1 | +207.2% | (3.1x slower) |
| `TS7.0 (TinyGo -opt=2)` | 1392.3 ± 3.8 | +238.8% | (3.4x slower) |
| `TS7.0 (TinyGo, initial memory 2GB)` | 796.3 ± 3.6 | +93.8% | (1.9x slower) |
| `TS7.0 (TinyGo -gc=leaking)` | 614.0 ± 3.8 | +49.4% | (1.5x slower) |
| `TS7.1 (Go)` | 896.1 ± 4.5 | +118.0% | (2.2x slower) |
| `TS7.1 (TinyGo)` | 863.3 ± 4.3 | +110.1% | (2.1x slower) |
| `TS7.1 (TinyGo -opt=2)` | 840.6 ± 4.7 | +104.5% | (2.0x slower) |
| `TS7.1 (TinyGo, initial memory 2GB)` | 723.8 ± 5.6 | +76.1% | (1.8x slower) |
| `TS7.1 (TinyGo -gc=leaking)` | 554.4 ± 5.9 | +34.9% | (1.3x slower) |
| `tsrs` | 213.4 ± 1.2 | -48.1% | (1.9x faster) |
| `ts-rust` | 329.6 ± 3.6 | -19.8% |  |
| `tsrs opt-level=z` | 240.0 ± 2.0 | -41.6% | (1.7x faster) |
| `ts-rust opt-level=s` | 296.9 ± 2.0 | -27.8% |  |
