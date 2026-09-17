import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#2563eb", light: "#60a5fa", dark: "#1d4ed8" },
    success: { main: "#10b981", light: "#34d399", dark: "#047857" },
    warning: { main: "#f59e0b", light: "#fbbf24", dark: "#b45309" },
    error: { main: "#ef4444", light: "#f87171", dark: "#b91c1c" },
    info: { main: "#0ea5e9", light: "#38bdf8", dark: "#0369a1" },
    background: { default: "#f8fafc", paper: "rgba(255, 255, 255, 0.7)" },
  },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'].join(","),
    h4: { fontWeight: 900, letterSpacing: "-0.04em" },
    h5: { fontWeight: 800, letterSpacing: "-0.02em" },
    h6: { fontWeight: 800, letterSpacing: "-0.01em" },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.4)",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)",
          backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 100%)",
          transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 700,
          borderRadius: 8,
          boxShadow: "none",
          "&:hover": {
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          paddingTop: 12,
          paddingBottom: 12,
          borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
        },
        head: {
          fontWeight: 800,
          whiteSpace: "nowrap",
          background: "transparent",
          color: "#64748b",
          textTransform: "uppercase",
          fontSize: "0.75rem",
          letterSpacing: "0.05em",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          overflow: "visible",
        }
      }
    },
    MuiTextField: {
      defaultProps: {
        variant: "outlined",
      },
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            backgroundColor: "rgba(255, 255, 255, 0.5)",
            backdropFilter: "blur(8px)",
            transition: "all 0.2s ease-in-out",
            "&:hover": {
              backgroundColor: "rgba(255, 255, 255, 0.8)",
            },
            "&.Mui-focused": {
              backgroundColor: "#ffffff",
              boxShadow: "0 0 0 3px rgba(37, 99, 235, 0.1)",
            }
          }
        }
      }
    }
  },
});
