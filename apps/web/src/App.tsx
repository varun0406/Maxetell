import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell.tsx";
import { FloorShell } from "./components/FloorShell.tsx";
import { AuthGate } from "./components/AuthGate.tsx";
import { LoginPage } from "./pages/LoginPage.tsx";
import {
  AnalyticsPage,
  MastersPage,
  RollsPage,
  SettingsSyncPage,
  UsersAdminPage,
} from "./pages/admin/AdminPages.tsx";
import { ItemCatalogPage } from "./pages/admin/ItemCatalogPage.tsx";
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
            <Route path="masters" element={<MastersPage />} />
            <Route path="rolls" element={<RollsPage />} />
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
