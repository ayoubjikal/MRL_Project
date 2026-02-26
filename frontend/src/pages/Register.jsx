import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../api/api';
import './Auth.css';

export default function Register() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        email: '',
        username: '',
        password: '',
        confirmPassword: '',
        full_name: '',
        phone: '',
        farm_name: '',
        farm_location: '',
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

        if (formData.password !== formData.confirmPassword) {
            setError('Les mots de passe ne correspondent pas');
            setLoading(false);
            return;
        }

        try {
            const { confirmPassword, ...submitData } = formData;
            await authAPI.register(submitData);
            navigate('/login');
        } catch (err) {
            setError(err.response?.data?.error || 'Erreur lors de l\'inscription');
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
                    <div className="auth-context">Inscription</div>
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
                        <label>Nom complet</label>
                        <input
                            type="text"
                            name="full_name"
                            value={formData.full_name}
                            onChange={handleChange}
                            required
                            placeholder="Jean Dupont"
                        />
                    </div>

                    <div className="form-group">
                        <label>Nom d'utilisateur</label>
                        <input
                            type="text"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            required
                            placeholder="jeandupont"
                        />
                    </div>

                    <div className="form-group">
                        <label>Téléphone</label>
                        <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder="+33 6 12 34 56 78"
                        />
                    </div>

                    <div className="form-group">
                        <label>Nom de la ferme</label>
                        <input
                            type="text"
                            name="farm_name"
                            value={formData.farm_name}
                            onChange={handleChange}
                            placeholder="Ferme Dupont"
                        />
                    </div>

                    <div className="form-group">
                        <label>Localisation</label>
                        <input
                            type="text"
                            name="farm_location"
                            value={formData.farm_location}
                            onChange={handleChange}
                            placeholder="Ville, Région"
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
                        {loading ? 'Création en cours...' : 'Créer un compte'}
                    </button>
                </form>

                <p className="link-text">
                    Vous avez déjà un compte ? <a href="/login">Se connecter</a>
                </p>
            </div>
        </div>
    );
}