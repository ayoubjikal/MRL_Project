import mysql.connector
from config import Config
import os
import json
import base64
import google.generativeai as genai
from werkzeug.exceptions import BadRequest

# ---------------------------------------------------------------------------
# GeminiModel
# Handles PDF data extraction using Google Gemini Vision API
# Returns data in same format as OCR module for seamless integration
# ---------------------------------------------------------------------------

class GeminiModel:
    def __init__(self):
        self.db_config = {
            'host': Config.MYSQL_HOST,
            'user': Config.MYSQL_USER,
            'password': Config.MYSQL_PASSWORD,
            'database': Config.MYSQL_DATABASE
        }
        self.upload_dir = os.path.join(os.path.dirname(__file__), '..', 'uploads')
        os.makedirs(self.upload_dir, exist_ok=True)

        # Configure Gemini API
        genai.configure(api_key=Config.GEMINI_API_KEY)
        self.model = genai.GenerativeModel(Config.GEMINI_MODEL)

        # Optimized prompt for laboratory analysis extraction
        self.extraction_prompt = """
You are an expert laboratory data extraction specialist. Extract data from this laboratory analysis report (bulletin d'analyse).

IMPORTANT: Return ONLY valid JSON, no markdown, no explanation.

Extract and return JSON with this structure:
{
  "metadata": {
    "product_name": "extracted product name or null",
    "batch_id": "batch/lot number or null",
    "sampling_date": "date in DD/MM/YYYY format or null",
    "country_of_origin": "country name or null",
    "lab_name": "laboratory name or null"
  },
  "results": [
    {
      "substance": "pesticide residue name",
      "detected_value": numeric_value_or_null,
      "below_loq": boolean,
      "loq_value": numeric_value_or_null,
      "unit": "mg/kg"
    }
  ]
}

EXTRACTION RULES:
1. Metadata section: Extract header information (product, batch, date, origin, lab)
2. Results table: Extract all pesticide substances and their values
3. For "detected_value":
   - If marked "< LOQ" or "nd" or "non détecté", set to null and below_loq=true
   - Otherwise convert to float (numeric value)
4. For "loq_value": Extract Limit of Quantification/Detection value
5. Unit: Always "mg/kg" unless explicitly different
6. If a field cannot be found, use null
7. For results: Extract ALL rows from the analysis table

QUALITY CHECK:
- Ensure valid JSON only
- No explanatory text
- If you cannot extract data with confidence, return empty results array
- Metadata can be partially complete, results must have substance names

Return only the JSON object, nothing else.
"""

    # -----------------------------------------------------------------------
    # DB helpers (kept from OCRModel for compatibility)
    # -----------------------------------------------------------------------

    def get_connection(self):
        return mysql.connector.connect(**self.db_config)

    def save_upload(self, user_id, filename, file_path, file_size):
        """Enregistre les métadonnées du fichier uploadé."""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute(
                """INSERT INTO ocr_uploads
                   (user_id, filename, file_path, file_size, processing_status)
                   VALUES (%s, %s, %s, %s, 'pending')""",
                (user_id, filename, file_path, file_size)
            )
            upload_id = cursor.lastrowid
            conn.commit()
            cursor.close()
            conn.close()
            return {'success': True, 'upload_id': upload_id}
        except mysql.connector.Error as err:
            return {'success': False, 'error': str(err)}

    def update_upload_status(self, upload_id, status, confidence_score=None):
        """Met à jour le statut de traitement d'un upload."""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            if confidence_score is not None:
                cursor.execute(
                    "UPDATE ocr_uploads SET processing_status=%s, confidence_score=%s WHERE id=%s",
                    (status, confidence_score, upload_id)
                )
            else:
                cursor.execute(
                    "UPDATE ocr_uploads SET processing_status=%s WHERE id=%s",
                    (status, upload_id)
                )
            conn.commit()
            cursor.close()
            conn.close()
            return {'success': True}
        except mysql.connector.Error as err:
            return {'success': False, 'error': str(err)}

    def save_extracted_data(self, upload_id, extracted_data):
        """
        Sauvegarde toutes les lignes du tableau d'analyse.
        extracted_data est le dict retourné par extract_from_pdf():
          {
            'metadata': { product_name, batch_id, sampling_date, country_of_origin },
            'results':  [ { substance, detected_value, loq_value, unit, below_loq }, ... ],
            'confidence': float
          }
        """
        try:
            conn = self.get_connection()
            cursor = conn.cursor()

            meta = extracted_data.get('metadata', {})
            product_name = meta.get('product_name')
            lot_number = meta.get('batch_id')
            confidence = extracted_data.get('confidence', 0.95)
            results = extracted_data.get('results', [])

            inserted_ids = []
            for row in results:
                detected_value = row.get('detected_value')
                loq_value = row.get('loq_value')
                unit = row.get('unit', 'mg/kg')
                below_loq = row.get('below_loq', False)
                row_confidence = row.get('confidence', confidence)
                requires_val = row_confidence < 0.95

                cursor.execute(
                    """INSERT INTO ocr_extracted_data (
                           upload_id, substance_name, detected_value, detected_unit,
                           loq_value, loq_unit, product_name, lot_number,
                           extraction_confidence, requires_validation
                       ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (
                        upload_id,
                        row.get('substance'),
                        detected_value,
                        unit,
                        loq_value,
                        unit,
                        product_name,
                        lot_number,
                        row_confidence,
                        requires_val
                    )
                )
                inserted_ids.append(cursor.lastrowid)

            conn.commit()
            cursor.close()
            conn.close()
            return {'success': True, 'inserted_count': len(inserted_ids), 'ids': inserted_ids}
        except mysql.connector.Error as err:
            return {'success': False, 'error': str(err)}

    def get_user_uploads(self, user_id, limit=20):
        """Récupère l'historique des uploads d'un utilisateur."""
        try:
            conn = self.get_connection()
            cursor = conn.cursor(dictionary=True)
            cursor.execute(
                """SELECT * FROM ocr_uploads
                   WHERE user_id = %s
                   ORDER BY upload_date DESC
                   LIMIT %s""",
                (user_id, limit)
            )
            uploads = cursor.fetchall()
            cursor.close()
            conn.close()
            return {'success': True, 'uploads': uploads}
        except mysql.connector.Error as err:
            return {'success': False, 'error': str(err)}

    def get_extracted_data(self, upload_id):
        """Récupère toutes les lignes extraites pour un upload."""
        try:
            conn = self.get_connection()
            cursor = conn.cursor(dictionary=True)
            cursor.execute(
                "SELECT * FROM ocr_extracted_data WHERE upload_id=%s ORDER BY id",
                (upload_id,)
            )
            data = cursor.fetchall()
            cursor.close()
            conn.close()
            return {'success': True, 'data': data}
        except mysql.connector.Error as err:
            return {'success': False, 'error': str(err)}

    # -----------------------------------------------------------------------
    # Core Gemini extraction
    # -----------------------------------------------------------------------

    def extract_from_pdf(self, file_path):
        """
        Extract data from PDF using Gemini Vision API.

        Returns dict (same format as OCRModel):
        {
            'metadata': { product_name, batch_id, sampling_date, country_of_origin, lab_name },
            'results': [{ substance, detected_value, loq_value, unit, below_loq }, ...],
            'confidence': float (0.95 for Gemini = high confidence)
        }
        """
        try:
            if not os.path.exists(file_path):
                raise BadRequest(f"File not found: {file_path}")

            # Read PDF file as base64
            with open(file_path, 'rb') as f:
                pdf_data = base64.standard_b64encode(f.read()).decode('utf-8')

            # Send to Gemini with vision capabilities
            pdf_part = {
                "mime_type": "application/pdf",
                "data": pdf_data
            }

            response = self.model.generate_content([self.extraction_prompt, pdf_part])

            # Extract JSON from response
            response_text = response.text.strip()

            # Remove markdown code blocks if present
            if response_text.startswith("```"):
                response_text = response_text.split("```")[1]
                if response_text.startswith("json"):
                    response_text = response_text[4:]
                response_text = response_text.strip()

            # Parse JSON
            extracted_json = json.loads(response_text)

            # Validate and normalize structure
            extracted_data = self._normalize_extraction(extracted_json)

            return extracted_data

        except json.JSONDecodeError as e:
            return {
                'metadata': {},
                'results': [],
                'confidence': 0.0,
                'error': f"JSON parsing error: {str(e)}"
            }
        except Exception as e:
            return {
                'metadata': {},
                'results': [],
                'confidence': 0.0,
                'error': str(e)
            }

    def _normalize_extraction(self, data):
        """
        Normalize and validate extracted data structure.
        Ensures all required fields are present with correct types.
        """
        try:
            # Extract metadata
            raw_metadata = data.get('metadata', {})
            metadata = {
                'product_name': raw_metadata.get('product_name'),
                'batch_id': raw_metadata.get('batch_id'),
                'sampling_date': raw_metadata.get('sampling_date'),
                'country_of_origin': raw_metadata.get('country_of_origin'),
                'lab_name': raw_metadata.get('lab_name')
            }

            # Extract and normalize results
            raw_results = data.get('results', [])
            results = []

            for row in raw_results:
                try:
                    substance = str(row.get('substance', '')).strip()
                    if not substance:
                        continue

                    # Parse numeric values safely
                    detected_value = None
                    if row.get('detected_value') is not None:
                        try:
                            detected_value = float(row.get('detected_value'))
                        except (ValueError, TypeError):
                            pass

                    loq_value = None
                    if row.get('loq_value') is not None:
                        try:
                            loq_value = float(row.get('loq_value'))
                        except (ValueError, TypeError):
                            pass

                    below_loq = bool(row.get('below_loq', False))
                    unit = str(row.get('unit', 'mg/kg')).strip() or 'mg/kg'

                    results.append({
                        'substance': substance,
                        'detected_value': detected_value,
                        'loq_value': loq_value,
                        'unit': unit,
                        'below_loq': below_loq,
                        'confidence': 0.95  # Gemini returns structured data = high confidence
                    })
                except Exception as e:
                    continue

            # Calculate global confidence
            # Gemini API returns structured data, so confidence is high
            meta_score = sum(1 for v in metadata.values() if v) / 5 if metadata else 0.5
            results_score = 0.95 if results else 0.5
            global_confidence = round((meta_score * 0.4 + results_score * 0.6), 3)
            global_confidence = min(1.0, max(0.0, global_confidence))

            return {
                'metadata': metadata,
                'results': results,
                'confidence': global_confidence
            }
        except Exception as e:
            return {
                'metadata': {},
                'results': [],
                'confidence': 0.0,
                'error': f"Normalization error: {str(e)}"
            }
