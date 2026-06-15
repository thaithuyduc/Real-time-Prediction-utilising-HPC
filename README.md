# Real-Time Stock Price Forecasting System

## Overview

This project is an end-to-end real-time stock forecasting platform designed to predict the next closing price of FPT stock using deep learning and microservice architecture.

Historical stock data (90,000+ minute-level records) is collected from the VNStock API, processed through a feature engineering pipeline, and used to train an LSTM model for time-series forecasting.

The system simulates a real-time stock market environment by continuously streaming historical market data to a prediction service. Forecast results are generated through a dedicated inference service and displayed on a React dashboard.

Key Features

* Real-time stock data streaming simulation
* Minute-level stock price forecasting
* LSTM-based deep learning model
* Feature engineering for financial time-series data
* Microservice architecture using FastAPI
* Django backend acting as system orchestrator
* Interactive React frontend dashboard
* Dockerized deployment for all components
* End-to-end ML pipeline from data ingestion to visualization

⸻

## Dataset

Source

* VNStock API

Target Stock

* FPT Corporation (FPT)

Dataset Characteristics

* ~90,000+ observations
* Minute-level trading data
* Historical OHLCV information:
    * Open
    * High
    * Low
    * Close
    * Volume

⸻

## Machine Learning Pipeline

### Data Preprocessing

* Feature scaling
* Time-series sequence generation
* Train/Validation/Test split

### Feature Engineering

Examples of engineered features include:

* Relative Strength Index (RSI)
* Exponential Moving averages
* Rolling statistics
* Lag features

### Model Architecture

Long Short-Term Memory (LSTM)

LSTM networks were employed to capture temporal dependencies within minute-level stock price movements.

### Model objective:

* Predict future closing prices based on historical sequences.

⸻

## Model Performance

Long-Term Trend Forecasting

Metric	Score
R²	0.99

The model successfully captures the overall market trend and long-term price movements.

Short-Term Forecasting

Metric	Score
R²	0.22

Although long-term trend prediction performs well, short-term minute-by-minute price fluctuations remain challenging due to the highly stochastic nature of financial markets.

Key Insight

The model demonstrates strong capability in learning macro price trends but has limited predictive power for immediate short-term market movements, which aligns with the efficient market characteristics commonly observed in high-frequency financial data.

⸻

System Architecture

<img width="690" height="468" alt="image" src="https://github.com/user-attachments/assets/dfd9b75e-f833-403f-8972-d525042c778c" />

⸻

## Components

1. Streaming Service (FastAPI)

Responsible for:

* Simulating real-time stock data streams
* Sending market data continuously
* Replaying historical records at configurable intervals

2. Django Backend (Orchestrator)

Responsible for:

* Receiving streamed data
* Managing communication between services
* Forwarding data to inference service
* Returning prediction results to frontend

3. Model Inference Service (FastAPI)

Responsible for:

* Loading trained LSTM model
* Performing online inference
* Returning forecast results

4. React Frontend

Responsible for:

* Real-time visualization
* Displaying incoming stock prices
* Displaying forecasted prices
* Monitoring prediction behavior

⸻

## Project Root
1. Backend: store Django acting as orchestrator
2. Frontend: React code for Display
3. Services: include Model Inference Service and Streaming Service built by FastAPI
4. Experiment: used for testing and development

## Technology Stack

Machine Learning

* Python
* TensorFlow / Keras
* Pandas
* NumPy
* Scikit-Learn

Backend

* Django
* FastAPI

Frontend

* React.js

DevOps

* Docker
* Docker Compose

⸻

Future Improvements

* Transformer-based forecasting models
* Temporal Fusion Transformer (TFT)
* Informer architecture
* Real-time VNStock integration
* Kafka-based streaming pipeline
* Model monitoring and drift detection
* Automated retraining pipeline
* Deployment on Kubernetes
* CI/CD integration using GitHub Actions

⸻

Final Result from System

<img width="601" height="320" alt="image" src="https://github.com/user-attachments/assets/fd2c5c3c-7657-42c0-890a-ee0425b38828" />

