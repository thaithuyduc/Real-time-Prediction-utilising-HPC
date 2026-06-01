import joblib
from numpy.lib.stride_tricks import sliding_window_view
import pandas as pd
import numpy as np
import torch
from sklearn.compose import ColumnTransformer
from typing import Literal
import torch.nn as nn
import math
from collections import OrderedDict

def inverse_transform_columntransformer(column_transformer:ColumnTransformer, X_transformed:pd.DataFrame):
    """Inverse transform entire ColumnTransformer output back to original scale"""
    X_original = X_transformed.copy()
    list_of_features = list(column_transformer.get_feature_names_out())
    
    for name, transformer, columns in column_transformer.transformers_:
        if name != 'remainder' and transformer is not None:
            # Get the indices of these columns in the transformed data
            col_indices = [list_of_features.index(col) for col in columns]
            
            X_original.iloc[:, col_indices] = transformer.inverse_transform(X_transformed.iloc[:, col_indices])
    
    df_inversed = pd.DataFrame(X_original, columns=list_of_features, index=X_transformed.index)
    
    return df_inversed

# build class to predict stock price from LSTM
class LSTMInference:
    def __init__(self, model, device):
        self.model = model.to(device)
        self.device = device
        self.preprocessor = joblib.load('./standardise_transformer-1.joblib')
        self.preprocessor: ColumnTransformer
    
    def create_sequences(self, X: pd.DataFrame, lag: int) -> np.ndarray:
        """
        Vectorized version to create time series sequences.
        """
        X_values = X.values  # shape: (n_samples, n_features)
        
        # Create sliding windows for features (X)
        X_windows = sliding_window_view(X_values, window_shape=lag, axis=0).transpose(0, 2, 1) # (n_sequences, timesteps, n_features)

        X_seq = X_windows
       
        return X_seq

    def forecast(self, stock_data_past_current:pd.DataFrame, timesteps:int=30):
        # Forecast stock price for next period using stock price from past periods and current period
        y_forecast: torch.Tensor
        self.model.eval()
        with torch.no_grad():
            X_seq = self.create_sequences(stock_data_past_current, lag=timesteps) # (B, timesteps, features)
            X_seq = torch.tensor(X_seq, dtype=torch.float32)
            X_seq = X_seq.to(self.device)
    
            y_forecast = self.model(X_seq) # (B, 1)
            y_forecast = y_forecast.squeeze(1)
            
            df_temp = pd.DataFrame(0, columns=self.preprocessor.get_feature_names_out(), index=[0], dtype=float)
            df_temp['close'] = y_forecast.tolist()

            df_temp = inverse_transform_columntransformer(self.preprocessor, df_temp)
            
            return df_temp['close'].values

#-------------------

# Define Attention Mechanism
class GlobalAttentionPooling(nn.Module):
    def __init__(self, hidden_size:int, bidirectional:bool):
        super().__init__()
        if bidirectional == True:
            factor = 2
        else:
            factor = 1
        self.query = nn.Parameter(torch.randn(factor * hidden_size)) 
        # (bidirections * hidden_size) or (hidden_size)

    def forward(self, hidden_states):
        # hidden_states: (B, num_tokens, bidirections * hidden_size)
        
        # compute attention scores with dot_product
        attn_scores = torch.matmul(hidden_states, self.query) / math.sqrt(hidden_states.size(-1)) # (B, num_tokens)

        # compute attention weights
        attn_weights = torch.softmax(attn_scores, dim=1) # (B, num_tokens)

        # Weighted sum
        final_hidden_state = torch.sum(hidden_states * attn_weights.unsqueeze(-1), dim=1) # (B, bidirections * hidden_size)

        return final_hidden_state
    
