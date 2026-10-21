# Sourced by the build scripts: resolves TS_VERSION to the compiler source.
#   7.1 (default)  TypeScript/ (v7.1-beta), where the Go port lives under tsc/
#   7.0            typescript-go/ (typescript/v7.0.2), released before the port moved into microsoft/TypeScript
# Sets ts_repo, ts_module, ts_cmd, ts_patches and ts_suffix (the output name suffix).
case "${TS_VERSION:-7.1}" in
  7.1)
    ts_repo="$root/TypeScript"
    ts_module="$ts_repo/tsc"
    ts_cmd=./cmd/tsc
    ts_patches=("$root"/patches/*.patch)
    ts_suffix="" ;;
  7.0)
    ts_repo="$root/typescript-go"
    ts_module="$ts_repo"
    ts_cmd=./cmd/tsgo
    ts_patches=("$root"/patches/typescript-go/*.patch)
    ts_suffix="-7.0" ;;
  *) echo "unknown TS_VERSION: $TS_VERSION" >&2; exit 2 ;;
esac
