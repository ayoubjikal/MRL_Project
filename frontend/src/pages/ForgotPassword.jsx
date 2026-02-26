import React, { useState } from 'react';
import { authAPI } from '../api/api';
import './Auth.css';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            const response = await authAPI.forgotPassword(email);
            setSuccess(response.data.message);
            setEmail('');
        } catch (err) {
            setError(err.response?.data?.error || 'Erreur lors de la demande');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <div className="brand">
                        <div className="brand-badge">M</div>
                        <div className="brand-text">
                            <span className="brand-name">AgriMRL Alert</span>
                            <span className="brand-tagline">Surveillance des résidus avant export</span>
                        </div>
                    </div>
                    <div className="auth-context">Mot de passe oublié</div>
                </div>

                <h1>Réinitialiser le mot de passe</h1>
                <p className="subtitle">Entrez votre email pour recevoir un lien sécurisé de réinitialisation.</p>

                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">{success}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="votre@email.com"
                        />
                    </div>

                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? 'Envoi en cours...' : 'Envoyer le lien'}
                    </button>
                </form>

                <p className="link-text">
                    <a href="/login">Retour à la connexion</a>
                </p>
            </div>
        </div>
    );
}