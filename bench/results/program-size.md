<!-- The "program" rows of node bench/wasm-size.mjs <module> --embed <embedded files> for every build. -->

| module | embedded files | program | program, gzip -9 |
|---|---:|---:|---:|
| tsc-go.wasip1.wasm | 5.01 MB | 43.46 MB | 9.53 MB |
| tsc-go-oz.wasip1.wasm | 5.01 MB | 39.97 MB | 9.48 MB |
| tsc.wasip1.wasm | 5.01 MB | 15.01 MB | 4.80 MB |
| tsc-o2.wasip1.wasm | 5.01 MB | 22.50 MB | 6.77 MB |
| tsc-mem2g.wasip1.wasm | 5.01 MB | 15.01 MB | 4.80 MB |
| tsc-leaking.wasip1.wasm | 5.01 MB | 12.45 MB | 3.93 MB |
| tsc-go-7.0.wasip1.wasm | 4.88 MB | 42.88 MB | 9.06 MB |
| tsc-go-7.0-oz.wasip1.wasm | 4.88 MB | 39.25 MB | 9.02 MB |
| tsc-7.0.wasip1.wasm | 4.88 MB | 13.58 MB | 4.30 MB |
| tsc-7.0-o2.wasip1.wasm | 4.88 MB | 20.55 MB | 6.09 MB |
| tsc-7.0-mem2g.wasip1.wasm | 4.88 MB | 13.58 MB | 4.30 MB |
| tsc-7.0-leaking.wasip1.wasm | 4.88 MB | 11.25 MB | 3.53 MB |
| tsrs.wasm | 3.79 MB | 6.12 MB | 2.33 MB |
| tsrs-z.wasm | 3.79 MB | 4.99 MB | 1.99 MB |
| ts-rust.wasm | 0.32 MB | 4.75 MB | 1.86 MB |
| ts-rust-s.wasm | 0.32 MB | 5.98 MB | 2.27 MB |
