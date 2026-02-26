import React, { useState, useRef, useCallback } from 'react';
import { ocrAPI } from '../api/api';
import './Dashboard.css';

/* ─── Small helpers ───────────────────────────────────────────────────── */

function ConfidenceBadge({ value }) {
    const pct = Math.round(value * 100);
    const cls = pct >= 95 ? 'safe' : pct >= 70 ? 'vigilance' : 'critical';
    return <span className={`status-badge ${cls}`}>{pct}%</span>;
}

function MetaRow({ label, value }) {
    return (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontWeight: 600, minWidth: '160px', color: '#64748b' }}>{label}</span>
            <span style={{ color: value ? '#1e293b' : '#94a3b8', fontStyle: value ? 'normal' : 'italic' }}>
                {value || 'Non trouvé'}
            </span>
        </div>
    );
}

/* ─── Main component ──────────────────────────────────────────────────── */

export default function OCRPage() {
    const [file, setFile] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState(null);   // full response
    const [error, setError] = useState('');
    const [uploads, setUploads] = useState([]);
    const [selectedUploadId, setSelectedUploadId] = useState(null);
    const [savedRows, setSavedRows] = useState([]);
    const fileInputRef = useRef(null);

    /* ── File selection ──────────────────────────────────────────────── */

    const acceptFile = (f) => {
        if (!f) return;
        if (f.type !== 'application/pdf') {
            setError('Veuillez sélectionner un fichier PDF');
            return;
        }
        setFile(f);
        setError('');
        setResult(null);
    };

    const handleFileChange = (e) => acceptFile(e.target.files[0]);
    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setDragging(false);
        acceptFile(e.dataTransfer.files[0]);
    }, []);
    const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
    const handleDragLeave = () => setDragging(false);

    /* ── Upload & parse ──────────────────────────────────────────────── */

    const handleUpload = async () => {
        if (!file) { setError('Veuillez sélectionner un fichier PDF'); return; }
        setUploading(true);
        setError('');
        try {
            const response = await ocrAPI.uploadPDF(file);
            setResult(response.data);
            setFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            loadUploads();
        } catch (err) {
            setError(err.response?.data?.error || "Erreur lors du traitement du PDF");
        } finally {
            setUploading(false);
        }
    };

    /* ── History ─────────────────────────────────────────────────────── */

    const loadUploads = async () => {
        try {
            const r = await ocrAPI.getUploads();
            setUploads(r.data.uploads || []);
        } catch (_) { }
    };

    const loadSavedRows = async (uploadId) => {
        try {
            const r = await ocrAPI.getExtractedData(uploadId);
            setSavedRows(r.data.data || []);
            setSelectedUploadId(uploadId);
        } catch (_) { }
    };

    React.useEffect(() => { loadUploads(); }, []);

    /* ── "Use this substance" → pre-fill dashboard ───────────────────── */

    const useForAnalysis = (row) => {
        const data = {
            substance_name: row.substance || row.substance_name || '',
            product_name: result?.extracted_data?.metadata?.product_name
                || row.product_name || '',
            product_code: result?.extracted_data?.metadata?.product_code
                || row.product_code || '',
            lot_number: result?.extracted_data?.metadata?.batch_id
                || row.lot_number || '',
            detected_value: row.detected_value ?? '',
            detected_unit: row.unit || row.detected_unit || 'mg/kg',
            loq_value: row.loq_value ?? '',
            loq_unit: row.unit || row.loq_unit || 'mg/kg',
            below_loq: row.below_loq || false,
        };
        localStorage.setItem('ocr_extracted_data', JSON.stringify(data));
        localStorage.setItem('ocr_open_tab', 'new-analysis');
        window.location.href = '/dashboard';
    };

    const compareAll = () => {
        if (!result?.extracted_data) return;
        localStorage.setItem('ocr_full_results', JSON.stringify(result.extracted_data));
        localStorage.setItem('ocr_open_tab', 'new-analysis');
        window.location.href = '/dashboard';
    };

    /* ═══════════════════════════════════════════════════════════════════
       RENDER
    ═══════════════════════════════════════════════════════════════════ */
    return (
        <div className="dashboard-form-container">
            <h1>📄 Import OCR — Bulletin d'analyse</h1>
            <p className="subtitle">
                Uploadez un rapport PDF de laboratoire : le système extrait automatiquement
                toutes les substances, valeurs et métadonnées.
            </p>

            {/* ── Upload zone ───────────────────────────────────────────── */}
            <div className="form-section">
                <h3>① Sélectionner le fichier PDF</h3>

                {/* Drag-and-drop zone */}
                <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                        border: `2px dashed ${dragging ? '#3b82f6' : '#cbd5e1'}`,
                        borderRadius: '12px',
                        padding: '36px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: dragging ? '#eff6ff' : '#f8fafc',
                        transition: 'all .2s',
                        marginBottom: '16px',
                    }}
                >
                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>📂</div>
                    {file ? (
                        <div>
                            <strong style={{ color: '#2563eb' }}>{file.name}</strong>
                            <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>
                                {(file.size / 1024).toFixed(1)} KB — Prêt à traiter
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div style={{ fontWeight: 600, color: '#334155' }}>
                                Glisser-déposer un PDF ici
                            </div>
                            <div style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>
                                ou cliquer pour parcourir — PDF uniquement, max 16 MB
                            </div>
                        </div>
                    )}
                </div>

                <input
                    type="file"
                    accept=".pdf"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                />

                {error && <div className="error-message">{error}</div>}

                <button
                    onClick={handleUpload}
                    disabled={!file || uploading}
                    className="btn-primary"
                    style={{ marginTop: '8px' }}
                >
                    {uploading ? '⏳ Extraction en cours...' : '🔍 Analyser le PDF'}
                </button>
            </div>

            {/* ── Results ───────────────────────────────────────────────── */}
            {result && result.extracted_data && (
                <div className="form-section">

                    {/* Global confidence */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        marginBottom: '20px', padding: '12px 16px',
                        background: result.confidence >= 0.95 ? '#f0fdf4' : '#fffbeb',
                        border: `1px solid ${result.confidence >= 0.95 ? '#bbf7d0' : '#fde68a'}`,
                        borderRadius: '8px',
                    }}>
                        <span style={{ fontSize: '22px' }}>
                            {result.confidence >= 0.95 ? '✅' : '⚠️'}
                        </span>
                        <div>
                            <strong>Score de confiance global : </strong>
                            <ConfidenceBadge value={result.confidence} />
                            {result.confidence < 0.95 && (
                                <span style={{ color: '#b45309', marginLeft: '10px', fontSize: '13px' }}>
                                    Validation manuelle recommandée
                                </span>
                            )}
                        </div>
                        <div style={{ marginLeft: 'auto', color: '#64748b', fontSize: '13px' }}>
                            {result.substances_count ?? result.extracted_data.results?.length ?? 0} substance(s) extraite(s)
                        </div>
                    </div>

                    {/* Metadata */}
                    {result.extracted_data.metadata && (
                        <div style={{ marginBottom: '24px' }}>
                            <h3>② Métadonnées du rapport</h3>
                            <div style={{
                                background: '#f8fafc', padding: '16px', borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                            }}>
                                <MetaRow label="Produit" value={result.extracted_data.metadata.product_name} />
                                <MetaRow label="Numéro de lot" value={result.extracted_data.metadata.batch_id} />
                                <MetaRow label="Date prélèvement" value={result.extracted_data.metadata.sampling_date} />
                                <MetaRow label="Pays d'origine" value={result.extracted_data.metadata.country_of_origin} />
                                <MetaRow label="Laboratoire" value={result.extracted_data.metadata.lab_name} />
                            </div>
                        </div>
                    )}

                    {/* Substances table */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h3>③ Résultats d'analyse par substance</h3>
                        <button
                            className="btn-primary"
                            style={{ backgroundColor: '#2563eb' }}
                            onClick={compareAll}
                        >
                            🚀 Comparer TOUTES les substances
                        </button>
                    </div>
                    {result.extracted_data.results && result.extracted_data.results.length > 0 ? (
                        <div className="analyses-table" style={{ overflowX: 'auto' }}>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Substance</th>
                                        <th>Valeur détectée</th>
                                        <th>LOQ</th>
                                        <th>Unité</th>
                                        <th>Statut</th>
                                        <th>Confiance</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.extracted_data.results.map((row, i) => (
                                        <tr key={i}>
                                            <td><strong>{row.substance}</strong></td>
                                            <td>
                                                {row.below_loq
                                                    ? <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>&lt; LOQ</span>
                                                    : (row.detected_value ?? '—')}
                                            </td>
                                            <td>{row.loq_value ?? '—'}</td>
                                            <td><code>{row.unit || 'mg/kg'}</code></td>
                                            <td>
                                                <span className={`status-badge ${row.below_loq ? 'safe' : 'vigilance'}`}>
                                                    {row.below_loq ? 'Non détecté' : 'Détecté'}
                                                </span>
                                            </td>
                                            <td><ConfidenceBadge value={row.confidence} /></td>
                                            <td>
                                                <button
                                                    className="btn-primary"
                                                    style={{ padding: '4px 10px', fontSize: '12px' }}
                                                    onClick={() => useForAnalysis(row)}
                                                >
                                                    Utiliser
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div style={{
                            padding: '24px', textAlign: 'center',
                            background: '#fff7ed', borderRadius: '8px',
                            border: '1px solid #fed7aa', color: '#9a3412'
                        }}>
                            ⚠️ Aucune substance extraite — vérifiez le format du PDF
                        </div>
                    )}
                </div>
            )}

            {/* ── Upload history ────────────────────────────────────────── */}
            <div className="form-section">
                <h3>📋 Historique des uploads</h3>
                {uploads.length === 0 ? (
                    <p style={{ color: '#94a3b8' }}>Aucun fichier uploadé pour l'instant.</p>
                ) : (
                    <div className="analyses-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Fichier</th>
                                    <th>Statut</th>
                                    <th>Confiance</th>
                                    <th>Détails</th>
                                </tr>
                            </thead>
                            <tbody>
                                {uploads.map(upload => (
                                    <React.Fragment key={upload.id}>
                                        <tr>
                                            <td>{new Date(upload.upload_date).toLocaleString('fr-FR')}</td>
                                            <td>{upload.filename}</td>
                                            <td>
                                                <span className={`status-badge ${upload.processing_status === 'completed' ? 'safe' :
                                                    upload.processing_status === 'failed' ? 'critical' : 'vigilance'
                                                    }`}>
                                                    {upload.processing_status}
                                                </span>
                                            </td>
                                            <td>
                                                {upload.confidence_score != null
                                                    ? <ConfidenceBadge value={Number(upload.confidence_score)} />
                                                    : '—'}
                                            </td>
                                            <td>
                                                {upload.processing_status === 'completed' && (
                                                    <button
                                                        className="btn-primary"
                                                        style={{ padding: '4px 10px', fontSize: '12px' }}
                                                        onClick={() => loadSavedRows(upload.id)}
                                                    >
                                                        Voir données
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                        {/* Expanded saved rows */}
                                        {selectedUploadId === upload.id && savedRows.length > 0 && (
                                            <tr>
                                                <td colSpan={5} style={{ padding: 0 }}>
                                                    <div style={{
                                                        background: '#f8fafc',
                                                        padding: '12px 16px',
                                                        borderTop: '1px solid #e2e8f0'
                                                    }}>
                                                        <table style={{ width: '100%', fontSize: '13px' }}>
                                                            <thead>
                                                                <tr>
                                                                    <th>Substance</th>
                                                                    <th>Valeur</th>
                                                                    <th>LOQ</th>
                                                                    <th>Unité</th>
                                                                    <th>Confiance</th>
                                                                    <th>Action</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {savedRows.map((row, i) => (
                                                                    <tr key={i}>
                                                                        <td>{row.substance_name}</td>
                                                                        <td>{row.detected_value ?? '< LOQ'}</td>
                                                                        <td>{row.loq_value ?? '—'}</td>
                                                                        <td>{row.detected_unit}</td>
                                                                        <td><ConfidenceBadge value={Number(row.extraction_confidence)} /></td>
                                                                        <td>
                                                                            <button
                                                                                className="btn-primary"
                                                                                style={{ padding: '3px 8px', fontSize: '11px' }}
                                                                                onClick={() => useForAnalysis({
                                                                                    substance: row.substance_name,
                                                                                    detected_value: row.detected_value,
                                                                                    loq_value: row.loq_value,
                                                                                    unit: row.detected_unit,
                                                                                    below_loq: !row.detected_value,
                                                                                    product_name: row.product_name,
                                                                                    lot_number: row.lot_number,
                                                                                })}
                                                                            >
                                                                                Utiliser
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
