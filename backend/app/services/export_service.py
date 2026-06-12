import io
import csv
import json
import pandas as pd
from typing import Dict, Any

def flatten_dict(d: Dict[str, Any], parent_key: str = '', sep: str = '.') -> Dict[str, Any]:
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        else:
            items.append((new_key, v))
    return dict(items)

class ExportService:
    @staticmethod
    def generate_json_bytes(invoice_data: Dict[str, Any]) -> bytes:
        """
        Formats invoice data dictionary into formatted JSON bytes.
        """
        data_to_export = invoice_data.copy()
        data_to_export.pop("confidence_details", None)
        
        json_str = json.dumps(data_to_export, indent=4)
        return json_str.encode('utf-8')

    @staticmethod
    def generate_csv_bytes(invoice_data: Dict[str, Any]) -> bytes:
        """
        Flattens the entire invoice data (metadata + items) into CSV bytes.
        """
        data_to_export = invoice_data.copy()
        data_to_export.pop("confidence_details", None)
        
        output = io.StringIO()
        metadata = {}
        items = []
        for k, v in data_to_export.items():
            if k == "items" and isinstance(v, list):
                items = v
            else:
                metadata[k] = v
                
        # Flatten nested structures (like company: {name, address})
        flat_metadata = flatten_dict(metadata)
                    
        rows = []
        if items:
            for item in items:
                row = flat_metadata.copy()
                flat_item = flatten_dict(item, parent_key="item")
                row.update(flat_item)
                rows.append(row)
        else:
            rows.append(flat_metadata.copy())
            
        if rows:
            fieldnames = list(rows[0].keys())
            writer = csv.DictWriter(output, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        else:
            # Fallback placeholder structure
            writer = csv.writer(output)
            writer.writerow(["data"])
            
        return output.getvalue().encode('utf-8')

    @staticmethod
    def generate_excel_bytes(invoice_data: Dict[str, Any]) -> bytes:
        """
        Generates a professionally-formatted multi-sheet Excel spreadsheet buffer.
        Tab 1: "Invoice Summary" - Dynamically tracks all top-level keys.
        Tab 2: "Line Items" - Shows detailed rows of items.
        """
        output = io.BytesIO()
        
        data_to_export = invoice_data.copy()
        data_to_export.pop("confidence_details", None)
        
        # Split items list from top-level metadata fields
        metadata = {}
        items = []
        for k, v in data_to_export.items():
            if k == "items" and isinstance(v, list):
                items = v
            else:
                metadata[k] = v
                
        # Use ExcelWriter to write multiple worksheets in memory
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            # 1. Process Metadata
            flat_metadata_dict = flatten_dict(metadata)
            flat_metadata_list = []
            for key, val in flat_metadata_dict.items():
                label = key.replace('_', ' ').replace('.', ' - ').title()
                flat_metadata_list.append({"Field": label, "Value": val})
                
            df_meta = pd.DataFrame(flat_metadata_list)
            df_meta.to_excel(writer, sheet_name="Invoice Summary", index=False)
            
            # 2. Process Line Items
            if items:
                flat_items = [flatten_dict(item) for item in items]
                df_items = pd.DataFrame(flat_items)
                # Formats headers dynamically
                df_items.columns = [col.replace('_', ' ').replace('.', ' - ').title() for col in df_items.columns]
                df_items.to_excel(writer, sheet_name="Line Items", index=False)
            else:
                pd.DataFrame(columns=["Description", "Quantity", "Unit Price", "Amount"]).to_excel(
                    writer, sheet_name="Line Items", index=False
                )
                
        return output.getvalue()
