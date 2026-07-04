import React, { useRef, useState } from "react";
import { Button, CircularProgress } from "@mui/material";
import * as XLSX from "xlsx";
import { updateFromCsv } from "../lib/api";

export function CsvImportUpdate({ 
  table, 
  onSuccess,
  buttonText = "Import & Update" 
}: { 
  table: string; 
  onSuccess?: (msg: string) => void;
  buttonText?: string;
}) {
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

        if (rows.length === 0) {
          throw new Error("No data found in file.");
        }

        // We convert the JSON array to use standard keys.
        // Wait, our backend handles specific columns. So if the export had "Packing", they should map it back,
        // or we expect the user to know we need exact columns.
        // Let's assume the user doesn't change the column names but our custom export changed them!
        // So we need a reverse map.
        
        const reverseMap: Record<string, string> = {
          "Order Kgs": "order_kgs",
          "Order Pcs": "order_pcs",
          "Dispatch Kgs": "dispatch_weight",
          "Packing": "packing_weight",
          "Packing Weight": "packing_weight",
          "Dispatch Weight": "dispatch_weight",
          "Dispatch Pcs": "dispatch_pcs",
          "WO No": "wo_no",
          "Client PO": "client_po_no",
          "Invoice No": "invoice_no",
          "PO No": "po_no",
          "Supplier": "supplier_name",
          "Weight": "weight",
          "Rate": "rate",
          "Bill No": "bill_no",
          "Bundle No": "bundle_no",
          "Transport": "transport"
        };

        const mappedRows = rows.map(r => {
          const mapped: Record<string, any> = {};
          for (const key of Object.keys(r)) {
             const val = r[key];
             const mappedKey = reverseMap[key] || key.toLowerCase().replace(/ /g, "_");
             mapped[mappedKey] = val;
             mapped[key] = val; // keep original just in case
          }
          return mapped;
        });

        const res = await updateFromCsv(table, mappedRows);
        if (onSuccess) {
          onSuccess(`Successfully updated ${res.updatedCount} records.`);
        } else {
          alert(`Successfully updated ${res.updatedCount} records.`);
        }
      } catch (err: any) {
        alert(err.message || "Failed to process XLSX file.");
      } finally {
        setLoading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    };
    
    reader.onerror = () => {
      alert("Failed to read file.");
      setLoading(false);
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <Button variant="contained" component="label" disabled={loading} size="small" sx={{ ml: 1 }}>
      {loading ? <CircularProgress size={20} color="inherit" /> : buttonText}
      <input type="file" accept=".xlsx,.csv" hidden ref={inputRef} onChange={handleImport} />
    </Button>
  );
}
