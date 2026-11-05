# サイズ

検証結果の一覧は [README](../README.md#検証結果)、各ビルドの内容は [ビルド](builds.md) を参照。

## 計測方法

```sh
pnpm --dir bench/ts6 install   # TS6 のサイズに使う
bench/sizes.sh                 # bench/results/sizes.md
```

## 配布サイズ

| バリアント | サイズ | gzip -9 |
|---|---:|---:|
| **TS6.0** | 10.0 MB | 1.6 MB |
| TS7.0 (Go) | 49.5 MB | 10.8 MB |
| TS7.0 (TinyGo) `-opt=z`（デフォルト） | 20.0 MB | 6.1 MB |
| TS7.0 (TinyGo) `-opt=2` | 26.8 MB | 7.9 MB |
| TS7.0 (TinyGo) 初期メモリ 2GB | 20.0 MB | 6.1 MB |
| TS7.0 (TinyGo) `-gc=leaking` | 17.6 MB | 5.3 MB |
| TS7.1 (Go) | 50.1 MB | 11.4 MB |
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

- gzip 後のサイズは TS6 が最小（1.6 MB）。wasm では ts-rust（2.2 MB）と tsrs（2.9 MB）が小さく、TinyGo は標準 Go の約 6 割（6〜7 MB）。
  tsrs のモジュールは ts-rust の約 2 倍の大きさ。ts-rust は `lib.*.d.ts` を圧縮して埋め込むが、tsrs は非圧縮のまま（3.8 MB）埋め込んでいる。

## wasm バイナリの内訳

TS7.1 の Go と TinyGo（デフォルト）のビルドを `bench/wasm-size.mjs` で分解した。7.0 との比較は後述。
TinyGo はビルドの最後に wasm-opt（`--asyncify -Oz`）をかけるが、標準 Go のツールチェーンはかけないので、Go のほうはリンカの出力そのまま。

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

**TS7.0 との比較**

7.0 も構成は同じで、Go は data の半分以上が pclntab、TinyGo は data の 4 分の 3 が埋め込みファイル。単位は MB、括弧内は gzip -9。

| | Go 7.0 | Go 7.1 | TinyGo 7.0 | TinyGo 7.1 |
|---|---:|---:|---:|---:|
| code | 24.56（5.45） | 25.63（5.79） | 12.03（3.75） | 13.38（4.21） |
| data | 23.12（5.21） | 22.78（5.40） | 6.39（2.17） | 6.61（2.27） |
| name | 1.78（0.22） | 1.65（0.21） | 1.55（0.17） | 1.77（0.19） |
| 合計 | 49.55 | 50.12 | 20.01 | 21.79 |
| code: コンパイラ本体 | 18.70 | 19.55 | 9.27 | 10.59 |
| 　うち言語サーバー・API（`ls`・`lsp`・`project`・`api`・`format`） | 5.34 | 6.31 | 2.69 | 3.50 |
| 　うち `internal/checker` | 4.50 | 4.52 | 2.44 | 2.61 |
| 　うち `internal/ast` | 1.65 | 1.13 | 0.67 | 0.58 |
| code: 標準ライブラリ | 3.94 | 4.12 | 1.71 | 1.88 |
| code: ランタイム | 1.40 | 1.40 | 0.09 | 0.09 |
| code: 外部の依存 | 0.27 | 0.26 | 0.14 | 0.13 |
| code: その他 | 0.22 | 0.24 | 0.81 | 0.65 |
| data: `lib.*.d.ts`（7.0 は 108 ファイル、7.1 は 116 ファイル） | 3.79 | 3.87 | 3.79 | 3.87 |
| data: 翻訳メッセージ | 1.09 | 1.14 | 1.09 | 1.14 |
| data: pclntab | 13.17 | 12.35 | – | – |
| 　うち `go:func.*` | 6.90 | 6.20 | – | – |
| 　うち `funcnametab` | 2.28 | 2.29 | – | – |
| 　うち `pctab` | 2.03 | 2.10 | – | – |
| 　うち `ftab`・`_func` | 1.85 | 1.64 | – | – |
| data: 型情報 | 3.15 | 3.41 | – | – |
| data: その他（文字列・型情報・変数の初期値など） | 1.12 | 1.20 | 1.46 | 1.55 |
| data: セグメントのヘッダ | 0.80 | 0.81 | 0.05 | 0.05 |

- code の増加（Go +1.07 MB、TinyGo +1.35 MB）の半分以上は言語サーバーと API（+0.97 MB、+0.81 MB）。型チェッカーはほとんど変わらず、`internal/ast` は小さくなった。
- 標準 Go の関数の数は 21,656 から 19,005 に減り、pclntab の `go:func.*` も 6.90 MB から 6.20 MB に縮んだ。その分、型情報は 3.15 MB から 3.41 MB に増え、data 全体は 7.1 のほうが少し小さい。
- TinyGo のインターフェースのメソッド呼び出しの中継は 0.63 MB から 0.45 MB に減った（「その他」に含まれる）。
- 7.0 の asyncify の寄与は計測していない。

**code だけで TS6 の JavaScript 全体より大きい理由**

TS6 の `tsc` の本体（`_tsc.js`）は 6.24 MB で、esbuild で minify すると 2.83 MB（gzip 0.73 MB）になる。wasm の code はこれより大きいが、同じものを比べているわけではない。

- wasm には言語サーバーと API（`internal/ls`・`lsp`・`project`・`api`・`format`）も入っている。これが TinyGo で約 3.5 MB、Go で約 6.3 MB ある。
  TS6 で言語サービスまで含む `typescript.js` は 9.14 MB（minify で 3.60 MB、gzip 1.03 MB）。
- JavaScript は GC・`Map`・文字列操作・正規表現・JSON・Unicode の処理を V8 に任せられるが、wasm はこれを自前で持つ。標準ライブラリとランタイムは Go で 5.5 MB、TinyGo で 2.2 MB（C・wasi-libc を含む）。
- wasm は機械語に近い。JavaScript の `node.kind` のような短い式が、wasm では nil チェックとメモリの読み込みになる。Go では関数ごとにスタックのチェックと再開用の分岐が、ポインタの書き込みごとに GC のライトバリアが加わる。TinyGo では asyncify が code を 2 倍にしている。
- ジェネリクスやインライン展開で、同じソースから型ごとに別のコードができる。TinyGo ではインターフェースのメソッド呼び出しの中継（0.45 MB）も生成される。
- JavaScript のソースはテキストなので圧縮が効く。minify と gzip で `typescript.js` は 1.03 MB になるが、TinyGo の code は gzip で 4.21 MB（asyncify なしでも 2.57 MB）。

範囲をそろえた比較は「TS6 とのサイズの比較」を参照。

## TS6 とのサイズの比較

wasm の通常のビルド（CLI・言語サーバー・API）と、同じ範囲の TS6 の配布物を比べる。
TS6 は言語サービスとサーバーを含む `typescript.js`・`tsserver.js`・`_tsserver.js` で、minify は esbuild 0.28 の `--minify`。

**ビルドしたまま**

wasm はビルドしたファイルそのまま、TS6 は npm のファイルそのまま（と JavaScript だけを minify したもの）。
wasm は `lib.*.d.ts` と 13 言語分の翻訳メッセージを埋め込んでいるので、TS6 にもそれらのファイル（`lib.*.d.ts` 107 個 3.78 MB、`*/diagnosticMessages.generated.json` 13 個 4.47 MB）を含める。
TS6 の gzip はファイルごとに圧縮した値の合計。

| バリアント | サイズ | gzip -9 |
|---|---:|---:|
| **TS6.0** | 17.42 MB | 3.36 MB |
| **TS6.0**（JavaScript を minify） | 11.87 MB | 2.75 MB |
| TS7.0 (Go) | 49.55 MB | 10.93 MB |
| TS7.0 (TinyGo) | 20.01 MB | 6.12 MB |
| TS7.1 (Go) | 50.12 MB | 11.44 MB |
| TS7.1 (TinyGo) | 21.79 MB | 6.70 MB |

- 生のサイズでは、TS7.1 の TinyGo は npm のままの TS6 の 1.3 倍で、それほど離れていない。TS6 も `lib.*.d.ts` と翻訳メッセージで 8.25 MB ある。
- gzip 後は差が開き、TS7.1 の TinyGo は TS6 の 2.0 倍、minify した TS6 の 2.4 倍になる。JavaScript のテキストはよく縮むが、wasm の機械語はそれほど縮まない。
- 標準 Go は生のサイズで 2.9 倍、gzip 後で 3.4 倍（minify した TS6 の 4.2 倍）。

**プログラム本体だけ**

埋め込みファイルと実行に不要な部分を除いて、プログラムそのものを比べる。

- wasm は、埋め込みファイル（`lib.*.d.ts` と翻訳メッセージ）と custom セクション（name など）を除いた大きさ。
  gzip は埋め込みファイルの部分をゼロで埋めてから圧縮した値。`bench/wasm-size.mjs` の最後の表（`program`）がこれを出し、全ビルドの値は `bench/results/program-size.md` にある。
- TS6 は JavaScript のファイルだけ。英語の診断メッセージはどちらもプログラム本体に含まれる。

| バリアント | サイズ | gzip -9 |
|---|---:|---:|
| **TS6.0** | 9.17 MB（minify 3.62 MB） | 1.65 MB（minify 1.03 MB） |
| TS7.0 (Go) | 42.88 MB | 9.06 MB |
| TS7.0 (TinyGo) `-opt=z`（デフォルト）、初期メモリ 2GB | 13.58 MB | 4.30 MB |
| TS7.0 (TinyGo) `-opt=2` | 20.55 MB | 6.09 MB |
| TS7.0 (TinyGo) `-gc=leaking` | 11.25 MB | 3.53 MB |
| TS7.1 (Go) | 43.46 MB | 9.53 MB |
| TS7.1 (TinyGo) `-opt=z`（デフォルト）、初期メモリ 2GB | 15.01 MB | 4.80 MB |
| TS7.1 (TinyGo) `-opt=2` | 22.50 MB | 6.77 MB |
| TS7.1 (TinyGo) `-gc=leaking` | 12.45 MB | 3.93 MB |

- プログラム本体だけで比べると、minify して gzip した TS6 との差はさらに大きく、TS7.1 の TinyGo は 4.7 倍、Go は 9.3 倍。
  前述の理由（ランタイムと標準ライブラリ、機械語に近い表現、asyncify、圧縮の効きにくさ）で、差の大部分が説明できる。
- 初期メモリ 2GB のビルドは、メモリの初期サイズ以外はデフォルトと同じ。
