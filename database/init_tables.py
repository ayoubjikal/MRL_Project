"""
Script pour initialiser les tables MRL dans la base de données
Utilise mysql-connector-python (compatible avec XAMPP)

Exécuter depuis le répertoire backend:
    python ../database/init_tables.py
"""
import sys
import os

# Ajouter le répertoire backend au path
backend_dir = os.path.join(os.path.dirname(__file__), '..', 'backend')
sys.path.insert(0, backend_dir)

import mysql.connector
from config import Config

def execute_sql_file(cursor, file_path):
    """Exécute un fichier SQL"""
    with open(file_path, 'r', encoding='utf-8') as f:
        sql_content = f.read()
        # Séparer les commandes par ';'
        commands = [cmd.strip() for cmd in sql_content.split(';') if cmd.strip() and not cmd.strip().startswith('--')]
        
        for command in commands:
            if command:
                try:
                    cursor.execute(command)
                    print(f"✓ Exécuté: {command[:50]}...")
                except mysql.connector.Error as err:
                    # Ignorer les erreurs "table already exists"
                    if "already exists" not in str(err).lower():
                        print(f"⚠ Erreur: {err}")
                        print(f"  Commande: {command[:100]}...")

def main():
    try:
        # Connexion à MySQL
        print("Connexion à MySQL...")
        conn = mysql.connector.connect(
            host=Config.MYSQL_HOST,
            user=Config.MYSQL_USER,
            password=Config.MYSQL_PASSWORD,
            database=Config.MYSQL_DATABASE
        )
        
        cursor = conn.cursor()
        print(f"✓ Connecté à la base de données '{Config.MYSQL_DATABASE}'")
        
        # Chemin du fichier SQL
        script_dir = os.path.dirname(os.path.abspath(__file__))
        sql_file = os.path.join(script_dir, 'init_mrl_tables.sql')
        
        if not os.path.exists(sql_file):
            print(f"✗ Fichier non trouvé: {sql_file}")
            return
        
        print(f"\nExécution du script SQL: {sql_file}")
        print("-" * 60)
        
        # Exécuter le fichier SQL
        execute_sql_file(cursor, sql_file)
        
        # Commit des changements
        conn.commit()
        print("-" * 60)
        print("✓ Tables créées avec succès !")
        
        # Vérifier les tables créées
        cursor.execute("SHOW TABLES")
        tables = cursor.fetchall()
        print(f"\nTables dans la base '{Config.MYSQL_DATABASE}':")
        for table in tables:
            print(f"  - {table[0]}")
        
        cursor.close()
        conn.close()
        
    except mysql.connector.Error as err:
        print(f"✗ Erreur MySQL: {err}")
    except Exception as e:
        print(f"✗ Erreur: {e}")

if __name__ == '__main__':
    # Ajouter le répertoire parent au path pour importer config
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
    
    main()
