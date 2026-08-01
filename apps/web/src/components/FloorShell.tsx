import { Link, Outlet, useLocation } from "react-router-dom";
import ContentCutIcon from "@mui/icons-material/ContentCut";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import SyncIcon from "@mui/icons-material/Sync";
import { useEffect } from "react";
import { startSyncWorker } from "../offline/syncWorker";
import "../pages/floor/floor.css";

const tabs = [
  { to: "/floor/cutting", label: "Cut", icon: <ContentCutIcon fontSize="small" /> },
  { to: "/floor/parcel", label: "Parcel", icon: <Inventory2Icon fontSize="small" /> },
  { to: "/floor/godown", label: "Godown", icon: <WarehouseIcon fontSize="small" /> },
  { to: "/floor/dispatch", label: "Dispatch", icon: <LocalShippingIcon fontSize="small" /> },
];

export function FloorShell() {
  const loc = useLocation();

  useEffect(() => {
    startSyncWorker(15000);
  }, []);

  return (
    <div className="floor-root">
      <header className="floor-header">
        <span className="floor-title">Maxwell Floor</span>
        <Link to="/device" style={{ color: "var(--mx-muted)", display: "flex" }} title="Sync & printer">
          <SyncIcon />
        </Link>
      </header>
      <main className="floor-main">
        <Outlet />
      </main>
      <nav className="floor-bottom-nav">
        {tabs.map((t) => (
          <Link key={t.to} to={t.to} className={loc.pathname === t.to ? "active" : ""}>
            {t.icon}
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
