# AfriDam AI × TECHFEAST 2026

Standalone Next.js skin-analysis demonstration for TECHFEAST 2026.

## Development

```bash
npm install
npm run dev
```

## Environment

Copy `.env.example` to `.env.local` and configure the server-side variables. Live requests require an
authorised replacement credential; no exposed production key is included in this repository.

## Integration status

Live integration is currently blocked until the owner supplies an authorised `AFRIDAM_API_KEY` and
confirms public demo usage and the specialist consultation URL.

## Security

- The API key is read only from `process.env.AFRIDAM_API_KEY`.
- `/api/skin-analysis` validates image type and size.
- Uploaded images are forwarded in memory and are not saved by this application.
- Analysis requests are rate-limited in the application process.
