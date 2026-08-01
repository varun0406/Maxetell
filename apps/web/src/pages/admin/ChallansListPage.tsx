import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Alert,
} from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { api } from "../../lib/api";
import { printDeliveryChallan } from "../../lib/print/docs";

export function ChallansListPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const r = await api.get("/mx/challans", { params: filter ? { status: filter } : {} });
    setRows(r.data.data ?? []);
  }

  useEffect(() => {
    void load();
  }, [filter]);

  async function printOne(id: string) {
    try {
      const r = await api.get(`/mx/challans/${id}`);
      printDeliveryChallan(r.data.data);
    } catch {
      setMsg("Could not load challan for PDF");
    }
  }

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" mb={2} gap={1}>
        <Box>
          <Typography variant="h5" fontWeight={800}>
            Delivery Challans
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Open challan PDF — print or Save as PDF from the browser dialog
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <TextField select size="small" label="Status" value={filter} onChange={(e) => setFilter(e.target.value)} sx={{ minWidth: 140 }}>
            <MenuItem value="">All</MenuItem>
            {["created", "assigned", "assembling", "dispatched", "delivered"].map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>
          <Button variant="contained" component={RouterLink} to="/challans/new">
            New challan
          </Button>
        </Stack>
      </Stack>
      {msg && <Alert severity="error" sx={{ mb: 2 }}>{msg}</Alert>}
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Challan</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Party</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Scans</TableCell>
              <TableCell align="right">PDF</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.challan_id} hover>
                <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{c.challan_no}</TableCell>
                <TableCell>{c.challan_date}</TableCell>
                <TableCell>{c.party_name || c.addr_party || "—"}</TableCell>
                <TableCell>
                  <Chip size="small" label={c.status} color={c.status === "dispatched" ? "success" : c.status === "assembling" ? "warning" : "default"} />
                </TableCell>
                <TableCell align="right">{c.scan_count}</TableCell>
                <TableCell align="right">
                  <Button size="small" startIcon={<PictureAsPdfIcon />} onClick={() => void printOne(c.challan_id)}>
                    PDF
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ color: "text.secondary" }}>
                  No challans
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
