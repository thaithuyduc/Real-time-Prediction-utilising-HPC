from fastapi import FastAPI
from router import inferece_router
from contextlib import asynccontextmanager
import torch
import torch.nn as nn
import os
from models import LSTMModel, LSTMInference

MODEL_PATH = './best_lstm_model-1.pth'

@asynccontextmanager
async def lifespan(app: FastAPI):
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    try:
        if os.path.exists(MODEL_PATH):
            state_dict = torch.load(MODEL_PATH, map_location=device)
            model = LSTMModel(**state_dict['model_args'])
            model = nn.DataParallel(model)
            
            # ✅ FIX 4: Pass the 'device' variable, not the 'torch.device' module class
            model.to(device) 
            model.load_state_dict(state_dict['model_state'])
            
            app.state.model_inference = LSTMInference(model=model, device=device)
            print(f"✅ Model loaded successfully on {device}!", flush=True)
        else:
            print(f"⚠️ Model file not found at: {MODEL_PATH}", flush=True)
    except Exception as e:
        print(f"❌ Error loading model: {e}", flush=True)

    yield # The app runs while this sits here
    # Clean up code goes here if needed when server shuts down

app = FastAPI(title="Inference Service", lifespan=lifespan)

app.include_router(inferece_router)