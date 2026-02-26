import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Intercepteur pour ajouter le token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const authAPI = {
    register: (data) => api.post('/auth/register', data),
    login: (email, password) => api.post('/auth/login', { email, password }),
    forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
    resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
};

export const userAPI = {
    getProfile: () => api.get('/user/profile'),
};

export const mrlAPI = {
    searchResidue: (substanceName) => api.post('/mrl/residues/search', { substance_name: substanceName }),
    searchProduct: (productCode, language = 'EN') => api.post('/mrl/products/search', { product_code: productCode, language }),
    getMrls: (residueId, productId = null) => api.post('/mrl/mrls/get', { residue_id: residueId, product_id: productId }),
    multiSearchResidues: (substances, productCode, language = 'EN') =>
        api.post('/mrl/residues/multi-search', { substances, product_code: productCode, language }),
    downloadReport: (data) => api.post('/mrl/analyses/report', data, { responseType: 'blob' }),
    saveAnalysis: (data) => api.post('/mrl/analyses', data),
    getAnalyses: (limit = 50) => api.get(`/mrl/analyses?limit=${limit}`),
    getProductsList: () => api.get('/mrl/products/list'),
};

export const ocrAPI = {
    uploadPDF: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post('/ocr/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    },
    getUploads: (limit = 20) => api.get(`/ocr/uploads?limit=${limit}`),
    getExtractedData: (uploadId) => api.get(`/ocr/extracted/${uploadId}`),
};

export default api;