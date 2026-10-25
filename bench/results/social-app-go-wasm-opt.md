| Command | Mean Wall Time [s] | Change | Factor |
|:---|---:|---:|:---|
| `TS6.0` | 9.664 ± 0.080 |  |  |
| `TS7.0 (Go)` | 17.846 ± 2.591 | +84.7% | (1.8x slower) |
| `TS7.1 (Go)` | 14.080 ± 0.794 | +45.7% | (1.5x slower) |
| `TS7.0 (Go, wasm-opt -Oz)` | 17.096 ± 0.496 | +76.9% | (1.8x slower) |
| `TS7.1 (Go, wasm-opt -Oz)` | 13.832 ± 0.523 | +43.1% | (1.4x slower) |
