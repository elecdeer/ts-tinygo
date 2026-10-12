| Command | Mean Wall Time [ms] | Change | Factor |
|:---|---:|---:|:---|
| `native (parallel)` | 109.5 ± 2.4 |  |  |
| `native --singleThreaded` | 115.7 ± 1.5 | +5.7% |  |
| `Go wasip1 --singleThreaded` | 912.0 ± 34.3 | +733.0% | (8.3x slower) |
| `TinyGo -opt=z --singleThreaded` | 1053.4 ± 17.4 | +862.2% | (9.6x slower) |
| `TinyGo -opt=2 --singleThreaded` | 1147.2 ± 27.0 | +947.8% | (10.5x slower) |
