import os
import uuid
from dotenv import load_dotenv

# Load environment variables from backend/.env if available
load_dotenv()

def get_env(key: str, default: str = "") -> str:
    """
    Fetches an environment variable, falling back to a default value if not set.
    """
    return os.environ.get(key, default)

def generate_unique_id() -> str:
    """
    Generates a secure unique identifier for processed invoices.
    """
    return str(uuid.uuid4())
