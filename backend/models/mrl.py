import mysql.connector
from config import Config
import requests
from decimal import Decimal

class MRLModel:
    BASE_URL = "https://api.datalake.sante.service.ec.europa.eu/sante/pesticides"
    VERSION = "v3.0"
    HEADERS = {"Accept": "application/json"}
    
    UNIT_TABLE = {
        "mg/kg": 1.0, "ppm": 1.0,
        "ppb": 0.001, "µg/kg": 0.001, "ug/kg": 0.001,
        "µg/g": 1.0, "ng/g": 0.001,
    }
    
    PRODUCTS = {
        "Apples": ("0130010", 230),
        "Pears": ("0130020", 231),
        "Tomatoes": ("0231010", 388),
        "Aubergines": ("0231030", 118),
        "Strawberries": ("0154010", 271),
        "Wheat": ("0500010", 640),
        "Oranges": ("0110020", 203),
        "Grapes (table)": ("0163010", 293),
        "Lettuce": ("0251010", 423),
        "Potatoes": ("0213010", 375),
        "Peaches": ("0130040", 232),
        "Peppers": ("0231020", 389),
        "Cucumbers": ("0232010", 391),
    }
    
    # Cache partagé pour les résidus afin d'éviter de requêter
    # l'API complète à chaque recherche (inspiré du code Streamlit).
    _RESIDUES_CACHE = None

    def __init__(self):
        self.db_config = {
            'host': Config.MYSQL_HOST,
            'user': Config.MYSQL_USER,
            'password': Config.MYSQL_PASSWORD,
            'database': Config.MYSQL_DATABASE
        }
    
    def get_connection(self):
        return mysql.connector.connect(**self.db_config)
    
    def call_api(self, endpoint, params):
        """Appel à l'API EU Pesticides"""
        url = f"{self.BASE_URL}/{endpoint}"
        p = dict(params)
        p["api-version"] = self.VERSION
        p["format"] = "json"
        try:
            resp = requests.get(url, params=p, headers=self.HEADERS, timeout=30)
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list):
                    return data, resp.url, 200, None
                if isinstance(data, dict):
                    for k in ["value", "data", "results", "items"]:
                        if k in data and isinstance(data[k], list):
                            return data[k], resp.url, 200, None
                    return [data], resp.url, 200, None
                return [], resp.url, 200, "Unexpected format"
            return [], resp.url, resp.status_code, resp.text[:300]
        except requests.exceptions.Timeout:
            return [], url, None, "Timeout (30s)"
        except requests.exceptions.ConnectionError:
            return [], url, None, "No internet connection"
        except Exception as ex:
            return [], url, None, str(ex)

    def _load_all_residues(self, language="EN"):
        """Charger et mettre en cache toutes les substances depuis l'API EU."""
        if self._RESIDUES_CACHE is not None:
            return self._RESIDUES_CACHE

        residues: list = []
        api_configs = [
            {"url": f"{self.BASE_URL}/pesticide-residues", "version": self.VERSION},
            {"url": f"{self.BASE_URL}/pesticide_residues", "version": "v1.0"},
        ]

        for cfg in api_configs:
            url = cfg["url"]
            params = {"language": language, "format": "json", "api-version": cfg["version"], "$top": 1000}
            try:
                while url:
                    resp = requests.get(url, params=params, headers=self.HEADERS, timeout=30)
                    if resp.status_code != 200: break
                    data = resp.json()
                    items = data.get("value") or data.get("items") or data.get("results") or []
                    if isinstance(data, list): items = data
                    residues.extend(items)
                    url = data.get("@odata.nextLink") or data.get("nextLink") if isinstance(data, dict) else None
                    if url: params = {}
            except Exception: residues = []
            if residues: break

        self._RESIDUES_CACHE = residues
        return residues

    def _find_residue_fuzzy(self, substance_name, language="EN"):
        """Fuzzy-match d'une substance dans le cache local."""
        all_residues = self._load_all_residues(language=language)
        query = substance_name.lower().strip()
        if not query or not all_residues: return None

        # Exact, starts with, contains
        for item in all_residues:
            name = (item.get("pesticide_residue_name") or item.get("PESTICIDE_RESIDUE_NAME") or "").lower().strip()
            if name == query: return item
        for item in all_residues:
            name = (item.get("pesticide_residue_name") or item.get("PESTICIDE_RESIDUE_NAME") or "").lower().strip()
            if name.startswith(query): return item
        for item in all_residues:
            name = (item.get("pesticide_residue_name") or item.get("PESTICIDE_RESIDUE_NAME") or "").lower().strip()
            if query in name: return item
        return None
    
    def search_residue(self, substance_name):
        """Rechercher un résidu pesticide avec stratégies de repli."""
        query = substance_name.strip()
        residues, url, status, error = self.call_api("pesticide-residues", {"pesticide_residue_name": query})

        # Fallbacks (R) or Uppercase
        if not residues and not error and query:
            for alt in [f"{query} (R)", query.upper()]:
                alt_res, alt_url, alt_stat, alt_err = self.call_api("pesticide-residues", {"pesticide_residue_name": alt})
                if alt_res and not alt_err:
                    residues, url, status, error = alt_res, alt_url, alt_stat, alt_err
                    break
        
        # Fuzzy match via cache
        if not residues and not error and query:
            cached = self._find_residue_fuzzy(query)
            if cached:
                residues = [cached]
                url = f"{self.BASE_URL}/pesticide-residues?cached=1"
                status = 200
                error = None

        if residues:
            for r in residues:
                if 'pesticide_residue_id' not in r and 'PESTICIDE_RESIDUE_ID' in r:
                    r['pesticide_residue_id'] = r['PESTICIDE_RESIDUE_ID']
                if 'pesticide_residue_name' not in r and 'PESTICIDE_RESIDUE_NAME' in r:
                    r['pesticide_residue_name'] = r['PESTICIDE_RESIDUE_NAME']
        return residues, url, status, error
    
    def search_product(self, product_code=None, language="EN"):
        """Rechercher un produit"""
        params = {"language": language}
        if product_code:
            params["product_code"] = product_code.strip()
        return self.call_api("pesticide-residues-products", params)
    
    def get_mrls(self, residue_id, product_id=None):
        """Récupérer les MRL pour un résidu et produit"""
        params = {"pesticide_residue_id": residue_id}
        if product_id:
            params["product_id"] = product_id
        return self.call_api("pesticide-residues-mrls", params)
    
    def parse_mrl(self, val):
        """Parser une valeur MRL"""
        if val is None or str(val).strip() in ["—", "N/A", ""]:
            return None
        try:
            return float(str(val).replace("*", "").replace("<", "").replace(">", "").strip())
        except Exception:
            return None
    
    def to_mg_kg(self, value, unit):
        """Convertir une valeur en mg/kg"""
        return value * self.UNIT_TABLE.get(unit.strip().lower(), 1.0)
    
    def calculate_compliance(self, detected_mg_kg, mrl_mg_kg, loq_mg_kg=None):
        """Calculer le score de conformité"""
        if detected_mg_kg > mrl_mg_kg:
            ratio = detected_mg_kg / mrl_mg_kg
            return {
                "score": 0,
                "label": "CRITICAL",
                "status": "CRITICAL",
                "hard_fail": True,
                "reason": f"Detected ({detected_mg_kg:.4f} mg/kg) exceeds MRL ({mrl_mg_kg} mg/kg)",
                "ratio": round(ratio, 4)
            }
        
        if loq_mg_kg and loq_mg_kg > mrl_mg_kg:
            return {
                "score": 0,
                "label": "CRITICAL",
                "status": "CRITICAL",
                "hard_fail": True,
                "reason": f"LOQ ({loq_mg_kg:.4f} mg/kg) is above MRL — analytical method not sensitive enough",
                "ratio": None
            }
        
        ratio = detected_mg_kg / mrl_mg_kg if mrl_mg_kg > 0 else 1.0
        score = round(max(0.0, min(100.0, 100.0 * (1.0 - ratio))), 1)
        
        if score > 80 and ratio < 0.5:
            label = "SAFE"
        elif score >= 40:
            label = "VIGILANCE"
        else:
            label = "CRITICAL"
        
        return {
            "score": score,
            "label": label,
            "status": label,
            "hard_fail": False,
            "reason": "Within limit",
            "ratio": round(ratio, 4)
        }
    
    def save_analysis(self, user_id, data):
        """Sauvegarder une analyse MRL"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            query = """
            INSERT INTO mrl_analyses (
                user_id, lot_number, product_code, product_id_eu, product_name,
                residue_id_eu, residue_name, detected_value, detected_unit,
                detected_value_mg_kg, loq_value, loq_unit, loq_value_mg_kg,
                mrl_value, mrl_source, mrl_regulation, target_market,
                compliance_score, compliance_label, compliance_status, hard_fail,
                ratio_to_mrl, notes
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            """
            
            # Convertir les valeurs numériques en Decimal pour MySQL
            def to_decimal(val):
                if val is None:
                    return None
                try:
                    return Decimal(str(val))
                except:
                    return None
            
            values = (
                user_id,
                data.get('lot_number') or None,
                data.get('product_code') or None,
                data.get('product_id_eu') or None,
                data.get('product_name') or None,
                data.get('residue_id_eu') or None,
                data.get('residue_name') or None,
                to_decimal(data.get('detected_value')),
                data.get('detected_unit') or None,
                to_decimal(data.get('detected_value_mg_kg')),
                to_decimal(data.get('loq_value')),
                data.get('loq_unit') or None,
                to_decimal(data.get('loq_value_mg_kg')),
                to_decimal(data.get('mrl_value')),
                data.get('mrl_source') or None,
                data.get('mrl_regulation') or None,
                data.get('target_market') or None,
                to_decimal(data.get('compliance_score')),
                data.get('compliance_label') or None,
                data.get('compliance_status') or None,
                bool(data.get('hard_fail', False)),
                to_decimal(data.get('ratio_to_mrl')),
                data.get('notes') or None
            )
            
            cursor.execute(query, values)
            analysis_id = cursor.lastrowid
            conn.commit()
            cursor.close()
            conn.close()
            
            return {'success': True, 'analysis_id': analysis_id}
        except mysql.connector.Error as err:
            return {'success': False, 'error': str(err)}
    
    def get_user_analyses(self, user_id, limit=50):
        """Récupérer les analyses d'un utilisateur"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor(dictionary=True)
            
            query = """
            SELECT * FROM mrl_analyses
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT %s
            """
            
            cursor.execute(query, (user_id, limit))
            analyses = cursor.fetchall()
            
            # Convertir les Decimal en float pour JSON
            for analysis in analyses:
                for key, value in analysis.items():
                    if isinstance(value, Decimal):
                        analysis[key] = float(value)
            
            cursor.close()
            conn.close()
            
            return {'success': True, 'analyses': analyses}
        except mysql.connector.Error as err:
            return {'success': False, 'error': str(err)}
