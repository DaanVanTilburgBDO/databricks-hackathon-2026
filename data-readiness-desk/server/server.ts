import { createApp, analytics, lakebase, server } from '@databricks/appkit';
import { setupReviewRoutes } from './routes/review-routes.js';

await createApp({
  plugins: [
    analytics(),
    lakebase(),
    server(),
  ],
  async onPluginsReady(appkit) {
    await setupReviewRoutes(appkit);
  },
}).catch(console.error);
