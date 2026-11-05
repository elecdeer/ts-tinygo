# ビルド

検証で使っているビルドの一覧と、ビルドし直す方法。

## 一覧

wasm バイナリは `out/` にコミットしているので、検証や Playground のためにビルドし直す必要はない。
コンパイラのソースやビルドの設定を変えたときだけ、下のコマンドでビルドし直してコミットする。
生成元のソースはサブモジュールの固定先と `patches/` で決まる。

| ファイル（`out/`） | コンパイラ | ツールチェーン | 内容 |
|---|---|---|---|
| `tsc-go-7.0.wasip1.wasm` | TS 7.0.2 | Go | 標準 Go のベースライン |
| `tsc-7.0.wasip1.wasm` | TS 7.0.2 | TinyGo | `-opt=z`（デフォルト） |
| `tsc-7.0-o2.wasip1.wasm` | TS 7.0.2 | TinyGo | `-opt=2`（速度優先の最適化） |
| `tsc-7.0-mem2g.wasip1.wasm` | TS 7.0.2 | TinyGo | 初期メモリ 2GB |
| `tsc-7.0-leaking.wasip1.wasm` | TS 7.0.2 | TinyGo | `-gc=leaking`（GC なし） |
| `tsc-go.wasip1.wasm` | TS 7.1 beta | Go | 標準 Go のベースライン |
| `tsc.wasip1.wasm` | TS 7.1 beta | TinyGo | `-opt=z`（デフォルト） |
| `tsc-o2.wasip1.wasm` | TS 7.1 beta | TinyGo | `-opt=2`（速度優先の最適化） |
| `tsc-mem2g.wasip1.wasm` | TS 7.1 beta | TinyGo | 初期メモリ 2GB |
| `tsc-leaking.wasip1.wasm` | TS 7.1 beta | TinyGo | `-gc=leaking`（GC なし） |
| `tsrs.wasm` | tsrs | Rust | `opt-level=s`（デフォルト） |
| `tsrs-z.wasm` | tsrs | Rust | `opt-level=z` |
| `ts-rust.wasm` | ts-rust | Rust | `opt-level=z`（デフォルト） |
| `ts-rust-s.wasm` | ts-rust | Rust | `opt-level=s` |

ネイティブバイナリ（`tsc-native`、`tsrs-native`、`ts-rust-native`）は環境に依存するのでコミットしていない。[言語サーバーのベンチマーク](bench-lsp.md)を動かすときはビルドが必要。

## ビルド方法

ツールは `mise.toml` で固定している（Go、TinyGo、TinyGo が使う `wasm-opt` の binaryen、`wasm-strip` などの wabt、hyperfine、ts-rust 用の Rust、tsrs の mimalloc 用の CMake）。
tsrs は `tsrs/rust-toolchain.toml` で独自に Rust のバージョンを固定しており、初回使用時に rustup がインストールする。

```sh
mise install

# TinyGo
scripts/build.sh wasip1     # out/tsc.wasip1.wasm
SUFFIX=-o2 TINYGO_FLAGS="-no-debug -opt=2" scripts/build.sh wasip1
SUFFIX=-mem2g TINYGO_FLAGS="-no-debug -target=$PWD/targets/wasip1-mem2g.json" scripts/build.sh wasip1
SUFFIX=-leaking TINYGO_FLAGS="-no-debug -gc=leaking" scripts/build.sh wasip1

# 標準 Go
scripts/build-go.sh wasip1  # out/tsc-go.wasip1.wasm
scripts/build-go.sh native  # out/tsc-native

# Rust 移植版
scripts/build-tsrs.sh wasm wasm-z native      # out/tsrs.wasm, out/tsrs-z.wasm, out/tsrs-native
scripts/build-ts-rust.sh wasm wasm-s native   # out/ts-rust.wasm, out/ts-rust-s.wasm, out/ts-rust-native
```

TS 7.0 のビルドは、TinyGo と標準 Go のどのコマンドにも `TS_VERSION=7.0` を付ける（例: `TS_VERSION=7.0 scripts/build.sh wasip1` で `out/tsc-7.0.wasip1.wasm`）。

`TS_VERSION` のデフォルトは 7.1。
`scripts/build.sh` は同じバージョンについては同時に 1 つだけ実行すること。サブモジュールにパッチを当てて戻すため。
`scripts/build-go.sh` もパッチを当てていないソースを前提にしているので、同じバージョンの `scripts/build.sh` と同時に実行しないこと。

`scripts/build.sh` はビルドの間だけパッチをサブモジュールに当て、終わると元に戻す。
7.1 には `patches/*.patch`、7.0 には同じ内容を `typescript-go` のレイアウト（`cmd/tsgo`）に移植した `patches/typescript-go/*.patch` を使う。
7.0 にはジェネリックメソッドがないので 0001 は不要。
TinyGo のリンク・最適化フェーズはシングルスレッドなので、ターゲットは並列にビルドする。

