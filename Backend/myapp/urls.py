from django.urls import path
from .views import stock_stream_view

urlpatterns = [
    path('api/stock-stream/', stock_stream_view, name='stock_stream'),
]