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

比較するビルドの詳細は [docs/builds.md](docs/builds.md) にまとめている。

括弧内は TS6 に対する速度比。

| バリアント | サイズ | gzip -9 | social-app 実行時間 | social-app RSS | Playwright 実行時間 | Playwright RSS | basic 実行時間 | basic RSS |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| **TS6.0** | 10.0 MB | 1.6 MB | 8.76 s (1.0x) | 1.70 GB | 5.24 s (1.0x) | 1.20 GB | 411 ms (1.0x) | 0.25 GB |
| TS7.0 (Go) | 49.5 MB | 10.8 MB | 17.0 s (0.52x) | 1.77 GB | 9.98 s (0.53x) | 1.16 GB | 983 ms (0.42x) | 0.35 GB |
| TS7.0 (TinyGo) `-opt=z`（デフォルト） | 20.0 MB | 6.1 MB | 32.2 s (0.27x) | 3.44 GB | 30.2 s (0.17x) | 1.83 GB | 1,263 ms (0.33x) | 0.41 GB |
| TS7.0 (TinyGo) `-opt=2` | 26.8 MB | 7.9 MB | 31.3 s (0.28x) | 3.63 GB | 31.0 s (0.17x) | 2.01 GB | 1,392 ms (0.30x) | 0.46 GB |
| TS7.0 (TinyGo) 初期メモリ 2GB | 20.0 MB | 6.1 MB | 24.4 s (0.36x) | 4.29 GB | 13.3 s (0.40x) | 2.26 GB | 796 ms (0.52x) | 0.49 GB |
| TS7.0 (TinyGo) `-gc=leaking` | 17.6 MB | 5.3 MB | メモリ不足 | – | 5.89 s (0.89x) | 3.17 GB | 614 ms (0.67x) | 0.41 GB |
| TS7.1 (Go) | 50.1 MB | 11.4 MB | 13.1 s (0.67x) | 1.32 GB | 8.08 s (0.65x) | 0.90 GB | 896 ms (0.46x) | 0.33 GB |
| TS7.1 (TinyGo) `-opt=z`（デフォルト） | 21.8 MB | 6.7 MB | 18.2 s (0.48x) | 1.92 GB | 19.0 s (0.28x) | 1.09 GB | 863 ms (0.48x) | 0.40 GB |
| TS7.1 (TinyGo) `-opt=2` | 29.0 MB | 8.6 MB | 16.2 s (0.54x) | 2.09 GB | 17.7 s (0.30x) | 1.26 GB | 841 ms (0.49x) | 0.47 GB |
| TS7.1 (TinyGo) 初期メモリ 2GB | 21.8 MB | 6.7 MB | 13.2 s (0.66x) | 2.30 GB | 6.26 s (0.84x) | 1.83 GB | 724 ms (0.57x) | 0.44 GB |
| TS7.1 (TinyGo) `-gc=leaking` | 19.2 MB | 5.8 MB | 8.11 s (1.1x) | 2.55 GB | 4.53 s (1.2x) | 1.53 GB | 554 ms (0.74x) | 0.34 GB |
| tsrs `opt-level=s`（デフォルト） | 9.9 MB | 2.9 MB | 2.39 s (3.7x) | 0.47 GB | 1.46 s (3.6x) | 0.37 GB | 213 ms (1.9x) | 0.16 GB |
| ts-rust `opt-level=z`（デフォルト） | 5.1 MB | 2.2 MB | 5.11 s (1.7x) | 0.77 GB | 2.87 s (1.8x) | 0.57 GB | 330 ms (1.2x) | 0.19 GB |
| tsrs `opt-level=z` | 8.8 MB | 2.5 MB | 2.96 s (3.0x) | 0.46 GB | 1.82 s (2.9x) | 0.35 GB | 240 ms (1.7x) | 0.14 GB |
| ts-rust `opt-level=s` | 6.3 MB | 2.6 MB | 4.45 s (2.0x) | 0.78 GB | 2.40 s (2.2x) | 0.59 GB | 297 ms (1.4x) | 0.20 GB |
