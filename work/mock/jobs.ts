import type { Job } from "../src/inferops-contract";
import { MOCK_INFEROPS } from "./mock-config";

const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;
const UINT32 = 4294967296;

function hashOf(text: string): number {
	let hash = FNV_OFFSET;
	for (const char of text) {
		hash = Math.imul(hash ^ (char.codePointAt(0) ?? 0), FNV_PRIME);
	}
	return hash >>> 0;
}

function randomFrom(seed: number): () => number {
	let state = seed;
	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let value = Math.imul(state ^ (state >>> 15), 1 | state);
		value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
		return ((value ^ (value >>> 14)) >>> 0) / UINT32;
	};
}

function pick<TItem>(items: readonly TItem[], roll: number): TItem {
	const item = items[Math.floor(roll * items.length)] ?? items[0];
	if (item === undefined) throw new Error("Cannot pick from an empty list.");
	return item;
}

function between(min: number, max: number, roll: number): number {
	return Math.round(min + (max - min) * roll);
}

function statusOf(scheduled: number, now: number, roll: number): Job["status"] {
	const { completedShare, invoicedShare } = MOCK_INFEROPS.jobs;
	if (scheduled > now) return "scheduled";
	if (roll < completedShare) return "completed";
	if (roll < completedShare + invoicedShare) return "invoiced";
	return "overdue";
}

export function jobsForCustomer(customerId: string, now: Date): Job[] {
	const settings = MOCK_INFEROPS.jobs;
	const random = randomFrom(hashOf(customerId));
	const count = between(
		settings.minPerCustomer,
		settings.maxPerCustomer,
		random(),
	);
	const anchor = now.getTime();

	return Array.from({ length: count }, (_, index) => {
		const scheduled = between(
			anchor - settings.historyMs,
			anchor + settings.futureMs,
			random(),
		);
		const status = statusOf(scheduled, anchor, random());
		const done = status === "completed" || status === "invoiced";

		return {
			id: `job-${hashOf(`${customerId}:${index}`).toString(36)}`,
			tenantId: MOCK_INFEROPS.tenant.id,
			customerId,
			title: pick(MOCK_INFEROPS.titles, random()),
			status,
			technician: pick(MOCK_INFEROPS.technicians, random()),
			scheduledAt: new Date(scheduled).toISOString(),
			completedAt: done
				? new Date(scheduled + settings.durationMs).toISOString()
				: null,
			amountCents: between(
				settings.minAmountCents,
				settings.maxAmountCents,
				random(),
			),
		};
	}).sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
}
