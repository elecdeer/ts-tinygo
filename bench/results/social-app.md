| Command | Mean Wall Time [s] | Change | Factor |
|:---|---:|---:|:---|
| `TS6.0` | 8.764 ± 0.015 |  |  |
| `TS7.0 (Go)` | 16.999 ± 0.290 | +94.0% | (1.9x slower) |
| `TS7.0 (TinyGo)` | 32.199 ± 1.556 | +267.4% | (3.7x slower) |
| `TS7.0 (TinyGo -opt=2)` | 31.262 ± 0.041 | +256.7% | (3.6x slower) |
| `TS7.0 (TinyGo, initial memory 2GB)` | 24.384 ± 0.172 | +178.2% | (2.8x slower) |
| `TS7.0 (TinyGo -gc=leaking)` | 3.852 ± 0.039 | -56.0% | (2.3x faster) |
| `TS7.1 (Go)` | 13.129 ± 0.797 | +49.8% | (1.5x slower) |
| `TS7.1 (TinyGo)` | 18.170 ± 0.866 | +107.3% | (2.1x slower) |
| `TS7.1 (TinyGo -opt=2)` | 16.233 ± 0.768 | +85.2% | (1.9x slower) |
| `TS7.1 (TinyGo, initial memory 2GB)` | 13.201 ± 0.018 | +50.6% | (1.5x slower) |
| `TS7.1 (TinyGo -gc=leaking)` | 8.109 ± 0.010 | -7.5% |  |
| `tsrs` | 2.387 ± 0.026 | -72.8% | (3.7x faster) |
| `ts-rust` | 5.111 ± 0.006 | -41.7% | (1.7x faster) |
| `tsrs opt-level=z` | 2.957 ± 0.007 | -66.3% | (3.0x faster) |
| `ts-rust opt-level=s` | 4.452 ± 0.021 | -49.2% | (2.0x faster) |
