## @typescript/typescript-wasip1-wasm 7.1.0-dev.20261030.1 (social-app, --singleThreaded)

total 15.3 s

| kind of work | self time |
|---|---:|
| GC (marking, sweeping, write barriers) | 15.5% |
| allocation | 8.2% |
| maps and hashing | 11.7% |
| the compiler (TypeScript's packages) | 54.2% |
| calls into JavaScript (WASI) | 2.1% |
| other | 8.3% |

| function | kind | self time |
|---|---|---:|
| `runtime.tryDeferToSpanScan` | GC (marking, sweeping, write barriers) | 6.3% |
| `runtime.wbBufFlush.func1` | GC (marking, sweeping, write barriers) | 4.3% |
| `runtime.bulkBarrierPreWrite` | GC (marking, sweeping, write barriers) | 2.9% |
| `runtime.growMemory` | allocation | 2.3% |
| `internal_runtime_maps.memHashFallback` | maps and hashing | 2.0% |
| `runtime.mapaccess2_fast64` | maps and hashing | 2.0% |
| `[js] wasm-to-js` | calls into JavaScript (WASI) | 2.0% |
| `runtime.mapaccess2` | maps and hashing | 1.4% |
| `runtime.mapaccess2_faststr` | maps and hashing | 1.2% |
| `github.com_microsoft_TypeScript_tsc_internal_checker.__Checker_.inferFromTypes` | the compiler (TypeScript's packages) | 1.2% |
| `github.com_microsoft_TypeScript_tsc_internal_checker.CompareTypes` | the compiler (TypeScript's packages) | 1.2% |
| `runtime.mapassign` | maps and hashing | 1.1% |
| `github.com_microsoft_TypeScript_tsc_internal_checker.__Checker_.checkIdentifier` | the compiler (TypeScript's packages) | 1.0% |
| `github.com_microsoft_TypeScript_tsc_internal_ast.__SymbolMap_.find` | the compiler (TypeScript's packages) | 1.0% |
| `github.com_microsoft_TypeScript_tsc_internal_scanner.__Scanner_.Scan` | the compiler (TypeScript's packages) | 1.0% |
| `github.com_microsoft_TypeScript_tsc_internal_ast.__SymbolMap_.Get` | the compiler (TypeScript's packages) | 0.9% |
| `github.com_microsoft_TypeScript_tsc_internal_checker.hasMatchingRecursionIdentity` | the compiler (TypeScript's packages) | 0.9% |
| `github.com_microsoft_TypeScript_tsc_internal_checker.__Relater_.isRelatedToEx` | the compiler (TypeScript's packages) | 0.9% |
| `runtime.growslice` | allocation | 0.8% |
| `github.com_microsoft_TypeScript_tsc_internal_checker.__Checker_.getPropertyOfTypeEx` | the compiler (TypeScript's packages) | 0.8% |
