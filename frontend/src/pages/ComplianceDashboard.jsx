import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { mrlAPI } from '../api/api';
import './Dashboard.css';

export default function ComplianceDashboard() {
    const { user } = useContext(AuthContext);
    const [analyses, setAnalyses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedAnalysis, setSelectedAnalysis] = useState(null);

    useEffect(() => {
        loadAnalyses();
    }, []);

    const loadAnalyses = async () => {
        setLoading(true);
        try {
            const response = await mrlAPI.getAnalyses(100);
            setAnalyses(response.data.analyses || []);
        } catch (err) {
            console.error('Error loading analyses:', err);
        } finally {
            setLoading(false);
        }
    };

    // Calculer les statistiques
    const stats = {
        total: analyses.length,
        safe: analyses.filter(a => a.compliance_status === 'SAFE').length,
        vigilance: analyses.filter(a => a.compliance_status === 'VIGILANCE').length,
        critical: analyses.filter(a => a.compliance_status === 'CRITICAL').length,
    };

    return (
        <div className="dashboard-form-container">
            <h1>Dashboard de Conformité MRL</h1>
            <p className="subtitle">Vue d'ensemble de la conformité de vos analyses</p>

            {/* Statistiques */}
            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
                <div className="stat-card">
                    <div className="stat-value">{stats.total}</div>
                    <div className="stat-label">Total Analyses</div>
                </div>
                <div className="stat-card safe">
                    <div className="stat-value">{stats.safe}</div>
                    <div className="stat-label">Conformes</div>
                </div>
                <div className="stat-card vigilance">
                    <div className="stat-value">{stats.vigilance}</div>
                    <div className="stat-label">Vigilance</div>
                </div>
                <div className="stat-card critical">
                    <div className="stat-value">{stats.critical}</div>
                    <div className="stat-label">Critiques</div>
                </div>
            </div>

            {/* Tableau de synthèse */}
            <div className="dashboard-history">
                <h2>Tableau de Synthèse Décisionnel</h2>
                {loading ? (
                    <p>Chargement...</p>
                ) : analyses.length === 0 ? (
                    <p>Aucune analyse disponible</p>
                ) : (
                    <div className="analyses-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>Produit</th>
                                    <th>Substance</th>
                                    <th>Teneur Détectée</th>
                                    <th>MRL UE</th>
                                    <th>Score</th>
                                    <th>Classification</th>
                                    <th>Décision</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analyses.map(analysis => (
                                    <tr
                                        key={analysis.id}
                                        onClick={() => setSelectedAnalysis(analysis)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <td>{analysis.product_name || '—'}</td>
                                        <td>{analysis.residue_name || '—'}</td>
                                        <td>
                                            {analysis.detected_value_mg_kg != null && typeof analysis.detected_value_mg_kg === 'number'
                                                ? `${analysis.detected_value_mg_kg.toFixed(4)} mg/kg`
                                                : '—'}
                                        </td>
                                        <td>
                                            {analysis.mrl_value != null && typeof analysis.mrl_value === 'number'
                                                ? `${analysis.mrl_value} mg/kg`
                                                : '—'}
                                        </td>
                                        <td>
                                            {analysis.compliance_score != null && typeof analysis.compliance_score === 'number'
                                                ? analysis.compliance_score.toFixed(1)
                                                : '—'}
                                        </td>
                                        <td>
                                            <span className={`status-badge ${analysis.compliance_status?.toLowerCase()}`}>
                                                {analysis.compliance_status || '—'}
                                            </span>
                                        </td>
                                        <td>
                                            {analysis.compliance_status === 'SAFE' ? '✅ Export autorisé' :
                                                analysis.compliance_status === 'VIGILANCE' ? '⚠️ À surveiller' :
                                                    analysis.compliance_status === 'CRITICAL' ? '❌ Export interdit' : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Détails de l'analyse sélectionnée */}
            {selectedAnalysis && (
                <div className="analysis-detail-modal" onClick={() => setSelectedAnalysis(null)}>
                    <div className="analysis-detail-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Détails de l'analyse</h3>
                        <div className="detail-grid">
                            <div><strong>Lot:</strong> {selectedAnalysis.lot_number || '—'}</div>
                            <div><strong>Produit:</strong> {selectedAnalysis.product_name || '—'}</div>
                            <div><strong>Substance:</strong> {selectedAnalysis.residue_name || '—'}</div>
                            <div><strong>Valeur détectée:</strong> {
                                selectedAnalysis.detected_value_mg_kg != null && typeof selectedAnalysis.detected_value_mg_kg === 'number'
                                    ? `${selectedAnalysis.detected_value_mg_kg.toFixed(4)} mg/kg`
                                    : '—'
                            }</div>
                            <div><strong>MRL:</strong> {
                                selectedAnalysis.mrl_value != null && typeof selectedAnalysis.mrl_value === 'number'
                                    ? `${selectedAnalysis.mrl_value} mg/kg`
                                    : '—'
                            }</div>
                            <div><strong>Score:</strong> {
                                selectedAnalysis.compliance_score != null && typeof selectedAnalysis.compliance_score === 'number'
                                    ? selectedAnalysis.compliance_score.toFixed(1)
                                    : '—'
                            }</div>
                            <div><strong>Statut:</strong>
                                <span className={`status-badge ${selectedAnalysis.compliance_status?.toLowerCase()}`}>
                                    {selectedAnalysis.compliance_status || '—'}
                                </span>
                            </div>
                            <div><strong>Date:</strong> {new Date(selectedAnalysis.created_at).toLocaleString()}</div>
                        </div>
                        <button onClick={() => setSelectedAnalysis(null)} className="btn-primary">Fermer</button>
                    </div>
                </div>
            )}
        </div>
    );
}
