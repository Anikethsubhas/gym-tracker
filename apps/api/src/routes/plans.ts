import { Router } from 'express';
import { planSchema, type Plan, type PlanWithCount } from '@gym/shared';
import { pool, select, selectOne } from '../db/pool';
import { asyncHandler, HttpError, parseId } from '../utils/http';

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  const plans = await select<PlanWithCount>(
    pool,
    `SELECT p.*, COUNT(s.id)::int AS member_count
       FROM plans p
       LEFT JOIN subscriptions s ON s.plan_id = p.id AND s.status = 'active'
      GROUP BY p.id
      ORDER BY p.is_active DESC, p.duration_months, p.name`,
  );
  res.json(plans);
}));

router.post('/', asyncHandler(async (req, res) => {
  const d = planSchema.parse(req.body);
  const plan = await selectOne<Plan>(
    pool,
    `INSERT INTO plans (name, price, duration_months, description, features, is_featured, is_active)
     VALUES ($1,$2,$3,$4,$5::text[],$6,$7) RETURNING *`,
    [d.name, d.price, d.duration_months, d.description || null, d.features ?? [], d.is_featured ?? false, d.is_active ?? true],
  );
  res.status(201).json(plan);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const d = planSchema.parse(req.body);
  const plan = await selectOne<Plan>(
    pool,
    `UPDATE plans SET name=$1, price=$2, duration_months=$3, description=$4,
            features=COALESCE($5::text[], features), is_featured=COALESCE($6, is_featured), is_active=COALESCE($7, is_active)
      WHERE id=$8 RETURNING *`,
    [d.name, d.price, d.duration_months, d.description || null, d.features ?? null, d.is_featured ?? null,
     d.is_active ?? null, parseId(req.params.id)],
  );
  if (!plan) throw new HttpError(404, 'Plan not found.');
  res.json(plan);
}));

export default router;
