This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Realtime Health Assistant

Add this environment variable for websocket integration:

```bash
WS_URL=ws://localhost:8000/ws/realtime-health-assistant
```

For production, use secure websocket URL:

```bash
WS_URL=wss://your-domain/ws/realtime-health-assistant
```

## Concurrency Validation (10K)

Use the included k6 script to validate API behavior under heavy concurrent load.

1. Install k6 from https://grafana.com/docs/k6/latest/set-up/install-k6/
2. Build and run your app in production mode:

```bash
npm run build
npm run start
```

3. Run the load test:

```bash
k6 run -e BASE_URL=http://localhost:3000 load-tests/k6-api-smoke.js
```

Optional authenticated run:

```bash
k6 run -e BASE_URL=http://localhost:3000 -e AUTH_COOKIE="next-auth.session-token=..." load-tests/k6-api-smoke.js
```

Important:
- True 10K concurrency requires horizontal scaling (multiple app instances) and a shared cache/datastore for rate limiting.
- In-memory limiters are per-instance and are not globally coordinated across replicas.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
