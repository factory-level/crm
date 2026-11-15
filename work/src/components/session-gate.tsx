import { useIsAuthenticated } from "@refinedev/core";
import type { ReactNode } from "react";

type SessionGateProps = {
	children: ReactNode;
	fallback: ReactNode;
};

export function SessionGate({ children, fallback }: SessionGateProps) {
	const { data, isLoading } = useIsAuthenticated();

	if (isLoading) return null;

	return data?.authenticated ? children : fallback;
}
