| Command | Mean Wall Time [s] | Change | Factor |
|:---|---:|---:|:---|
| `TS6.0` | 4.819 ± 0.124 |  |  |
| `TS7.0 (Go)` | 8.624 ± 0.541 | +79.0% | (1.8x slower) |
| `TS7.1 (Go)` | 7.588 ± 0.090 | +57.5% | (1.6x slower) |
| `TS7.0 (Go, wasm-opt -Oz)` | 8.879 ± 0.482 | +84.2% | (1.8x slower) |
| `TS7.1 (Go, wasm-opt -Oz)` | 7.005 ± 0.456 | +45.4% | (1.5x slower) |
