import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { api } from "../../lib/api";

function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2,
        bgcolor: "action.hover",
        border: "1px solid",
        borderColor: "divider",
        minWidth: 0,
      }}
    >
      <Typography variant="caption" color="text.secondary" display="block" sx={{ letterSpacing: 0.06, textTransform: "uppercase" }}>
        {label}
      </Typography>
      <Typography fontWeight={800} fontSize="1.15rem" color={accent || "text.primary"} sx={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </Typography>
    </Box>
  );
}

export function ItemCatalogPage() {
  const [items, setItems] = useState<any[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<any>(null);

  async function loadList() {
    const r = await api.get("/mx/analytics/by-item");
    setItems(r.data.data ?? []);
  }

  async function openItem(id: number) {
    setOpenId(id);
    const r = await api.get(`/mx/analytics/item/${id}`);
    setDetail(r.data.data);
  }

  useEffect(() => {
    void loadList();
  }, []);

  if (openId && detail) {
    const { item, variants, lots } = detail;
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => { setOpenId(null); setDetail(null); }} sx={{ mb: 2 }}>
          All items
        </Button>

        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 3 },
            mb: 3,
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
            background: "linear-gradient(135deg, rgba(25,118,210,0.08), rgba(0,0,0,0))",
          }}
        >
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={2}>
            <Box>
              <Typography variant="overline" color="primary" fontWeight={700}>
                Item
              </Typography>
              <Typography variant="h4" fontWeight={900} letterSpacing={-0.5}>
                {item.code}
              </Typography>
              <Typography variant="h6" color="text.secondary" fontWeight={500}>
                {item.name}
                {item.quality ? ` · ${item.quality}` : ""}
              </Typography>
            </Box>
            <Chip label={`${variants.length} variants`} color="primary" variant="outlined" />
          </Stack>
        </Paper>

        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, letterSpacing: 0.08, textTransform: "uppercase" }}>
          Variants
        </Typography>
        <Grid container spacing={2} mb={4}>
          {variants.map((v: any) => (
            <Grid key={v.variant_code} size={{ xs: 12, md: 6 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  height: "100%",
                  borderRadius: 3,
                  border: "1px solid",
                  borderColor: "divider",
                  transition: "border-color .15s, box-shadow .15s",
                  "&:hover": { borderColor: "primary.main", boxShadow: 2 },
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Box>
                    <Typography fontFamily="monospace" fontWeight={800} fontSize="1.25rem">
                      {v.variant_code}
                    </Typography>
                    <Typography color="text.secondary">
                      {v.variant_name}
                      {v.color ? ` · ${v.color}` : ""}
                    </Typography>
                  </Box>
                  <Chip size="small" label={`${v.roll_count} lots`} />
                </Stack>
                <Grid container spacing={1}>
                  <Grid size={4}>
                    <Metric label="Available" value={`${Number(v.available_m).toFixed(0)} m`} accent="success.main" />
                  </Grid>
                  <Grid size={4}>
                    <Metric label="On lots" value={`${Number(v.roll_remaining_m).toFixed(0)} m`} />
                  </Grid>
                  <Grid size={4}>
                    <Metric label="At mill" value={`${Number(v.mill_wip_m).toFixed(0)} m`} accent="warning.main" />
                  </Grid>
                  <Grid size={4}>
                    <Metric label="Godown" value={`${Number(v.godown_m).toFixed(0)} m`} />
                  </Grid>
                  <Grid size={4}>
                    <Metric label="Packed" value={`${Number(v.packed_m).toFixed(0)} m`} />
                  </Grid>
                  <Grid size={4}>
                    <Metric label="Dispatched" value={`${Number(v.dispatched_m).toFixed(0)} m`} />
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          ))}
          {!variants.length && (
            <Grid size={12}>
              <Typography color="text.secondary">No variants for this item</Typography>
            </Grid>
          )}
        </Grid>

        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, letterSpacing: 0.08, textTransform: "uppercase" }}>
          Lots / job IDs
        </Typography>
        <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Lot no</TableCell>
                <TableCell>Job ID</TableCell>
                <TableCell>Variant</TableCell>
                <TableCell>Supplier</TableCell>
                <TableCell align="right">Remaining</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lots.map((l: any) => (
                <TableRow key={l.job_id} hover>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{l.lot_no}</TableCell>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{String(l.job_id).slice(0, 8).toUpperCase()}</TableCell>
                  <TableCell>{l.variant_code}</TableCell>
                  <TableCell>{l.supplier_name}</TableCell>
                  <TableCell align="right">
                    {Number(l.remaining_meterage).toFixed(1)} / {Number(l.original_meterage).toFixed(0)}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={l.status} />
                  </TableCell>
                </TableRow>
              ))}
              {!lots.length && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ color: "text.secondary" }}>
                    No lots yet — stock in with a lot number
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight={900} letterSpacing={-0.5} gutterBottom>
        Items
      </Typography>
      <Typography color="text.secondary" mb={3}>
        Open an item to see every variant module with stock analysis and lot / job IDs.
      </Typography>

      <Grid container spacing={2}>
        {items.map((it) => (
          <Grid key={it.id} size={{ xs: 12, sm: 6, lg: 4 }}>
            <Paper
              elevation={0}
              onClick={() => void openItem(it.id)}
              sx={{
                p: 2.5,
                borderRadius: 3,
                border: "1px solid",
                borderColor: "divider",
                cursor: "pointer",
                height: "100%",
                transition: "transform .12s, border-color .12s, box-shadow .12s",
                "&:hover": {
                  transform: "translateY(-2px)",
                  borderColor: "primary.main",
                  boxShadow: 3,
                },
              }}
            >
              <Typography variant="overline" color="primary" fontWeight={700}>
                {it.code}
              </Typography>
              <Typography variant="h6" fontWeight={800} gutterBottom>
                {it.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                {it.quality || "—"} · {it.variant_count} variants
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" color="success" variant="outlined" label={`${Number(it.available_m).toFixed(0)} m avail`} />
                <Chip size="small" variant="outlined" label={`${Number(it.roll_remaining_m).toFixed(0)} m on lots`} />
                <Chip size="small" variant="outlined" label={`${Number(it.dispatched_m).toFixed(0)} m out`} />
              </Stack>
            </Paper>
          </Grid>
        ))}
        {!items.length && (
          <Grid size={12}>
            <Typography color="text.secondary">No items yet — add them under Masters, then Load demo data.</Typography>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
