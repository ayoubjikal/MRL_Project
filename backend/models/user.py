import mysql.connector
from config import Config
import bcrypt
from datetime import datetime, timedelta
import jwt
import secrets

class User:
    def __init__(self):
        self.db_config = {
            'host': Config.MYSQL_HOST,
            'user': Config.MYSQL_USER,
            'password': Config.MYSQL_PASSWORD,
            'database': Config.MYSQL_DATABASE
        }
    
    def get_connection(self):
        return mysql.connector.connect(**self.db_config)
    
    @staticmethod
    def hash_password(password):
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    @staticmethod
    def verify_password(password, hashed):
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    
    def create_user(self, email, username, password, full_name, phone='', farm_name='', farm_location=''):
        """Créer un nouvel utilisateur"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            hashed_password = self.hash_password(password)
            
            query = """
            INSERT INTO users (email, username, password, full_name, phone, farm_name, farm_location)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            
            cursor.execute(query, (email, username, hashed_password, full_name, phone, farm_name, farm_location))
            conn.commit()
            
            user_id = cursor.lastrowid
            cursor.close()
            conn.close()
            
            return {'success': True, 'user_id': user_id}
        except mysql.connector.Error as err:
            if err.errno == 1062:  # Duplicate entry
                return {'success': False, 'error': 'Email ou username déjà utilisé'}
            return {'success': False, 'error': str(err)}
    
    def get_user_by_email(self, email):
        """Récupérer un utilisateur par email"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor(dictionary=True)
            
            query = "SELECT * FROM users WHERE email = %s"
            cursor.execute(query, (email,))
            user = cursor.fetchone()
            
            cursor.close()
            conn.close()
            
            return user
        except mysql.connector.Error as err:
            return None
    
    def generate_reset_token(self, user_id):
        """Générer un token de reset password"""
        try:
            token = secrets.token_urlsafe(32)
            expires_at = datetime.now() + timedelta(hours=1)
            
            conn = self.get_connection()
            cursor = conn.cursor()
            
            query = """
            INSERT INTO password_reset_tokens (user_id, token, expires_at)
            VALUES (%s, %s, %s)
            """
            
            cursor.execute(query, (user_id, token, expires_at))
            conn.commit()
            cursor.close()
            conn.close()
            
            return token
        except mysql.connector.Error as err:
            return None
    
    def verify_reset_token(self, token):
        """Vérifier si un token de reset est valide"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor(dictionary=True)
            
            query = """
            SELECT * FROM password_reset_tokens 
            WHERE token = %s AND expires_at > NOW()
            """
            cursor.execute(query, (token,))
            token_data = cursor.fetchone()
            
            cursor.close()
            conn.close()
            
            return token_data
        except mysql.connector.Error as err:
            return None
    
    def reset_password(self, token, new_password):
        """Réinitialiser le mot de passe"""
        try:
            token_data = self.verify_reset_token(token)
            if not token_data:
                return {'success': False, 'error': 'Token invalide ou expiré'}
            
            hashed_password = self.hash_password(new_password)
            user_id = token_data['user_id']
            
            conn = self.get_connection()
            cursor = conn.cursor()
            
            # Mettre à jour le mot de passe
            query = "UPDATE users SET password = %s WHERE id = %s"
            cursor.execute(query, (hashed_password, user_id))
            
            # Supprimer le token utilisé
            query = "DELETE FROM password_reset_tokens WHERE id = %s"
            cursor.execute(query, (token_data['id'],))
            
            conn.commit()
            cursor.close()
            conn.close()
            
            return {'success': True, 'message': 'Mot de passe réinitialisé avec succès'}
        except mysql.connector.Error as err:
            return {'success': False, 'error': str(err)}