`scripts/build.sh` を引数なしで実行すると、実行できない TinyGo の js ターゲット（`out/tsc.wasm.wasm`）もビルドする。これはコミットしない。

## 回避策

- **TinyGo コンパイラのパニック `unknown type: T`**（[0001](../patches/0001-avoid-generic-method-tinygo-panic.patch)）:
  TinyGo 0.43 は、型パラメータが本体にしか現れずインターフェースに流れ込む Go 1.27 のジェネリックメソッドでクラッシュする。
  `packagejson` の `unmarshalJSONValueFrom` をジェネリック関数に書き換えている。最小再現:

  ```go
  type V struct{ v any }

  func (v *V) Set[T any](n int) { v.v = make([]T, n) } // panics; the same as a generic func compiles

  func main() { var v V; v.Set[string](2) }
  ```

- **作業ディレクトリ**（[0002](../patches/0002-sync-cwd-with-pwd-on-tinygo-wasip1.patch)）:
  wasi-libc は cwd を `/` から始まるものとしてエミュレートする一方、標準 Go の wasip1 ポートは `$PWD` を読む。そのため TinyGo ビルドは起動時に `$PWD` へ `chdir` する。
- **スタックサイズ**: TinyGo の goroutine スタックは固定長（wasm ではデフォルト 64KB）で、チェッカーがこれを溢れさせてヒープを壊す
  （`core.LinkStore.Get` での nil ポインタパニックとして現れる）。ビルドでは `-stack-size=16MB` を使う。
- **シングルスレッド**（[0003](../patches/0003-run-single-threaded-on-tinygo.patch)）:
  tsc はファイルやパッケージごとに goroutine を起動し、TinyGo ではその 1 つ 1 つが固定長スタックを丸ごと確保する。
  大きなプロジェクトは 1MB スタックでも wasm32 のメモリを使い切り、小さなプロジェクトでも 1 goroutine の場合より約 2.7 倍遅い。
  TinyGo ビルドは `--singleThreaded` と同じように常にシングルスレッドで動き、このフラグが届かない部分
  （言語サーバーの自動インポートレジストリとプロジェクトビルダー）も対象にしている。
- **言語サーバーの入力**（[0004](../patches/0004-poll-lsp-stdin-on-tinygo.patch)）:
  stdin でブロッキングする `fd_read` は、クライアントが次のメッセージを送るまで全 goroutine を止めるため、バックグラウンド処理が滞る。
  TinyGo ではサーバーが stdin をノンブロッキングにしてポーリングする。これで診断は流れ続けるが、補完は依然として応答しない（[言語サーバーのベンチマーク](bench-lsp.md)を参照）。

## その他の実装

### ts-rust

[pingdotgg/ts-rust](https://github.com/pingdotgg/ts-rust)（サブモジュール `ts-rust`）は typescript-go の Rust 移植版で、`wasm32-wasip1` ビルドを公式にサポートしている。
そのモジュールは WASI コマンドではなく、JS のグルーコード（`npm/wasm/core.js`）が `ts_input`/`ts_run`/`ts_output` のエクスポートと、ファイルシステム用の `ts_host` インポートを通じて動かす。

```sh
rustup target add wasm32-wasip1
scripts/build-ts-rust.sh            # out/ts-rust.wasm, out/ts-rust-s.wasm, out/ts-rust-native
node scripts/run-ts-rust.mjs out/ts-rust.wasm -p examples/basic
```

### tsrs

[oxc-project/tsrs](https://github.com/oxc-project/tsrs)（サブモジュール `tsrs`）も TypeScript 7 コンパイラの Rust 移植版で、言語サーバー（`tsrs --lsp --stdio`）と `wasm32-wasip1` ビルド（`@tsrs/wasm`）がある。
ts-rust と同じく、そのモジュールは WASI コマンドではない。JS のグルーコード（`npm/tsrs-wasm/node.js`）が `tsrs_input`/`tsrs_run`/`tsrs_output` のエクスポートと、ファイルシステム用の `tsrs_host` インポートを通じて動かす。言語サーバーは含まない。

```sh
rustup target add wasm32-wasip1
scripts/build-tsrs.sh               # out/tsrs.wasm, out/tsrs-z.wasm, out/tsrs-native
node scripts/run-tsrs.mjs out/tsrs.wasm -p examples/basic
```

### bun check（未ビルド）

`bun check` のチェッカーは [oven-sh/bun](https://github.com/oven-sh/bun) の `src/sema`（Rust）で、Bun の C/C++ 部分を Rust の代替実装に置き換えたスタンドアロンの `bun-sema` バイナリがある。
ネイティブでのビルドはでき（`bun scripts/build.ts --profile=debug --mode=codegen`、`BUN_CODEGEN_DIR`、`vendor/` クレートのスタブ、欠けている `mi_heap_visit_blocks` の代替 1 つを用意した上で）、`examples/basic` では tsc と同じ結果になる。
