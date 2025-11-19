# CDN Tinycardo - Cloudflare Worker

A Cloudflare Worker that serves text-to-speech WAV files with HMAC signature verification for secure access control.

## Features

- ✅ Signature verification using HMAC-SHA256
- ✅ Serves WAV files from Cloudflare R2 storage
- ✅ TypeScript support
- ✅ CI/CD with GitHub Actions
- ✅ Secure constant-time signature comparison

## Prerequisites

- Node.js 20 or higher
- npm or yarn
- Cloudflare account with Workers and R2 enabled
- Wrangler CLI (installed via npm)

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create R2 bucket:**
   - Go to Cloudflare Dashboard → R2 → Create bucket
   - Name it `tts-wav-files` (or update `wrangler.toml`)

3. **Set up environment variables:**
   ```bash
   # Set the signature secret (used for HMAC verification)
   wrangler secret put SIGNATURE_SECRET
   ```

4. **Configure Cloudflare secrets for CI/CD:**
   - Go to your GitHub repository → Settings → Secrets and variables → Actions
   - Add the following secrets:
     - `CLOUDFLARE_API_TOKEN`: Your Cloudflare API token with Workers and R2 permissions
     - `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID

## Development

```bash
# Start local development server
npm run dev

# Type check
npm run type-check

# Build (type checking only, Wrangler handles bundling)
npm run build
```

## Deployment

### Manual Deployment

```bash
npm run deploy
```

### Automatic Deployment

The project includes GitHub Actions workflow that automatically deploys:
- **Main branch**: Deploys to production
- **Pull requests**: Deploys to staging environment

## Usage

### Generating Signatures

To generate a valid signature for a file, you need to:

1. Create an HMAC-SHA256 signature of the URL path (without query parameters)
2. Include the signature as a query parameter `sig` or header `X-Signature`

**Example (Node.js):**
```typescript
import crypto from 'crypto';

const secret = 'your-secret-key';
const file_path = '/audio/example.wav';
const url = `https://your-worker.workers.dev${file_path}`;

const hmac = crypto.createHmac('sha256', secret);
hmac.update(url);
const signature = hmac.digest('hex');

// Access the file with signature
const signed_url = `${url}?sig=${signature}`;
```

### Request Format

```
GET /path/to/file.wav?sig=<signature>
```

Or with header:
```
GET /path/to/file.wav
X-Signature: <signature>
```

## Security

- Signatures are verified using constant-time comparison to prevent timing attacks
- Only GET requests are allowed
- Only `.wav` files are served
- Invalid or missing signatures return 401/403 errors

## Project Structure

```
.
├── src/
│   └── index.ts          # Main worker code
├── .github/
│   └── workflows/
│       └── deploy.yml    # CI/CD pipeline
├── wrangler.toml         # Cloudflare Worker configuration
├── tsconfig.json         # TypeScript configuration
├── package.json          # Dependencies and scripts
└── README.md            # This file
```

## Environment Variables

- `SIGNATURE_SECRET`: Secret key for HMAC signature verification (set via `wrangler secret put`)

## License

MIT

