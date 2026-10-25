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

ツールは `mise.toml` で固定している（Go、TinyGo、`wasm-opt` 用の binaryen、`wasm-strip` などの wabt、hyperfine、ts-rust 用の Rust、tsrs の mimalloc 用の CMake）。
tsrs は `tsrs/rust-toolchain.toml` で独自に Rust のバージョンを固定しており、初回使用時に rustup がインストールする。

```sh
git submodule update --init --depth 1
mise install
```

## ビルド

```sh
scripts/build.sh            # TinyGo: out/tsc.wasip1.wasm, out/tsc.wasm.wasm
scripts/build.sh wasip1     # 1 ターゲットのみ
scripts/build-go.sh         # 標準 Go のベースライン: out/tsc-go.wasip1.wasm, out/tsc-native
TS_VERSION=7.0 scripts/build.sh wasip1      # 7.0.2: out/tsc-7.0.wasip1.wasm
TS_VERSION=7.0 scripts/build-go.sh wasip1   # 7.0.2: out/tsc-go-7.0.wasip1.wasm
SUFFIX=-oz WASM_OPT_FLAGS=-Oz scripts/build-go.sh wasip1   # 標準 Go のビルドに wasm-opt をかける: out/tsc-go-oz.wasip1.wasm
SUFFIX=-o2 TINYGO_FLAGS="-no-debug -opt=2" scripts/build.sh wasip1   # 速度優先の最適化
SUFFIX=-mem2g TINYGO_FLAGS="-no-debug -target=$PWD/targets/wasip1-mem2g.json" scripts/build.sh wasip1   # 初期メモリ 2GB
SUFFIX=-leaking TINYGO_FLAGS="-no-debug -gc=leaking" scripts/build.sh wasip1   # GC なし
```

`TS_VERSION` のデフォルトは 7.1。
`scripts/build.sh` は同じバージョンについては同時に 1 つだけ実行すること。サブモジュールにパッチを当てて戻すため。
`scripts/build-go.sh` もパッチを当てていないソースを前提にしているので、同じバージョンの `scripts/build.sh` と同時に実行しないこと。

`scripts/build.sh` はビルドの間だけパッチをサブモジュールに当て、終わると元に戻す。
7.1 には `patches/*.patch`、7.0 には同じ内容を `typescript-go` のレイアウト（`cmd/tsgo`）に移植した `patches/typescript-go/*.patch` を使う。
7.0 にはジェネリックメソッドがないので 0001 は不要。
TinyGo のリンク・最適化フェーズはシングルスレッドなので、ターゲットは並列にビルドする。

### 回避策

- **TinyGo コンパイラのパニック `unknown type: T`**（[0001](patches/0001-avoid-generic-method-tinygo-panic.patch)）:
  TinyGo 0.43 は、型パラメータが本体にしか現れずインターフェースに流れ込む Go 1.27 のジェネリックメソッドでクラッシュする。
  `packagejson` の `unmarshalJSONValueFrom` をジェネリック関数に書き換えている。最小再現:

  ```go
  type V struct{ v any }

  func (v *V) Set[T any](n int) { v.v = make([]T, n) } // panics; the same as a generic func compiles

  func main() { var v V; v.Set[string](2) }
  ```

- **作業ディレクトリ**（[0002](patches/0002-sync-cwd-with-pwd-on-tinygo-wasip1.patch)）:
  wasi-libc は cwd を `/` から始まるものとしてエミュレートする一方、標準 Go の wasip1 ポートは `$PWD` を読む。そのため TinyGo ビルドは起動時に `$PWD` へ `chdir` する。
- **スタックサイズ**: TinyGo の goroutine スタックは固定長（wasm ではデフォルト 64KB）で、チェッカーがこれを溢れさせてヒープを壊す
  （`core.LinkStore.Get` での nil ポインタパニックとして現れる）。ビルドでは `-stack-size=16MB` を使う。
- **シングルスレッド**（[0003](patches/0003-run-single-threaded-on-tinygo.patch)）:
  tsc はファイルやパッケージごとに goroutine を起動し、TinyGo ではその 1 つ 1 つが固定長スタックを丸ごと確保する。
  大きなプロジェクトは 1MB スタックでも wasm32 のメモリを使い切り、小さなプロジェクトでも 1 goroutine の場合より約 2.7 倍遅い。
  TinyGo ビルドは `--singleThreaded` と同じように常にシングルスレッドで動き、このフラグが届かない部分
  （言語サーバーの自動インポートレジストリとプロジェクトビルダー）も対象にしている。
