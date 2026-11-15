import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { Input } from "@crm/ui/components/input";
import { Label } from "@crm/ui/components/label";
import { useLogin } from "@refinedev/core";
import { type FormEvent, useState } from "react";
import { WORK } from "../work-config";

export function LoginPage() {
	const [email, setEmail] = useState<string>(WORK.login.email);
	const [password, setPassword] = useState<string>(WORK.login.password);
	const { mutate: login, isPending, data } = useLogin();
	const failure = data?.success === false ? data.error?.message : undefined;

	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		login({ email, password });
	};

	return (
		<main className="flex min-h-svh items-center justify-center p-6">
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle>Sign in to InferOps</CardTitle>
					<CardDescription>
						This is a dummy login against the mock InferOps API. Any email and
						password work.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form className="flex flex-col gap-4" onSubmit={submit}>
						<div className="flex flex-col gap-2">
							<Label htmlFor="email">Email</Label>
							<Input
								id="email"
								type="email"
								autoComplete="username"
								value={email}
								onChange={(event) => setEmail(event.target.value)}
							/>
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor="password">Password</Label>
							<Input
								id="password"
								type="password"
								autoComplete="current-password"
								value={password}
								onChange={(event) => setPassword(event.target.value)}
							/>
						</div>
						{failure ? (
							<Alert variant="destructive">
								<AlertTitle>Sign-in failed</AlertTitle>
								<AlertDescription>{failure}</AlertDescription>
							</Alert>
						) : null}
						<Button type="submit" disabled={isPending}>
							Sign in
						</Button>
					</form>
				</CardContent>
			</Card>
		</main>
	);
}
