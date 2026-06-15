import { createApp, analytics, lakebase, server, serving } from '@databricks/appkit';
import { setupReviewRoutes } from './routes/review-routes.js';
import { setupAiReviewRoutes } from './routes/ai-review-routes.js';

await createApp({
  plugins: [
    analytics(),
    lakebase(),
    serving(),
    server(),
  ],
  async onPluginsReady(appkit) {
    await setupReviewRoutes(appkit);
    await setupAiReviewRoutes(appkit);
  },
}).catch(console.error);
