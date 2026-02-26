import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../api/api';
import { AuthContext } from '../context/AuthContext';
import './Auth.css';

export default function Login() {
    const navigate = useNavigate();
    const { login } = useContext(AuthContext);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
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
        setLoading(true);

        try {
            const response = await authAPI.login(formData.email, formData.password);
            login(response.data.user, response.data.token);
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.error || 'Erreur de connexion');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <div className="brand">
                        <div className="brand-text">
                            <span className="brand-name">AgriMRL Alert</span>
                            <span className="brand-tagline">Surveillance des résidus avant export</span>
                        </div>
                    </div>
                    <div className="auth-context">Connexion</div>
                </div>


                {error && <div className="error-message">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            placeholder="votre@email.com"
                        />
                    </div>

                    <div className="form-group">
                        <label>Mot de passe</label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            placeholder="Votre mot de passe"
                        />
                    </div>

                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? 'Connexion en cours...' : 'Se connecter'}
                    </button>
                </form>

                <div className="auth-links">
                    <a href="/forgot-password">Mot de passe oublié ?</a>
                    <p>Pas encore de compte ? <a href="/register">Créer un compte</a></p>
                </div>
            </div>
        </div>
    );
}