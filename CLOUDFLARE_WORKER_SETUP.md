### Setting up the Infinity Counter Cloudflare Worker

To enable the "Increment to Infinity" counter in the footer, you need to deploy a Cloudflare Worker that handles the persistent storage using Cloudflare KV.

#### 1. Create a KV Namespace
1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Navigate to **Workers & Pages** > **KV**.
3. Click **Create a namespace**.
4. Name it `INFINITY_KV`.

#### 2. Create the Worker
1. Navigate to **Workers & Pages** > **Overview**.
2. Click **Create application** > **Create Worker**.
3. Give it a name (e.g., `infinity-counter`).
4. Click **Deploy**.
5. Click **Edit code**.
6. Replace the existing code with the content of the `worker.js` file found in your project root.
7. Click **Save and deploy**.

#### 3. Bind the KV Namespace to the Worker
1. Go back to your Worker's dashboard.
2. Navigate to **Settings** > **Variables**.
3. Scroll down to **KV Namespace Bindings**.
4. Click **Add binding**.
5. Set the **Variable name** to `INFINITY_KV`.
6. Set the **KV namespace** to the one you created in Step 1 (`INFINITY_KV`).
7. Click **Save and deploy**.

#### 4. Update the Website Configuration
1. Note the URL of your deployed worker (e.g., `https://infinity-counter.your-subdomain.workers.dev`).
2. Open `layouts/partials/extended_footer.html` in your project.
3. Find the `apiEndpoint` constant and update it with your Worker's URL:
   ```javascript
   const apiEndpoint = 'https://infinity-2026-counter.radek25c-cloudflare.workers.dev';
   ```
4. Re-deploy your Hugo site to Cloudflare Pages.

#### 5. Local Testing (Optional)
If you are using `wrangler` for local development, ensure your `wrangler.toml` includes:
```toml
kv_namespaces = [
  { binding = "INFINITY_KV", id = "YOUR_KV_NAMESPACE_ID" }
]
```
