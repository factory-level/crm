import { Badge } from "@crm/ui/components/badge";
import type { Job } from "../inferops-contract";

const LABELS = {
	scheduled: "Scheduled",
	overdue: "Overdue",
	completed: "Completed",
	invoiced: "Invoiced",
} as const satisfies Record<Job["status"], string>;

export function JobStatus({ status }: { status: Job["status"] }) {
	return (
		<Badge variant={status === "overdue" ? "destructive" : "secondary"}>
			{LABELS[status]}
		</Badge>
	);
}
