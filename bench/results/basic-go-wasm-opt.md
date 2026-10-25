| Command | Mean Wall Time [ms] | Change | Factor |
|:---|---:|---:|:---|
| `TS6.0` | 398.0 ± 10.2 |  |  |
| `TS7.0 (Go)` | 948.8 ± 54.0 | +138.4% | (2.4x slower) |
| `TS7.1 (Go)` | 887.8 ± 30.0 | +123.1% | (2.2x slower) |
| `TS7.0 (Go, wasm-opt -Oz)` | 909.9 ± 42.9 | +128.6% | (2.3x slower) |
| `TS7.1 (Go, wasm-opt -Oz)` | 871.5 ± 26.1 | +119.0% | (2.2x slower) |
