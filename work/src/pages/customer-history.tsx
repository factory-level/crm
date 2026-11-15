import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { Badge } from "@crm/ui/components/badge";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { StatCard } from "@crm/ui/components/stat-card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@crm/ui/components/table";
import { type HttpError, useList, useOne } from "@refinedev/core";
import type { ReactNode } from "react";
import { useParams } from "react-router";
import { JobStatus } from "../components/job-status";
import { NoteForm } from "../components/note-form";
import { LoadingOverlay } from "../components/refine-ui/layout/loading-overlay";
import {
	ShowView,
	ShowViewHeader,
} from "../components/refine-ui/views/show-view";
import { formatCents, formatDay } from "../format";
import type { Job } from "../inferops-contract";
import { JOBS_RESOURCE } from "../providers/inferops-data-provider";
import {
	type ActivityEntry,
	type CompanyRecord,
	TIMELINE_RESOURCE,
} from "../resources";
import { WORK } from "../work-config";

type HistoryItem = {
	key: string;
	at: string;
	source: "CRM" | "InferOps";
	title: string;
	detail: ReactNode;
};

function historyOf(activities: ActivityEntry[], jobs: Job[]): HistoryItem[] {
	const fromCrm = activities.map((activity) => ({
		key: `crm-${activity.id}`,
		at: activity.occurredAt ?? activity.createdAt,
		source: "CRM" as const,
		title: activity.subject ?? activity.body ?? activity.type,
		detail: <Badge variant="outline">{activity.type}</Badge>,
	}));
	const fromInferops = jobs.map((job) => ({
		key: `inferops-${job.id}`,
		at: job.scheduledAt,
		source: "InferOps" as const,
		title: `${job.title}, ${job.technician}, ${formatCents(job.amountCents)}`,
		detail: <JobStatus status={job.status} />,
	}));
	return [...fromCrm, ...fromInferops].sort((a, b) => b.at.localeCompare(a.at));
}

export function CustomerHistoryPage() {
	const { id = "" } = useParams();
	const live = { refetchInterval: WORK.live.refetchMs };
	const customer = useOne<CompanyRecord, HttpError>({
		resource: "companies",
		id,
		queryOptions: live,
	});
	const activities = useList<ActivityEntry, HttpError>({
		resource: TIMELINE_RESOURCE,
		filters: [{ field: "companyId", operator: "eq", value: id }],
		queryOptions: live,
	});
	const jobs = useList<Job, HttpError>({
		resource: JOBS_RESOURCE,
		dataProviderName: "inferops",
		filters: [{ field: "customerId", operator: "eq", value: id }],
		pagination: { pageSize: WORK.list.maxPageSize },
	});

	const record = customer.result;
	const failure =
		customer.query.error ?? activities.query.error ?? jobs.query.error;
	const loading =
		customer.query.isLoading ||
		activities.query.isLoading ||
		jobs.query.isLoading;
	const history = historyOf(activities.result.data, jobs.result.data);
	const billed = jobs.result.data
		.filter((job) => job.completedAt !== null)
		.reduce((sum, job) => sum + job.amountCents, 0);

	return (
		<ShowView>
			<ShowViewHeader resource="companies" title={record?.name ?? "Customer"} />
			{failure ? (
				<Alert variant="destructive">
					<AlertTitle>The customer history did not load</AlertTitle>
					<AlertDescription>{failure.message}</AlertDescription>
				</Alert>
			) : null}
			<LoadingOverlay loading={loading}>
				<div className="flex flex-col gap-4">
					<Card>
						<CardContent className="grid grid-cols-1 sm:grid-cols-4">
							<StatCard label="Domain" value={record?.domain ?? "–"} />
							<StatCard label="Industry" value={record?.industry ?? "–"} />
							<StatCard label="InferOps jobs" value={jobs.result.data.length} />
							<StatCard label="Billed work" value={formatCents(billed)} />
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle>History</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-col gap-4">
							<NoteForm companyId={id} />
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Date</TableHead>
										<TableHead>Source</TableHead>
										<TableHead>Event</TableHead>
										<TableHead>Detail</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{history.map((item) => (
										<TableRow key={item.key}>
											<TableCell>{formatDay(item.at)}</TableCell>
											<TableCell>
												<Badge
													variant={
														item.source === "CRM" ? "secondary" : "default"
													}
												>
													{item.source}
												</Badge>
											</TableCell>
											<TableCell>{item.title}</TableCell>
											<TableCell>{item.detail}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</div>
			</LoadingOverlay>
		</ShowView>
	);
}
