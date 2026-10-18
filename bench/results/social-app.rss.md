| variant | max RSS |
|---|---|
| TS6 (JS tsc on Node) | 1.69 GB |
| native (parallel) | 1.50 GB |
| native --singleThreaded | 1.05 GB |
| Go wasip1 --singleThreaded | 1.59 GB |
| TinyGo -opt=z --singleThreaded | 1.94 GB |
| TinyGo -opt=2 --singleThreaded | 2.12 GB |
| TinyGo initial memory 2GB --singleThreaded | 2.30 GB |
| TinyGo -gc=leaking --singleThreaded | 2.75 GB |
| ts-rust native (parallel) | 1.06 GB |
| ts-rust native --singleThreaded | 0.75 GB |
| ts-rust wasm opt-level=z | 0.77 GB |
| ts-rust wasm opt-level=s | 0.79 GB |
| tsrs native (parallel) | 0.85 GB |
| tsrs native --singleThreaded | 0.39 GB |
| tsrs wasm opt-level=z | 0.46 GB |
| tsrs wasm opt-level=s | 0.47 GB |
