import { TooltipProvider } from "@crm/ui/components/tooltip";
import { Refine } from "@refinedev/core";
import routerProvider, {
	CatchAllNavigate,
	NavigateToResource,
} from "@refinedev/react-router";
import { Building2, LayoutDashboard } from "lucide-react";
import { BrowserRouter, Outlet, Route, Routes } from "react-router";
import { ErrorComponent } from "./components/refine-ui/layout/error-component";
import { Layout } from "./components/refine-ui/layout/layout";
import { Toaster } from "./components/refine-ui/notification/toaster";
import { useNotificationProvider } from "./components/refine-ui/notification/use-notification-provider";
import { SessionGate } from "./components/session-gate";
import { CustomerCreatePage } from "./pages/customer-create";
import { CustomerEditPage } from "./pages/customer-edit";
import { CustomerHistoryPage } from "./pages/customer-history";
import { CustomersPage } from "./pages/customers";
import { DashboardPage } from "./pages/dashboard";
import { LoginPage } from "./pages/login";
import { inferopsAuthProvider } from "./providers/auth-provider";
import { crmDataProvider } from "./providers/crm-data-provider";
import {
	inferopsDataProvider,
	JOBS_RESOURCE,
} from "./providers/inferops-data-provider";
import { createRestClient } from "./providers/rest-client";
import { TIMELINE_RESOURCE } from "./resources";
import { WORK } from "./work-config";

const request = createRestClient("", (input, init) => fetch(input, init));
const dataProviders = {
	default: crmDataProvider(request),
	inferops: inferopsDataProvider(request),
};
const authProvider = inferopsAuthProvider(request);

const resources = [
	{
		name: "dashboard",
		list: WORK.routes.dashboard,
		meta: { label: "Dashboard", icon: <LayoutDashboard /> },
	},
	{
		name: "companies",
		list: WORK.routes.customers,
		create: WORK.routes.customerCreate,
		show: WORK.routes.customer,
		edit: WORK.routes.customerEdit,
		meta: { label: "Customers", icon: <Building2 /> },
	},
	{ name: TIMELINE_RESOURCE },
	{ name: JOBS_RESOURCE, meta: { dataProviderName: "inferops" } },
];

export function App() {
	return (
		<BrowserRouter>
			<TooltipProvider>
				<Refine
					dataProvider={dataProviders}
					authProvider={authProvider}
					routerProvider={routerProvider}
					notificationProvider={useNotificationProvider()}
					resources={resources}
					options={{
						disableTelemetry: true,
						title: { text: "CRM Work" },
					}}
				>
					<Routes>
						<Route
							element={
								<SessionGate
									fallback={<CatchAllNavigate to={WORK.routes.login} />}
								>
									<Layout>
										<Outlet />
									</Layout>
								</SessionGate>
							}
						>
							<Route index element={<DashboardPage />} />
							<Route path={WORK.routes.customers} element={<CustomersPage />} />
							<Route
								path={WORK.routes.customerCreate}
								element={<CustomerCreatePage />}
							/>
							<Route
								path={WORK.routes.customer}
								element={<CustomerHistoryPage />}
							/>
							<Route
								path={WORK.routes.customerEdit}
								element={<CustomerEditPage />}
							/>
							<Route path="*" element={<ErrorComponent />} />
						</Route>
						<Route
							element={
								<SessionGate fallback={<Outlet />}>
									<NavigateToResource resource="dashboard" />
								</SessionGate>
							}
						>
							<Route path={WORK.routes.login} element={<LoginPage />} />
						</Route>
					</Routes>
					<Toaster />
				</Refine>
			</TooltipProvider>
		</BrowserRouter>
	);
}
