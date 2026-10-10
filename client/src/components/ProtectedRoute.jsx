import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/auth";
import { PageSpinner } from "./Spinner";

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageSpinner />;
  if (!user) {
    // Keep the hash too: transfer links carry their token in it
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }
  return <Outlet />;
}
