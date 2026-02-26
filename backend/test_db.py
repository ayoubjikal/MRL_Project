import mysql.connector
from config import Config

try:
    connection = mysql.connector.connect(
        host=Config.MYSQL_HOST,
        user=Config.MYSQL_USER,
        password=Config.MYSQL_PASSWORD,
        database=Config.MYSQL_DATABASE
    )
    
    if connection.is_connected():
        print("✅ Connexion à MySQL réussie!")
        
        cursor = connection.cursor()
        cursor.execute("SELECT DATABASE();")
        database = cursor.fetchone()
        print(f"✅ Base de données: {database[0]}")
        
        cursor.execute("SHOW TABLES;")
        tables = cursor.fetchall()
        print(f"✅ Tables créées: {len(tables)}")
        for table in tables:
            print(f"   - {table[0]}")
        
        cursor.close()
        connection.close()
    else:
        print("❌ Connexion échouée")

except mysql.connector.Error as err:
    if err.errno == 2003:
        print("❌ MySQL n'est pas accessible. Vérifiez que XAMPP est lancé")
    elif err.errno == 1045:
        print("❌ Erreur d'authentification. Vérifiez l'utilisateur et le mot de passe")
    else:
        print(f"❌ Erreur: {err}")