- **言語サーバーの入力**（[0004](patches/0004-poll-lsp-stdin-on-tinygo.patch)）:
  stdin でブロッキングする `fd_read` は、クライアントが次のメッセージを送るまで全 goroutine を止めるため、バックグラウンド処理が滞る。
  TinyGo ではサーバーが stdin をノンブロッキングにしてポーリングする。これで診断は流れ続けるが、補完は依然として応答しない（後述）。

## 実行

```sh
cd examples/basic
node ../../scripts/run-wasi.mjs ../../out/tsc.wasip1.wasm -p .
```

TinyGo ビルドは何も指定しなくてもシングルスレッドで動く（[0003](patches/0003-run-single-threaded-on-tinygo.patch)）。

## Playground

ブラウザ用の Playground（Vite + React + Monaco）は、インメモリのファイルシステム上でビルドを Worker 内で実行し、TinyGo・標準 Go・ts-rust を切り替えられる。

```sh
scripts/build.sh wasip1 && scripts/build-go.sh wasip1 && scripts/build-ts-rust.sh wasm
cd playground
pnpm install
pnpm run dev
```

## ベンチマーク

```sh
pnpm --dir bench/ts6 install                    # TypeScript 6 のベースライン
scripts/build-go.sh wasip1 && TS_VERSION=7.0 scripts/build-go.sh wasip1
scripts/build.sh wasip1 && TS_VERSION=7.0 scripts/build.sh wasip1
# TinyGo のバリアント（ビルド節の SUFFIX 付きのコマンド）も 7.1 と TS_VERSION=7.0 の両方でビルドする
scripts/build-tsrs.sh wasm wasm-z && scripts/build-ts-rust.sh wasm wasm-s
bench/sizes.sh
VARIANTS=1 bench/run.sh examples/basic tsconfig.json 10
VARIANTS=1 bench/run.sh bench/repos/playwright tsconfig.json 3
VARIANTS=1 bench/run.sh bench/repos/social-app tsconfig.check.web.json 3
```

対象のリポジトリは `bench/repos/` に置く（git の管理外）。

```sh
git clone https://github.com/bluesky-social/social-app bench/repos/social-app   # 46d98dd を使用
(cd bench/repos/social-app && pnpm install)
git clone https://github.com/microsoft/playwright bench/repos/playwright        # 66070a1 を使用
(cd bench/repos/playwright && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci --ignore-scripts && node utils/generate_injected.js)
```

Playwright は `utils/generate_injected.js` が生成する `packages/playwright-core/src/generated/*Source.ts` がないと型エラーになる。

計測環境は Apple Silicon Mac（14 コア、48GB）、Node.js 26、TypeScript 6.0.3、TinyGo 0.43、Go 1.27.2、Rust 1.99。
実行時間には Node.js の起動と、wasm の場合は V8 によるモジュールのコンパイルを含む。速度比は TypeScript 6（JavaScript 版 tsc）に対する値。
wasm の実行はすべて `--singleThreaded` を指定している。TS6 にはこのオプションがなく、もともとシングルスレッドで動く。
`VARIANTS=1` は Rust 移植版のデフォルト以外の最適化レベル（tsrs の `opt-level=z`、ts-rust の `opt-level=s`）を加える。
生データは `bench/results/` にある。計測ごとに 1 割程度のばらつきがあるので、表はすべて同じ 1 回の計測から取っている。

### 一覧

括弧内は TS6 に対する速度比。各列の詳細と注記は以下の節にある。

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

### サイズ

| バリアント | サイズ | gzip -9 |
|---|---:|---:|
| **TS6.0** | 10.0 MB | 1.6 MB |
| TS7.0 (Go) | 49.5 MB | 10.8 MB |
| TS7.0 (Go) wasm-opt `-Oz` | 44.1 MB | 10.6 MB |
| TS7.0 (TinyGo) `-opt=z`（デフォルト） | 20.0 MB | 6.1 MB |
| TS7.0 (TinyGo) `-opt=2` | 26.8 MB | 7.9 MB |
| TS7.0 (TinyGo) 初期メモリ 2GB | 20.0 MB | 6.1 MB |
| TS7.0 (TinyGo) `-gc=leaking` | 17.6 MB | 5.3 MB |
| TS7.1 (Go) | 50.1 MB | 11.4 MB |
| TS7.1 (Go) wasm-opt `-Oz` | 45.0 MB | 11.1 MB |
| TS7.1 (TinyGo) `-opt=z`（デフォルト） | 21.8 MB | 6.7 MB |
| TS7.1 (TinyGo) `-opt=2` | 29.0 MB | 8.6 MB |
| TS7.1 (TinyGo) 初期メモリ 2GB | 21.8 MB | 6.7 MB |
| TS7.1 (TinyGo) `-gc=leaking` | 19.2 MB | 5.8 MB |
| tsrs `opt-level=s`（デフォルト） | 9.9 MB | 2.9 MB |
| ts-rust `opt-level=z`（デフォルト） | 5.1 MB | 2.2 MB |
| tsrs `opt-level=z` | 8.8 MB | 2.5 MB |
| ts-rust `opt-level=s` | 6.3 MB | 2.6 MB |

