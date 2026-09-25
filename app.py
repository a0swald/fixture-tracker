from pathlib import Path
import json
from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent
CONFIG_FILE = BASE_DIR / "config.json"

app = FastAPI(title="Fixture Tracker")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

class FolderPaths(BaseModel):
    fixture_pool: str = ""
    machine_jobs: str = ""

def load_config():
    default = {"fixture_pool": "", "machine_jobs": ""}
    if not CONFIG_FILE.exists():
        return default
    try:
        data = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
        return {key: data.get(key, "") for key in default}
    except (json.JSONDecodeError, OSError):
        return default

def save_config(config):
    CONFIG_FILE.write_text(json.dumps(config, indent=2), encoding="utf-8")

@app.get("/")
def home(request: Request):
    return templates.TemplateResponse(request=request, name="index.html", context={"page": "home"})

@app.get("/settings")
def settings(request: Request):
    return templates.TemplateResponse(request=request, name="settings.html", context={"page": "settings"})

@app.get("/api/settings/folder-paths")
def get_folder_paths():
    return load_config()

@app.put("/api/settings/folder-paths")
def update_folder_paths(paths: FolderPaths):
    config = {"fixture_pool": paths.fixture_pool.strip(), "machine_jobs": paths.machine_jobs.strip()}
    errors = {}
    for key, value in config.items():
        if not value:
            continue
        path = Path(value)
        if not path.exists():
            errors[key] = "This path does not exist."
        elif not path.is_dir():
            errors[key] = "This path is not a folder."
    if errors:
        raise HTTPException(status_code=400, detail={"message": "One or more folder paths are invalid.", "fields": errors})
    save_config(config)
    return config
