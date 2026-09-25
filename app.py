from pathlib import Path
import json

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import FileResponse
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

class NewJob(BaseModel):
    machine: str
    job_name: str

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
                if (
                    item.is_file()
                    and item.suffix.lower() in {".jpg", ".jpeg"}
                    and item.stem.upper().startswith("F_")
                )
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

@app.get("/api/fixture-pool/{category}/media/{filename}")
def get_fixture_media(category: str, filename: str):
    config = load_config()
    fixture_pool_path = config.get("fixture_pool", "").strip()

    if not fixture_pool_path:
        raise HTTPException(
            status_code=400,
            detail="Fixture Pool path is not configured."
        )

    fixture_pool = Path(fixture_pool_path)
    media_path = fixture_pool / category / filename

    try:
        media_path.resolve().relative_to(fixture_pool.resolve())
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid fixture media path."
        )

    if not media_path.exists() or not media_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Fixture media was not found."
        )

    if not media_path.stem.upper().startswith("F_"):
        raise HTTPException(
            status_code=404,
            detail="Fixture media was not found."
        )

    return FileResponse(media_path)

@app.get("/api/machine-jobs")
def get_machine_jobs():
    config = load_config()
    machine_jobs_path = config.get("machine_jobs", "").strip()

    if not machine_jobs_path:
        raise HTTPException(
            status_code=400,
            detail="Machine Jobs path is not configured."
        )

    machine_jobs = Path(machine_jobs_path)

    if not machine_jobs.exists() or not machine_jobs.is_dir():
        raise HTTPException(
            status_code=400,
            detail="Machine Jobs path is invalid."
        )

    try:
        machines = []

        for machine in machine_jobs.iterdir():
            if not machine.is_dir():
                continue

            jobs = sorted(
                [
                    job.name
                    for job in machine.iterdir()
                    if job.is_dir()
                ],
                key=str.lower
            )

            machines.append({
                "name": machine.name,
                "jobs": jobs
            })

        machines.sort(key=lambda machine: machine["name"].lower())

    except OSError:
        raise HTTPException(
            status_code=500,
            detail="Machine Jobs folder could not be read."
        )

    return {"machines": machines}

@app.post("/api/machine-jobs")
def create_machine_job(job: NewJob):
    config = load_config()
    machine_jobs_path = config.get("machine_jobs", "").strip()

    if not machine_jobs_path:
        raise HTTPException(
            status_code=400,
            detail="Machine Jobs path is not configured."
        )

    machine_jobs = Path(machine_jobs_path)
    machine_path = machine_jobs / job.machine
    job_name = job.job_name.strip()

    if not job_name:
        raise HTTPException(
            status_code=400,
            detail="Job name is required."
        )

    try:
        machine_path.resolve().relative_to(machine_jobs.resolve())
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid machine."
        )

    if not machine_path.exists() or not machine_path.is_dir():
        raise HTTPException(
            status_code=404,
            detail="Machine was not found."
        )

    job_path = machine_path / job_name

    try:
        job_path.resolve().relative_to(machine_path.resolve())
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid job name."
        )

    if job_path.exists():
        raise HTTPException(
            status_code=409,
            detail="A job with this name already exists on this machine."
        )

    try:
        job_path.mkdir()
    except OSError:
        raise HTTPException(
            status_code=500,
            detail="Job folder could not be created."
        )

    return {
        "machine": job.machine,
        "job_name": job_name
    }