wasm のモジュールは `lib.*.d.ts` を埋め込んでいるので、TS6 は `tsc.js`・`_tsc.js`（6.2 MB、gzip 1.1 MB）と `lib.*.d.ts`（3.8 MB、gzip 0.6 MB）の合計にしている。
tsrs と ts-rust の JS グルーコード（数 KB）は含めていない。初期メモリ 2GB のビルドはメモリセクションの初期サイズが違うだけで、コードはデフォルトと同じ。

### wasm バイナリの内訳

TS7.1 の Go と TinyGo（デフォルト）のビルドを `bench/wasm-size.mjs` で分解した。7.0 もほぼ同じ構成。
TinyGo はビルドの最後に wasm-opt（`--asyncify -Oz`）をかけるが、標準 Go のツールチェーンはかけないので、Go のほうはリンカの出力そのまま（wasm-opt をかけた場合は後述）。

```sh
node bench/wasm-size.mjs out/tsc-go.wasip1.wasm --embed TypeScript/tsc/internal/bundled/libs/*.d.ts TypeScript/tsc/internal/diagnostics/loc/*.json.gz
node bench/wasm-size.mjs out/tsc.wasip1.wasm --embed TypeScript/tsc/internal/bundled/libs/*.d.ts TypeScript/tsc/internal/diagnostics/loc/*.json.gz
node --test bench/wasm-size.test.mjs
```

関数ごとのコードサイズは名前セクションの関数名から、Go のデータの区分は `runtime.moduledata` が指す範囲から求めている。
`--embed` に渡したファイルは、データ中にそのままの形で見つかったものを数える。gzip はセクションごとに圧縮した値で、目安。
生の出力は `bench/results/wasm-size.md` にある。

| セクション | Go | TinyGo |
|---|---:|---:|
| code（関数本体） | 25.63 MB（gzip 5.79 MB） | 13.38 MB（gzip 4.21 MB） |
| data（静的データ） | 22.78 MB（gzip 5.40 MB） | 6.61 MB（gzip 2.27 MB） |
| name（関数名。実行には不要） | 1.65 MB（gzip 0.21 MB） | 1.77 MB（gzip 0.19 MB） |
| その他 | 0.06 MB | 0.03 MB |
| 合計 | 50.12 MB | 21.79 MB |

**code**（関数本体の合計。Go 25.59 MB、TinyGo 13.35 MB）

| パッケージ | Go | TinyGo |
|---|---:|---:|
| コンパイラ本体（`internal/*`） | 19.55 MB | 10.59 MB |
| 　うち `internal/checker` | 4.52 MB | 2.61 MB |
| 　うち `internal/ls`（言語サービス） | 2.32 MB | 1.24 MB |
| 　うち `internal/ast` | 1.13 MB | 0.58 MB |
| 標準ライブラリ | 4.12 MB | 1.88 MB |
| ランタイム | 1.40 MB | 0.09 MB |
| 外部の依存（`golang.org/x/text` など） | 0.26 MB | 0.13 MB |
| その他（Go: 型の比較・ハッシュ関数。TinyGo: インターフェースのメソッド呼び出し、C・wasi-libc） | 0.24 MB | 0.65 MB |

- TinyGo のコードは Go の約半分だが、そのさらに半分は asyncify による。TinyGo は goroutine の切り替えを asyncify（Binaryen のパス）で実現しており、関数ごとにスタックを退避・復元するコードが加わる。
  `-work` で残したリンク直後のモジュール（code 7.96 MB）に wasm-opt を手で適用すると、`-Oz` だけなら code は 6.52 MB（gzip 2.57 MB）、TinyGo と同じ `--asyncify -Oz` なら 13.38 MB（gzip 4.21 MB）になる。asyncify が code を 2.1 倍にしている。
