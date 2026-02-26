import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Sidebar.css';

export default function Sidebar({ activeMenu, setActiveMenu }) {
    const location = useLocation();
    
    const menuItems = [
        {
            id: 'dashboard',
            label: 'Dashboard',
            icon: '📊',
            path: '/dashboard'
        },
        {
            id: 'new-analysis',
            label: 'Nouvelle Analyse',
            icon: '➕',
            path: '/dashboard/new-analysis'
        },
        {
            id: 'history',
            label: 'Historique',
            icon: '📋',
            path: '/dashboard/history'
        },
        {
            id: 'compliance',
            label: 'Conformité MRL',
            icon: '✅',
            path: '/dashboard/compliance'
        },
        {
            id: 'regulations',
            label: 'Base Réglementaire',
            icon: '📚',
            path: '/dashboard/regulations'
        },
        {
            id: 'traceability',
            label: 'Traçabilité & Audit',
            icon: '🔍',
            path: '/dashboard/traceability'
        },
        {
            id: 'ocr',
            label: 'Import OCR',
            icon: '📄',
            path: '/dashboard/ocr'
        },
        {
            id: 'settings',
            label: 'Paramètres',
            icon: '⚙️',
            path: '/dashboard/settings'
        }
    ];
    
    const handleMenuClick = (item) => {
        setActiveMenu(item.id);
    };
    
    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="sidebar-brand">
                    <div className="brand-badge">M</div>
                    <div className="brand-text">
                        <span className="brand-name">AgriMRL Alert</span>
                        <span className="brand-tagline">Conformité MRL</span>
                    </div>
                </div>
            </div>
            
            <nav className="sidebar-nav">
                {menuItems.map(item => (
                    <button
                        key={item.id}
                        className={`sidebar-item ${activeMenu === item.id ? 'active' : ''}`}
                        onClick={() => handleMenuClick(item)}
                    >
                        <span className="sidebar-icon">{item.icon}</span>
                        <span className="sidebar-label">{item.label}</span>
                    </button>
                ))}
            </nav>
        </aside>
    );
}
