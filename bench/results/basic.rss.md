| variant | max RSS |
|---|---|
| TS6 (JS tsc on Node) | 0.24 GB |
| native (parallel) | 0.09 GB |
| native --singleThreaded | 0.09 GB |
| Go wasip1 --singleThreaded | 0.36 GB |
| TinyGo -opt=z --singleThreaded | 0.42 GB |
| TinyGo -opt=2 --singleThreaded | 0.48 GB |
| TinyGo initial memory 2GB --singleThreaded | 0.46 GB |
| TinyGo -gc=leaking --singleThreaded | 0.36 GB |
| ts-rust native (parallel) | 0.07 GB |
| ts-rust native --singleThreaded | 0.06 GB |
| ts-rust wasm opt-level=z | 0.19 GB |
| ts-rust wasm opt-level=s | 0.19 GB |
