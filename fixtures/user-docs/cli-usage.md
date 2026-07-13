# CLI Usage

The `donorlist` CLI imports and exports listing data in bulk.

## Flags

| Flag        | Type    | Description               |
| ----------- | ------- | ------------------------- |
| `--output`  | string  | Output directory          |
| `--verbose` | boolean | Print detailed progress   |
| `--dry-run` | boolean | Run without writing files |

## Examples

```bash
donorlist export --output ./exports --verbose
donorlist import ./listings.csv --dry-run
```
