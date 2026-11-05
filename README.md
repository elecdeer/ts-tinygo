# ts-tinygo

TypeScript コンパイラの Go 移植版（`tsc`、TypeScript 7）を [TinyGo](https://tinygo.org/) で WebAssembly にビルドする実験。

コンパイラのソースはサブモジュールとして 2 バージョン固定している。

| サブモジュール | バージョン | ソース |
|---|---|---|
| `TypeScript` | 7.1 beta（`v7.1-beta`） | [microsoft/TypeScript](https://github.com/microsoft/TypeScript) の `tsc/` |
| `typescript-go` | 7.0.2（`typescript/v7.0.2`） | [microsoft/typescript-go](https://github.com/microsoft/typescript-go) |

7.0 は `microsoft/typescript-go` からリリースされ、その後移植版が本家にマージされて `microsoft/typescript-go` はアーカイブされた。
本家の `v7.0.2` タグは JavaScript 版のツリーを指しているので、7.0 のビルドには `microsoft/typescript-go` を使う。

## 状況

| ターゲット | ビルド | 実行 |
|---|---|---|
| TinyGo `wasip1` | ✅ | ✅ 型チェックと出力ができる（Node.js の WASI、ブラウザでは [browser_wasi_shim](https://github.com/bjorn3/browser_wasi_shim) 経由） |
| TinyGo `wasm`（js） | ✅ | ❌ TinyGo の js ターゲットにはファイルシステムがない（`os.Getwd` が空になり `path must be absolute`） |

## セットアップ

ビルド済みの wasm バイナリを `out/` にコミットしているので、動かすだけならビルドは要らない。
tsrs と ts-rust の wasm の実行には各サブモジュールの JS グルーコードを使う。

```sh
git submodule update --init --depth 1
```

ビルドし直す方法は [docs/builds.md](docs/builds.md) を参照。

## 実行

```sh
cd examples/basic
node ../../scripts/run-wasi.mjs ../../out/tsc.wasip1.wasm -p .
```

TinyGo ビルドは何も指定しなくてもシングルスレッドで動く（[0003](patches/0003-run-single-threaded-on-tinygo.patch)）。

## Playground

ブラウザ用の Playground（Vite + React + Monaco）は、インメモリのファイルシステム上でビルドを Worker 内で実行し、TinyGo・標準 Go・ts-rust を切り替えられる。

```sh
cd playground
pnpm install
pnpm run dev
```

## 検証結果

| 検証 | 内容 |
|---|---|
| [実行時間とメモリ](docs/bench-time-memory.md) | social-app・Playwright・examples/basic の型チェックの時間とピーク RSS |
| [サイズ](docs/bench-size.md) | 配布サイズ、wasm バイナリの内訳、TS6 との比較 |
| [CPU プロファイル](docs/bench-cpu-profile.md) | TinyGo が遅い理由、TS7.0 の Go と TinyGo の処理の種類ごとの内訳 |
| [言語サーバー](docs/bench-lsp.md) | social-app での診断・編集・補完・ホバーの応答時間 |

公式 wasm は `@typescript/typescript-wasip1-wasm`（Microsoft が npm で公開している標準 Go のビルド）。比較するビルドの詳細は [docs/builds.md](docs/builds.md) にまとめている。

括弧内は TS6 に対する速度比。

| バリアント | サイズ | gzip -9 | social-app 実行時間 | social-app RSS | Playwright 実行時間 | Playwright RSS | basic 実行時間 | basic RSS |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| **TS6.0** | 10.0 MB | 1.6 MB | 10.3 s (1.0x) | 1.65 GB | 5.48 s (1.0x) | 1.20 GB | 426 ms (1.0x) | 0.24 GB |
| TS7.0 (Go) | 49.5 MB | 10.8 MB | 20.4 s (0.51x) | 1.73 GB | 10.2 s (0.54x) | 1.10 GB | 1,046 ms (0.41x) | 0.34 GB |
| TS7.0 (TinyGo) `-opt=z`（デフォルト） | 20.0 MB | 6.1 MB | 34.8 s (0.30x) | 2.98 GB | 31.0 s (0.18x) | 1.81 GB | 1,266 ms (0.34x) | 0.40 GB |
| TS7.0 (TinyGo) `-opt=2` | 26.8 MB | 7.9 MB | 35.1 s (0.29x) | 3.55 GB | 31.5 s (0.17x) | 1.95 GB | 1,401 ms (0.30x) | 0.49 GB |
| TS7.0 (TinyGo) 初期メモリ 2GB | 20.0 MB | 6.1 MB | 27.3 s (0.38x) | 4.09 GB | 13.4 s (0.41x) | 2.24 GB | 804 ms (0.53x) | 0.50 GB |
| TS7.0 (TinyGo) `-gc=leaking` | 17.6 MB | 5.3 MB | メモリ不足 | – | 5.94 s (0.92x) | 3.15 GB | 628 ms (0.68x) | 0.42 GB |
| TS7.1 (Go) | 50.1 MB | 11.4 MB | 15.2 s (0.68x) | 1.27 GB | 7.63 s (0.72x) | 0.85 GB | 901 ms (0.47x) | 0.32 GB |
| TS7.1 (TinyGo) `-opt=z`（デフォルト） | 21.8 MB | 6.7 MB | 20.3 s (0.51x) | 1.87 GB | 18.9 s (0.29x) | 1.05 GB | 860 ms (0.50x) | 0.37 GB |
| TS7.1 (TinyGo) `-opt=2` | 29.0 MB | 8.6 MB | 18.0 s (0.57x) | 2.00 GB | 17.9 s (0.31x) | 1.20 GB | 850 ms (0.50x) | 0.47 GB |
| TS7.1 (TinyGo) 初期メモリ 2GB | 21.8 MB | 6.7 MB | 15.0 s (0.69x) | 2.25 GB | 6.76 s (0.81x) | 1.79 GB | 726 ms (0.59x) | 0.45 GB |
| TS7.1 (TinyGo) `-gc=leaking` | 19.2 MB | 5.8 MB | 9.22 s (1.1x) | 2.50 GB | 5.00 s (1.1x) | 1.49 GB | 571 ms (0.75x) | 0.34 GB |
| TS7.1 dev（公式 wasm） | 52.6 MB | 13.2 MB | 15.5 s (0.66x) | 1.22 GB | 7.54 s (0.73x) | 0.83 GB | 935 ms (0.46x) | 0.51 GB |
| tsrs `opt-level=s`（デフォルト） | 9.9 MB | 2.9 MB | 2.75 s (3.8x) | 0.46 GB | 1.43 s (3.8x) | 0.36 GB | 222 ms (1.9x) | 0.15 GB |
| ts-rust `opt-level=z`（デフォルト） | 5.1 MB | 2.2 MB | 6.38 s (1.6x) | 0.77 GB | 3.07 s (1.8x) | 0.58 GB | 336 ms (1.3x) | 0.19 GB |
| tsrs `opt-level=z` | 8.8 MB | 2.5 MB | 3.41 s (3.0x) | 0.45 GB | 1.84 s (3.0x) | 0.35 GB | 241 ms (1.8x) | 0.14 GB |
| ts-rust `opt-level=s` | 6.3 MB | 2.6 MB | 5.46 s (1.9x) | 0.78 GB | 2.48 s (2.2x) | 0.59 GB | 302 ms (1.4x) | 0.20 GB |
