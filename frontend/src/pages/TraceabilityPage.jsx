import React, { useState, useEffect } from 'react';
import { mrlAPI } from '../api/api';
import './Dashboard.css';

export default function TraceabilityPage() {
    const [analyses, setAnalyses] = useState([]);
    const [selectedAnalysis, setSelectedAnalysis] = useState(null);

    useEffect(() => {
        loadAnalyses();
    }, []);

    const loadAnalyses = async () => {
        try {
            const response = await mrlAPI.getAnalyses(100);
            setAnalyses(response.data.analyses || []);
        } catch (err) {
            console.error('Error loading analyses:', err);
        }
    };

    const exportAuditLog = (analysis) => {
        const log = {
            'Date de création': new Date(analysis.created_at).toLocaleString(),
            'Numéro de lot': analysis.lot_number || 'N/A',
            'Produit': analysis.product_name || 'N/A',
            'Code produit EU': analysis.product_code || 'N/A',
            'Substance': analysis.residue_name || 'N/A',
            'ID résidu EU': analysis.residue_id_eu || 'N/A',
            'Valeur détectée': analysis.detected_value_mg_kg != null ? `${analysis.detected_value_mg_kg.toFixed(4)} mg/kg` : 'N/A',
            'LOQ': analysis.loq_value_mg_kg != null ? `${analysis.loq_value_mg_kg.toFixed(4)} mg/kg` : 'N/A',
            'MRL appliquée': analysis.mrl_value != null ? `${analysis.mrl_value} mg/kg` : 'N/A',
            'Source MRL': analysis.mrl_source || 'N/A',
            'Réglementation': analysis.mrl_regulation || 'N/A',
            'Marché cible': analysis.target_market || 'N/A',
            'Score de conformité': analysis.compliance_score != null ? analysis.compliance_score.toFixed(1) : 'N/A',
            'Classification': analysis.compliance_status || 'N/A',
            'Hard Fail': analysis.hard_fail ? 'Oui' : 'Non',
            'Ratio MRL': analysis.ratio_to_mrl != null ? `${(analysis.ratio_to_mrl * 100).toFixed(2)}%` : 'N/A',
            'Notes': analysis.notes || 'Aucune'
        };

        const blob = new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-log-${analysis.id}-${new Date(analysis.created_at).toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="dashboard-form-container">
            <h1>Traçabilité & Audit</h1>
            <p className="subtitle">Consultation des logs d'audit et traçabilité complète</p>

            <div className="analyses-table">
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Lot</th>
                            <th>Produit</th>
                            <th>Substance</th>
                            <th>Score</th>
                            <th>Statut</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {analyses.map(analysis => (
                            <tr key={analysis.id}>
                                <td>{new Date(analysis.created_at).toLocaleDateString()}</td>
                                <td>{analysis.lot_number || '—'}</td>
                                <td>{analysis.product_name || '—'}</td>
                                <td>{analysis.residue_name || '—'}</td>
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
                                    <button
                                        onClick={() => setSelectedAnalysis(analysis)}
                                        className="btn-small"
                                    >
                                        Voir détails
                                    </button>
                                    <button
                                        onClick={() => exportAuditLog(analysis)}
                                        className="btn-small"
                                    >
                                        Exporter log
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {selectedAnalysis && (
                <div className="analysis-detail-modal" onClick={() => setSelectedAnalysis(null)}>
                    <div className="analysis-detail-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Log d'Audit - Analyse #{selectedAnalysis.id}</h3>
                        <div className="detail-grid">
                            <div><strong>Date de création:</strong> {new Date(selectedAnalysis.created_at).toLocaleString()}</div>
                            <div><strong>Numéro de lot:</strong> {selectedAnalysis.lot_number || 'N/A'}</div>
                            <div><strong>Produit:</strong> {selectedAnalysis.product_name || 'N/A'}</div>
                            <div><strong>Code produit EU:</strong> {selectedAnalysis.product_code || 'N/A'}</div>
                            <div><strong>Substance:</strong> {selectedAnalysis.residue_name || 'N/A'}</div>
                            <div><strong>ID résidu EU:</strong> {selectedAnalysis.residue_id_eu || 'N/A'}</div>
                            <div><strong>Valeur détectée:</strong> {
                                selectedAnalysis.detected_value_mg_kg != null && typeof selectedAnalysis.detected_value_mg_kg === 'number'
                                    ? `${selectedAnalysis.detected_value_mg_kg.toFixed(4)} mg/kg`
                                    : 'N/A'
                            }</div>
                            <div><strong>LOQ:</strong> {
                                selectedAnalysis.loq_value_mg_kg != null && typeof selectedAnalysis.loq_value_mg_kg === 'number'
                                    ? `${selectedAnalysis.loq_value_mg_kg.toFixed(4)} mg/kg`
                                    : 'N/A'
                            }</div>
                            <div><strong>MRL appliquée:</strong> {
                                selectedAnalysis.mrl_value != null && typeof selectedAnalysis.mrl_value === 'number'
                                    ? `${selectedAnalysis.mrl_value} mg/kg`
                                    : 'N/A'
                            }</div>
                            <div><strong>Source MRL:</strong> {selectedAnalysis.mrl_source || 'N/A'}</div>
                            <div><strong>Réglementation:</strong> {selectedAnalysis.mrl_regulation || 'N/A'}</div>
                            <div><strong>Marché cible:</strong> {selectedAnalysis.target_market || 'N/A'}</div>
                            <div><strong>Score de conformité:</strong> {
                                selectedAnalysis.compliance_score != null && typeof selectedAnalysis.compliance_score === 'number'
                                    ? selectedAnalysis.compliance_score.toFixed(1)
                                    : 'N/A'
                            }</div>
                            <div><strong>Classification:</strong>
                                <span className={`status-badge ${selectedAnalysis.compliance_status?.toLowerCase()}`}>
                                    {selectedAnalysis.compliance_status || 'N/A'}
                                </span>
                            </div>
                            <div><strong>Hard Fail:</strong> {selectedAnalysis.hard_fail ? 'Oui' : 'Non'}</div>
                            <div><strong>Ratio MRL:</strong> {
                                selectedAnalysis.ratio_to_mrl != null
                                    ? `${(selectedAnalysis.ratio_to_mrl * 100).toFixed(2)}%`
                                    : 'N/A'
                            }</div>
                            <div><strong>Notes:</strong> {selectedAnalysis.notes || 'Aucune'}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                            <button onClick={() => exportAuditLog(selectedAnalysis)} className="btn-primary">
                                Exporter log d'audit
                            </button>
                            <button onClick={() => setSelectedAnalysis(null)} className="btn-secondary">
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
