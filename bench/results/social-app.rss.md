| variant | max RSS |
|---|---|
| native (parallel) | 1.42 GB |
| native --singleThreaded | 1.00 GB |
| Go wasip1 --singleThreaded | 1.59 GB |
| TinyGo -opt=z --singleThreaded | 1.93 GB |
| TinyGo -opt=2 --singleThreaded | 2.12 GB |
| ts-rust native (parallel) | 1.06 GB |
| ts-rust native --singleThreaded | 0.74 GB |
| ts-rust wasm opt-level=z | 0.76 GB |
| ts-rust wasm opt-level=s | 0.79 GB |
