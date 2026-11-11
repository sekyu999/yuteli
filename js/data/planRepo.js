// 家計（買いたい物・やりたい事）の読み書き
import { db } from './db.js';
import { newId, nowIso } from '../lib/util.js';
import { validatePlanInput } from '../domain/plans.js';
import { ValidationError } from './productRepo.js';

export function listPlans() {
  return db.plans.toArray();
}

export function getPlan(id) {
  return db.plans.get(id);
}

/** 保存（id がなければ新規）。入力が不正なら ValidationError */
export async function savePlan(id, raw) {
  const r = validatePlanInput(raw);
  if (!r.ok) throw new ValidationError(r.errors);
  const t = nowIso();
  const old = id ? await db.plans.get(id) : null;
  const plan = { id: id ?? newId(), ...r.value, createdAt: old?.createdAt ?? t, updatedAt: t };
  await db.plans.put(plan);
  return plan;
}

export async function setPlanDone(id, done) {
  await db.plans.update(id, { done: !!done, updatedAt: nowIso() });
}

/** 月だけ変える（ドラッグで移動した時）。month は YYYY-MM、未定は null */
export async function setPlanMonth(id, month) {
  await db.plans.update(id, { month: month || null, updatedAt: nowIso() });
}

/** 消した予定を元に戻す（済みにして消した直後の「元に戻す」用） */
export async function restorePlan(plan) {
  await db.plans.put(plan);
}

export async function deletePlan(id) {
  await db.plans.delete(id);
}
