# CLI Usage

The `listaid` CLI imports and exports listing data in bulk.

## Flags

| Flag        | Type    | Description               |
| ----------- | ------- | ------------------------- |
| `--output`  | string  | Output directory          |
| `--verbose` | boolean | Print detailed progress   |
| `--dry-run` | boolean | Run without writing files |

## Examples

```bash
listaid export --output ./exports --verbose
listaid import ./listings.csv --dry-run
```
