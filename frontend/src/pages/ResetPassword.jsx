import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authAPI } from '../api/api';
import './Auth.css';

export default function ResetPassword() {
    const { token } = useParams();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        password: '',
        confirmPassword: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('Les mots de passe ne correspondent pas');
            return;
        }

        setLoading(true);

        try {
            await authAPI.resetPassword(token, formData.password);
            navigate('/login');
        } catch (err) {
            setError(err.response?.data?.error || 'Erreur lors de la réinitialisation');
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
                    <div className="auth-context">Réinitialisation</div>
                </div>

                <h1>Créer un nouveau mot de passe</h1>

                {error && <div className="error-message">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Nouveau mot de passe</label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            placeholder="Minimum 6 caractères"
                        />
                    </div>

                    <div className="form-group">
                        <label>Confirmer le mot de passe</label>
                        <input
                            type="password"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            required
                            placeholder="Confirmez le mot de passe"
                        />
                    </div>

                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? 'Réinitialisation en cours...' : 'Réinitialiser'}
                    </button>
                </form>
            </div>
        </div>
    );
}