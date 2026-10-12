| Command | Mean Wall Time [s] | Change | Factor |
|:---|---:|---:|:---|
| `TS6 (JS tsc on Node)` | 9.248 ± 0.126 |  |  |
| `native (parallel)` | 1.260 ± 0.014 | -86.4% | (7.3x faster) |
| `native --singleThreaded` | 2.625 ± 0.031 | -71.6% | (3.5x faster) |
| `Go wasip1 --singleThreaded` | 14.221 ± 0.342 | +53.8% | (1.5x slower) |
| `TinyGo -opt=z --singleThreaded` | 20.741 ± 0.076 | +124.3% | (2.2x slower) |
| `TinyGo -opt=2 --singleThreaded` | 20.408 ± 0.186 | +120.7% | (2.2x slower) |
| `ts-rust native (parallel)` | 0.740 ± 0.002 | -92.0% | (12.5x faster) |
| `ts-rust native --singleThreaded` | 1.972 ± 0.101 | -78.7% | (4.7x faster) |
| `ts-rust wasm opt-level=z` | 5.680 ± 0.263 | -38.6% | (1.6x faster) |
| `ts-rust wasm opt-level=s` | 5.082 ± 0.091 | -45.0% | (1.8x faster) |
