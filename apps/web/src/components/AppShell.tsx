import {
  Box,
  Button,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Chip,
} from "@mui/material";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import StyleOutlinedIcon from "@mui/icons-material/StyleOutlined";
import ContentCutOutlinedIcon from "@mui/icons-material/ContentCutOutlined";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import SyncOutlinedIcon from "@mui/icons-material/SyncOutlined";
import PersonAddOutlinedIcon from "@mui/icons-material/PersonAddOutlined";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { clearAuthToken } from "../lib/auth";
import { useAuthGate } from "./AuthGate.tsx";
import { useEffect } from "react";
import { startSyncWorker } from "../offline/syncWorker";

const drawerWidth = 260;

const nav = [
  { to: "/", label: "Stock Dashboard", icon: <DashboardOutlinedIcon /> },
  { to: "/masters", label: "Masters", icon: <CategoryOutlinedIcon /> },
  { to: "/rolls", label: "Supplier Rolls", icon: <StyleOutlinedIcon /> },
  { to: "/challans", label: "Delivery Challans", icon: <ArticleOutlinedIcon /> },
  { to: "/challans/new", label: "New Challan", icon: <ArticleOutlinedIcon /> },
  { to: "/floor/cutting", label: "Floor App", icon: <ContentCutOutlinedIcon />, highlight: true },
  { to: "/device", label: "Device & Sync", icon: <SyncOutlinedIcon /> },
  { to: "/users", label: "Users", icon: <PersonAddOutlinedIcon />, adminOnly: true },
];

export function AppShell() {
  const loc = useLocation();
  const navigate = useNavigate();
  const authGate = useAuthGate();
  const authEnabled = authGate.enabled;
  const showUsersNav = authEnabled && authGate.session?.role === "admin";

  useEffect(() => {
    startSyncWorker(15000);
  }, []);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": { width: drawerWidth, boxSizing: "border-box" },
        }}
      >
        <Toolbar sx={{ px: 2, flexDirection: "column", alignItems: "stretch", gap: 1, py: 2 }}>
          <Box>
            <Typography fontWeight={900} lineHeight={1.1}>
              Maxwell Trading
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Offline-first cloth stock
            </Typography>
          </Box>
          <Chip size="small" label={navigator.onLine ? "Online" : "Offline"} color={navigator.onLine ? "success" : "warning"} />
          {authEnabled ? (
            <Button
              size="small"
              variant="outlined"
              startIcon={<LogoutOutlinedIcon />}
              onClick={() => {
                clearAuthToken();
                navigate("/login", { replace: true });
              }}
            >
              Sign out
            </Button>
          ) : null}
        </Toolbar>
        <Divider />
        <List dense sx={{ px: 1, py: 1 }}>
          {nav
            .filter((n) => (n.adminOnly ? showUsersNav : true))
            .map((n) => (
              <ListItemButton
                key={n.to}
                component={Link}
                to={n.to}
                selected={n.to === "/" ? loc.pathname === "/" : loc.pathname === n.to || loc.pathname.startsWith(n.to + "/")}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  ...(n.highlight ? { bgcolor: "primary.main", color: "primary.contrastText", "&:hover": { bgcolor: "primary.dark" }, "&.Mui-selected": { bgcolor: "primary.dark" } } : {}),
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>{n.icon}</ListItemIcon>
                <ListItemText primary={n.label} primaryTypographyProps={{ fontWeight: 600 }} />
              </ListItemButton>
            ))}
        </List>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, px: 3, py: 2 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
