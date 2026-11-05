| Command | Mean Wall Time [s] | Change | Factor |
|:---|---:|---:|:---|
| `TS6.0` | 5.477 ± 0.180 |  |  |
| `TS7.0 (Go)` | 10.189 ± 0.189 | +86.0% | (1.9x slower) |
| `TS7.0 (TinyGo)` | 31.013 ± 0.102 | +466.3% | (5.7x slower) |
| `TS7.0 (TinyGo -opt=2)` | 31.532 ± 0.324 | +475.7% | (5.8x slower) |
| `TS7.0 (TinyGo, initial memory 2GB)` | 13.381 ± 0.226 | +144.3% | (2.4x slower) |
| `TS7.0 (TinyGo -gc=leaking)` | 5.937 ± 0.082 | +8.4% |  |
| `TS7.1 (Go)` | 7.628 ± 0.615 | +39.3% | (1.4x slower) |
| `TS7.1 (TinyGo)` | 18.901 ± 0.085 | +245.1% | (3.5x slower) |
| `TS7.1 (TinyGo -opt=2)` | 17.851 ± 0.064 | +225.9% | (3.3x slower) |
| `TS7.1 (TinyGo, initial memory 2GB)` | 6.764 ± 0.712 | +23.5% |  |
| `TS7.1 (TinyGo -gc=leaking)` | 4.999 ± 0.766 | -8.7% |  |
| `TS7.1 dev (official wasm)` | 7.544 ± 0.019 | +37.7% | (1.4x slower) |
| `tsrs` | 1.433 ± 0.015 | -73.8% | (3.8x faster) |
| `ts-rust` | 3.074 ± 0.007 | -43.9% | (1.8x faster) |
| `tsrs opt-level=z` | 1.838 ± 0.015 | -66.4% | (3.0x faster) |
| `ts-rust opt-level=s` | 2.476 ± 0.013 | -54.8% | (2.2x faster) |
