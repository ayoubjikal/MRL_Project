import os
from datetime import timedelta

class Config:
    # MySQL Configuration
    MYSQL_HOST = 'localhost'
    MYSQL_USER = 'root'
    MYSQL_PASSWORD = ''  
    MYSQL_DATABASE = 'mrl_db'
    
    # JWT
    SECRET_KEY = '1234567890'  
    JWT_EXPIRATION = timedelta(days=7)
    
    # CORS
    CORS_ORIGINS = ['http://localhost:3000', 'http://localhost:5173']

    # Gemini API Configuration
    GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
    GEMINI_MODEL = 'gemini-1.5-flash'  # Can also use 'gemini-1.5-pro' for higher accuracy

    # Email (à configurer selon ton fournisseur SMTP)
    EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
    EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '587'))
    EMAIL_USER = os.environ.get('EMAIL_USER', 'kaoutarokayl4@gmail.com')
    EMAIL_PASSWORD = os.environ.get('EMAIL_PASSWORD', 'rtru mcbf rmpo tabr')
    EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'true').lower() == 'true'
    EMAIL_FROM = os.environ.get('EMAIL_FROM', EMAIL_USER)