# Create your views here.
import json
import random
import requests
from typing import List
from datetime import datetime, timedelta
from django.http import StreamingHttpResponse
from concurrent.futures import ThreadPoolExecutor, as_completed
import time
import psutil
import os

# --- Thread-Safe Connection Pooling Session ---
from requests.adapters import HTTPAdapter

# Create a shared requests.Session with a configured connection pool to avoid TCP handshake overhead
session = requests.Session()
adapter = HTTPAdapter(
    pool_connections=100,  # Number of connection pools to cache
    pool_maxsize=3000      # Max number of connections to keep in the pool (matching our concurrency level)
)
session.mount("http://", adapter)
session.mount("https://", adapter)

# --- Simulated AI Inference Model ---
def run_model_inference(stock_data_past_current: List[List[float]]) -> float:
    """
    Calls FastAPI endpoint to get predictions based on preprocessed windows.
    """
    FASTAPI_URL = "http://localhost:8001/inference/forecast" #http://inference_service:8001/inference/forecast
    try:
        response = session.post(
            FASTAPI_URL,
            json={'stock_data_past_current': stock_data_past_current},
            # timeout=2.0  # Safe timeout threshold to prevent Django from hanging
        )
        if response.status_code == 200:
            forecast = response.json().get('forecast')
            return round(float(forecast), 2)
        else:
            raise ValueError(f"FastAPI returned status code {response.status_code}")
    except requests.RequestException as e:
        print(f"❌ Error occurred while calling FastAPI Forecast: {e}")
        raise


def get_historical_stock_data():
    """
    Streams data lines coming from the FastAPI processing engine.
    """
    FASTAPI_URL = "http://localhost:8002/stream/stream_data" # http://streaming_service:8002/stream/stream_data
    try:
        print("Connecting to FastAPI data stream...")
        response = session.post(FASTAPI_URL, stream=True)
        
        if response.status_code == 200:
            print("✅ Successfully connected to FastAPI stream!")
            for line in response.iter_lines():
                if line:
                    decoded_line = line.decode('utf-8')
                    if decoded_line.startswith("data: "):
                        json_data = decoded_line[6:]  # Remove "data: " prefix
                        data = json.loads(json_data)

                        yield {
                            "scaled_window": data.get("scaled_window"),
                            "actual_row": data.get("actual_row")
                        }
        else:
            raise ValueError(f"Failed to get historical stock data from FastAPI: Status {response.status_code}")
    except requests.RequestException as e:
        print(f"❌ Error occurred while calling FastAPI for historical data: {e}")
        raise

# --- Streaming View ---
def stock_stream_view(request):
    def event_stream():
        CONCURRENT_REQUESTS = 3000 
        
        # 1. Initialize the process monitor for the current Django worker
        process = psutil.Process(os.getpid())
        
        # 2. Call cpu_percent once to establish a baseline for the first loop
        process.cpu_percent(interval=None)

        for data_chunk in get_historical_stock_data():
            scaled_window = data_chunk['scaled_window']
            actual_row = data_chunk['actual_row']

            actual_price = actual_row.get('close', 0.0)
            next_time_str = str(actual_row.get('time', ''))

            if "T" in next_time_str:
                next_time_str = next_time_str.replace("T", " ")
            if "." in next_time_str:
                next_time_str = next_time_str.split(".")[0]

            # --- CONCURRENCY SIMULATION ---
            start_time = time.time()
            successful_requests = 0
            local_forecast = None

            with ThreadPoolExecutor(max_workers=CONCURRENT_REQUESTS) as executor:
                futures = [
                    executor.submit(run_model_inference, scaled_window) 
                    for _ in range(CONCURRENT_REQUESTS)
                ]
                
                for future in as_completed(futures):
                    try:
                        result = future.result()
                        successful_requests += 1
                        if local_forecast is None:
                            local_forecast = result 
                    except Exception:
                        pass 
            
            end_time = time.time()
            total_duration = end_time - start_time

            if local_forecast is None:
                # Basic fallback without random import to keep imports clean
                local_forecast = round(actual_price * 1.001, 2)
            
            # --- CALCULATE METRICS ---
            latency_ms = round(total_duration * 1000, 2)
            throughput = round(CONCURRENT_REQUESTS / total_duration, 2) if total_duration > 0 else 0

            # 3. Capture Actual System/Process Metrics
            # CPU usage since the last time cpu_percent was called (i.e., since the last loop iteration)
            cpu_usage = process.cpu_percent(interval=None)
            
            # Resident Set Size (RSS) gives the non-swapped physical memory a process has used
            # We divide by (1024 * 1024) to convert Bytes to Megabytes (MB)
            memory_info = process.memory_info()
            memory_usage_mb = round(memory_info.rss / (1024 * 1024), 2)

            try:
                time_obj = datetime.strptime(next_time_str, "%Y-%m-%d %H:%M:%S")
                current_time_str = (time_obj - timedelta(minutes=1)).strftime("%Y-%m-%d %H:%M:%S")
            except ValueError:
                current_time_str = next_time_str
            
            payload = {
                "time": current_time_str,
                "actual": round(actual_price, 2),
                "next_time": next_time_str,
                "local_forecast": local_forecast,
                "throughput": throughput,
                "latency": latency_ms,
                "cpu_usage": cpu_usage,         # Real Django CPU usage
                "memory_usage": memory_usage_mb # Real Django Memory in MB
            }

            yield f"data: {json.dumps(payload)}\n\n"

    response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no' 
    return response