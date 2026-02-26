from flask import Flask, request, jsonify
from flask_cors import CORS
from config import Config
from models.user import User
from models.mrl import MRLModel
from models.gemini import GeminiModel
import jwt
from functools import wraps
from datetime import datetime
import smtplib
from email.mime.text import MIMEText
import os
from werkzeug.utils import secure_filename
from fpdf import FPDF
import io
from flask import send_file

app = Flask(__name__)
app.config['SECRET_KEY'] = Config.SECRET_KEY
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
CORS(app, origins=Config.CORS_ORIGINS)

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

user_model = User()
mrl_model = MRLModel()
gemini_model = GeminiModel()

# ========== MIDDLEWARE ==========
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            try:
                token = request.headers['Authorization'].split(" ")[1]
            except IndexError:
                return jsonify({'error': 'Format de token invalide'}), 401
        
        if not token:
            return jsonify({'error': 'Token manquant'}), 401
        
        try:
            data = jwt.decode(token, Config.SECRET_KEY, algorithms=['HS256'])
            current_user_id = data['user_id']
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expiré'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Token invalide'}), 401
        
        return f(current_user_id, *args, **kwargs)
    
    return decorated

# ========== FONCTIONS UTILITAIRES ==========

def send_reset_email(to_email, reset_link):
    """Envoyer l'email de réinitialisation de mot de passe"""
    subject = "Réinitialisation de votre mot de passe"
    body = (
        "Bonjour,\n\n"
        f"Vous avez demandé à réinitialiser votre mot de passe.\n"
        f"Cliquez sur ce lien pour le réinitialiser : {reset_link}\n\n"
        "Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce message."
    )

    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = Config.EMAIL_FROM
    msg["To"] = to_email

    try:
        with smtplib.SMTP(Config.EMAIL_HOST, Config.EMAIL_PORT) as server:
            if Config.EMAIL_USE_TLS:
                server.starttls()
            server.login(Config.EMAIL_USER, Config.EMAIL_PASSWORD)
            server.sendmail(Config.EMAIL_FROM, [to_email], msg.as_string())
    except Exception as e:
        # On logue l'erreur côté serveur, mais on ne révèle pas de détails au client
        print(f"Erreur lors de l'envoi de l'email de reset: {e}")


# ========== ROUTES ==========

@app.route('/api/auth/register', methods=['POST'])
def register():
    """Créer un nouveau compte"""
    try:
        data = request.get_json()
        
        # Validation
        if not all([data.get('email'), data.get('username'), data.get('password'), data.get('full_name')]):
            return jsonify({'error': 'Données manquantes'}), 400
        
        result = user_model.create_user(
            email=data['email'],
            username=data['username'],
            password=data['password'],
            full_name=data['full_name'],
            phone=data.get('phone', ''),
            farm_name=data.get('farm_name', ''),
            farm_location=data.get('farm_location', '')
        )
        
        if result['success']:
            return jsonify({'message': 'Compte créé avec succès'}), 201
        else:
            return jsonify({'error': result['error']}), 400
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Connexion utilisateur"""
    try:
        data = request.get_json()
        
        if not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Email et mot de passe requis'}), 400
        
        user = user_model.get_user_by_email(data['email'])
        
        if not user:
            return jsonify({'error': 'Utilisateur non trouvé'}), 404
        
        if not user_model.verify_password(data['password'], user['password']):
            return jsonify({'error': 'Mot de passe incorrect'}), 401
        
        # Générer JWT
        token = jwt.encode({
            'user_id': user['id'],
            'email': user['email']
        }, Config.SECRET_KEY, algorithm='HS256')
        
        return jsonify({
            'token': token,
            'user': {
                'id': user['id'],
                'email': user['email'],
                'username': user['username'],
                'full_name': user['full_name'],
                'farm_name': user['farm_name']
            }
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/forgot-password', methods=['POST'])
def forgot_password():
    """Demander un reset de mot de passe"""
    try:
        data = request.get_json()
        
        if not data.get('email'):
            return jsonify({'error': 'Email requis'}), 400
        
        user = user_model.get_user_by_email(data['email'])
        
        if not user:
            # Pour la sécurité, ne pas révéler si l'email existe
            return jsonify({'message': 'Si cet email existe, un lien de reset sera envoyé'}), 200
        
        token = user_model.generate_reset_token(user['id'])

        if not token:
            return jsonify({'error': "Impossible de générer le lien de réinitialisation"}), 500

        reset_link = f"http://localhost:3000/reset-password/{token}"

        # Envoyer l'email au user
        send_reset_email(user['email'], reset_link)

        # En dev, on peut aussi renvoyer le lien pour test rapide
        return jsonify({
            'message': 'Si cet email existe, un lien de reset a été envoyé',
            'reset_link': reset_link  # À retirer en production si tu veux
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    """Réinitialiser le mot de passe"""
    try:
        data = request.get_json()
        
        if not data.get('token') or not data.get('password'):
            return jsonify({'error': 'Token et mot de passe requis'}), 400
        
        result = user_model.reset_password(data['token'], data['password'])
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/profile', methods=['GET'])
@token_required
def get_profile(current_user_id):
    """Récupérer le profil de l'utilisateur"""
    try:
        # Récupérer l'utilisateur par ID (vous devez ajouter cette méthode)
        conn = user_model.get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, email, username, full_name, phone, farm_name, farm_location FROM users WHERE id = %s", (current_user_id,))
        user = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if not user:
            return jsonify({'error': 'Utilisateur non trouvé'}), 404
        
        return jsonify(user), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health():
    """Vérifier l'état du serveur"""
    return jsonify({'status': 'ok'}), 200

