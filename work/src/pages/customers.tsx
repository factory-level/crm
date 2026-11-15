import { Button } from "@crm/ui/components/button";
import { Input } from "@crm/ui/components/input";
import { useTable } from "@refinedev/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { DataTable } from "../components/refine-ui/data-table/data-table";
import { DataTableSorter } from "../components/refine-ui/data-table/data-table-sorter";
import {
	ListView,
	ListViewHeader,
} from "../components/refine-ui/views/list-view";
import { formatDay } from "../format";
import type { CompanyRow } from "../resources";
import { WORK } from "../work-config";

export function CustomersPage() {
	const [search, setSearch] = useState("");

	const columns = useMemo<ColumnDef<CompanyRow>[]>(
		() => [
			{
				id: "name",
				accessorKey: "name",
				header: ({ column }) => (
					<div className="flex items-center gap-1">
						<span>Customer</span>
						<DataTableSorter column={column} />
					</div>
				),
				cell: ({ row }) => (
					<Link to={WORK.routes.customer.replace(":id", row.original.id)}>
						{row.original.name}
					</Link>
				),
			},
			{ id: "domain", accessorKey: "domain", header: "Domain" },
			{
				id: "industry",
				accessorKey: "industry",
				header: ({ column }) => (
					<div className="flex items-center gap-1">
						<span>Industry</span>
						<DataTableSorter column={column} />
					</div>
				),
			},
			{
				id: "contacts",
				accessorKey: "contactCount",
				header: "Contacts",
				enableSorting: false,
			},
			{
				id: "deals",
				accessorKey: "openDealCount",
				header: "Open deals",
				enableSorting: false,
			},
			{
				id: "lastActivity",
				accessorKey: "lastActivityAt",
				header: "Last activity",
				enableSorting: false,
				cell: ({ row }) =>
					row.original.lastActivityAt
						? formatDay(row.original.lastActivityAt)
						: null,
			},
			{
				id: "history",
				header: "",
				enableSorting: false,
				cell: ({ row }) => (
					<Button asChild variant="outline" size="sm">
						<Link to={WORK.routes.customer.replace(":id", row.original.id)}>
							History
						</Link>
					</Button>
				),
			},
		],
		[],
	);

	const table = useTable<CompanyRow>({
		columns,
		refineCoreProps: {
			resource: "companies",
			queryOptions: { refetchInterval: WORK.live.refetchMs },
			pagination: { pageSize: WORK.list.pageSize },
			sorters: { initial: [{ field: "name", order: "asc" }] },
			filters: {
				permanent: [{ field: "q", operator: "contains", value: search }],
			},
		},
	});

	return (
		<ListView>
			<ListViewHeader title="Customers" />
			<Input
				aria-label="Search customers"
				placeholder="Search customers"
				value={search}
				onChange={(event) => setSearch(event.target.value)}
			/>
			<DataTable table={table} />
		</ListView>
	);
}
