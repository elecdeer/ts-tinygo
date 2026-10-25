## tsc-go-7.0.wasip1.wasm (social-app, --singleThreaded)

total 17.7 s

| kind of work | self time |
|---|---:|
| GC (marking, sweeping, write barriers) | 25.4% |
| allocation | 6.2% |
| maps and hashing | 17.1% |
| the compiler (TypeScript's packages) | 38.7% |
| calls into JavaScript (WASI) | 4.7% |
| other | 7.9% |

| function | kind | self time |
|---|---|---:|
| `runtime.tryDeferToSpanScan` | GC (marking, sweeping, write barriers) | 9.5% |
| `runtime.wbBufFlush1` | GC (marking, sweeping, write barriers) | 5.1% |
| `[js] wasm-to-js` | calls into JavaScript (WASI) | 4.6% |
| `runtime.mapaccess2_fast64` | maps and hashing | 3.4% |
| `runtime.findObject` | GC (marking, sweeping, write barriers) | 3.1% |
| `runtime.typePointers.next` | GC (marking, sweeping, write barriers) | 3.0% |
| `runtime.bulkBarrierPreWrite` | GC (marking, sweeping, write barriers) | 2.6% |
| `internal_runtime_maps.memHashFallback` | maps and hashing | 2.5% |
| `runtime.mapaccess2_faststr` | maps and hashing | 2.3% |
| `runtime.growMemory` | allocation | 2.0% |
| `runtime.mapassign_fast64ptr` | maps and hashing | 1.2% |
| `runtime.mallocgcSmallScanSlowPath` | allocation | 1.2% |
| `runtime.mapaccess2` | maps and hashing | 1.1% |
| `internal_runtime_maps.__Map_.getWithoutKeySmallFastStr` | maps and hashing | 1.1% |
| `github.com_zeebo_xxh3.__Hasher_.updateString` | other | 1.0% |
| `github.com_microsoft_typescript_go_internal_checker.CompareTypes` | the compiler (TypeScript's packages) | 0.9% |
| `github.com_microsoft_typescript_go_internal_checker.__Checker_.resolveStructuredTypeMembers` | the compiler (TypeScript's packages) | 0.8% |
| `internal_runtime_atomic.Load8` | other | 0.8% |
| `runtime.typedmemmove` | other | 0.7% |
| `runtime.mapassign_faststr` | maps and hashing | 0.7% |

## tsc-7.0.wasip1.wasm (social-app, --singleThreaded)

total 31.2 s

| kind of work | self time |
|---|---:|
| GC (marking, sweeping, write barriers) | 54.7% |
| allocation | 4.9% |
| maps and hashing | 10.1% |
| the compiler (TypeScript's packages) | 23.8% |
| calls into JavaScript (WASI) | 2.5% |
| other | 4.1% |

| function | kind | self time |
|---|---|---:|
| `(runtime.gcBlock).findHead` | GC (marking, sweeping, write barriers) | 37.4% |
| `runtime.insertFreeRange` | GC (marking, sweeping, write barriers) | 5.4% |
| `runtime.alloc` | allocation | 4.3% |
| `runtime.markRoot` | GC (marking, sweeping, write barriers) | 3.9% |
| `runtime.hashmapGet` | maps and hashing | 3.7% |
| `runtime.scanWithMask` | GC (marking, sweeping, write barriers) | 3.1% |
| `[js] wasm-to-js` | calls into JavaScript (WASI) | 2.5% |
| `runtime.runGC` | GC (marking, sweeping, write barriers) | 2.1% |
| `runtime.hashmapSet` | maps and hashing | 1.8% |
| `runtime.hash32` | maps and hashing | 1.4% |
| `(runtime.gcBlock).free` | GC (marking, sweeping, write barriers) | 1.3% |
| `(*github.com/microsoft/typescript-go/internal/checker.Checker).resolveStructuredTypeMembers` | the compiler (TypeScript's packages) | 1.0% |
| `runtime.finishMark` | GC (marking, sweeping, write barriers) | 1.0% |
| `(*github.com/microsoft/typescript-go/internal/checker.Checker).instantiateTypeWithAlias` | the compiler (TypeScript's packages) | 0.9% |
| `runtime.hashmapNext` | maps and hashing | 0.8% |
| `github.com/microsoft/typescript-go/internal/checker.CompareTypes` | the compiler (TypeScript's packages) | 0.7% |
| `runtime.hashmapClear` | maps and hashing | 0.7% |
| `(*github.com/microsoft/typescript-go/internal/checker.Type).AsStructuredType` | the compiler (TypeScript's packages) | 0.6% |
| `(*github.com/microsoft/typescript-go/internal/ast.Node).Name` | the compiler (TypeScript's packages) | 0.6% |
| `(*github.com/microsoft/typescript-go/internal/ast.Node).DeclarationData` | the compiler (TypeScript's packages) | 0.6% |

