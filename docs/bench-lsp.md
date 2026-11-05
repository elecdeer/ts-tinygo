# 言語サーバーのベンチマーク

検証結果の一覧は [README](../README.md#検証結果)、各ビルドの内容は [ビルド](builds.md) を参照。

TS 7.1 開発版（ベータ前の main、`aa81492`）で計測した。

エディタから見た各実装の体感速度を測る。サーバーを起動してファイルを開き、診断・編集・補完・ホバーにかかる時間を計測する。
クライアントは `bench/lsp/run.mjs` で、LSP（pull と push の両方の診断）と tsserver 独自のプロトコルを話す。

```sh
scripts/build-go.sh native && scripts/build-tsrs.sh native && scripts/build-ts-rust.sh native
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

対象リポジトリの用意は[実行時間とメモリ](bench-time-memory.md)を参照。