class LSTMCell(nn.Module):
    def __init__(self, emb_dim:int, hidden_size:int, num_layers:int, dropout:float, bidirectional:bool,
                proj_size:int, pooling_fn: Literal['mean', 'sum', 'max', 'attention']|None = None):
        super().__init__()
        
        self.lstm = nn.LSTM(input_size=emb_dim, hidden_size=hidden_size, num_layers=num_layers,
                           bias=True, batch_first=True, dropout=dropout, bidirectional=bidirectional, 
                            proj_size=proj_size)
        self.pooling_fn = pooling_fn
        self.bidirectional = bidirectional
        self.attn_pooling = GlobalAttentionPooling(hidden_size=hidden_size, bidirectional=bidirectional)

    def forward(self, time_series_data):
        # tokens_emb: (B, timesteps, features)

        # pass through lstm cell
        output, (last_hidden_state, last_cell_state) = self.lstm(time_series_data)
        # last_hidden_state: (bidirections * num_layers, B, hidden_size) ; 
        # last_cell_state: (bidirections * num_layers, B, hidden_size)
        
        # output: (B, num_tokens, bidirections * hidden_size)

        if self.pooling_fn == 'mean':
            final_hidden_state = output.mean(dim=1) # (B, bidirections * hidden_size)
        
        elif self.pooling_fn == 'sum':
            final_hidden_state = output.sum(dim=1) # (B, bidirections * hidden_size)
        
        elif self.pooling_fn == 'max':
            final_hidden_state, max_value_index = output.max(dim=1)
            # final_hidden_state: # (B, bidirections * hidden_size)

        elif self.pooling_fn == 'attention':
            final_hidden_state = self.attn_pooling(output) # (B, bidirections * hidden_size)
        
        else:
            final_hidden_state = last_hidden_state.transpose(0, 1) # (B, bidirections * num_layers, hidden_size)

            if self.bidirectional == True:
                forward_hidden_state = final_hidden_state[:, -2, :] # (B, hidden_size)
                backward_hidden_state = final_hidden_state[:, -1, :] # (B, hidden_size)
                final_hidden_state = torch.cat([forward_hidden_state, backward_hidden_state], dim=1) # (B, bidirections * hidden_size)
            else:
                final_hidden_state = final_hidden_state[:, -1, :] # (B, hidden_size)

        # final_hidden_state: (B, bidirections * hidden_size) or (B, hidden_size)
        return final_hidden_state
    
class LSTMModel(nn.Module):
    def __init__(self, emb_dim:int, hidden_size:int, num_layers:int,
                bidirectional:bool, proj_size:int, pooling_fn: Literal['mean', 'sum', 'max', 'attention']|None):
        super().__init__()
        self.pooling_fn = pooling_fn
        self.dropout_emb = nn.Dropout(p=0.35)

        self.lstm = LSTMCell(emb_dim=emb_dim, hidden_size=hidden_size, num_layers=num_layers, 
                            bidirectional=bidirectional, dropout=0, 
                           pooling_fn=pooling_fn, proj_size=proj_size)
        # dropout only used when using stack RNNs
        
        if bidirectional == True:
            factor = 2
        else:
            factor = 1
        
        self.mlp = nn.Sequential(OrderedDict([
            ("fc1", nn.Linear(factor * hidden_size, 64)),
            ("ln1", nn.LayerNorm(64)),
            ("relu1", nn.LeakyReLU()),
            ("drop1", nn.Dropout(p=0.35)),
            
            # ("fc2", nn.Linear(64, 128)),
            # ("ln2", nn.LayerNorm(128)),
            # ("relu2", nn.LeakyReLU()),
            # ("drop2", nn.Dropout(p=0.35)),

            # ("fc3", nn.Linear(128, 128)),
            # ("ln3", nn.LayerNorm(128)),
            # ("relu3", nn.LeakyReLU()),
            # ("drop3", nn.Dropout(p=0.35)),
            
            ('out', nn.Linear(64, 1))
        ]))

    def forward(self, time_series_data):
        # time_series_data: (B, timesteps, features)
        last_hidden_state = self.lstm(time_series_data) # (B, bidirections * hidden_size) or (B, hidden_size)
        output = self.mlp(last_hidden_state) # (B, num_classes)
        
        return output