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

@app.get("/api/fixture-pool/categories")
def get_fixture_pool_categories():
    config = load_config()
    fixture_pool_path = config.get("fixture_pool", "").strip()

    if not fixture_pool_path:
        raise HTTPException(
            status_code=400,
            detail="Fixture Pool path is not configured."
        )

    fixture_pool = Path(fixture_pool_path)

    if not fixture_pool.exists() or not fixture_pool.is_dir():
        raise HTTPException(
            status_code=400,
            detail="Fixture Pool path is invalid."
        )

    try:
        categories = sorted(
            [
                item.name
                for item in fixture_pool.iterdir()
                if item.is_dir()
            ],
            key=str.lower
        )
    except OSError:
        raise HTTPException(
            status_code=500,
            detail="Fixture Pool folder could not be read."
        )

    return {"categories": categories}


@app.get("/api/fixture-pool/{category}")
def get_fixture_pool_items(category: str):
    config = load_config()
    fixture_pool_path = config.get("fixture_pool", "").strip()

    if not fixture_pool_path:
        raise HTTPException(
            status_code=400,
            detail="Fixture Pool path is not configured."
        )

    fixture_pool = Path(fixture_pool_path)
    category_path = fixture_pool / category

    # Prevent requests from escaping the configured Fixture Pool.
    try:
        category_path.resolve().relative_to(fixture_pool.resolve())
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid fixture category."
        )

    if not category_path.exists() or not category_path.is_dir():
        raise HTTPException(
            status_code=404,
            detail="Fixture category was not found."
        )

    try:
        items = sorted(
            [
                {
                    "name": item.name,
                    "stem": item.stem,
                    "extension": item.suffix.lower()
                }
                for item in category_path.iterdir()
                if item.is_file() and item.stem.upper().startswith("F_")
            ],
            key=lambda item: item["name"].lower()
        )
    except OSError:
        raise HTTPException(
            status_code=500,
            detail="Fixture category could not be read."
        )

    return {
        "category": category,
        "items": items
    }