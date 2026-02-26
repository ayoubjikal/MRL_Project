import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { mrlAPI, ocrAPI } from '../api/api';
import './Dashboard.css';

export default function Dashboard({ activeTab: propActiveTab }) {
    const navigate = useNavigate();
    const { user, logout } = useContext(AuthContext);
    const [activeTab, setActiveTab] = useState(propActiveTab || 'new');
    const [analyses, setAnalyses] = useState([]);
    const [loading, setLoading] = useState(false);

    // Formulaire
    const [formData, setFormData] = useState({
        lot_number: '',
        product_code: '',
        product_name: '',
        substance_name: '',
        detected_value: '',
        detected_unit: 'mg/kg',
        loq_value: '',
        loq_unit: 'mg/kg',
        target_market: 'EU',
        notes: ''
    });

    // ── OCR state ────────────────────────────────────────────────────────
    const [pdfFile, setPdfFile] = useState(null);
    const [pdfUploading, setPdfUploading] = useState(false);
    const [pdfError, setPdfError] = useState('');
    const [ocrResults, setOcrResults] = useState(null); // { metadata, results[] }
    const pdfInputRef = React.useRef(null);

    // Résultats de recherche
    const [residueResults, setResidueResults] = useState([]);
    const [productResults, setProductResults] = useState([]);
    const [selectedResidue, setSelectedResidue] = useState(null);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [mrlData, setMrlData] = useState(null);
    const [complianceResult, setComplianceResult] = useState(null);
    const [multiResults, setMultiResults] = useState([]);
    const [substanceInputs, setSubstanceInputs] = useState(['']);
    const [overallDecision, setOverallDecision] = useState(null); // { text, status }

    // Produits courants
    const [commonProducts, setCommonProducts] = useState([]);

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        loadAnalyses();
        loadCommonProducts();

        // Vérifier si des données OCR sont disponibles
        const ocrData = localStorage.getItem('ocr_extracted_data');
        const ocrFull = localStorage.getItem('ocr_full_results');

        if (ocrFull && activeTab === 'new') {
            try {
                const parsed = JSON.parse(ocrFull);
                setOcrResults(parsed);
                // Trigger batch analysis automatically
                handleCompareAllFromOcrInternal(parsed);
                localStorage.removeItem('ocr_full_results');
            } catch (e) { console.error(e); }
        } else if (ocrData && activeTab === 'new') {
            try {
                const parsed = JSON.parse(ocrData);
                setFormData(prev => ({ ...prev, ...parsed }));
                localStorage.removeItem('ocr_extracted_data');
            } catch (e) {
                console.error('Error parsing OCR data:', e);
            }
        }
    }, [user, navigate, activeTab]);

    const handleCompareAllFromOcrInternal = async (resultsArea) => {
        if (!resultsArea || !resultsArea.results) return;
        const substances = resultsArea.results.map(r => r.substance);
        const pCode = resultsArea.metadata?.product_code || formData.product_code;

        setLoading(true);
        try {
            const response = await mrlAPI.multiSearchResidues(substances, pCode);
            const baseResults = response.data.results || [];
            const matchedResults = baseResults.map(item => {
                const ocrRow = resultsArea.results.find(r => r.substance === item.input_name);
                const val = ocrRow?.below_loq ? 0 : (ocrRow?.detected_value || 0);
                return {
                    ...item,
                    detected_value: val,
                    residue_name: item.residue?.pesticide_residue_name || item.input_name,
                    mrl_value: item.current_mrl || 0.01,
                    compliance_status: 'PENDING'
                };
            });
            const updated = matchedResults.map(r => ({ ...r, ...calculateLocalCompliance(r.detected_value, r.mrl_value) }));
            setMultiResults(updated);
            updateOverallDecision(updated);
            if (response.data.product) {
                setSelectedProduct(response.data.product);
                setFormData(prev => ({ ...prev, product_name: response.data.product.product_name, product_code: pCode }));
            }
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const loadAnalyses = async () => {
        try {
            const response = await mrlAPI.getAnalyses();
            setAnalyses(response.data.analyses || []);
        } catch (err) {
            console.error('Error loading analyses:', err);
        }
    };

    // ── OCR handlers ─────────────────────────────────────────────────────
    const handleOcrUpload = async () => {
        if (!pdfFile) return;
        setPdfUploading(true);
        setPdfError('');
        try {
            const response = await ocrAPI.uploadPDF(pdfFile);
            const extracted = response.data.extracted_data;
            setOcrResults(extracted);
            setPdfFile(null);
            if (pdfInputRef.current) pdfInputRef.current.value = '';
        } catch (err) {
            setPdfError(err.response?.data?.error || "Erreur lors de l'analyse PDF");
        } finally {
            setPdfUploading(false);
        }
    };

    const fillFormFromOcr = (row, metadata) => {
        setFormData(prev => ({
            ...prev,
            substance_name: row.substance || '',
            product_name: metadata?.product_name || prev.product_name,
            product_code: metadata?.product_code || prev.product_code,
            lot_number: metadata?.batch_id || metadata?.lot_number || prev.lot_number,
            detected_value: row.below_loq ? '0' : (row.detected_value?.toString() || ''),
            detected_unit: row.unit || 'mg/kg',
            loq_value: row.loq_value?.toString() || '',
            loq_unit: row.unit || 'mg/kg',
        }));
        // Reset previous search results so user starts fresh
        setResidueResults([]);
        setSelectedResidue(null);
        setMrlData(null);
        setComplianceResult(null);
        setOcrResults(null); // hide picker after selection
    };

    const handleCompareAllFromOcr = async () => {
        if (!ocrResults || !ocrResults.results) return;
        const substances = ocrResults.results.map(r => r.substance);
        const pCode = ocrResults.metadata?.product_code || formData.product_code;

        setLoading(true);
        try {
            const response = await mrlAPI.multiSearchResidues(substances, pCode);
            const baseResults = response.data.results || [];

            // Map OCR values to the API results
            const matchedResults = baseResults.map(item => {
                const ocrRow = ocrResults.results.find(r => r.substance === item.input_name);
                const val = ocrRow?.below_loq ? 0 : (ocrRow?.detected_value || 0);
                return {
                    ...item,
                    detected_value: val,
                    residue_name: item.residue?.pesticide_residue_name || item.input_name,
                    mrl_value: item.current_mrl || 0.01,
                    compliance_status: 'PENDING'
                };
            });

            setMultiResults(matchedResults);
            setSelectedProduct(response.data.product);
            setFormData(prev => ({
                ...prev,
                product_name: response.data.product?.product_name || prev.product_name,
                product_code: pCode
            }));

            // Recalculate compliance for all
            const updated = matchedResults.map(r => {
                const comp = calculateLocalCompliance(r.detected_value, r.mrl_value);
                return { ...r, ...comp };
            });
            setMultiResults(updated);
            updateOverallDecision(updated);
            setOcrResults(null);
        } catch (err) {
            alert(err.response?.data?.error || "Erreur lors de l'analyse groupée");
        } finally {
            setLoading(false);
        }
    };

    const loadCommonProducts = async () => {
        try {
            const response = await mrlAPI.getProductsList();
            setCommonProducts(response.data.products || []);
        } catch (err) {
            console.error('Error loading products:', err);
        }
    };

    const handleSearchResidue = async () => {
        if (!formData.substance_name.trim()) return;
        setLoading(true);
        try {
            const response = await mrlAPI.searchResidue(formData.substance_name);
            setResidueResults(response.data.residues || []);
            if (response.data.residues && response.data.residues.length > 0) {
                const residue = response.data.residues[0];
                setSelectedResidue(residue);
                const residueId = residue.pesticide_residue_id || residue.pesticide_residue_id;
                const productId = selectedProduct?.product_id || null;
                await fetchMrls(residueId, productId);
            }
        } catch (err) {
            alert(err.response?.data?.error || 'Erreur lors de la recherche');
        } finally {
            setLoading(false);
        }
    };

    const handleSearchProduct = async () => {
        if (!formData.product_code.trim()) return;
        setLoading(true);
        try {
            const response = await mrlAPI.searchProduct(formData.product_code, 'EN');
            setProductResults(response.data.products || []);
            if (response.data.products && response.data.products.length > 0) {
                const product = response.data.products[0];
                setSelectedProduct(product);
                setFormData(prev => ({
                    ...prev,
                    product_name: product.product_name || '',
                    product_code: product.product_code || formData.product_code
                }));
                // Si on a déjà un résidu sélectionné, récupérer les MRL avec le produit
                if (selectedResidue) {
                    const residueId = selectedResidue.pesticide_residue_id || selectedResidue.pesticide_residue_id;
                    await fetchMrls(residueId, product.product_id);
                }
            }
        } catch (err) {
            alert(err.response?.data?.error || 'Erreur lors de la recherche');
        } finally {
            setLoading(false);
        }
    };

    const fetchMrls = async (residueId, productId = null) => {
        if (!residueId) return;
        try {
            const response = await mrlAPI.getMrls(residueId, productId);
            setMrlData(response.data);
            calculateCompliance(response.data.current_mrl);
        } catch (err) {
            console.error('Error fetching MRLs:', err);
        }
    };

    const calculateLocalCompliance = (detectedMgKg, mrlValue) => {
        if (detectedMgKg === undefined || mrlValue === undefined) return {};
        const ratio = detectedMgKg / mrlValue;
        const hardFail = ratio > 1;
        const rawScore = 100 * (1 - ratio);
        const score = hardFail ? 0 : Math.max(0, Math.min(100, rawScore));
        let label;
        if (hardFail) label = 'CRITICAL';
        else if (score > 80 && ratio < 0.5) label = 'SAFE';
        else if (score >= 40) label = 'VIGILANCE';
        else label = 'CRITICAL';

        return {
            compliance_score: Math.round(score * 10) / 10,
            compliance_status: label,
            hard_fail: hardFail,
            ratio_to_mrl: Math.round(ratio * 10000) / 10000
        };
    };

    const updateOverallDecision = (results) => {
        if (!results.length) {
            setOverallDecision(null);
            return;
        }
        const anyCritical = results.some(r => r.compliance_status === 'CRITICAL' || r.hard_fail);
        const anyVigilance = results.some(r => r.compliance_status === 'VIGILANCE');

        if (anyCritical) setOverallDecision({ text: 'REJET - Non conforme à l\'export', status: 'critical' });
        else if (anyVigilance) setOverallDecision({ text: 'VIGILANCE - Produit à risque', status: 'vigilance' });
        else setOverallDecision({ text: 'CONFORME - Produit exportable', status: 'safe' });
    };

    const handleDownloadReport = async () => {
        setLoading(true);
        try {
            const reportData = {
                results: multiResults.length ? multiResults : [{
                    residue_name: selectedResidue?.pesticide_residue_name || formData.substance_name,
                    detected_value: formData.detected_value,
                    mrl_value: mrlData?.current_mrl,
                    compliance_status: complianceResult?.status
                }],
                product_name: formData.product_name,
                lot_number: formData.lot_number,
                decision: overallDecision?.text || (complianceResult?.hard_fail ? 'REJET' : 'CONFORME')
            };
            const response = await mrlAPI.downloadReport(reportData);
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Rapport_${formData.lot_number || 'export'}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            alert("Erreur lors de la génération du rapport");
        } finally {
            setLoading(false);
        }
    };

    const handleMultiSearch = async () => {
        const substances = substanceInputs.filter(s => s.trim());
        if (!substances.length) return;
        setLoading(true);
        try {
            const response = await mrlAPI.multiSearchResidues(substances, formData.product_code);
            const processed = (response.data.results || []).map(r => ({
                ...r,
                detected_value: 0,
                residue_name: r.residue?.pesticide_residue_name || r.input_name,
                mrl_value: r.current_mrl || 0.01
            }));
            const updated = processed.map(r => ({ ...r, ...calculateLocalCompliance(0, r.mrl_value) }));
            setMultiResults(updated);
            updateOverallDecision(updated);
            if (response.data.product) {
                setSelectedProduct(response.data.product);
                setFormData(prev => ({ ...prev, product_name: response.data.product.product_name }));
            }
        } catch (err) {
            alert(err.response?.data?.error || "Erreur multi-recherche");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveMultiAnalyses = async () => {
        setLoading(true);
        try {
            for (const r of multiResults) {
                const analysisData = {
                    lot_number: formData.lot_number,
                    product_code: formData.product_code,
                    product_id_eu: selectedProduct?.product_id || null,
                    product_name: formData.product_name || selectedProduct?.product_name || '',
                    residue_id_eu: r.residue_id,
                    residue_name: r.residue_name,
                    detected_value: r.detected_value,
                    detected_unit: 'mg/kg',
                    detected_value_mg_kg: r.detected_value,
                    mrl_value: r.mrl_value,
                    mrl_source: r.mrl_source,
                    target_market: formData.target_market,
                    compliance_score: r.compliance_score,
                    compliance_status: r.compliance_status,
                    hard_fail: r.hard_fail,
                    ratio_to_mrl: r.ratio_to_mrl,
                    notes: formData.notes
                };
                await mrlAPI.saveAnalysis(analysisData);
            }
            alert(`Saved ${multiResults.length} analyses`);
            loadAnalyses();
        } catch (err) {
            alert("Error saving analyses");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedResidue || !mrlData) {
            alert('Veuillez rechercher et sélectionner une substance et un produit');
            return;
        }

        setLoading(true);
        try {
            const analysisData = {
                lot_number: formData.lot_number,
                product_code: formData.product_code,
                product_id_eu: selectedProduct?.product_id || null,
                product_name: formData.product_name || selectedProduct?.product_name || '',
                residue_id_eu: selectedResidue.pesticide_residue_id || selectedResidue.pesticide_residue_id,
                residue_name: selectedResidue.pesticide_residue_name || selectedResidue.pesticide_residue_name,
                detected_value: parseFloat(formData.detected_value),
                detected_unit: formData.detected_unit,
                detected_value_mg_kg: complianceResult?.detected_mg_kg,
                loq_value: formData.loq_value ? parseFloat(formData.loq_value) : null,
                loq_unit: formData.loq_unit,
                loq_value_mg_kg: complianceResult?.loq_mg_kg || null,
                mrl_value: mrlData.current_mrl,
                mrl_source: mrlData.mrl_source,
                mrl_regulation: mrlData.mrls?.[0]?.regulation_number || null,
                target_market: formData.target_market,
                compliance_score: complianceResult?.score,
                compliance_label: complianceResult?.label,
                compliance_status: complianceResult?.status,
                hard_fail: complianceResult?.hard_fail || false,
                ratio_to_mrl: complianceResult?.ratio,
                notes: formData.notes
            };

            await mrlAPI.saveAnalysis(analysisData);
            alert('Analyse sauvegardée avec succès !');
            setFormData({
                lot_number: '',
                product_code: '',
                product_name: '',
                substance_name: '',
                detected_value: '',
                detected_unit: 'mg/kg',
                loq_value: '',
                loq_unit: 'mg/kg',
                target_market: 'EU',
                notes: ''
            });
            setSelectedResidue(null);
            setSelectedProduct(null);
            setMrlData(null);
            setComplianceResult(null);
            setResidueResults([]);
            setProductResults([]);
            loadAnalyses();
        } catch (err) {
            alert(err.response?.data?.error || 'Erreur lors de la sauvegarde');
        } finally {
            setLoading(false);
        }
    };

    if (!user) return null;

    // Si on est dans le layout, ne pas afficher le header
    const isInLayout = propActiveTab !== undefined;

    if (activeTab === 'overview') {
        return (
            <div className="dashboard-form-container">
                <h1>Vue d'ensemble</h1>
                <p className="subtitle">Bienvenue sur AgriMRL Alert</p>

                <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
                    <div className="stat-card">
                        <div className="stat-value">{analyses.length}</div>
                        <div className="stat-label">Total Analyses</div>
                    </div>
                    <div className="stat-card safe">
                        <div className="stat-value">{analyses.filter(a => a.compliance_status === 'SAFE').length}</div>
                        <div className="stat-label">Conformes</div>
                    </div>
                    <div className="stat-card critical">
                        <div className="stat-value">{analyses.filter(a => a.compliance_status === 'CRITICAL').length}</div>
                        <div className="stat-label">Critiques</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={isInLayout ? '' : 'dashboard-container'}>
            {!isInLayout && (
                <>
                    <header className="dashboard-header">
                        <div className="dashboard-brand">
                            <div className="brand-badge">M</div>
                            <div className="brand-text">
                                <span className="brand-name">AgriMRL Alert</span>
                                <span className="brand-tagline">Surveillance des résidus avant export</span>
                            </div>
                        </div>
                        <div className="dashboard-user">
                            <span>{user.full_name || user.username}</span>
                            <button onClick={logout} className="btn-logout">Déconnexion</button>
                        </div>
                    </header>

                    <div className="dashboard-tabs">
                        <button
                            className={activeTab === 'new' ? 'active' : ''}
                            onClick={() => setActiveTab('new')}
                        >
                            Nouvelle analyse
                        </button>
                        <button
                            className={activeTab === 'history' ? 'active' : ''}
                            onClick={() => setActiveTab('history')}
                        >
                            Historique ({analyses.length})
                        </button>
                    </div>
                </>
            )}

            <main className={isInLayout ? '' : 'dashboard-main'}>
                {activeTab === 'new' ? (
                    <div className="dashboard-form-container">

                        {/* ═══════════════════════════════════════════════════
                            OCR — Import automatique depuis PDF
                        ═══════════════════════════════════════════════════ */}
                        <div style={{
                            background: 'linear-gradient(135deg,#eff6ff,#e0f2fe)',
                            border: '1.5px solid #93c5fd',
                            borderRadius: '14px',
                            padding: '20px 24px',
                            marginBottom: '28px'
                        }}>
                            <h3 style={{ margin: '0 0 4px', color: '#1d4ed8' }}>
                                📄 Import OCR — Remplissage automatique depuis PDF
                            </h3>
                            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '14px', marginTop: '4px' }}>
                                Uploadez votre bulletin d'analyse PDF : l'OCR extrait toutes les substances
                                et pré-remplit le formulaire automatiquement.
                            </p>

                            {/* File input row */}
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <input
                                    type="file"
                                    accept=".pdf"
                                    ref={pdfInputRef}
                                    onChange={(e) => { setPdfFile(e.target.files[0]); setPdfError(''); }}
                                    style={{ flex: 1, minWidth: '200px' }}
                                    disabled={pdfUploading}
                                />
                                <button
                                    type="button"
                                    className="btn-primary"
                                    onClick={handleOcrUpload}
                                    disabled={!pdfFile || pdfUploading}
                                    style={{ whiteSpace: 'nowrap' }}
                                >
                                    {pdfUploading ? '⏳ Extraction...' : '🔍 Analyser le PDF'}
                                </button>
                            </div>

                            {pdfError && (
                                <div className="error-message" style={{ marginTop: '10px' }}>{pdfError}</div>
                            )}

                            {/* Substance picker after OCR */}
                            {ocrResults && ocrResults.results && ocrResults.results.length > 0 && (
                                <div style={{ marginTop: '16px' }}>
                                    <div style={{ fontWeight: 600, color: '#1e40af', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>✅ {ocrResults.results.length} substance(s) extraite(s)</span>
                                        <button
                                            type="button"
                                            onClick={handleCompareAllFromOcr}
                                            className="btn-primary"
                                            style={{ backgroundColor: '#2563eb', padding: '6px 12px', fontSize: '13px' }}
                                        >
                                            🚀 Comparer toutes les substances
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {ocrResults.results.map((row, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => fillFormFromOcr(row, ocrResults.metadata)}
                                                style={{
                                                    padding: '8px 14px',
                                                    borderRadius: '10px',
                                                    border: '1.5px solid #93c5fd',
                                                    background: row.below_loq ? '#f0fdf4' : 'white',
                                                    cursor: 'pointer',
                                                    textAlign: 'left',
                                                    transition: 'box-shadow .15s',
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 0 3px #bfdbfe'}
                                                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                                            >
                                                <div style={{ fontWeight: 700, fontSize: '13px' }}>{row.substance}</div>
                                                <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>
                                                    {row.below_loq
                                                        ? <span style={{ color: '#16a34a' }}>✓ &lt; LOQ (non détecté)</span>
                                                        : <>{row.detected_value} {row.unit}</>}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {ocrResults && (!ocrResults.results || ocrResults.results.length === 0) && (
                                <div style={{ marginTop: '12px', color: '#b45309', fontSize: '13px' }}>
                                    ⚠️ Aucune substance extraite. Vérifiez le format du PDF.
                                </div>
                            )}
                        </div>

                        <form onSubmit={handleSubmit} className="mrl-form">
                            <div className="form-section">
                                <h3>🌾 Produit / Culture</h3>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Code produit EU</label>
                                        <div className="input-with-button">
                                            <input
                                                type="text"
                                                value={formData.product_code}
                                                onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
                                                placeholder="ex: 0231010"
                                            />
                                            <button type="button" onClick={handleSearchProduct} disabled={loading}>
                                                Rechercher
                                            </button>
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>Ou sélectionner un produit courant</label>
                                        <select
                                            value={formData.product_code}
                                            onChange={async (e) => {
                                                const selected = commonProducts.find(p => p.code === e.target.value);
                                                if (selected) {
                                                    setFormData({
                                                        ...formData,
                                                        product_code: selected.code,
                                                        product_name: selected.name
                                                    });
                                                    // Rechercher le produit via l'API
                                                    setLoading(true);
                                                    try {
                                                        const response = await mrlAPI.searchProduct(selected.code, 'EN');
                                                        if (response.data.products && response.data.products.length > 0) {
                                                            const product = response.data.products[0];
                                                            setSelectedProduct(product);
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                product_name: product.product_name || selected.name
                                                            }));
                                                            // Si on a déjà un résidu, récupérer les MRL
                                                            if (selectedResidue) {
                                                                const residueId = selectedResidue.pesticide_residue_id || selectedResidue.pesticide_residue_id;
                                                                await fetchMrls(residueId, product.product_id);
                                                            }
                                                        }
                                                    } catch (err) {
                                                        console.error('Error searching product:', err);
                                                    } finally {
                                                        setLoading(false);
                                                    }
                                                }
                                            }}
                                        >
                                            <option value="">-- Sélectionner --</option>
                                            {commonProducts.map(p => (
                                                <option key={p.code} value={p.code}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                {selectedProduct && (
                                    <div className="result-card success">
                                        <strong>✅ Produit identifié:</strong> {selectedProduct.product_name}
                                        (ID: {selectedProduct.product_id})
                                    </div>
                                )}
                            </div>

                            <div className="form-section">
                                <h3>🧪 Substances pesticides</h3>
                                <div className="multi-substances-wrapper">
                                    {substanceInputs.map((val, idx) => (
                                        <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                            <input
                                                type="text"
                                                value={val}
                                                onChange={(e) => {
                                                    const next = [...substanceInputs];
                                                    next[idx] = e.target.value;
                                                    setSubstanceInputs(next);
                                                }}
                                                placeholder="ex: Glyphosate"
                                                style={{ flex: 1 }}
                                            />
                                            {substanceInputs.length > 1 && (
                                                <button type="button" onClick={() => setSubstanceInputs(substanceInputs.filter((_, i) => i !== idx))} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px' }}>×</button>
                                            )}
                                        </div>
                                    ))}
                                    <button type="button" onClick={() => setSubstanceInputs([...substanceInputs, ''])} className="btn-secondary" style={{ marginBottom: '12px' }}>+ Ajouter une substance</button>
                                </div>
                                <div className="input-with-button">
                                    <button type="button" onClick={handleMultiSearch} disabled={loading} className="btn-primary">🔍 Rechercher toutes les LMR</button>
                                </div>
                            </div>

                            {overallDecision && (
                                <div className={`export-decision-card ${overallDecision.status}`} style={{
                                    padding: '20px', borderRadius: '12px', marginBottom: '24px',
                                    backgroundColor: overallDecision.status === 'safe' ? '#f0fdf4' : overallDecision.status === 'critical' ? '#fef2f2' : '#fffbeb',
                                    border: `2px solid ${overallDecision.status === 'safe' ? '#22c55e' : overallDecision.status === 'critical' ? '#ef4444' : '#f59e0b'}`
                                }}>
                                    <h4 style={{ margin: '0 0 8px' }}>Décision Export</h4>
                                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{overallDecision.text}</div>
                                    <button type="button" onClick={handleDownloadReport} className="btn-primary" style={{ marginTop: '16px', backgroundColor: '#4b5563' }}>📥 Télécharger Rapport PDF</button>
                                </div>
                            )}

                            {multiResults.length > 0 && (
                                <div className="form-section">
                                    <h3>📊 Résultats de l'analyse groupée</h3>
                                    <div className="analyses-table">
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                                                    <th style={{ padding: '12px' }}>Substance</th>
                                                    <th style={{ padding: '12px' }}>Détecté (mg/kg)</th>
                                                    <th style={{ padding: '12px' }}>LMR (mg/kg)</th>
                                                    <th style={{ padding: '12px' }}>Statut</th>
                                                    <th style={{ padding: '12px' }}>Ratio</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {multiResults.map((r, i) => (
                                                    <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                        <td style={{ padding: '12px' }}>{r.residue_name}</td>
                                                        <td style={{ padding: '12px' }}>
                                                            <input
                                                                type="number"
                                                                step="0.0001"
                                                                value={r.detected_value}
                                                                onChange={(e) => {
                                                                    const val = parseFloat(e.target.value) || 0;
                                                                    const next = [...multiResults];
                                                                    next[i] = { ...next[i], detected_value: val, ...calculateLocalCompliance(val, r.mrl_value) };
                                                                    setMultiResults(next);
                                                                    updateOverallDecision(next);
                                                                }}
                                                                style={{ width: '100px', padding: '4px' }}
                                                            />
                                                        </td>
                                                        <td style={{ padding: '12px' }}>{r.mrl_value}</td>
                                                        <td style={{ padding: '12px' }}>
                                                            <span className={`status-badge ${r.compliance_status.toLowerCase()}`}>
                                                                {r.compliance_status}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '12px' }}>{(r.ratio_to_mrl * 100).toFixed(1)}%</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <button type="button" onClick={handleSaveMultiAnalyses} disabled={loading} className="btn-primary" style={{ marginTop: '16px' }}>💾 Sauvegarder toutes les analyses</button>
                                </div>
                            )}

                            <div className="form-section">
                                <h3>📋 Informations complémentaires</h3>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Numéro de lot</label>
                                        <input
                                            type="text"
                                            value={formData.lot_number}
                                            onChange={(e) => setFormData({ ...formData, lot_number: e.target.value })}
                                            placeholder="ex: LOT-2025-001"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Marché cible</label>
                                        <select
                                            value={formData.target_market}
                                            onChange={(e) => setFormData({ ...formData, target_market: e.target.value })}
                                        >
                                            <option value="EU">EU</option>
                                            <option value="ONSSA">ONSSA</option>
                                            <option value="Codex">Codex</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Notes</label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        rows="3"
                                        placeholder="Notes additionnelles..."
                                    />
                                </div>
                            </div>

                            <button type="submit" className="btn-primary" disabled={loading || !complianceResult}>
                                {loading ? 'Sauvegarde...' : 'Sauvegarder l\'analyse'}
                            </button>
                        </form>
                    </div>
                ) : (
                    <div className="dashboard-history">
                        <h2>Historique des analyses</h2>
                        {analyses.length === 0 ? (
                            <p>Aucune analyse enregistrée</p>
                        ) : (
                            <div className="analyses-table">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Lot</th>
                                            <th>Produit</th>
                                            <th>Substance</th>
                                            <th>Détecté</th>
                                            <th>MRL</th>
                                            <th>Score</th>
                                            <th>Statut</th>
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
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
