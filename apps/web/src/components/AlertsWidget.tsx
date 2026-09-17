import { useState, useEffect } from "react";
import { Badge, IconButton, Popover, List, ListItem, ListItemText, Typography, Box, Chip } from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import { api } from "../../lib/api";

export function AlertsWidget() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  async function loadAlerts() {
    try {
      const res = await api.get("/mx/alerts");
      setAlerts(res.data.data);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    void loadAlerts();
    const iv = setInterval(loadAlerts, 60000); // refresh every minute
    return () => clearInterval(iv);
  }, []);

  const open = Boolean(anchorEl);
  const id = open ? "alerts-popover" : undefined;

  return (
    <>
      <IconButton color="inherit" onClick={(e) => setAnchorEl(e.currentTarget)}>
        <Badge badgeContent={alerts.length} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>
      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { width: 350, maxHeight: 400 } } }}
      >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
          <Typography variant="subtitle1" fontWeight={700}>System Alerts</Typography>
        </Box>
        <List sx={{ p: 0 }}>
          {alerts.map((a, i) => (
            <ListItem key={i} divider sx={{ alignItems: "flex-start", py: 1.5 }}>
              <ListItemText
                primary={
                  <Box display="flex" justifyContent="space-between" mb={0.5}>
                    <Typography variant="body2" fontWeight={600}>{a.alert_type.replace(/_/g, " ").toUpperCase()}</Typography>
                    <Chip size="small" label={a.severity} color={a.severity === "critical" ? "error" : a.severity === "warning" ? "warning" : "info"} sx={{ height: 20, fontSize: 10 }} />
                  </Box>
                }
                secondary={
                  <Typography variant="caption" color="text.secondary" display="block">
                    {a.message}
                  </Typography>
                }
              />
            </ListItem>
          ))}
          {alerts.length === 0 && (
            <ListItem sx={{ py: 3 }}>
              <Typography variant="body2" color="text.secondary" textAlign="center" width="100%">
                No active alerts.
              </Typography>
            </ListItem>
          )}
        </List>
      </Popover>
    </>
  );
}
