| Command | Mean Wall Time [s] | Change | Factor |
|:---|---:|---:|:---|
| `TS6 (JS tsc on Node)` | 9.117 ± 0.041 |  |  |
| `native (parallel)` | 1.230 ± 0.028 | -86.5% | (7.4x faster) |
| `native --singleThreaded` | 2.625 ± 0.012 | -71.2% | (3.5x faster) |
| `Go wasip1 --singleThreaded` | 14.137 ± 0.515 | +55.1% | (1.6x slower) |
| `TinyGo -opt=z --singleThreaded` | 20.913 ± 0.294 | +129.4% | (2.3x slower) |
| `TinyGo -opt=2 --singleThreaded` | 21.691 ± 0.922 | +137.9% | (2.4x slower) |
| `TinyGo initial memory 2GB --singleThreaded` | 15.881 ± 0.084 | +74.2% | (1.7x slower) |
| `TinyGo -gc=leaking --singleThreaded` | 9.736 ± 0.032 | +6.8% |  |
| `ts-rust native (parallel)` | 0.735 ± 0.003 | -91.9% | (12.4x faster) |
| `ts-rust native --singleThreaded` | 1.896 ± 0.006 | -79.2% | (4.8x faster) |
| `ts-rust wasm opt-level=z` | 5.579 ± 0.008 | -38.8% | (1.6x faster) |
| `ts-rust wasm opt-level=s` | 4.903 ± 0.001 | -46.2% | (1.9x faster) |
| `tsrs native (parallel)` | 0.326 ± 0.006 | -96.4% | (27.9x faster) |
| `tsrs native --singleThreaded` | 1.150 ± 0.013 | -87.4% | (7.9x faster) |
| `tsrs wasm opt-level=z` | 3.123 ± 0.009 | -65.7% | (2.9x faster) |
| `tsrs wasm opt-level=s` | 2.524 ± 0.020 | -72.3% | (3.6x faster) |
