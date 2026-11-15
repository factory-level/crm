import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { Button } from "@crm/ui/components/button";
import { Card, CardContent } from "@crm/ui/components/card";
import { Input } from "@crm/ui/components/input";
import { Label } from "@crm/ui/components/label";
import { type FormEvent, useState } from "react";
import { type CustomerInput, customerInput } from "../resources";

type CustomerFormProps = {
	initial: CustomerInput;
	submitLabel: string;
	pending: boolean;
	failure: string | undefined;
	onSubmit: (values: CustomerInput) => void;
};

export function CustomerForm({
	initial,
	submitLabel,
	pending,
	failure,
	onSubmit,
}: CustomerFormProps) {
	const [name, setName] = useState(initial.name);
	const [domain, setDomain] = useState(initial.domain);
	const [invalid, setInvalid] = useState<string>();

	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const parsed = customerInput.safeParse({ name, domain });
		setInvalid(parsed.success ? undefined : parsed.error.issues[0]?.message);
		if (parsed.success) onSubmit(parsed.data);
	};

	const problem = invalid ?? failure;

	return (
		<Card>
			<CardContent>
				<form className="flex max-w-md flex-col gap-4" onSubmit={submit}>
					<div className="flex flex-col gap-2">
						<Label htmlFor="customer-name">Name</Label>
						<Input
							id="customer-name"
							value={name}
							onChange={(event) => setName(event.target.value)}
						/>
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="customer-domain">Domain</Label>
						<Input
							id="customer-domain"
							placeholder="example.com"
							value={domain}
							onChange={(event) => setDomain(event.target.value)}
						/>
					</div>
					{problem ? (
						<Alert variant="destructive">
							<AlertTitle>The customer was not saved</AlertTitle>
							<AlertDescription>{problem}</AlertDescription>
						</Alert>
					) : null}
					<div>
						<Button type="submit" disabled={pending}>
							{submitLabel}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
