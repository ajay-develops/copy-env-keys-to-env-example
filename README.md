## copy-env-keys-to-env-example

Copies environment variable keys from `.env` and `.env.local` into an `.env.example` file.

### Highlights

- **Empty values** in output (`KEY=`)
- **Preserves source order**: `.env` first, then new keys from `.env.local`
- **Preserves standalone comments** and blank lines associated with keys
- **Append-only overwrite**: if output exists, only missing keys are appended under a timestamped section
- **Warns about unknown keys**: marks keys present only in `.env.example` with a comment
- **Idempotent**: safe to run repeatedly
- **Zero deps**, fast, tiny

---

## Install

Run via npx (recommended):

```bash
npx copy-env-keys-to-env-example
```

Or add to your project:

```bash
npm install --save-dev copy-env-keys-to-env-example
# or
yarn add -D copy-env-keys-to-env-example
```

Then add a script:

```json
{
  "scripts": {
    "create:.env.example": "npx copy-env-keys-to-env-example"
  }
}
```

or

```json
{
  "scripts": {
    "create:.env.example": "copy-env-keys-to-env-example"
  }
}
```

---

## Usage

```bash
copy-env-keys-to-env-example [--dry-run] [--output <path>]
```

### Flags

- `--dry-run`: print the resulting content to stdout without writing a file
- `-o, --output <path>`: custom output file path (default: `./.env.example`)
- `-h, --help`: show usage

### Behavior

- Reads keys from `.env` and `.env.local` if present. If neither exists, exits with an error.
- When the output file does not exist, it is created from scratch with:
  - Empty values for all keys: `KEY=`
  - Preserved standalone comments and blank lines
  - Keys ordered by appearance: `.env` first, then new keys from `.env.local`
- When the output file exists, behavior is append-only:
  - Missing keys are appended under a header: `# --- Added by copy-env-keys-to-env-example on YYYY-MM-DD HH:mm:ss ---`
  - Keys already present are left intact
  - Keys found only in the output (not in `.env` or `.env.local`) are annotated with:
    `# NOTE: Key not found in .env or .env.local`
- Duplicate top-of-file comments are avoided.

---

## Examples

### Generate `.env.example` from scratch

```bash
npx copy-env-keys-to-env-example
```

### Print the generated content without writing

```bash
npx copy-env-keys-to-env-example --dry-run
```

### Use a custom output path

```bash
npx copy-env-keys-to-env-example --output config/example.env
# or
npx copy-env-keys-to-env-example -o config/example.env
```

### Typical workflow

1. Update `.env` or `.env.local` with new keys
2. Run the tool:
   ```bash
   npx copy-env-keys-to-env-example
   ```
3. Commit the updated `.env.example`

---

## Notes and limitations

- Inline comments on the same line as assignments are not copied; standalone comments are preserved.
- Keys are parsed with a tolerant parser that supports optional `export` prefixes and quoted values.
- The tool does not remove keys from the output; it only appends and annotates unknown ones.

---

## Local development

```bash
# From this repo
npm link

# In a test project
npm link copy-env-keys-to-env-example
copy-env-keys-to-env-example --dry-run
```

---

## License

ISC © ajay-develops

Repository: [GitHub](https://github.com/ajay-develops/copy-env-keys-to-env-example)
