| Command | Mean Wall Time [ms] | Change | Factor |
|:---|---:|---:|:---|
| `TS6 (JS tsc on Node)` | 397.0 ± 4.3 |  |  |
| `native (parallel)` | 108.4 ± 1.0 | -72.7% | (3.7x faster) |
| `native --singleThreaded` | 116.3 ± 1.9 | -70.7% | (3.4x faster) |
| `Go wasip1 --singleThreaded` | 923.0 ± 5.6 | +132.5% | (2.3x slower) |
| `TinyGo -opt=z --singleThreaded` | 1038.4 ± 5.4 | +161.6% | (2.6x slower) |
| `TinyGo -opt=2 --singleThreaded` | 1115.6 ± 6.4 | +181.0% | (2.8x slower) |
| `TinyGo initial memory 2GB --singleThreaded` | 795.9 ± 5.4 | +100.5% | (2.0x slower) |
| `TinyGo -gc=leaking --singleThreaded` | 608.8 ± 4.0 | +53.3% | (1.5x slower) |
| `ts-rust native (parallel)` | 50.6 ± 0.8 | -87.3% | (7.8x faster) |
| `ts-rust native --singleThreaded` | 58.5 ± 2.4 | -85.3% | (6.8x faster) |
| `ts-rust wasm opt-level=z` | 319.5 ± 1.1 | -19.5% |  |
| `ts-rust wasm opt-level=s` | 288.5 ± 1.0 | -27.3% |  |
