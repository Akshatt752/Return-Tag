import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import FoundTag from "./pages/FoundTag";
import FinderChat from "./pages/FinderChat";
import FindCode from "./pages/FindCode";
import Dashboard from "./pages/Dashboard";
import NewTag from "./pages/NewTag";
import TagDetail from "./pages/TagDetail";
import PrintTag from "./pages/PrintTag";
import Claim from "./pages/Claim";
import Transfer from "./pages/Transfer";
import Inbox from "./pages/Inbox";
import OwnerChat from "./pages/OwnerChat";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import PrintBatch from "./pages/PrintBatch";
import NotFound from "./pages/NotFound";

function ScrollToTop() {
  const { pathname } = useLocation();
  // Braces matter: newer browsers return a Promise from scrollTo, and React treats
  // anything an effect returns as its cleanup function
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Auth mode="login" />} />
          <Route path="/register" element={<Auth mode="register" />} />
          <Route path="/t/:code" element={<FoundTag />} />
          <Route path="/r/:id" element={<FinderChat />} />
          <Route path="/found" element={<FindCode />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/tags/new" element={<NewTag />} />
            <Route path="/tags/:id" element={<TagDetail />} />
            <Route path="/tags/:id/print" element={<PrintTag />} />
            <Route path="/claim" element={<Claim />} />
            <Route path="/transfer" element={<Transfer />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/inbox/:id" element={<OwnerChat />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/batches/:id/print" element={<PrintBatch />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
