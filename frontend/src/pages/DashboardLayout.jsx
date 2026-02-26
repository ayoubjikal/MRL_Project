import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import Dashboard from './Dashboard';
import ComplianceDashboard from './ComplianceDashboard';
import RegulationsPage from './RegulationsPage';
import TraceabilityPage from './TraceabilityPage';
import OCRPage from './OCRPage';
import SettingsPage from './SettingsPage';
import './DashboardLayout.css';

export default function DashboardLayout() {
    const navigate = useNavigate();
    const { user, logout } = useContext(AuthContext);
    const [activeMenu, setActiveMenu] = useState('dashboard');
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // Read redirect flag set by OCRPage "Utiliser" button
    React.useEffect(() => {
        const tab = localStorage.getItem('ocr_open_tab');
        if (tab) {
            localStorage.removeItem('ocr_open_tab');
            setActiveMenu(tab);
        }
    }, []);

    if (!user) {
        navigate('/login');
        return null;
    }

    const renderContent = () => {
        switch (activeMenu) {
            case 'dashboard':
                return <Dashboard activeTab="overview" />;
            case 'new-analysis':
                return <Dashboard activeTab="new" />;
            case 'history':
                return <Dashboard activeTab="history" />;
            case 'compliance':
                return <ComplianceDashboard />;
            case 'regulations':
                return <RegulationsPage />;
            case 'traceability':
                return <TraceabilityPage />;
            case 'ocr':
                return <OCRPage />;
            case 'settings':
                return <SettingsPage />;
            default:
                return <Dashboard activeTab="overview" />;
        }
    };

    return (
        <div className="dashboard-layout">
            <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />

            <div className="dashboard-main-wrapper">
                <header className="dashboard-header">
                    <button
                        className="sidebar-toggle"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                    >
                        ☰
                    </button>
                    <div className="header-spacer"></div>
                    <div className="dashboard-user">
                        <span>{user.full_name || user.username}</span>
                        <button onClick={logout} className="btn-logout">Déconnexion</button>
                    </div>
                </header>

                <main className="dashboard-content">
                    {renderContent()}
                </main>
            </div>
        </div>
    );
}
