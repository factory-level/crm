import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
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
import { type HttpError, useCustom } from "@refinedev/core";
import { Link } from "react-router";
import { JobStatus } from "../components/job-status";
import { LoadingOverlay } from "../components/refine-ui/layout/loading-overlay";
import { formatCents, formatDay } from "../format";
import type { OperationsSummary } from "../inferops-contract";
import { WORK } from "../work-config";

export function DashboardPage() {
	const { query } = useCustom<OperationsSummary, HttpError>({
		url: WORK.inferops.summaryPath,
		method: "get",
		dataProviderName: "inferops",
		queryOptions: { refetchInterval: WORK.live.refetchMs },
	});
	const summary = query.data?.data;

	return (
		<div className="flex flex-col gap-4">
			<h2 className="font-bold text-2xl">Operations dashboard</h2>
			{query.isError ? (
				<Alert variant="destructive">
					<AlertTitle>The dashboard did not load</AlertTitle>
					<AlertDescription>{query.error.message}</AlertDescription>
				</Alert>
			) : null}
			{summary?.crm.connected === false ? (
				<Alert variant="warning">
					<AlertTitle>The CRM is not connected</AlertTitle>
					<AlertDescription>{summary.crm.reason}</AlertDescription>
				</Alert>
			) : null}
			<LoadingOverlay loading={query.isLoading}>
				<div className="flex flex-col gap-4">
					<Card>
						<CardHeader>
							<CardTitle>CRM</CardTitle>
						</CardHeader>
						<CardContent className="grid grid-cols-1 sm:grid-cols-3">
							<StatCard
								label="Customers"
								value={summary?.crm.connected ? summary.crm.customers : "–"}
							/>
							<StatCard
								label="Contacts"
								value={summary?.crm.connected ? summary.crm.contacts : "–"}
							/>
							<StatCard
								label="Deals"
								value={summary?.crm.connected ? summary.crm.deals : "–"}
							/>
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle>InferOps jobs</CardTitle>
						</CardHeader>
						<CardContent className="grid grid-cols-1 sm:grid-cols-4">
							<StatCard label="Open jobs" value={summary?.jobs.open ?? "–"} />
							<StatCard
								label="Overdue jobs"
								value={summary?.jobs.overdue ?? "–"}
							/>
							<StatCard
								label="Completed, last 30 days"
								value={summary?.jobs.completedLast30Days ?? "–"}
							/>
							<StatCard
								label="Revenue, last 30 days"
								value={
									summary
										? formatCents(summary.jobs.revenueCentsLast30Days)
										: "–"
								}
							/>
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle>Recent jobs</CardTitle>
						</CardHeader>
						<CardContent>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Date</TableHead>
										<TableHead>Customer</TableHead>
										<TableHead>Job</TableHead>
										<TableHead>Technician</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Amount</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{(summary?.recentJobs ?? []).map((job) => (
										<TableRow key={job.id}>
											<TableCell>{formatDay(job.scheduledAt)}</TableCell>
											<TableCell>
												<Link
													to={WORK.routes.customer.replace(
														":id",
														job.customerId,
													)}
												>
													{job.customerName}
												</Link>
											</TableCell>
											<TableCell>{job.title}</TableCell>
											<TableCell>{job.technician}</TableCell>
											<TableCell>
												<JobStatus status={job.status} />
											</TableCell>
											<TableCell>{formatCents(job.amountCents)}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</div>
			</LoadingOverlay>
		</div>
	);
}