# ========== ROUTES MRL ==========

@app.route('/api/mrl/residues/search', methods=['POST'])
@token_required
def search_residue(current_user_id):
    """Rechercher un résidu pesticide"""
    try:
        data = request.get_json()
        substance_name = data.get('substance_name', '').strip()
        
        if not substance_name:
            return jsonify({'error': 'Substance name required'}), 400
        
        residues, url, status, error = mrl_model.search_residue(substance_name)
        
        if error:
            return jsonify({'error': error, 'status': status}), 500 if status is None else status
        
        return jsonify({
            'residues': residues,
            'api_url': url,
            'count': len(residues)
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/mrl/products/search', methods=['POST'])
@token_required
def search_product(current_user_id):
    """Rechercher un produit"""
    try:
        data = request.get_json()
        product_code = data.get('product_code', '').strip()
        language = data.get('language', 'EN')
        
        products, url, status, error = mrl_model.search_product(product_code, language)
        
        if error:
            return jsonify({'error': error, 'status': status}), 500 if status is None else status
        
        return jsonify({
            'products': products,
            'api_url': url,
            'count': len(products)
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/mrl/mrls/get', methods=['POST'])
@token_required
def get_mrls(current_user_id):
    """Récupérer les MRL pour un résidu et produit"""
    try:
        data = request.get_json()
        residue_id = data.get('residue_id')
        product_id = data.get('product_id')
        
        if not residue_id:
            return jsonify({'error': 'Residue ID required'}), 400
        
        mrls, url, status, error = mrl_model.get_mrls(residue_id, product_id)
        
        if error:
            return jsonify({'error': error, 'status': status}), 500 if status is None else status
        
        # Parser les MRL pour trouver la valeur actuelle
        current_mrls = [r for r in mrls if str(r.get('applicability', '')).strip() == '1']
        mrl_numeric = None
        mrl_source = "EU default 0.01 mg/kg"
        
        if current_mrls:
            nums = [mrl_model.parse_mrl(r.get('mrl_value_only') or r.get('mrl_value')) for r in current_mrls]
            nums = [n for n in nums if n is not None]
            if nums:
                mrl_numeric = min(nums)
                mrl_source = "EU Pesticides Database (current)"
        else:
            mrl_numeric = 0.01
        
        return jsonify({
            'mrls': mrls,
            'current_mrl': mrl_numeric,
            'mrl_source': mrl_source,
            'api_url': url,
            'count': len(mrls)
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/mrl/residues/multi-search', methods=['POST'])
@token_required
def multi_search(current_user_id):
    """Recherche groupée pour plusieurs substances et un produit"""
    try:
        data = request.get_json()
        substances = data.get('substances', [])
        product_code = data.get('product_code', '').strip()
        language = data.get('language', 'EN')

        if not substances:
            return jsonify({'error': 'No substances provided'}), 400

        # Identifier le produit
        product = None
        product_id = None
        product_error = None
        if product_code:
            products, p_url, p_status, p_error = mrl_model.search_product(product_code, language)
            if products:
                product = products[0]
                product_id = product.get('product_id')
            product_error = p_error

        results = []
        for s_name in substances:
            entry = {'input_name': s_name}
            residues, r_url, r_status, r_error = mrl_model.search_residue(s_name)
            
            if r_error or not residues:
                entry.update({'error': r_error or 'Not found', 'current_mrl': 0.01, 'mrl_source': 'Default'})
                results.append(entry)
                continue

            residue = residues[0]
            residue_id = residue.get('pesticide_residue_id')
            entry.update({'residue': residue, 'residue_id': residue_id})

            if residue_id and product_id:
                mrls, m_url, m_status, m_error = mrl_model.get_mrls(residue_id, product_id)
                current_mrl = 0.01
                mrl_source = "EU default 0.01 mg/kg"
                if not m_error:
                    current_mrls = [r for r in mrls if str(r.get('applicability', '')).strip() == '1']
                    if current_mrls:
                        nums = [mrl_model.parse_mrl(r.get('mrl_value_only') or r.get('mrl_value')) for r in current_mrls]
                        nums = [n for n in nums if n is not None]
                        if nums:
                            current_mrl = min(nums)
                            mrl_source = "EU Pesticides Database (current)"
                entry.update({'current_mrl': current_mrl, 'mrl_source': mrl_source})
            else:
                entry.update({'current_mrl': 0.01, 'mrl_source': 'Default (no product match)'})
            
            results.append(entry)

        return jsonify({
            'product': product,
            'results': results
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/mrl/analyses/report', methods=['POST'])
@token_required
def generate_report(current_user_id):
    """Générer un rapport PDF récapitulatif"""
    try:
        data = request.get_json()
        results = data.get('results', [])
        product_name = data.get('product_name', 'N/A')
        lot_number = data.get('lot_number', 'N/A')
        decision = data.get('decision', 'N/A')
        
        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("Arial", "B", 16)
        pdf.cell(0, 10, "Rapport d'Analyse - AgriMRL Alert", 0, 1, 'C')
        pdf.ln(5)
        
        pdf.set_font("Arial", "", 12)
        pdf.cell(0, 10, f"Date: {datetime.now().strftime('%d/%m/%Y %H:%M')}", 0, 1)
        pdf.cell(0, 10, f"Produit: {product_name}", 0, 1)
        pdf.cell(0, 10, f"Lot: {lot_number}", 0, 1)
        pdf.ln(5)
        
        pdf.set_font("Arial", "B", 14)
        pdf.cell(0, 10, f"DECISION: {decision}", 0, 1)
        pdf.ln(5)
        
        # Table header
        pdf.set_font("Arial", "B", 10)
        pdf.cell(60, 10, "Substance", 1)
        pdf.cell(40, 10, "Detecte (mg/kg)", 1)
        pdf.cell(40, 10, "LMR (mg/kg)", 1)
        pdf.cell(30, 10, "Statut", 1)
        pdf.ln()
        
        pdf.set_font("Arial", "", 10)
        for r in results:
            name = (r.get('residue_name') or r.get('input_name') or 'N/A')[:30]
            val = f"{float(r.get('detected_value', 0)):.4f}"
            mrl = f"{float(r.get('mrl_value', 0.01)):.4f}"
            status = r.get('compliance_status', 'N/A')
            
            pdf.cell(60, 10, name, 1)
            pdf.cell(40, 10, val, 1)
            pdf.cell(40, 10, mrl, 1)
            pdf.cell(30, 10, status, 1)
            pdf.ln()
            
        pdf_out = io.BytesIO()
        pdf_str = pdf.output(dest='S').encode('latin1')
        pdf_out.write(pdf_str)
        pdf_out.seek(0)
        
        return send_file(
            pdf_out,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f"Rapport_{lot_number}_{datetime.now().strftime('%Y%m%d')}.pdf"
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/mrl/analyses', methods=['POST'])
@token_required
def save_analysis(current_user_id):
    """Sauvegarder une analyse MRL"""
    try:
        data = request.get_json()
        
        # Calculer la conformité
        detected_mg_kg = data.get('detected_value_mg_kg')
        mrl_mg_kg = data.get('mrl_value')
        loq_mg_kg = data.get('loq_value_mg_kg')
        
        if detected_mg_kg is not None and mrl_mg_kg:
            compliance = mrl_model.calculate_compliance(detected_mg_kg, mrl_mg_kg, loq_mg_kg)
            data.update(compliance)
        
        result = mrl_model.save_analysis(current_user_id, data)
        
        if result['success']:
            return jsonify(result), 201
        else:
            return jsonify(result), 400
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/mrl/analyses', methods=['GET'])
@token_required
def get_analyses(current_user_id):
    """Récupérer les analyses de l'utilisateur"""
    try:
        limit = request.args.get('limit', 50, type=int)
        result = mrl_model.get_user_analyses(current_user_id, limit)
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/mrl/products/list', methods=['GET'])
@token_required
def get_products_list(current_user_id):
    """Récupérer la liste des produits courants"""
    try:
        products_list = [
            {
                'name': name,
                'code': code,
                'product_id': pid
            }
            for name, (code, pid) in mrl_model.PRODUCTS.items()
        ]
        return jsonify({'products': products_list}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ========== ROUTES OCR ==========

@app.route('/api/ocr/upload', methods=['POST'])
@token_required
def upload_pdf(current_user_id):
    """Uploader un fichier PDF de bulletin d'analyse"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'Aucun fichier fourni'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'Aucun fichier sélectionné'}), 400
        
        if not file.filename.lower().endswith('.pdf'):
            return jsonify({'error': 'Seuls les fichiers PDF sont acceptés'}), 400
        
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{current_user_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{filename}")
        file.save(file_path)
        file_size = os.path.getsize(file_path)
        
        # Sauvegarder les infos de l'upload
        result = gemini_model.save_upload(current_user_id, filename, file_path, file_size)
        
        if not result['success']:
            return jsonify(result), 400
        
        upload_id = result['upload_id']
        
        # Traiter le PDF avec Gemini Vision API
        try:
            gemini_model.update_upload_status(upload_id, 'processing')

            # ── Extract PDF using Gemini Vision API ──────────────────────
            extracted_data = gemini_model.extract_from_pdf(file_path)

            # Check for errors in extraction
            if extracted_data.get('error'):
                raise Exception(f"Gemini extraction error: {extracted_data.get('error')}")

            # Score de confiance global
            confidence = extracted_data.get('confidence', 0.95)

            # ── Sauvegarder toutes les lignes substance en base ───────────
            save_result = gemini_model.save_extracted_data(upload_id, extracted_data)
            if not save_result['success']:
                raise Exception(save_result.get('error', 'DB save failed'))

            gemini_model.update_upload_status(upload_id, 'completed', confidence)

            return jsonify({
                'success': True,
                'upload_id': upload_id,
                'extracted_data': extracted_data,      # { metadata, results, confidence }
                'confidence': confidence,
                'substances_count': len(extracted_data.get('results', [])),
                'requires_validation': confidence < 0.95
            }), 200
            
        except Exception as e:
            gemini_model.update_upload_status(upload_id, 'failed')
            return jsonify({'error': f'Erreur lors du traitement: {str(e)}'}), 500
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/ocr/uploads', methods=['GET'])
@token_required
def get_uploads(current_user_id):
    """Récupérer les uploads de l'utilisateur"""
    try:
        limit = request.args.get('limit', 20, type=int)
        result = gemini_model.get_user_uploads(current_user_id, limit)
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/ocr/extracted/<int:upload_id>', methods=['GET'])
@token_required
def get_extracted_data(current_user_id, upload_id):
    """Récupérer les données extraites d'un upload"""
    try:
        result = gemini_model.get_extracted_data(upload_id)
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='localhost', port=5000)