from fastapi import APIRouter, HTTPException, Request
import pandas as pd
from typing import List
from pydantic import BaseModel

# Define the structured data template that sent to the API
class Payload(BaseModel):
    stock_data_past_current: List[List[float]]

inferece_router = APIRouter(prefix="/inference", tags=["Inference"])

@inferece_router.post("/forecast")
def forecast(payload: Payload, request: Request):
    model_inference = request.app.state.model_inference
    try:
        if model_inference is not None:
            df_frame = pd.DataFrame(payload.stock_data_past_current)
            
            forecast_result = model_inference.forecast(df_frame)
            
            return {"forecast": forecast_result[0]}
        else:
            raise HTTPException(status_code=503, detail="Model is not loaded yet. Please try again later.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error during forecasting: {e}")
    
