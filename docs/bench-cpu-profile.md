# CPU プロファイル

検証結果の一覧は [README](../README.md#検証結果)、各ビルドの内容は [ビルド](builds.md) を参照。

## TinyGo が遅い理由

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

**TS7.0 の CPU プロファイル**

TS7.0 の Go と TinyGo（デフォルト）のビルドで、social-app を `--singleThreaded` で 1 回ずつ `node --cpu-prof` にかけ、`bench/cpu-profile.mjs` で関数の自己時間を処理の種類ごとに集計した。
集計結果は `bench/results/cpu-profile-7.0.md` にある。

```sh
cd bench/repos/social-app
node --cpu-prof --cpu-prof-dir=../../../out/prof-tinygo ../../../scripts/run-wasi.mjs ../../../out/tsc-7.0.wasip1.wasm -p tsconfig.check.web.json --noEmit --singleThreaded
cd ../../.. && node bench/cpu-profile.mjs out/prof-tinygo/*.cpuprofile
node --test bench/cpu-profile.test.mjs
```

| 処理の種類 | Go | TinyGo |
|---|---:|---:|
| GC（マーク、スイープ、ライトバリア） | 4.49 s（25.4%） | 17.06 s（54.7%） |
| アロケーション | 1.10 s（6.2%） | 1.53 s（4.9%） |
| マップとハッシュ | 3.03 s（17.1%） | 3.14 s（10.1%） |
| コンパイラ本体（TypeScript のパッケージ） | 6.85 s（38.7%） | 7.41 s（23.8%） |
| JavaScript の呼び出し（WASI） | 0.83 s（4.7%） | 0.78 s（2.5%） |
| その他（標準ライブラリなど） | 1.40 s（7.9%） | 1.28 s（4.1%） |
| 合計 | 17.70 s | 31.20 s |

| 自己時間の多い関数（Go） | | 自己時間の多い関数（TinyGo） | |
|---|---:|---|---:|
| `runtime.tryDeferToSpanScan`（GC） | 9.5% | `(runtime.gcBlock).findHead`（GC） | 37.4% |
| `runtime.wbBufFlush1`（ライトバリア） | 5.1% | `runtime.insertFreeRange`（GC） | 5.4% |
| `wasm-to-js`（WASI） | 4.6% | `runtime.alloc` | 4.3% |
| `runtime.mapaccess2_fast64` | 3.4% | `runtime.markRoot`（GC） | 3.9% |
| `runtime.findObject`（GC） | 3.1% | `runtime.hashmapGet` | 3.7% |
| `runtime.typePointers.next`（GC） | 3.0% | `runtime.scanWithMask`（GC） | 3.1% |

- コンパイラ本体にかかる時間は Go 6.85 秒、TinyGo 7.41 秒でほぼ同じ。マップとハッシュ、アロケーション、WASI の呼び出しもほぼ同じで、差（13.5 秒）のほとんどは GC（+12.6 秒）。
  TinyGo では `findHead` だけで 11.68 秒かかっている。
- TS7.0 の TinyGo は、前述の 7.1 開発版（GC が約 3 分の 1、`findHead` が 5 分の 1）よりさらに GC の割合が大きい。TS7.0 はピーク RSS も大きく（social-app で 3.44GB 対 1.92GB）、生存ヒープが大きいほど GC 1 回あたりの走査が増える。
- 標準 Go も時間の 4 分の 1 を GC に使っている。wasm はシングルスレッドなので、ネイティブなら別のスレッドで並行して進むマークがメインスレッドで走る。
  ライトバリア（`wbBufFlush1`、`bulkBarrierPreWrite`、`gcWriteBarrier`）だけで 8% ある。
- 合計時間は `bench/run.sh` の計測（Go 17.0 秒、TinyGo 32.2 秒）とほぼ同じで、プロファイルによる遅れは小さい。
