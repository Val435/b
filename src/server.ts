import app from './app';
import { getLastRecommendationSummary } from './utils/recommendationMetrics';

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  console.log('DB', process.env.DATABASE_URL);
  console.log('Time of the last recommendation: ', getLastRecommendationSummary());
});
