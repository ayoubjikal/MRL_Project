import React from 'react';
import './Dashboard.css';

export default function RegulationsPage() {
    return (
        <div className="dashboard-form-container">
            <h1>Base Réglementaire MRL</h1>
            <p className="subtitle">Gestion de la base de données réglementaire UE</p>

            <div className="info-card">
                <h3>📚 Fonctionnalités à venir</h3>
                <ul>
                    <li>Automatisation du téléchargement des données MRL UE</li>
                    <li>Versioning des LMR et auditabilité historique</li>
                    <li>Gestion des synonymes de substances et codes produits UE</li>
                    <li>Mise à jour automatique hebdomadaire</li>
                </ul>
            </div>
        </div>
    );
}
