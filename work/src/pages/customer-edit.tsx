import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { Button } from "@crm/ui/components/button";
import {
	type HttpError,
	useDelete,
	useForm,
	useNavigation,
} from "@refinedev/core";
import { useParams } from "react-router";
import { CustomerForm } from "../components/customer-form";
import { LoadingOverlay } from "../components/refine-ui/layout/loading-overlay";
import {
	EditView,
	EditViewHeader,
} from "../components/refine-ui/views/edit-view";
import type { CompanyRecord, CustomerInput } from "../resources";

export function CustomerEditPage() {
	const { id = "" } = useParams();
	const { list } = useNavigation();
	const { onFinish, formLoading, mutation, query } = useForm<
		CompanyRecord,
		HttpError,
		CustomerInput
	>({ resource: "companies", action: "edit", id, redirect: "show" });
	const archive = useDelete<CompanyRecord, HttpError>();
	const record = query?.data?.data;
	const loadFailure = query?.error?.message;

	const archiveCustomer = () =>
		archive.mutate(
			{
				resource: "companies",
				id,
				successNotification: {
					type: "success",
					message: "Customer archived",
					description: "Restore it from the Archived view in the CRM.",
				},
			},
			{ onSuccess: () => list("companies") },
		);

	return (
		<EditView>
			<EditViewHeader
				resource="companies"
				title={record ? `Edit ${record.name}` : "Edit customer"}
			/>
			{loadFailure ? (
				<Alert variant="destructive">
					<AlertTitle>The customer did not load</AlertTitle>
					<AlertDescription>{loadFailure}</AlertDescription>
				</Alert>
			) : null}
			<LoadingOverlay loading={!record && !loadFailure}>
				{record ? (
					<div className="flex flex-col gap-4">
						<CustomerForm
							key={record.id}
							initial={{ name: record.name, domain: record.domain ?? "" }}
							submitLabel="Save customer"
							pending={formLoading}
							failure={mutation.error?.message}
							onSubmit={(values) => void onFinish(values)}
						/>
						<div>
							<Button
								variant="outline"
								disabled={archive.mutation.isPending}
								onClick={archiveCustomer}
							>
								Archive customer
							</Button>
						</div>
					</div>
				) : null}
			</LoadingOverlay>
		</EditView>
	);
}
