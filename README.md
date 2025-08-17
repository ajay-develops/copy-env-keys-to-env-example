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

## Quick start (no install)

Use via npx without adding any dependency:

```bash
npx copy-env-keys-to-env-example
```

Print what would be written (no file changes):

```bash
npx copy-env-keys-to-env-example --dry-run
```

Custom output path:

```bash
npx copy-env-keys-to-env-example --output config/example.env
# or
npx copy-env-keys-to-env-example -o config/example.env
```

---

## Pre-commit hook (ensure .env.example stays up to date)

Keep `.env.example` updated automatically before every commit. Two options are shown below; the first uses npx without installing the package.

### Option A: Husky (recommended)

```bash
# Install husky (dev-only)
npm i -D husky

# Initialize husky (creates .husky/ and git hook wiring)
npx husky init

# Add a pre-commit hook that runs the tool via npx without installing it
npx husky add .husky/pre-commit "npx -y copy-env-keys-to-env-example && git add .env.example"

# If you use a custom output path, update the hook accordingly, e.g.:
# npx husky add .husky/pre-commit "npx -y copy-env-keys-to-env-example -o config/example.env && git add config/example.env"
```

### Option B: Native git hook (no extra deps)

```bash
mkdir -p .git/hooks
cat > .git/hooks/pre-commit <<'SH'
#!/usr/bin/env sh
set -e

# Update .env.example using npx without installing locally
npx -y copy-env-keys-to-env-example

# Stage the updated file
git add .env.example
SH
chmod +x .git/hooks/pre-commit
```

For a custom output path, replace the command and the path in `git add` accordingly.

---

## Install (optional)

If you prefer adding the tool to devDependencies:

```bash
npm install --save-dev copy-env-keys-to-env-example
# or
yarn add -D copy-env-keys-to-env-example
```

Add a script for easy usage:

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
