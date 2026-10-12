| Command | Mean Wall Time [ms] | Change | Factor |
|:---|---:|---:|:---|
| `TS6 (JS tsc on Node)` | 383.7 ± 7.5 |  |  |
| `native (parallel)` | 105.8 ± 1.2 | -72.4% | (3.6x faster) |
| `native --singleThreaded` | 115.2 ± 3.3 | -70.0% | (3.3x faster) |
| `Go wasip1 --singleThreaded` | 918.7 ± 12.6 | +139.4% | (2.4x slower) |
| `TinyGo -opt=z --singleThreaded` | 1031.4 ± 15.2 | +168.8% | (2.7x slower) |
| `TinyGo -opt=2 --singleThreaded` | 1118.8 ± 15.1 | +191.6% | (2.9x slower) |
| `ts-rust native (parallel)` | 51.1 ± 0.6 | -86.7% | (7.5x faster) |
| `ts-rust native --singleThreaded` | 57.8 ± 1.2 | -84.9% | (6.6x faster) |
| `ts-rust wasm opt-level=z` | 321.3 ± 3.2 | -16.3% |  |
| `ts-rust wasm opt-level=s` | 293.1 ± 4.5 | -23.6% |  |
