import express from 'express';
import path from 'node:path';
import { reviewTargetSchema } from './review/schemas.js';
import { reviewTarget } from './review/orchestrator.js';
import {
  getReview,
  listReviews,
  saveReview,
} from './storage/review-history.js';

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.resolve('ui')));

app.post('/api/reviews', async (req, res) => {
  try {
    const target = reviewTargetSchema.parse(req.body);
    const result = await reviewTarget(target);
    const stored = await saveReview(target, result);

    res.status(201).json(stored);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Review failed.';

    res.status(400).json({ error: message });
  }
});

app.get('/api/reviews', async (_req, res) => {
  res.json(await listReviews());
});

app.get('/api/reviews/:id', async (req, res) => {
  const review = await getReview(req.params.id);

  if (!review) {
    res.status(404).json({
      error: 'Review not found.',
    });
    return;
  }

  res.json(review);
});

app.listen(PORT, () => {
  console.log(`Code Review Agent running at http://localhost:${PORT}`);
});
