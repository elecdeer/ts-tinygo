| Command | Mean Wall Time [s] | Change | Factor |
|:---|---:|---:|:---|
| `native (parallel)` | 1.209 ± 0.019 |  |  |
| `native --singleThreaded` | 2.661 ± 0.093 | +120.2% | (2.2x slower) |
| `Go wasip1 --singleThreaded` | 14.963 ± 0.029 | +1137.8% | (12.4x slower) |
| `TinyGo -opt=z --singleThreaded` | 20.969 ± 0.050 | +1634.6% | (17.3x slower) |
| `TinyGo -opt=2 --singleThreaded` | 20.360 ± 0.113 | +1584.3% | (16.8x slower) |
| `ts-rust native (parallel)` | 0.728 ± 0.025 | -39.7% | (1.7x faster) |
| `ts-rust native --singleThreaded` | 1.875 ± 0.020 | +55.1% | (1.6x slower) |
| `ts-rust wasm opt-level=z` | 5.882 ± 0.257 | +386.6% | (4.9x slower) |
| `ts-rust wasm opt-level=s` | 4.997 ± 0.012 | +313.4% | (4.1x slower) |
