# 実行時間とメモリ

検証結果の一覧は [README](../README.md#検証結果)、各ビルドの内容は [ビルド](builds.md) を参照。

## 計測方法

ビルド済みの wasm は `out/` にコミットしているので、ビルドは要らない。tsrs と ts-rust の実行には各サブモジュールの JS グルーコードを使う。

```sh
git submodule update --init --depth 1 tsrs ts-rust
pnpm --dir bench/ts6 install                    # TypeScript 6 のベースライン
pnpm --dir bench/official install               # 公式の wasip1 ビルド
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
今回の計測中は他の処理も動いていて（ロードアベレージ 3〜7）、TS6 の social-app が以前の計測（8.76 秒）より 18% 遅い。比は同じ回の中で比べること。

## 結果

**[bluesky-social/social-app](https://github.com/bluesky-social/social-app)**（`tsconfig.check.web.json`: 4,982 ファイル、56.3 万行、エラーなし。TS 7.0 発表時のベンチマークの "bluesky" の行）

| バリアント | 実行時間 | TS6 比 | ピーク RSS |
|---|---:|---:|---:|
| **TS6.0** | 10.3 s | 1.0x | 1.65 GB |
| TS7.0 (Go) | 20.4 s | 0.51x | 1.73 GB |
| TS7.0 (TinyGo) `-opt=z`（デフォルト） | 34.8 s | 0.30x | 2.98 GB |
| TS7.0 (TinyGo) `-opt=2` | 35.1 s | 0.29x | 3.55 GB |
| TS7.0 (TinyGo) 初期メモリ 2GB | 27.3 s | 0.38x | 4.09 GB |
| TS7.0 (TinyGo) `-gc=leaking` | メモリ不足 | – | – |
| TS7.1 (Go) | 15.2 s | 0.68x | 1.27 GB |
| TS7.1 (TinyGo) `-opt=z`（デフォルト） | 20.3 s | 0.51x | 1.87 GB |
| TS7.1 (TinyGo) `-opt=2` | 18.0 s | 0.57x | 2.00 GB |
| TS7.1 (TinyGo) 初期メモリ 2GB | 15.0 s | 0.69x | 2.25 GB |
| TS7.1 (TinyGo) `-gc=leaking` | 9.22 s | 1.1x | 2.50 GB |
| TS7.1 dev（公式 wasm） | 15.5 s | 0.66x | 1.22 GB |
| tsrs `opt-level=s`（デフォルト） | 2.75 s | 3.8x | 0.46 GB |
| ts-rust `opt-level=z`（デフォルト） | 6.38 s | 1.6x | 0.77 GB |
| tsrs `opt-level=z` | 3.41 s | 3.0x | 0.45 GB |
| ts-rust `opt-level=s` | 5.46 s | 1.9x | 0.78 GB |

**[microsoft/playwright](https://github.com/microsoft/playwright)**（`tsconfig.json`: 1,523 ファイル、58.7 万行（うち型定義 36.8 万行）、エラーなし。TS 7.0 発表時のベンチマークの "playwright" の行）

| バリアント | 実行時間 | TS6 比 | ピーク RSS |
|---|---:|---:|---:|
| **TS6.0** | 5.48 s | 1.0x | 1.20 GB |
| TS7.0 (Go) | 10.2 s | 0.54x | 1.10 GB |
| TS7.0 (TinyGo) `-opt=z`（デフォルト） | 31.0 s | 0.18x | 1.81 GB |
| TS7.0 (TinyGo) `-opt=2` | 31.5 s | 0.17x | 1.95 GB |
| TS7.0 (TinyGo) 初期メモリ 2GB | 13.4 s | 0.41x | 2.24 GB |
| TS7.0 (TinyGo) `-gc=leaking` | 5.94 s | 0.92x | 3.15 GB |
| TS7.1 (Go) | 7.63 s | 0.72x | 0.85 GB |
| TS7.1 (TinyGo) `-opt=z`（デフォルト） | 18.9 s | 0.29x | 1.05 GB |
| TS7.1 (TinyGo) `-opt=2` | 17.9 s | 0.31x | 1.20 GB |
| TS7.1 (TinyGo) 初期メモリ 2GB | 6.76 s | 0.81x | 1.79 GB |
| TS7.1 (TinyGo) `-gc=leaking` | 5.00 s | 1.1x | 1.49 GB |
| TS7.1 dev（公式 wasm） | 7.54 s | 0.73x | 0.83 GB |
| tsrs `opt-level=s`（デフォルト） | 1.43 s | 3.8x | 0.36 GB |
| ts-rust `opt-level=z`（デフォルト） | 3.07 s | 1.8x | 0.58 GB |
| tsrs `opt-level=z` | 1.84 s | 3.0x | 0.35 GB |
| ts-rust `opt-level=s` | 2.48 s | 2.2x | 0.59 GB |

**examples/basic**（2 ファイル。同梱の `lib.*.d.ts` のパースとバインドが大半を占める）

| バリアント | 実行時間 | TS6 比 | ピーク RSS |
|---|---:|---:|---:|
| **TS6.0** | 426 ms | 1.0x | 0.24 GB |
| TS7.0 (Go) | 1,046 ms | 0.41x | 0.34 GB |
| TS7.0 (TinyGo) `-opt=z`（デフォルト） | 1,266 ms | 0.34x | 0.40 GB |
| TS7.0 (TinyGo) `-opt=2` | 1,401 ms | 0.30x | 0.49 GB |
| TS7.0 (TinyGo) 初期メモリ 2GB | 804 ms | 0.53x | 0.50 GB |
| TS7.0 (TinyGo) `-gc=leaking` | 628 ms | 0.68x | 0.42 GB |
| TS7.1 (Go) | 901 ms | 0.47x | 0.32 GB |
| TS7.1 (TinyGo) `-opt=z`（デフォルト） | 860 ms | 0.50x | 0.37 GB |
| TS7.1 (TinyGo) `-opt=2` | 850 ms | 0.50x | 0.47 GB |
| TS7.1 (TinyGo) 初期メモリ 2GB | 726 ms | 0.59x | 0.45 GB |
| TS7.1 (TinyGo) `-gc=leaking` | 571 ms | 0.75x | 0.34 GB |
| TS7.1 dev（公式 wasm） | 935 ms | 0.46x | 0.51 GB |
| tsrs `opt-level=s`（デフォルト） | 222 ms | 1.9x | 0.15 GB |
| ts-rust `opt-level=z`（デフォルト） | 336 ms | 1.3x | 0.19 GB |
| tsrs `opt-level=z` | 241 ms | 1.8x | 0.14 GB |
| ts-rust `opt-level=s` | 302 ms | 1.4x | 0.20 GB |

ピーク RSS には Node.js 自身の分も含むので、wasm32 の上限 4GB を超えることがある。

まとめ:

- 公式 wasm（`@typescript/typescript-wasip1-wasm` 7.1.0-dev.20261030.1）の速度は、自前の TS7.1 (Go) とほぼ同じ（social-app 15.5 秒と 15.2 秒、Playwright 7.54 秒と 7.63 秒、basic 935 ms と 901 ms）。ピーク RSS は social-app と Playwright でわずかに小さく、basic では大きい（0.51GB と 0.32GB）。
  PGO でビルドされているが（[ビルド](builds.md)を参照）、ソースのバージョンも違うので、この比較から PGO だけの効果は分からない。
- wasm にコンパイルした Go 移植版は、同じエンジン上で JavaScript として動く TS6 より遅い。social-app で TS7.1 の Go が 0.68x、TinyGo（デフォルト）が 0.51x。
- 7.0 から 7.1 で Go 移植版は速く、省メモリになった。social-app で Go は 20.4 秒・1.73GB から 15.2 秒・1.27GB に、TinyGo は 34.8 秒・2.98GB から 20.3 秒・1.87GB に。
- TinyGo のデフォルトの遅れはプロジェクトが大きくなるほど広がる（[GC のため](bench-cpu-profile.md)）。`examples/basic` では TS7.1 の TinyGo が Go と並ぶが、Playwright では Go の 2.5 倍かかる。
- TinyGo のビルドオプションでは初期メモリ 2GB が最も効く。TS7.1 では social-app で Go と並び（15.0 秒）、Playwright ではヒープがほぼ初期メモリに収まるので Go より速くなる（6.76 秒、デフォルトの 2.8 倍速）。
  TS7.0 では social-app のピーク RSS が 4.09GB に達し、上限に近い。
- `-gc=leaking`（GC なし）の TS7.1 は TS6 より速い（social-app と Playwright で 1.1x）。TS7.0 は social-app で 4GB を使い切ってメモリ不足になる。
- `-opt=2` は TS7.1 の social-app と Playwright で 6〜11% 速くなるが、TS7.0 ではほとんど変わらない。どちらもモジュールが 3 割大きくなる。
- Rust 移植版の wasm ビルドは TS6 より速い。最速は tsrs（デフォルトで TS6 の 3.8 倍、メモリは TS6 の 3 分の 1 未満）で、ts-rust は 1.6〜1.8 倍。
  どちらも `opt-level=s` のほうが `opt-level=z` より 1〜2 割速く、tsrs は上流のデフォルトが `s`、ts-rust は `z`。
- `--singleThreaded` なしでは、TinyGo は social-app でメモリ不足になる（ファイルごとの goroutine × 固定長スタック）。1MB スタックでも同様。
- TS6 と TS7 系のチェッカーは一部のメッセージが異なる。`examples/basic` では TS6 が TS2345 を報告する箇所で、後者は TS2739 を報告する。
- ブラウザの Playground（Chrome、小さなサンプル）では、1 回の実行に Go と TinyGo のビルドで約 0.9〜1.0 秒、ts-rust で約 0.3 秒かかる（TS 7.1 開発版で計測）。
