"""Settings for the ZUSia service.

Values come from the environment first, then from the repo-root .env. An empty value counts as unset and
.env is re-read on every lookup, so a key added while the service is running (e.g. ZUS_API_KEY) is picked up
without a restart – load_dotenv() alone never overwrites a variable that was already loaded as empty.
"""
import os
from pathlib import Path

from dotenv import dotenv_values, load_dotenv

ENV_FILE = Path(__file__).resolve().parent.parent / '.env'

load_dotenv(ENV_FILE)


def setting(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name)
    if value:
        return value
    if ENV_FILE.exists():
        value = dotenv_values(ENV_FILE).get(name)
        if value:
            return value
    return default