- Go のコードは関数あたりでも大きい（`internal/checker` で 1.7 倍）。Go の wasm バックエンドは goroutine のスタックを線形メモリ上に自前で持ち、関数の途中から再開するための分岐を各関数に入れている。
  ただし繰り返しが多いので圧縮が効き、gzip 後の差は 5.79 MB 対 4.21 MB まで縮まる。
- TinyGo で名前からランタイムに分類できる関数は 0.09 MB しかない。残りは呼び出し元にインライン展開されたか、名前のない関数（0.20 MB の「C・wasi-libc」に含まれる）になっている。

**data**

| 中身 | Go | TinyGo |
|---|---:|---:|
| 埋め込みファイル: `lib.*.d.ts`（非圧縮） | 3.87 MB | 3.87 MB |
| 埋め込みファイル: 翻訳メッセージ（`loc/*.json.gz`） | 1.14 MB | 1.14 MB |
| pclntab | 12.35 MB | – |
| 　うち関数ごとのメタデータ（`go:func.*`: GC 用のスタックマップ、インライン展開の情報など） | 6.20 MB | – |
| 　うち関数名（`funcnametab`） | 2.29 MB | – |
| 　うち PC から行番号やスタックの深さを引く表（`pctab`） | 2.10 MB | – |
| 　うち関数の表（`ftab`、`_func`） | 1.64 MB | – |
| 　うちファイル名（`filetab`、`cutab`） | 0.12 MB | – |
| 型情報（`types`） | 3.41 MB | – |
| その他の読み取り専用データ（文字列など） | 0.79 MB | – |
| 変数の初期値（`noptrdata`、`data`） | 0.41 MB | – |
| 文字列・型情報・変数の初期値 | – | 1.55 MB |
| セグメントのヘッダ | 0.81 MB | 0.05 MB |

- Go のデータの半分以上は pclntab で、スタックトレースに出す関数名・行番号と、GC がスタック上のポインタを正確に見つけるためのスタックマップを持つ。
  TinyGo はスタックを保守的にスキャンし、パニック時にスタックトレースも出さないので、これを持たない。Go と TinyGo のデータの差（16.2 MB）は、ほぼ pclntab と型情報で説明できる。
- 埋め込みファイル（5.01 MB）は両方に同じものが入っている。`lib.*.d.ts` は非圧縮のまま埋め込まれていて、gzip で配信すると埋め込みファイル全体で 1.71 MB になる（翻訳メッセージはもともと gzip 済み）。
  TinyGo では埋め込みファイルがデータの 4 分の 3 を占める。
- Go のリンカは 8 バイト以上続くゼロを省いてデータを複数のセグメントに分ける（上限 100,000 個）。今回は上限に達しており、ヘッダに 0.81 MB かかる代わりにゼロ 1.78 MB を省いている。
- name セクションは実行に不要で、Go の `-ldflags="-s -w"` か wabt の `wasm-strip` で削れる。削ると Go で 1.65 MB、TinyGo で 1.77 MB 小さくなるが、gzip 後の差はどちらも約 0.2 MB。

**code だけで TS6 の JavaScript 全体より大きい理由**

TS6 の `tsc` の本体（`_tsc.js`）は 6.24 MB で、esbuild で minify すると 2.83 MB（gzip 0.73 MB）になる。wasm の code はこれより大きいが、同じものを比べているわけではない。

- wasm には言語サーバーと API（`internal/ls`・`lsp`・`project`・`api`・`format`）も入っている。これが TinyGo で約 3.5 MB、Go で約 6.3 MB ある。
  TS6 で言語サービスまで含む `typescript.js` は 9.14 MB（minify で 3.60 MB、gzip 1.03 MB）。
- JavaScript は GC・`Map`・文字列操作・正規表現・JSON・Unicode の処理を V8 に任せられるが、wasm はこれを自前で持つ。標準ライブラリとランタイムは Go で 5.5 MB、TinyGo で 2.2 MB（C・wasi-libc を含む）。
- wasm は機械語に近い。JavaScript の `node.kind` のような短い式が、wasm では nil チェックとメモリの読み込みになる。Go では関数ごとにスタックのチェックと再開用の分岐が、ポインタの書き込みごとに GC のライトバリアが加わる。TinyGo では asyncify が code を 2 倍にしている。
- ジェネリクスやインライン展開で、同じソースから型ごとに別のコードができる。TinyGo ではインターフェースのメソッド呼び出しの中継（0.45 MB）も生成される。
- JavaScript のソースはテキストなので圧縮が効く。minify と gzip で `typescript.js` は 1.03 MB になるが、TinyGo の code は gzip で 4.21 MB（asyncify なしでも 2.57 MB）。

