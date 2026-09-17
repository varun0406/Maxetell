import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell.tsx";
import { FloorShell } from "./components/FloorShell.tsx";
import { AuthGate } from "./components/AuthGate.tsx";
import { LoginPage } from "./pages/LoginPage.tsx";
import {
  AnalyticsPage,
  SettingsSyncPage,
  UsersAdminPage,
} from "./pages/admin/AdminPages.tsx";
import { ItemCatalogPage } from "./pages/admin/ItemCatalogPage.tsx";
import { SuppliersModule } from "./pages/admin/SuppliersModule.tsx";
import { JobWorkModule } from "./pages/admin/JobWorkModule.tsx";
import { JobWorkerAccountPage } from "./pages/admin/JobWorkerAccountPage.tsx";
import { CoordinatorBoard } from "./pages/admin/CoordinatorBoard.tsx";
import { DispatcherBoard } from "./pages/admin/DispatcherBoard.tsx";
import { PartiesModule } from "./pages/admin/PartiesModule.tsx";
import { PartyAccountPage } from "./pages/admin/PartyAccountPage.tsx";
import { SupplierAccountPage } from "./pages/admin/SupplierAccountPage.tsx";
import { AccountsWorkspace } from "./pages/admin/AccountsWorkspace.tsx";
import { AgentsModule } from "./pages/admin/AgentsModule.tsx";
import { GodownsModule } from "./pages/admin/GodownsModule.tsx";
import { ChallansListPage } from "./pages/admin/ChallansListPage.tsx";
import {
  AdminChallanCreatePage,
  FloorChallanPage,
  GodownReceivePage,
  ParcelPage,
} from "./pages/floor/FloorPages.tsx";
import { CuttingStationPage } from "./pages/floor/CuttingStationPage.tsx";

export default function App() {
  return (
    <BrowserRouter>
      <AuthGate>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<AppShell />}>
            <Route index element={<ItemCatalogPage />} />
            <Route path="dashboard" element={<AnalyticsPage />} />
            <Route path="items" element={<ItemCatalogPage />} />
            <Route path="suppliers" element={<SuppliersModule />} />
            <Route path="suppliers/account/:id" element={<SupplierAccountPage />} />
            <Route path="accounts" element={<AccountsWorkspace />} />
            <Route path="job-work" element={<JobWorkModule />} />
            <Route path="job-work/worker/:id" element={<JobWorkerAccountPage />} />
            <Route path="coordinator" element={<CoordinatorBoard />} />
            <Route path="dispatcher" element={<DispatcherBoard />} />
            <Route path="parties" element={<PartiesModule />} />
            <Route path="parties/account/:id" element={<PartyAccountPage />} />
            <Route path="agents" element={<AgentsModule />} />
            <Route path="godowns" element={<GodownsModule />} />
            <Route path="challans" element={<ChallansListPage />} />
            <Route path="challans/new" element={<AdminChallanCreatePage />} />
            <Route path="device" element={<SettingsSyncPage />} />
            <Route path="users" element={<UsersAdminPage />} />
          </Route>
          <Route path="/floor" element={<FloorShell />}>
            <Route index element={<Navigate to="/floor/cutting" replace />} />
            <Route path="cutting" element={<CuttingStationPage />} />
            <Route path="parcel" element={<ParcelPage />} />
            <Route path="godown" element={<GodownReceivePage />} />
            <Route path="dispatch" element={<FloorChallanPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthGate>
    </BrowserRouter>
  );
}
