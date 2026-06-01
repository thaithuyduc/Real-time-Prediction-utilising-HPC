import joblib
from sklearn import set_config
import pandas as pd
from sklearn.compose import ColumnTransformer

set_config(transform_output='pandas', display='diagram')
def preprocessing(data:pd.DataFrame, preprocessor: ColumnTransformer):
    scaled_data: pd.DataFrame
    data = data.drop(columns=['time'])
    scaled_data = preprocessor.transform(data)
    
    return scaled_data

if __name__ == "__main__":
    data = pd.read_csv('/app/Dataset/FPT_1m_020124150526.csv')
    standardise = joblib.load('/app/standardise_transformer-1.joblib')
    
    preprocessed_data = preprocessing(data, standardise)
    print(preprocessed_data.head())
