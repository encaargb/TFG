from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DOCS_DIR = "../docs"

@app.get("/documents/{doc_id}/{filename}")
def get_page(doc_id: str, filename: str):
    path = os.path.join(DOCS_DIR, doc_id, filename)
    return FileResponse(path)

@app.get("/")
def root():
    return {"status": "ok"}