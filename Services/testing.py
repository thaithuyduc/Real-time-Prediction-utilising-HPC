# this file used to test and experiment before putting code into main codebase. Not used in production, just for testing and debugging purposes.

from fastapi import APIRouter, HTTPException
from sklearn.compose import ColumnTransformer
import pandas as pd
import time
import joblib
from fastapi.responses import StreamingResponse
import json


def stream_data():
    """Endpoint này sẽ stream dữ liệu đã được scale từ file CSV theo từng window."""
    try:
        preprocessor = joblib.load('/Users/thuyduc/Projects/Data Science/Real-time Stock Forecast/Experiment/Model/standardise_transformer-1.joblib')
        filepath = '/Users/thuyduc/Downloads/FPT_1m_15_180526220526.csv'
        window_size = 30
        delay_seconds = 3
        
        feeder_generator = realtime_data_feeder(filepath, preprocessor, window_size, delay_seconds)

        for scaled_window, actual_row in feeder_generator:
            payload = {
                "scaled_window": scaled_window.tolist(),  # Convert numpy array to list for JSON serialization
                "actual_row": json.loads(actual_row.to_json(date_format='iso'))  # Convert pandas Series to dict for JSON serialization ; json.loads(actual_row.to_json())
            }
            
            print(payload['actual_row'])
        
        # return StreamingResponse(event_stream(), media_type="text/event-stream")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def preprocess_data(window_df:pd.DataFrame, preprocessor: ColumnTransformer):
    """Hàm này được dùng để scale các giá trị trong window_df trước khi đưa vào model."""
    scaled_data: pd.DataFrame
    scaled_data = preprocessor.transform(window_df)
    
    return scaled_data

def realtime_data_feeder(filepath, preprocessor: ColumnTransformer, window_size=30, delay_seconds=5):
    """Hàm Generator thuần túy: Không bắt lỗi ở đây để Fail-Fast"""
    df = pd.read_csv(filepath)
    if 'time' in df.columns:
        df['time'] = pd.to_datetime(df['time'])
        
    total_rows = len(df)
    print(f"[FEEDER START] Đã load file: {filepath} | Tổng: {total_rows} dòng")
    
    for i in range(total_rows - window_size):
        window_df = df.iloc[i : i + window_size].copy()
        actual_row = df.iloc[i + window_size].copy()

        # scale data in window_df
        scaled_window = preprocess_data(window_df, preprocessor)
        yield scaled_window, actual_row
        
        time.sleep(delay_seconds)

if __name__ == "__main__":
    stream_data()