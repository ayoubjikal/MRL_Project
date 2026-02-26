import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import './Dashboard.css';

export default function SettingsPage() {
    const { user } = useContext(AuthContext);

    return (
        <div className="dashboard-form-container">
            <h1>Paramètres</h1>
            <p className="subtitle">Gestion de votre compte et préférences</p>

            <div className="form-section">
                <h3>Informations du compte</h3>
                <div className="form-group">
                    <label>Nom complet</label>
                    <input type="text" value={user?.full_name || ''} disabled />
                </div>
                <div className="form-group">
                    <label>Email</label>
                    <input type="email" value={user?.email || ''} disabled />
                </div>
                <div className="form-group">
                    <label>Nom d'utilisateur</label>
                    <input type="text" value={user?.username || ''} disabled />
                </div>
                <div className="form-group">
                    <label>Nom de la ferme</label>
                    <input type="text" value={user?.farm_name || ''} disabled />
                </div>
                <div className="form-group">
                    <label>Localisation</label>
                    <input type="text" value={user?.farm_location || ''} disabled />
                </div>
            </div>
        </div>
    );
}
