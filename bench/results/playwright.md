| Command | Mean Wall Time [s] | Change | Factor |
|:---|---:|---:|:---|
| `TS6.0` | 5.245 ± 0.055 |  |  |
| `TS7.0 (Go)` | 9.978 ± 0.010 | +90.2% | (1.9x slower) |
| `TS7.0 (TinyGo)` | 30.229 ± 0.038 | +476.4% | (5.8x slower) |
| `TS7.0 (TinyGo -opt=2)` | 30.983 ± 0.070 | +490.7% | (5.9x slower) |
| `TS7.0 (TinyGo, initial memory 2GB)` | 13.251 ± 0.030 | +152.6% | (2.5x slower) |
| `TS7.0 (TinyGo -gc=leaking)` | 5.892 ± 0.020 | +12.3% |  |
| `TS7.1 (Go)` | 8.084 ± 0.045 | +54.1% | (1.5x slower) |
| `TS7.1 (TinyGo)` | 18.997 ± 0.041 | +262.2% | (3.6x slower) |
| `TS7.1 (TinyGo -opt=2)` | 17.671 ± 0.056 | +236.9% | (3.4x slower) |
| `TS7.1 (TinyGo, initial memory 2GB)` | 6.255 ± 0.005 | +19.3% |  |
| `TS7.1 (TinyGo -gc=leaking)` | 4.531 ± 0.015 | -13.6% |  |
| `tsrs` | 1.457 ± 0.009 | -72.2% | (3.6x faster) |
| `ts-rust` | 2.866 ± 0.011 | -45.4% | (1.8x faster) |
| `tsrs opt-level=z` | 1.823 ± 0.009 | -65.2% | (2.9x faster) |
| `ts-rust opt-level=s` | 2.403 ± 0.012 | -54.2% | (2.2x faster) |