### 標準 Go のビルドに wasm-opt をかけた場合

`SUFFIX=-oz WASM_OPT_FLAGS=-Oz scripts/build-go.sh wasip1` は Go の出力に wasm-opt `-Oz` をかける。
Go のモジュールには使う機能の宣言（`target_features` セクション）がないので、Go が出力する bulk memory・sign-ext・飽和変換を明示的に有効にしている。
examples/basic・Playwright・social-app の診断と、Playwright を出力した 2,170 ファイル（`.js`・`.d.ts`・`.map`）は、`--singleThreaded` の有無にかかわらず元のビルドと一致した。

| | TS7.1 (Go) | TS7.1 (Go) wasm-opt `-Oz` |
|---|---:|---:|
| 全体 | 50.12 MB（gzip 11.36 MB） | 44.98 MB（gzip 11.10 MB） |
| code | 25.63 MB（gzip 5.79 MB） | 22.14 MB（gzip 5.74 MB） |
| data | 22.78 MB（gzip 5.40 MB） | 22.78 MB（gzip 5.40 MB） |
| name | 1.65 MB（gzip 0.21 MB） | なし |

TS7.0 では 49.55 MB（gzip 10.84 MB）から 44.12 MB（gzip 10.58 MB）になった。

| バリアント | basic | Playwright | social-app |
|---|---:|---:|---:|
| **TS6.0** | 398 ms | 4.82 s | 9.66 s |
| TS7.0 (Go) | 949 ms | 8.62 s | 17.8 s |
| TS7.0 (Go) wasm-opt `-Oz` | 910 ms | 8.88 s | 17.1 s |
| TS7.1 (Go) | 888 ms | 7.59 s | 14.1 s |
| TS7.1 (Go) wasm-opt `-Oz` | 872 ms | 7.01 s | 13.8 s |

実行時間は `ONLY='^TS6\.0$|\(Go' OUT=go-wasm-opt VARIANTS=1 bench/run.sh ...` で別に計測したもので、上の表とは別の回。ピーク RSS は変わらなかった。

- wasm-opt は code を 14% 削り、既定で name セクションを落とすが、gzip 後は 2% しか小さくならない。data は Go のリンカがすでにゼロを省いているので変わらない。
- 実行時間の差は -8〜+3% で、計測のばらつき（標準偏差で最大 0.5 秒）の範囲に収まる。
- Go と TinyGo のサイズの差は、wasm-opt の有無ではほとんど説明できない。

### 実行時間とメモリ

