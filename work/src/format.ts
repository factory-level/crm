const money = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	maximumFractionDigits: 0,
});

const day = new Intl.DateTimeFormat("en-US", {
	year: "numeric",
	month: "short",
	day: "numeric",
});

const CENTS = 100;

export function formatCents(cents: number): string {
	return money.format(cents / CENTS);
}

export function formatDay(iso: string): string {
	return day.format(new Date(iso));
}
