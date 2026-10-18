# ts-tinygo

TypeScript コンパイラの Go 移植版（`tsc`、TypeScript 7）を [TinyGo](https://tinygo.org/) で WebAssembly にビルドする実験。

コンパイラのソースは [microsoft/TypeScript](https://github.com/microsoft/TypeScript)（`tsc/`）で、`TypeScript` サブモジュールとして固定している。
`microsoft/typescript-go` は移植版が本家にマージされた後にアーカイブされた。

## 状況

| ターゲット | ビルド | 実行 |
|---|---|---|
| TinyGo `wasip1` | ✅ | ✅ 型チェックと出力ができる（Node.js の WASI、ブラウザでは [browser_wasi_shim](https://github.com/bjorn3/browser_wasi_shim) 経由） |
| TinyGo `wasm`（js） | ✅ | ❌ TinyGo の js ターゲットにはファイルシステムがない（`os.Getwd` が空になり `path must be absolute`） |

## セットアップ

ツールは `mise.toml` で固定している（Go、TinyGo、`wasm-opt` 用の binaryen、hyperfine、ts-rust 用の Rust）。

```sh
git submodule update --init --depth 1
mise install
```

## ビルド

```sh
scripts/build.sh            # TinyGo: out/tsc.wasip1.wasm, out/tsc.wasm.wasm
scripts/build.sh wasip1     # 1 ターゲットのみ
scripts/build-go.sh         # 標準 Go のベースライン: out/tsc-go.wasip1.wasm, out/tsc-native
SUFFIX=-o2 TINYGO_FLAGS="-no-debug -opt=2" scripts/build.sh wasip1   # 速度優先の最適化
SUFFIX=-mem2g TINYGO_FLAGS="-no-debug -target=$PWD/targets/wasip1-mem2g.json" scripts/build.sh wasip1   # 初期メモリ 2GB
SUFFIX=-leaking TINYGO_FLAGS="-no-debug -gc=leaking" scripts/build.sh wasip1   # GC なし
```

`scripts/build.sh` は同時に 1 つだけ実行すること。サブモジュールにパッチを当てて戻すため。

`scripts/build.sh` はビルドの間だけ `patches/*.patch` をサブモジュールに当て、終わると元に戻す。
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
bench/run.sh examples/basic tsconfig.json 10   # 上記のビルドが必要（ts-rust は任意）
bench/run.sh bench/repos/social-app tsconfig.check.web.json 3
```

計測環境は Apple Silicon Mac（14 コア、48GB）、Node.js 26、TypeScript 6.0.3、TinyGo 0.43、Go 1.27.2、Rust 1.99。
実行時間には Node.js の起動と、wasm の場合は V8 によるモジュールのコンパイルを含む。速度比は TypeScript 6（JavaScript 版 tsc）に対する値。
生データは `bench/results/` にある。

**[bluesky-social/social-app](https://github.com/bluesky-social/social-app)**（`tsconfig.check.web.json`: 4,989 ファイル、56.5 万行、エラーなし。TS 7.0 発表時のベンチマークの "bluesky" の行）

| バリアント | モジュール | 実行時間 | TS6 比 | ピーク RSS |
|---|---:|---:|---:|---:|
| **TS6**（Node 上の JS 版 tsc） | | 9.53 s | 1.0x | 1.70 GB |
| tsc ネイティブ（並列） | | 1.20 s | 7.9x | 1.50 GB |
| tsc ネイティブ `--singleThreaded` | | 2.67 s | 3.6x | 1.05 GB |
| tsc, Go wasip1 | 51.2 MB | 15.3 s | 0.62x | 1.60 GB |
| tsc, TinyGo wasip1 `-opt=z`（デフォルト） | 20.9 MB | 21.5 s | 0.44x | 1.93 GB |
| tsc, TinyGo wasip1 `-opt=2` | 28.1 MB | 20.4 s | 0.47x | 2.15 GB |
| tsc, TinyGo wasip1, 初期メモリ 2GB | 20.9 MB | 15.9 s | 0.60x | 2.29 GB |
| tsc, TinyGo wasip1 `-gc=leaking` | 18.4 MB | 9.67 s | 0.99x | 2.73 GB |
| ts-rust ネイティブ（並列） | | 0.72 s | 13.2x | 1.05 GB |
| ts-rust ネイティブ `--singleThreaded` | | 1.85 s | 5.2x | 0.74 GB |
| ts-rust wasm `opt-level=z` | 4.8 MB | 5.33 s | 1.8x | 0.77 GB |
| ts-rust wasm `opt-level=s` | 6.0 MB | 4.71 s | 2.0x | 0.79 GB |

**examples/basic**（2 ファイル。同梱の `lib.*.d.ts` のパースとバインドが大半を占める）

| バリアント | 実行時間 | TS6 比 | ピーク RSS |
|---|---:|---:|---:|
| **TS6**（Node 上の JS 版 tsc） | 397 ms | 1.0x | 0.24 GB |
| tsc ネイティブ（並列） | 108 ms | 3.7x | 0.09 GB |
| tsc ネイティブ `--singleThreaded` | 116 ms | 3.4x | 0.09 GB |
| tsc, Go wasip1 | 923 ms | 0.43x | 0.36 GB |
| tsc, TinyGo wasip1 `-opt=z`（デフォルト） | 1,038 ms | 0.38x | 0.42 GB |
| tsc, TinyGo wasip1 `-opt=2` | 1,116 ms | 0.36x | 0.48 GB |
| tsc, TinyGo wasip1, 初期メモリ 2GB | 796 ms | 0.50x | 0.46 GB |
| tsc, TinyGo wasip1 `-gc=leaking` | 609 ms | 0.65x | 0.36 GB |
| ts-rust ネイティブ（並列） | 51 ms | 7.8x | 0.07 GB |
| ts-rust ネイティブ `--singleThreaded` | 59 ms | 6.8x | 0.06 GB |
| ts-rust wasm `opt-level=z` | 320 ms | 1.2x | 0.19 GB |
| ts-rust wasm `opt-level=s` | 289 ms | 1.4x | 0.19 GB |

wasm の実行と `--singleThreaded` の行はすべて `--singleThreaded` を指定している。TS6 にはこのオプションがなく、もともとシングルスレッドで動く。

まとめ:

- wasm にコンパイルした Go 移植版は、同じエンジン上で JavaScript として動く TS6 より遅い。Go で 0.62x、デフォルトの TinyGo で 0.44x。
- wasm ビルドの中では ts-rust が最速（TS6 の 1.8〜2.0 倍）で、メモリは TS6 の半分未満。
- TinyGo は時間の半分以上を GC とアロケーションに費やしている（後述）。初期メモリを 2GB にすると標準 Go と同等になり、GC をなくすと TS6 と並ぶ。
- `-opt=2` はデフォルトの `-opt=z` に対して速くならず、モジュールが大きくなるだけ。
- `--singleThreaded` なしでは、TinyGo は social-app でメモリ不足になる（ファイルごとの goroutine × 固定長スタック）。1MB スタックでも同様。
- TS6 と TS7 系のチェッカーは一部のメッセージが異なる。`examples/basic` では TS6 が TS2345 を報告する箇所で、後者は TS2739 を報告する。
- ブラウザの Playground（Chrome、小さなサンプル）では、1 回の実行に Go と TinyGo のビルドで約 0.9〜1.0 秒、ts-rust で約 0.3 秒かかる。

### TinyGo が遅い理由

social-app の CPU プロファイル（`node --cpu-prof`）では、時間の約 3 分の 1 が TinyGo の GC、5 分の 1 が `(runtime.gcBlock).findHead` 単体、8% がマップに費やされている。asyncify は 0.2%。
`-gc=leaking`（一切解放しない）は 2.2 倍速く動く。

- TinyGo 0.43 のブロック GC はオブジェクトの先頭を*最後*のブロックに記録するため、オブジェクトの先頭へのポインタをたどると末尾までブロックの状態を走査することになる。つまりポインタ 1 つあたりのコストが、指す先の大きさに比例して増える。
  typescript-go はノードや型をアリーナに確保するので、ほとんどのポインタは大きなチャンクの内部を指している。
- ヒープは GC 後の空きが 3 分の 1 未満のときにしか拡張されず、GC のたびに生存ヒープ全体を走査する。
  TinyGo では `runtime/debug.SetGCPercent` は何もしない。
- TinyGo を変更せずに済む方法として、初期メモリを大きくすると、ヒープが小さい初期段階の GC を省ける（`targets/wasip1-mem2g.json`）。
  2GB が最適値。ヒープは倍々で拡張されるので、2GB なら wasm32 の上限 4GB まであと 1 回拡張できるが、3GB ではできず遅くなる（17.1 秒）。
  その分のメモリを最初に確保するため、ブラウザによっては拒否されることがある。
- `-gc=leaking` は、1 回の実行で確保する全メモリが 4GB に収まる場合にしか使えない（social-app では 2.7GB）。VS Code のようなもっと大きなプロジェクト（TS7 で 4.2GB）ではメモリが足りなくなる。
- TinyGo のランタイムにパッチを当てる方法（ここには含めていない）でも同程度の効果がある。`findHead` で状態がすべて tail のバイトを 8 個ずつ読み飛ばすと social-app で 22%、拡張の条件を空き 3 分の 1 から半分にすると 9%、両方で 27% 短縮した。

## 言語サーバーのベンチマーク

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
| TS6（tsserver、`geterr`） | 47 ms | 701 ms | 644 ms | 21 ms | 2 ms |
| TS6（typescript-language-server） | 74 ms | 3.76 s | 442 ms | 913 ms | 17 ms |
| tsc ネイティブ | 7 ms | 486 ms | 286 ms | 283 ms | 1 ms |
| ts-rust ネイティブ | 4 ms | 731 ms | 420 ms | 933 ms | 262 ms |
| tsc, TinyGo wasm | 192 ms | 7.36 s | 2.06 s | 応答なし | 応答なし |
| tsc, TinyGo wasm, 初期メモリ 2GB | 81 ms | 4.54 s | 3.73 s | 応答なし | 応答なし |
| tsc, Go wasm | 104 ms | 応答なし | – | – | – |

- wasm ビルドは Node.js の WASI 上で動かしている（`scripts/run-wasi.mjs`）。ts-rust の wasm ビルドには言語サーバーがない。
- tsc と ts-rust は pull の結果に suggestion 診断（ここでは "deprecated" のヒント 16 件）を含める。tsserver はこれを別の `suggestionDiag` イベントとして報告し、`geterr` はそれを待つが、この件数には含めていない。
- typescript-language-server は独自の遅延を置いてから診断を push するので、編集後の時間はほとんどがその遅延。TS6 のチェック時間は tsserver 直接の行のほう。
- TinyGo では、編集後の診断は 1.8〜2.2 秒に落ち着く。どの実行でも最初の編集は約 4.3 秒かかり、続く 2 回のうち 1 回は 8〜9 秒かかる（デフォルトのビルドでは 2 回目、2GB では 3 回目）。2GB ビルドは最初の診断こそ速いが、編集の中央値は速くない。
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

### bun check（未ビルド）

`bun check` のチェッカーは [oven-sh/bun](https://github.com/oven-sh/bun) の `src/sema`（Rust）で、Bun の C/C++ 部分を Rust の代替実装に置き換えたスタンドアロンの `bun-sema` バイナリがある。
ネイティブでのビルドはでき（`bun scripts/build.ts --profile=debug --mode=codegen`、`BUN_CODEGEN_DIR`、`vendor/` クレートのスタブ、欠けている `mi_heap_visit_blocks` の代替 1 つを用意した上で）、`examples/basic` では tsc と同じ結果になる。
`wasm32-wasip1` は見送った。`bun_core` の文字列はポインタの 61〜63 ビットにタグを埋め込み、`bun_sys` には WASI 分岐のない Unix/Windows 専用の `cfg` が約 290 箇所あり、チェッカーはスレッドプールを前提としている。
