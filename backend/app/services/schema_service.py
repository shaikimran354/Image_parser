import os
import json
from typing import Dict, Any

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..", "data"))
SCHEMA_FILE = os.path.join(DATA_DIR, "custom_schema.json")

class SchemaService:
    @staticmethod
    def get_custom_schema() -> Dict[str, Any]:
        """
        Returns custom schema configuration grouped by card (vendor, customer, invoice, amount).
        Each entry is a list of dicts: {"key": "...", "label": "..."}
        """
        if not os.path.exists(SCHEMA_FILE):
            return {"vendor": [], "customer": [], "invoice": [], "amount": [], "deletedStandardFields": [], "deletedItemColumns": []}
        try:
            with open(SCHEMA_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if "deletedStandardFields" not in data:
                    data["deletedStandardFields"] = []
                if "deletedItemColumns" not in data:
                    data["deletedItemColumns"] = []
                return data
        except Exception:
            return {"vendor": [], "customer": [], "invoice": [], "amount": [], "deletedStandardFields": [], "deletedItemColumns": []}

    @staticmethod
    def save_custom_schema(schema: Dict[str, Any]) -> None:
        """
        Saves custom schema configuration.
        """
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(SCHEMA_FILE, "w", encoding="utf-8") as f:
            json.dump(schema, f, indent=4)

    @staticmethod
    def clear_custom_schema() -> None:
        """
        Clears the custom schema configuration, resetting it to default.
        """
        empty_schema = {"vendor": [], "customer": [], "invoice": [], "amount": [], "deletedStandardFields": [], "deletedItemColumns": []}
        SchemaService.save_custom_schema(empty_schema)
