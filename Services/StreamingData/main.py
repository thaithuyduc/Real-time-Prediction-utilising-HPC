from fastapi import FastAPI
from router import streaming_router

app = FastAPI(title="Streaming Service")

app.include_router(streaming_router)