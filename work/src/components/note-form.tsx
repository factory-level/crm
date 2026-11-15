import { Button } from "@crm/ui/components/button";
import { Input } from "@crm/ui/components/input";
import { type HttpError, useCreate } from "@refinedev/core";
import { type FormEvent, useState } from "react";
import { noteInput, TIMELINE_RESOURCE } from "../resources";
import { WORK } from "../work-config";

export function NoteForm({ companyId }: { companyId: string }) {
	const [body, setBody] = useState("");
	const [problem, setProblem] = useState<string>();
	const { mutate, mutation } = useCreate<{ id: string }, HttpError>();

	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const parsed = noteInput.safeParse({ body });
		setProblem(parsed.success ? undefined : parsed.error.issues[0]?.message);
		if (!parsed.success) return;

		mutate(
			{
				resource: TIMELINE_RESOURCE,
				values: { type: WORK.note.type, body: parsed.data.body, companyId },
				successNotification: {
					type: "success",
					message: "Note saved to the CRM",
				},
			},
			{ onSuccess: () => setBody("") },
		);
	};

	return (
		<form className="flex flex-col gap-2" onSubmit={submit}>
			<div className="flex gap-2">
				<Input
					aria-label="Note for the CRM"
					placeholder="Write a note. It is saved to the CRM timeline."
					value={body}
					onChange={(event) => setBody(event.target.value)}
				/>
				<Button type="submit" disabled={mutation.isPending}>
					Add note
				</Button>
			</div>
			{problem ? (
				<p role="alert" className="text-13 text-status-danger-text">
					{problem}
				</p>
			) : null}
		</form>
	);
}
