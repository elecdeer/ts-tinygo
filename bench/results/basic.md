| Command | Mean Wall Time [ms] | Change | Factor |
|:---|---:|---:|:---|
| `native (parallel)` | 109.9 ± 2.3 |  |  |
| `native --singleThreaded` | 115.2 ± 1.2 | +4.9% |  |
| `Go wasip1 --singleThreaded` | 932.8 ± 12.6 | +749.2% | (8.5x slower) |
| `TinyGo -opt=z --singleThreaded` | 1045.6 ± 18.7 | +851.8% | (9.5x slower) |
| `TinyGo -opt=2 --singleThreaded` | 1122.0 ± 12.9 | +921.4% | (10.2x slower) |
| `ts-rust native (parallel)` | 51.2 ± 0.7 | -53.4% | (2.1x faster) |
| `ts-rust native --singleThreaded` | 57.3 ± 0.4 | -47.8% | (1.9x faster) |
| `ts-rust wasm opt-level=z` | 319.5 ± 2.0 | +190.9% | (2.9x slower) |
| `ts-rust wasm opt-level=s` | 295.3 ± 12.8 | +168.8% | (2.7x slower) |
