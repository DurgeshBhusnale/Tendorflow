import { createBrowserRouter } from "react-router-dom";
import { AdminRoute } from "@/auth/AdminRoute";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import PortalsPage from "@/pages/admin/PortalsPage";
import TenderNamesPage from "@/pages/admin/TenderNamesPage";
import UsersPage from "@/pages/admin/UsersPage";
import ClientsPage from "@/pages/clients/ClientsPage";
import DashboardPage from "@/pages/DashboardPage";
import LoginPage from "@/pages/LoginPage";

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
          {
            element: <AdminRoute />,
            children: [
              { path: "/admin/users", element: <UsersPage /> },
              { path: "/admin/portals", element: <PortalsPage /> },
              { path: "/admin/tender-names", element: <TenderNamesPage /> },
            ],
          },
        ],
      },
    ],
  },
]);
