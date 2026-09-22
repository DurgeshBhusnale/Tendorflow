import { createBrowserRouter } from "react-router-dom";
import { AdminRoute } from "@/auth/AdminRoute";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import PortalsPage from "@/pages/admin/PortalsPage";
import TenderDepartmentsPage from "@/pages/admin/TenderDepartmentsPage";
import UsersPage from "@/pages/admin/UsersPage";
import ClientsPage from "@/pages/clients/ClientsPage";
import CredentialsPage from "@/pages/credentials/CredentialsPage";
import DscPage from "@/pages/dsc/DscPage";
import EmdPage from "@/pages/emd/EmdPage";
import ExpensesPage from "@/pages/expenses/ExpensesPage";
import TendersPage from "@/pages/tenders/TendersPage";
import DashboardPage from "@/pages/DashboardPage";
import LoginPage from "@/pages/LoginPage";
import NotFoundPage from "@/pages/NotFoundPage";

export const router = createBrowserRouter([
  { path: "/", element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/dashboard", element: <DashboardPage /> },
          { path: "/clients", element: <ClientsPage /> },
          { path: "/credentials", element: <CredentialsPage /> },
          { path: "/tenders", element: <TendersPage /> },
          { path: "/emd", element: <EmdPage /> },
          { path: "/dsc", element: <DscPage /> },
          {
            element: <AdminRoute />,
            children: [
              { path: "/expenses", element: <ExpensesPage /> },
              { path: "/admin/users", element: <UsersPage /> },
              { path: "/admin/portals", element: <PortalsPage /> },
              { path: "/admin/tender-departments", element: <TenderDepartmentsPage /> },
            ],
          },
          // Every unmatched path, now that the host serves index.html for
          // all of them so reloads and pasted links work.
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
