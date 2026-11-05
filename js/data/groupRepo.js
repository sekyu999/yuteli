// 食事グループの読み書き
import { db } from './db.js';
import { newId, nowIso } from '../lib/util.js';
import { validateGroupInput } from '../domain/groups.js';
import { ValidationError } from './productRepo.js';

export function listGroups() {
  return db.foodGroups.toArray().then((l) => l.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
}

export function getGroup(id) {
  return db.foodGroups.get(id);
}

/**
 * グループを保存する（id がなければ新規）。入力が不正なら ValidationError
 * @param {string|null} id
 * @param {{name, unit, c_breakfast, c_lunch, c_dinner, members:Array<{productId, servingAmount}>}} raw
 */
export async function saveGroup(id, raw) {
  const r = validateGroupInput(raw);
  if (!r.ok) throw new ValidationError(r.errors);
  return db.transaction('rw', db.foodGroups, async () => {
    const old = id ? await db.foodGroups.get(id) : null;
    const t = nowIso();
    const group = { id: id ?? newId(), ...r.value, createdAt: old?.createdAt ?? t, updatedAt: t };
    await db.foodGroups.put(group);
    return group;
  });
}

export async function deleteGroup(id) {
  await db.foodGroups.delete(id);
}

/** 商品を削除する時：その商品をグループから外す（productRepo から呼ぶ。トランザクション内） */
export async function removeProductFromGroups(productId) {
  const groups = await db.foodGroups.toArray();
  for (const g of groups) {
    if (!g.members.some((m) => m.productId === productId)) continue;
    const others = g.members.filter((m) => m.productId !== productId);
    await db.foodGroups.update(g.id, { members: others, updatedAt: nowIso() });
  }
}
