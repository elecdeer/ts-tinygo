| Command | Mean Wall Time [s] | Change | Factor |
|:---|---:|---:|:---|
| `TS6 (JS tsc on Node)` | 9.525 ± 0.238 |  |  |
| `native (parallel)` | 1.199 ± 0.013 | -87.4% | (7.9x faster) |
| `native --singleThreaded` | 2.670 ± 0.021 | -72.0% | (3.6x faster) |
| `Go wasip1 --singleThreaded` | 15.282 ± 0.043 | +60.4% | (1.6x slower) |
| `TinyGo -opt=z --singleThreaded` | 21.495 ± 0.397 | +125.7% | (2.3x slower) |
| `TinyGo -opt=2 --singleThreaded` | 20.437 ± 0.147 | +114.6% | (2.1x slower) |
| `TinyGo initial memory 2GB --singleThreaded` | 15.910 ± 0.060 | +67.0% | (1.7x slower) |
| `TinyGo -gc=leaking --singleThreaded` | 9.666 ± 0.019 | +1.5% |  |
| `ts-rust native (parallel)` | 0.721 ± 0.007 | -92.4% | (13.2x faster) |
| `ts-rust native --singleThreaded` | 1.845 ± 0.009 | -80.6% | (5.2x faster) |
| `ts-rust wasm opt-level=z` | 5.327 ± 0.012 | -44.1% | (1.8x faster) |
| `ts-rust wasm opt-level=s` | 4.713 ± 0.097 | -50.5% | (2.0x faster) |
