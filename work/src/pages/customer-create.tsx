import { type HttpError, useForm } from "@refinedev/core";
import { CustomerForm } from "../components/customer-form";
import {
	CreateView,
	CreateViewHeader,
} from "../components/refine-ui/views/create-view";
import type { CompanyRecord, CustomerInput } from "../resources";

export function CustomerCreatePage() {
	const { onFinish, formLoading, mutation } = useForm<
		CompanyRecord,
		HttpError,
		CustomerInput
	>({ resource: "companies", action: "create", redirect: "show" });

	return (
		<CreateView>
			<CreateViewHeader resource="companies" title="New customer" />
			<CustomerForm
				initial={{ name: "", domain: "" }}
				submitLabel="Create customer"
				pending={formLoading}
				failure={mutation.error?.message}
				onSubmit={(values) => void onFinish(values)}
			/>
		</CreateView>
	);
}
