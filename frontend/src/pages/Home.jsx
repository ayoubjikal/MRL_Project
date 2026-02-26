import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { Leaf, Tractor, AlertTriangle, Shield, BarChart3, Users } from 'lucide-react';
import './Auth.css';
import '../App.css';

export default function Home() {
    const navigate = useNavigate();
    const handleLogin = () => navigate('/login');
    const handleRegister = () => navigate('/register');

    // Refs pour animations scroll
    const featuresRef = useRef(null);
    const usecasesRef = useRef(null);
    const isFeaturesInView = useInView(featuresRef, { once: true, amount: 0.3 });
    const isUsecasesInView = useInView(usecasesRef, { once: true, amount: 0.3 });

    // Variants pour animations
    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
    };

    return (
        <div className="landing-container">
            <header className="landing-header">
                <div className="landing-brand">
                    <div className="landing-title-block">
                        <h1 className="landing-title">AgriMRL Alert</h1>
                        <p className="landing-tagline">Surveillance des résidus de pesticides avant export</p>
                    </div>
                </div>
                <button className="landing-ghost-btn" onClick={handleLogin}>
                    Se connecter
                </button>
            </header>

            <main className="landing-main">
                {/* Hero principal – style SMAG : fond immersif avec agriculteur + tablette */}
                <section className="landing-hero hero-with-bg">
                    <div className="hero-bg">
                        <img
                            src="https://thumbs.dreamstime.com/b/une-agricultrice-avec-tablette-num%C3%A9rique-sur-un-champ-de-pommes-terre-agriculture-intelligente-et-pr%C3%A9cision-technologie-agricole-270429076.jpg"
                            alt="Agricultrice utilisant une tablette dans son champ pour surveiller les cultures"
                            className="hero-image"
                        />
                        <div className="hero-overlay"></div>
                    </div>

                    <div className="hero-content">
                        <motion.div
                            className="hero-text-block"
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 1, ease: "easeOut" }}
                        >
                            <h2 className="hero-main-title">
                                Anticipez vos risques MRL<br />avant l'exportation
                            </h2>

                            <p className="hero-subtitle">
                                Plateforme professionnelle pour contrôler la conformité de vos lots agricoles aux limites maximales de résidus (MRL) des marchés cibles – avant tout chargement.
                            </p>

                            <div className="landing-actions hero-cta">
                                <motion.button
                                    className="btn-primary cta-primary"
                                    whileHover={{ scale: 1.06 }}
                                    whileTap={{ scale: 0.96 }}
                                    onClick={handleRegister}
                                >
                                    Créer un compte gratuitement
                                </motion.button>

                                <motion.button
                                    className="landing-secondary-btn"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.96 }}
                                    onClick={handleLogin}
                                >
                                    Accéder à mon espace
                                </motion.button>
                            </div>
                        </motion.div>

                        {/* Panel avantages – positionné à droite sur desktop */}
                        <motion.div
                            className="landing-hero-panel hero-panel"
                            initial={{ opacity: 0, x: 60 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.5, duration: 0.9 }}
                        >
                            <p className="landing-panel-title">Contrôle proactif avant expédition</p>
                            <ul className="landing-list">
                                {[
                                    "Centralisation des analyses MRL par lot et culture",
                                    "Comparaison automatique aux seuils des pays destinataires",
                                    "Alertes visuelles immédiates (conforme / surveiller / non conforme)",
                                    "Traçabilité complète et rapports export-ready"
                                ].map((item, i) => (
                                    <motion.li
                                        key={i}
                                        variants={itemVariants}
                                        initial="hidden"
                                        animate="visible"
                                        transition={{ delay: 0.6 + i * 0.12 }}
                                    >
                                        {item}
                                    </motion.li>
                                ))}
                            </ul>
                        </motion.div>
                    </div>
                </section>

                {/* Fonctionnalités */}
                <section ref={featuresRef} className="landing-section landing-features">
                    <motion.h3
                        initial={{ opacity: 0, y: 25 }}
                        animate={isFeaturesInView ? { opacity: 1, y: 0 } : {}}
                        transition={{ duration: 0.7 }}
                    >
                        Une solution conçue pour la conformité export
                    </motion.h3>
                    <div className="landing-feature-grid">
                        {[
                            {
                                icon: <Leaf size={36} />,
                                title: "Suivi multi-lots",
                                desc: "Regroupez analyses, parcelles, cultures et laboratoires pour une visibilité totale avant expédition."
                            },
                            {
                                icon: <BarChart3 size={36} />,
                                title: "Comparaison MRL mondiale",
                                desc: "Seuils actualisés pour l’UE, marchés locaux et internationaux — détection automatique des écarts."
                            },
                            {
                                icon: <AlertTriangle size={36} />,
                                title: "Alertes décisionnelles",
                                desc: "Statut clair et immédiat (vert / orange / rouge) pour valider ou bloquer un lot."
                            }
                        ].map((feature, i) => (
                            <motion.div
                                key={i}
                                className="landing-feature-card"
                                whileHover={{ y: -8, boxShadow: "0 20px 40px rgba(0,0,0,0.25)" }}
                                initial={{ opacity: 0, y: 35 }}
                                animate={isFeaturesInView ? { opacity: 1, y: 0 } : {}}
                                transition={{ delay: i * 0.12, duration: 0.6 }}
                            >
                                <div className="feature-icon">{feature.icon}</div>
                                <h4>{feature.title}</h4>
                                <p>{feature.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* Cas d’usage */}
                <section ref={usecasesRef} className="landing-section landing-usecases">
                    <motion.h3
                        initial={{ opacity: 0, y: 25 }}
                        animate={isUsecasesInView ? { opacity: 1, y: 0 } : {}}
                        transition={{ duration: 0.7 }}
                    >
                        Destinée à toute la filière export
                    </motion.h3>
                    <div className="landing-columns">
                        {[
                            {
                                icon: <Tractor size={32} />,
                                title: "Producteurs & exploitants",
                                desc: "Validez la conformité MRL avant de vous engager sur des volumes export."
                            },
                            {
                                icon: <Users size={32} />,
                                title: "Coopératives & groupements",
                                desc: "Vue consolidée des risques par filière, client et destination."
                            },
                            {
                                icon: <Shield size={32} />,
                                title: "Exportateurs & transformateurs",
                                desc: "Minimisez les refus et renforcez la crédibilité auprès des acheteurs internationaux."
                            }
                        ].map((use, i) => (
                            <motion.div
                                key={i}
                                className="landing-column"
                                whileHover={{ y: -6, boxShadow: "0 15px 30px rgba(0,0,0,0.2)" }}
                                initial={{ opacity: 0, y: 35 }}
                                animate={isUsecasesInView ? { opacity: 1, y: 0 } : {}}
                                transition={{ delay: i * 0.15, duration: 0.6 }}
                            >
                                <div className="column-icon">{use.icon}</div>
                                <h4>{use.title}</h4>
                                <p>{use.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* Étapes */}
                <section className="landing-section landing-how">
                    <h3>Comment ça fonctionne en 4 étapes</h3>
                    <div className="how-steps">
                        {[
                            { num: "01", title: "Import des analyses", desc: "Téléchargez vos résultats laboratoire par lot" },
                            { num: "02", title: "Comparaison MRL", desc: "Matching automatique avec les seuils des destinations" },
                            { num: "03", title: "Alertes intelligentes", desc: "Notifications et statuts visuels immédiats" },
                            { num: "04", title: "Export sécurisé", desc: "Générez rapports traçables conformes douanes" }
                        ].map((step, i) => (
                            <motion.div
                                key={i}
                                className="step-card"
                                whileHover={{ scale: 1.03, y: -4 }}
                                initial={{ opacity: 0, x: -30 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.18, duration: 0.5 }}
                            >
                                <div className="step-num">{step.num}</div>
                                <h4>{step.title}</h4>
                                <p>{step.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* Mission */}
                <section className="landing-section landing-mission">
                    <motion.h3 initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ duration: 0.8 }}>
                        Conformité MRL sans complexité
                    </motion.h3>
                    <p>
                        AgriMRL Alert vous donne les outils clairs et fiables pour contrôler, comparer et documenter vos résidus de pesticides — tout en restant simple et intégré à vos processus export.
                    </p>
                </section>

                {/* CTA final */}
                <section className="landing-section landing-cta">
                    <div className="landing-cta-inner">
                        <div>
                            <h3>Prêt à sécuriser vos exports ?</h3>
                            <p>Commencez dès aujourd’hui à suivre vos lots et à anticiper les risques MRL avant chaque départ.</p>
                        </div>
                        <div className="landing-cta-actions">
                            <motion.button
                                className="btn-primary"
                                whileHover={{ scale: 1.08, boxShadow: "0 12px 30px rgba(12,112,64,0.35)" }}
                                onClick={handleRegister}
                            >
                                Démarrer gratuitement
                            </motion.button>
                            <button className="landing-secondary-btn" onClick={handleLogin}>
                                Se connecter
                            </button>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="landing-footer">
                <p>© {new Date().getFullYear()} AgriMRL Alert • Tous droits réservés</p>
            </footer>
        </div>
    );
}