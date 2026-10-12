| Command | Mean Wall Time [s] | Change | Factor |
|:---|---:|---:|:---|
| `native (parallel)` | 1.318 ± 0.063 |  |  |
| `native --singleThreaded` | 2.775 ± 0.061 | +110.6% | (2.1x slower) |
| `Go wasip1 --singleThreaded` | 14.655 ± 1.095 | +1012.2% | (11.1x slower) |
| `TinyGo -opt=z --singleThreaded` | 20.760 ± 0.239 | +1475.6% | (15.8x slower) |
| `TinyGo -opt=2 --singleThreaded` | 20.651 ± 0.907 | +1467.3% | (15.7x slower) |
