| variant | max RSS |
|---|---|
| TS6 (JS tsc on Node) | 1.70 GB |
| native (parallel) | 1.50 GB |
| native --singleThreaded | 1.05 GB |
| Go wasip1 --singleThreaded | 1.60 GB |
| TinyGo -opt=z --singleThreaded | 1.93 GB |
| TinyGo -opt=2 --singleThreaded | 2.15 GB |
| TinyGo initial memory 2GB --singleThreaded | 2.29 GB |
| TinyGo -gc=leaking --singleThreaded | 2.73 GB |
| ts-rust native (parallel) | 1.05 GB |
| ts-rust native --singleThreaded | 0.74 GB |
| ts-rust wasm opt-level=z | 0.77 GB |
| ts-rust wasm opt-level=s | 0.79 GB |