**[bluesky-social/social-app](https://github.com/bluesky-social/social-app)**（`tsconfig.check.web.json`: 4,982 ファイル、56.3 万行、エラーなし。TS 7.0 発表時のベンチマークの "bluesky" の行）

| バリアント | 実行時間 | TS6 比 | ピーク RSS |
|---|---:|---:|---:|
| **TS6.0** | 8.76 s | 1.0x | 1.70 GB |
| TS7.0 (Go) | 17.0 s | 0.52x | 1.77 GB |
| TS7.0 (TinyGo) `-opt=z`（デフォルト） | 32.2 s | 0.27x | 3.44 GB |
| TS7.0 (TinyGo) `-opt=2` | 31.3 s | 0.28x | 3.63 GB |
| TS7.0 (TinyGo) 初期メモリ 2GB | 24.4 s | 0.36x | 4.29 GB |
| TS7.0 (TinyGo) `-gc=leaking` | メモリ不足 | – | – |
| TS7.1 (Go) | 13.1 s | 0.67x | 1.32 GB |
| TS7.1 (TinyGo) `-opt=z`（デフォルト） | 18.2 s | 0.48x | 1.92 GB |
| TS7.1 (TinyGo) `-opt=2` | 16.2 s | 0.54x | 2.09 GB |
| TS7.1 (TinyGo) 初期メモリ 2GB | 13.2 s | 0.66x | 2.30 GB |
| TS7.1 (TinyGo) `-gc=leaking` | 8.11 s | 1.1x | 2.55 GB |
| tsrs `opt-level=s`（デフォルト） | 2.39 s | 3.7x | 0.47 GB |
| ts-rust `opt-level=z`（デフォルト） | 5.11 s | 1.7x | 0.77 GB |
| tsrs `opt-level=z` | 2.96 s | 3.0x | 0.46 GB |
| ts-rust `opt-level=s` | 4.45 s | 2.0x | 0.78 GB |

**[microsoft/playwright](https://github.com/microsoft/playwright)**（`tsconfig.json`: 1,523 ファイル、58.7 万行（うち型定義 36.8 万行）、エラーなし。TS 7.0 発表時のベンチマークの "playwright" の行）

| バリアント | 実行時間 | TS6 比 | ピーク RSS |
|---|---:|---:|---:|
| **TS6.0** | 5.24 s | 1.0x | 1.20 GB |
| TS7.0 (Go) | 9.98 s | 0.53x | 1.16 GB |
| TS7.0 (TinyGo) `-opt=z`（デフォルト） | 30.2 s | 0.17x | 1.83 GB |
| TS7.0 (TinyGo) `-opt=2` | 31.0 s | 0.17x | 2.01 GB |
| TS7.0 (TinyGo) 初期メモリ 2GB | 13.3 s | 0.40x | 2.26 GB |
| TS7.0 (TinyGo) `-gc=leaking` | 5.89 s | 0.89x | 3.17 GB |
| TS7.1 (Go) | 8.08 s | 0.65x | 0.90 GB |
| TS7.1 (TinyGo) `-opt=z`（デフォルト） | 19.0 s | 0.28x | 1.09 GB |
| TS7.1 (TinyGo) `-opt=2` | 17.7 s | 0.30x | 1.26 GB |
| TS7.1 (TinyGo) 初期メモリ 2GB | 6.26 s | 0.84x | 1.83 GB |
| TS7.1 (TinyGo) `-gc=leaking` | 4.53 s | 1.2x | 1.53 GB |
| tsrs `opt-level=s`（デフォルト） | 1.46 s | 3.6x | 0.37 GB |
| ts-rust `opt-level=z`（デフォルト） | 2.87 s | 1.8x | 0.57 GB |
| tsrs `opt-level=z` | 1.82 s | 2.9x | 0.35 GB |
| ts-rust `opt-level=s` | 2.40 s | 2.2x | 0.59 GB |

**examples/basic**（2 ファイル。同梱の `lib.*.d.ts` のパースとバインドが大半を占める）

| バリアント | 実行時間 | TS6 比 | ピーク RSS |
|---|---:|---:|---:|
| **TS6.0** | 411 ms | 1.0x | 0.25 GB |
| TS7.0 (Go) | 983 ms | 0.42x | 0.35 GB |
| TS7.0 (TinyGo) `-opt=z`（デフォルト） | 1,263 ms | 0.33x | 0.41 GB |
| TS7.0 (TinyGo) `-opt=2` | 1,392 ms | 0.30x | 0.46 GB |
| TS7.0 (TinyGo) 初期メモリ 2GB | 796 ms | 0.52x | 0.49 GB |
| TS7.0 (TinyGo) `-gc=leaking` | 614 ms | 0.67x | 0.41 GB |
| TS7.1 (Go) | 896 ms | 0.46x | 0.33 GB |
| TS7.1 (TinyGo) `-opt=z`（デフォルト） | 863 ms | 0.48x | 0.40 GB |
| TS7.1 (TinyGo) `-opt=2` | 841 ms | 0.49x | 0.47 GB |
| TS7.1 (TinyGo) 初期メモリ 2GB | 724 ms | 0.57x | 0.44 GB |
| TS7.1 (TinyGo) `-gc=leaking` | 554 ms | 0.74x | 0.34 GB |
| tsrs `opt-level=s`（デフォルト） | 213 ms | 1.9x | 0.16 GB |
| ts-rust `opt-level=z`（デフォルト） | 330 ms | 1.2x | 0.19 GB |
| tsrs `opt-level=z` | 240 ms | 1.7x | 0.14 GB |
| ts-rust `opt-level=s` | 297 ms | 1.4x | 0.20 GB |

ピーク RSS には Node.js 自身の分も含むので、wasm32 の上限 4GB を超えることがある。

まとめ:

- wasm にコンパイルした Go 移植版は、同じエンジン上で JavaScript として動く TS6 より遅い。social-app で TS7.1 の Go が 0.67x、TinyGo（デフォルト）が 0.48x。
- 7.0 から 7.1 で Go 移植版は速く、省メモリになった。social-app で Go は 17.0 秒・1.77GB から 13.1 秒・1.32GB に、TinyGo は 32.2 秒・3.44GB から 18.2 秒・1.92GB に。
- TinyGo のデフォルトの遅れはプロジェクトが大きくなるほど広がる（後述の GC のため）。`examples/basic` では TS7.1 の TinyGo が Go と並ぶが、Playwright では Go の 2.3 倍かかる。
- TinyGo のビルドオプションでは初期メモリ 2GB が最も効く。TS7.1 では social-app で Go と並び（13.2 秒）、Playwright ではヒープがほぼ初期メモリに収まるので Go より速くなる（6.26 秒、デフォルトの 3 倍速）。
  TS7.0 では social-app のピーク RSS が 4.29GB に達し、上限に近い。
- `-gc=leaking`（GC なし）の TS7.1 は TS6 より速い（social-app で 1.1x、Playwright で 1.2x）。TS7.0 は social-app で 4GB を使い切ってメモリ不足になる。
- `-opt=2` は TS7.1 で 7〜11% 速くなるが、TS7.0 ではほとんど変わらない。どちらもモジュールが 3 割大きくなる。
- Rust 移植版の wasm ビルドは TS6 より速い。最速は tsrs（デフォルトで TS6 の 3.6〜3.7 倍、メモリは TS6 の 3 分の 1 未満）で、ts-rust は 1.7〜1.8 倍。
  どちらも `opt-level=s` のほうが `opt-level=z` より 1〜2 割速く、tsrs は上流のデフォルトが `s`、ts-rust は `z`。
- gzip 後のサイズは TS6 が最小（1.6 MB）。wasm では ts-rust（2.2 MB）と tsrs（2.9 MB）が小さく、TinyGo は標準 Go の約 6 割（6〜7 MB）。
  tsrs のモジュールは ts-rust の約 2 倍の大きさ。ts-rust は `lib.*.d.ts` を圧縮して埋め込むが、tsrs は非圧縮のまま（3.8 MB）埋め込んでいる。
- `--singleThreaded` なしでは、TinyGo は social-app でメモリ不足になる（ファイルごとの goroutine × 固定長スタック）。1MB スタックでも同様。
- TS6 と TS7 系のチェッカーは一部のメッセージが異なる。`examples/basic` では TS6 が TS2345 を報告する箇所で、後者は TS2739 を報告する。
- ブラウザの Playground（Chrome、小さなサンプル）では、1 回の実行に Go と TinyGo のビルドで約 0.9〜1.0 秒、ts-rust で約 0.3 秒かかる（TS 7.1 開発版で計測）。

### TinyGo が遅い理由

TS 7.1 開発版（ベータ前の main）の social-app の CPU プロファイル（`node --cpu-prof`）では、時間の約 3 分の 1 が TinyGo の GC、5 分の 1 が `(runtime.gcBlock).findHead` 単体、8% がマップに費やされている。asyncify は 0.2%。
`-gc=leaking`（一切解放しない）は 2.2 倍速く動く（TS7.1 で 18.2 秒から 8.11 秒）。

- TinyGo 0.43 のブロック GC はオブジェクトの先頭を*最後*のブロックに記録するため、オブジェクトの先頭へのポインタをたどると末尾までブロックの状態を走査することになる。つまりポインタ 1 つあたりのコストが、指す先の大きさに比例して増える。
  typescript-go はノードや型をアリーナに確保するので、ほとんどのポインタは大きなチャンクの内部を指している。
- ヒープは GC 後の空きが 3 分の 1 未満のときにしか拡張されず、GC のたびに生存ヒープ全体を走査する。
  TinyGo では `runtime/debug.SetGCPercent` は何もしない。
- TinyGo を変更せずに済む方法として、初期メモリを大きくすると、ヒープが小さい初期段階の GC を省ける（`targets/wasip1-mem2g.json`）。
  2GB が最適値。ヒープは倍々で拡張されるので、2GB なら wasm32 の上限 4GB まであと 1 回拡張できるが、3GB ではできず遅くなる（TS 7.1 開発版で 17.1 秒）。
  Playwright のように 1 回の実行で確保する全メモリが 2GB 未満（TS7.1 の `-gc=leaking` で 1.53GB）のプロジェクトでは、GC がほとんど走らないので効果が大きい。
  その分のメモリを最初に確保するため、ブラウザによっては拒否されることがある。
- `-gc=leaking` は、1 回の実行で確保する全メモリが 4GB に収まる場合にしか使えない（TS7.1 の social-app では 2.55GB。TS7.0 は 4GB を超えてメモリ不足になる）。VS Code のようなもっと大きなプロジェクト（TS7 で 4.2GB）ではメモリが足りなくなる。
- TinyGo のランタイムにパッチを当てる方法（ここには含めていない）でも同程度の効果がある。`findHead` で状態がすべて tail のバイトを 8 個ずつ読み飛ばすと social-app で 22%、拡張の条件を空き 3 分の 1 から半分にすると 9%、両方で 27% 短縮した。

## 言語サーバーのベンチマーク

TS 7.1 開発版（ベータ前の main、`aa81492`）で計測した。

エディタから見た各実装の体感速度を測る。サーバーを起動してファイルを開き、診断・編集・補完・ホバーにかかる時間を計測する。
クライアントは `bench/lsp/run.mjs` で、LSP（pull と push の両方の診断）と tsserver 独自のプロトコルを話す。

```sh
bench/lsp/all.sh bench/repos/social-app bench/repos/social-app/src/view/com/composer/Composer.tsx 3
node bench/lsp/summarize.mjs bench/results/lsp-social-app.jsonl
```

social-app で `src/view/com/composer/Composer.tsx`（2,736 行、import 90 件）を開いた場合。各編集では、型エラーと正しいコードを交互に 1 行追記する。
補完は末尾に `[].` を追記した位置で要求する。3 回の実行の中央値（編集は全 15 回の中央値）。

| サーバー | initialize | 最初の診断 | 編集後の診断 | 補完 | ホバー |
|---|---:|---:|---:|---:|---:|
| TS6（tsserver、`geterr`） | 101 ms | 683 ms | 634 ms | 22 ms | 2 ms |
| TS6（typescript-language-server） | 64 ms | 3.90 s | 429 ms | 1.22 s | 18 ms |
| tsc ネイティブ | 6 ms | 472 ms | 296 ms | 293 ms | 1 ms |
| ts-rust ネイティブ | 4 ms | 791 ms | 450 ms | 903 ms | 190 ms |
| tsrs ネイティブ | 3 ms | 305 ms | 252 ms | 625 ms | 2 ms |
| tsc, TinyGo wasm | 196 ms | 7.53 s | 2.18 s | 応答なし | 応答なし |
| tsc, TinyGo wasm, 初期メモリ 2GB | 85 ms | 5.32 s | 4.28 s | 応答なし | 応答なし |
| tsc, Go wasm | 111 ms | 応答なし | – | – | – |

- wasm ビルドは Node.js の WASI 上で動かしている（`scripts/run-wasi.mjs`）。ts-rust と tsrs の wasm ビルドには言語サーバーがない。
- tsrs は tsc と同じ診断を報告し、チェックは最速だが、補完は tsc の約 2 倍かかり、返す候補は 24,684 件（tsc は 24,699 件）。
- tsc、ts-rust、tsrs は pull の結果に suggestion 診断（ここでは "deprecated" のヒント 16 件）を含める。tsserver はこれを別の `suggestionDiag` イベントとして報告し、`geterr` はそれを待つが、この件数には含めていない。
- typescript-language-server は独自の遅延を置いてから診断を push するので、編集後の時間はほとんどがその遅延。TS6 のチェック時間は tsserver 直接の行のほう。
- TinyGo では、編集後の診断は 2.0〜2.4 秒に落ち着く。どの実行でも最初の編集は約 4.4〜4.9 秒かかり、続く 2 回のうち 1 回は 8〜10 秒かかる（デフォルトのビルドでは 2 回目、2GB では 3 回目）。2GB ビルドは最初の診断こそ速いが、編集の中央値は速くない。
- TinyGo は補完に一切応答しない。他にすることがないと、サーバーはリクエストを保留したまま CPU 0% で待機する。
  クライアントが 50ms ごとに通知を送ったときだけ応答した（9.7 秒後。その後のホバーは 12ms）。つまりリクエストは、メッセージが届いたときにしか進まない処理を待っている。原因は特定できていない。
- Go の wasip1 ビルドは `initialize` に応答した後ハングする。Node.js の WASI が stdin について Go のポーラーを起こしていないようだ（未検証）。

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
`wasm32-wasip1` は見送った。`bun_core` の文字列はポインタの 61〜63 ビットにタグを埋め込み、`bun_sys` には WASI 分岐のない Unix/Windows 専用の `cfg` が約 290 箇所あり、チェッカーはスレッドプールを前提としている。
