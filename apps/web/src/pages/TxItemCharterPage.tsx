import { useEffect, useState } from "react";
import {
  Box, Button, Chip, Collapse, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, IconButton, Paper, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { api } from "../lib/api";

type Variant = { id: number; item_id: number; variant_code: string; variant_name: string; color?: string };
type Item = { id: number; code: string; name: string; variants: Variant[] };

// ── Dialogs ──────────────────────────────────────────────────────────────────
function ItemDialog({ open, onClose, onSave, init }: { open: boolean; onClose: () => void; onSave: (v: any) => void; init?: Item }) {
  const [code, setCode] = useState(init?.code ?? "");
  const [name, setName] = useState(init?.name ?? "");
  useEffect(() => { setCode(init?.code ?? ""); setName(init?.name ?? ""); }, [init]);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{init ? "Edit Item" : "New Item"}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
        <TextField label="Item Code (2-5 chars)" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} inputProps={{ maxLength: 5 }} required helperText='e.g. "1" or "CR"' />
        <TextField label="Item Name" value={name} onChange={(e) => setName(e.target.value)} required helperText='e.g. "Carens"' />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => { if (code && name) onSave({ code, name }); }}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

function VariantDialog({ open, onClose, onSave, item }: { open: boolean; onClose: () => void; onSave: (v: any) => void; item: Item }) {
  const [vc, setVc] = useState("");
  const [vn, setVn] = useState("");
  const [color, setColor] = useState("");
  useEffect(() => { if (open) { setVc(""); setVn(""); setColor(""); } }, [open]);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Add Variant to "{item.name}"</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
        <TextField label="Variant Code" value={vc} onChange={(e) => setVc(e.target.value)} required
          helperText={`Full code, e.g. "${item.code}-a" or "${item.code}-1"`} />
        <TextField label="Variant Name" value={vn} onChange={(e) => setVn(e.target.value)} required helperText='e.g. "Light Blue"' />
        <TextField label="Color (optional)" value={color} onChange={(e) => setColor(e.target.value)} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => { if (vc && vn) onSave({ variant_code: vc, variant_name: vn, color }); }}>Add</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function TxItemCharterPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [itemDlg, setItemDlg] = useState(false);
  const [editItem, setEditItem] = useState<Item | undefined>();
  const [variantDlg, setVariantDlg] = useState<Item | null>(null);

  const load = () => api.get<{ data: Item[] }>("/tx/items").then((r) => setItems(r.data.data ?? []));
  useEffect(() => { load(); }, []);

  const toggleExpand = (id: number) =>
    setExpanded((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const handleSaveItem = async (body: any) => {
    if (editItem) await api.put(`/tx/items/${editItem.id}`, body);
    else await api.post("/tx/items", body);
    setItemDlg(false); setEditItem(undefined); load();
  };
  const handleDeleteItem = async (id: number) => {
    if (!confirm("Delete this item and all its variants?")) return;
    await api.delete(`/tx/items/${id}`); load();
  };
  const handleAddVariant = async (item: Item, body: any) => {
    await api.post(`/tx/items/${item.id}/variants`, body);
    setVariantDlg(null); load();
  };
  const handleDeleteVariant = async (id: number) => {
    if (!confirm("Delete this variant?")) return;
    await api.delete(`/tx/variants/${id}`); load();
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={800}>Item Charter</Typography>
          <Typography variant="body2" color="text.secondary">Master list of items and their colour/variant codes</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditItem(undefined); setItemDlg(true); }}>
          New Item
        </Button>
      </Stack>

      <Stack spacing={2}>
        {items.length === 0 && (
          <Paper sx={{ p: 4, textAlign: "center" }}>
            <Typography color="text.secondary">No items yet. Create your first item above.</Typography>
          </Paper>
        )}
        {items.map((item) => (
          <Paper key={item.id} variant="outlined" sx={{ overflow: "hidden" }}>
            <Stack direction="row" alignItems="center" px={2} py={1.5} sx={{ bgcolor: "background.default" }}>
              <Chip label={item.code} size="small" color="primary" sx={{ fontWeight: 700, mr: 1.5, minWidth: 40, fontFamily: "monospace" }} />
              <Typography fontWeight={700} sx={{ flexGrow: 1 }}>{item.name}</Typography>
              <Chip label={`${item.variants.length} variant${item.variants.length !== 1 ? "s" : ""}`} size="small" sx={{ mr: 1 }} />
              <Tooltip title="Edit item">
                <IconButton size="small" onClick={() => { setEditItem(item); setItemDlg(true); }}><EditOutlinedIcon fontSize="small" /></IconButton>
              </Tooltip>
              <Tooltip title="Add variant">
                <IconButton size="small" onClick={() => setVariantDlg(item)}><AddIcon fontSize="small" /></IconButton>
              </Tooltip>
              <Tooltip title="Delete item">
                <IconButton size="small" color="error" onClick={() => handleDeleteItem(item.id)}><DeleteOutlineIcon fontSize="small" /></IconButton>
              </Tooltip>
              <IconButton size="small" onClick={() => toggleExpand(item.id)}>
                {expanded.has(item.id) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Stack>

            <Collapse in={expanded.has(item.id)}>
              <Divider />
              {item.variants.length === 0 ? (
                <Box px={3} py={2}>
                  <Typography variant="body2" color="text.secondary">No variants yet. Click + to add.</Typography>
                </Box>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Variant Code</TableCell>
                      <TableCell>Variant Name</TableCell>
                      <TableCell>Color</TableCell>
                      <TableCell align="right" />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {item.variants.map((v) => (
                      <TableRow key={v.id} hover>
                        <TableCell>
                          <Chip label={v.variant_code} size="small" variant="outlined" sx={{ fontWeight: 700, fontFamily: "monospace" }} />
                        </TableCell>
                        <TableCell>{v.variant_name}</TableCell>
                        <TableCell>{v.color || "—"}</TableCell>
                        <TableCell align="right">
                          <IconButton size="small" color="error" onClick={() => handleDeleteVariant(v.id)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Collapse>
          </Paper>
        ))}
      </Stack>

      <ItemDialog open={itemDlg} onClose={() => { setItemDlg(false); setEditItem(undefined); }} onSave={handleSaveItem} init={editItem} />
      {variantDlg && (
        <VariantDialog open={!!variantDlg} onClose={() => setVariantDlg(null)} onSave={(b) => handleAddVariant(variantDlg, b)} item={variantDlg} />
      )}
    </Box>
  );
}
