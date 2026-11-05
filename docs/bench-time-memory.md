# 実行時間とメモリ

検証結果の一覧は [README](../README.md#検証結果)、各ビルドの内容は [ビルド](builds.md) を参照。

## 計測方法

ビルド済みの wasm は `out/` にコミットしているので、ビルドは要らない。tsrs と ts-rust の実行には各サブモジュールの JS グルーコードを使う。

```sh
git submodule update --init --depth 1 tsrs ts-rust
pnpm --dir bench/ts6 install                    # TypeScript 6 のベースライン
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

## 結果

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
- TinyGo のデフォルトの遅れはプロジェクトが大きくなるほど広がる（[GC のため](bench-cpu-profile.md)）。`examples/basic` では TS7.1 の TinyGo が Go と並ぶが、Playwright では Go の 2.3 倍かかる。
- TinyGo のビルドオプションでは初期メモリ 2GB が最も効く。TS7.1 では social-app で Go と並び（13.2 秒）、Playwright ではヒープがほぼ初期メモリに収まるので Go より速くなる（6.26 秒、デフォルトの 3 倍速）。
  TS7.0 では social-app のピーク RSS が 4.29GB に達し、上限に近い。
- `-gc=leaking`（GC なし）の TS7.1 は TS6 より速い（social-app で 1.1x、Playwright で 1.2x）。TS7.0 は social-app で 4GB を使い切ってメモリ不足になる。
- `-opt=2` は TS7.1 で 7〜11% 速くなるが、TS7.0 ではほとんど変わらない。どちらもモジュールが 3 割大きくなる。
- Rust 移植版の wasm ビルドは TS6 より速い。最速は tsrs（デフォルトで TS6 の 3.6〜3.7 倍、メモリは TS6 の 3 分の 1 未満）で、ts-rust は 1.7〜1.8 倍。
  どちらも `opt-level=s` のほうが `opt-level=z` より 1〜2 割速く、tsrs は上流のデフォルトが `s`、ts-rust は `z`。
- `--singleThreaded` なしでは、TinyGo は social-app でメモリ不足になる（ファイルごとの goroutine × 固定長スタック）。1MB スタックでも同様。
- TS6 と TS7 系のチェッカーは一部のメッセージが異なる。`examples/basic` では TS6 が TS2345 を報告する箇所で、後者は TS2739 を報告する。
- ブラウザの Playground（Chrome、小さなサンプル）では、1 回の実行に Go と TinyGo のビルドで約 0.9〜1.0 秒、ts-rust で約 0.3 秒かかる（TS 7.1 開発版で計測）。
