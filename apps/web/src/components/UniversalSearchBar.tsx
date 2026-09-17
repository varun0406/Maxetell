import { useState, useEffect, useRef } from "react";
import {
  Box,
  InputBase,
  Paper,
  Popper,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  CircularProgress,
  ClickAwayListener,
  Divider,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { api } from "../../lib/api";
import { useNavigate } from "react-router-dom";

type SearchResult = {
  type: string;
  id: string | number;
  match_field: string;
  match_value: string;
  summary?: string;
  supplier_name?: string;
  source: string;
};

export function UniversalSearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(`/mx/search?q=${encodeURIComponent(query)}`);
        setResults(res.data.data ?? []);
        setOpen(true);
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleResultClick = (r: SearchResult) => {
    setOpen(false);
    setQuery("");

    // Route based on type
    switch (r.type) {
      case "job_worker":
        navigate(`/job-work/worker/${r.id}`);
        break;
      case "supplier":
        navigate(`/suppliers`); // We don't have supplier account page yet
        break;
      case "party":
        navigate(`/parties`); // We don't have party account page yet
        break;
      case "roll":
      case "packing":
      case "parcel":
      case "challan":
        navigate(`/dashboard?trace=${encodeURIComponent(r.match_value)}`);
        break;
      default:
        break;
    }
  };

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box sx={{ width: "100%", mt: 1, mb: 2 }}>
        <Paper
          ref={anchorRef}
          elevation={0}
          sx={{
            p: "2px 4px",
            display: "flex",
            alignItems: "center",
            width: "100%",
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "background.default",
          }}
        >
          <Box sx={{ p: "10px", display: "flex", alignItems: "center" }}>
            <SearchIcon color="action" />
          </Box>
          <InputBase
            sx={{ ml: 1, flex: 1, py: 1 }}
            placeholder="Search any name, alias, or code..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (results.length > 0) setOpen(true);
            }}
          />
          {loading && (
            <Box sx={{ p: "10px", display: "flex", alignItems: "center" }}>
              <CircularProgress size={20} />
            </Box>
          )}
        </Paper>

        <Popper
          open={open && results.length > 0}
          anchorEl={anchorRef.current}
          placement="bottom-start"
          style={{ width: anchorRef.current?.clientWidth, zIndex: 1300 }}
        >
          <Paper elevation={4} sx={{ mt: 1, maxHeight: 400, overflow: "auto" }}>
            <List dense>
              {results.map((r, i) => (
                <Box key={`${r.type}-${r.id}-${i}`}>
                  <ListItemButton onClick={() => handleResultClick(r)}>
                    <ListItemText
                      primary={
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <Typography variant="body2" fontWeight={600}>
                            {r.match_value}
                          </Typography>
                          <Typography variant="caption" color="primary.main" sx={{ textTransform: "capitalize", px: 1, py: 0.5, bgcolor: "primary.50", borderRadius: 1 }}>
                            {r.type.replace("_", " ")}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Box component="span" sx={{ display: "flex", flexDirection: "column", gap: 0.5, mt: 0.5 }}>
                          {r.supplier_name && (
                            <Typography variant="caption" color="text.secondary" component="span">
                              Supplier: {r.supplier_name}
                            </Typography>
                          )}
                          {r.summary && (
                            <Typography variant="caption" color="text.secondary" component="span">
                              {r.summary}
                            </Typography>
                          )}
                          {r.source === "alias" && (
                            <Typography variant="caption" color="info.main" component="span">
                              Matched via alias: {r.match_field.replace("_", " ")}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItemButton>
                  {i < results.length - 1 && <Divider component="li" />}
                </Box>
              ))}
            </List>
          </Paper>
        </Popper>
      </Box>
    </ClickAwayListener>
  );
}
