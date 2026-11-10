import { Router } from 'express';
import { offerSchema, type OfferAdmin } from '@gym/shared';
import { pool, select, selectOne } from '../db/pool';
import { asyncHandler, HttpError, parseId } from '../utils/http';
import { OFFER_COLUMNS } from './public';

const router = Router();

const WITH_STATUS = `
  SELECT ${OFFER_COLUMNS},
         CASE WHEN NOT is_active THEN 'hidden'
              WHEN valid_until IS NOT NULL AND valid_until < app_today() THEN 'expired'
              WHEN valid_from  IS NOT NULL AND valid_from  > app_today() THEN 'scheduled'
              ELSE 'live' END AS status
    FROM offers`;

const values = (d: ReturnType<typeof offerSchema.parse>) => [
  d.title, d.highlight || null, d.description || null, d.code || null,
  d.valid_from || null, d.valid_until || null, d.is_active,
];

router.get('/', asyncHandler(async (_req, res) => {
  const offers = await select<OfferAdmin>(
    pool,
    `SELECT * FROM (${WITH_STATUS}) o
      ORDER BY CASE status WHEN 'live' THEN 0 WHEN 'scheduled' THEN 1 WHEN 'hidden' THEN 2 ELSE 3 END, id DESC`,
  );
  res.json(offers);
}));

router.post('/', asyncHandler(async (req, res) => {
  const d = offerSchema.parse(req.body);
  const created = await selectOne<{ id: number }>(
    pool,
    `INSERT INTO offers (title, highlight, description, code, valid_from, valid_until, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    values(d),
  );
  res.status(201).json(await selectOne<OfferAdmin>(pool, `${WITH_STATUS} WHERE id = $1`, [created!.id]));
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const d = offerSchema.parse(req.body);
  const result = await pool.query(
    `UPDATE offers SET title=$1, highlight=$2, description=$3, code=$4, valid_from=$5, valid_until=$6, is_active=$7
      WHERE id=$8`,
    [...values(d), id],
  );
  if (!result.rowCount) throw new HttpError(404, 'Offer not found.');
  res.json(await selectOne<OfferAdmin>(pool, `${WITH_STATUS} WHERE id = $1`, [id]));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const result = await pool.query('DELETE FROM offers WHERE id = $1', [parseId(req.params.id)]);
  if (!result.rowCount) throw new HttpError(404, 'Offer not found.');
  res.status(204).end();
}));

export default router;
