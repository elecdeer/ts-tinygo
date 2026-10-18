| Command | Mean Wall Time [ms] | Change | Factor |
|:---|---:|---:|:---|
| `TS6 (JS tsc on Node)` | 394.8 ± 2.6 |  |  |
| `native (parallel)` | 108.8 ± 0.9 | -72.4% | (3.6x faster) |
| `native --singleThreaded` | 116.4 ± 1.5 | -70.5% | (3.4x faster) |
| `Go wasip1 --singleThreaded` | 900.4 ± 44.4 | +128.1% | (2.3x slower) |
| `TinyGo -opt=z --singleThreaded` | 1035.5 ± 5.1 | +162.3% | (2.6x slower) |
| `TinyGo -opt=2 --singleThreaded` | 1118.6 ± 7.8 | +183.3% | (2.8x slower) |
| `TinyGo initial memory 2GB --singleThreaded` | 798.1 ± 5.9 | +102.2% | (2.0x slower) |
| `TinyGo -gc=leaking --singleThreaded` | 610.6 ± 6.8 | +54.7% | (1.5x slower) |
| `ts-rust native (parallel)` | 50.6 ± 0.7 | -87.2% | (7.8x faster) |
| `ts-rust native --singleThreaded` | 56.5 ± 0.3 | -85.7% | (7.0x faster) |
| `ts-rust wasm opt-level=z` | 320.5 ± 1.8 | -18.8% |  |
| `ts-rust wasm opt-level=s` | 288.7 ± 2.4 | -26.9% |  |
| `tsrs native (parallel)` | 34.6 ± 0.5 | -91.2% | (11.4x faster) |
| `tsrs native --singleThreaded` | 46.9 ± 0.5 | -88.1% | (8.4x faster) |
| `tsrs wasm opt-level=z` | 230.7 ± 2.1 | -41.6% | (1.7x faster) |
| `tsrs wasm opt-level=s` | 210.1 ± 1.3 | -46.8% | (1.9x faster) |
