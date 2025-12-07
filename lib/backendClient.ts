/**
 * Backend API Client
 * 
 * The backend serves three critical roles:
 * 1. IPFS proxy - handles uploads/downloads without exposing node credentials to browsers
 * 2. Authentication layer - validates Firebase tokens and enforces access control
 * 3. Database - indexes file metadata for fast search (alternative to pure IPFS lookups)
 * 
 * The app can work with just IPFS + Firebase, but the backend dramatically improves UX.
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'https://api-walt.aayushman.dev';

// Log backend URL in development for debugging
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('[Backend Client] Using backend URL:', BACKEND_URL);
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  token?: string;
  headers?: Record<string, string>;
}

/**
 * Make authenticated request to backend API
 */
export async function backendRequest<T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, token, headers = {} } = options;

  const url = `${BACKEND_URL}${endpoint}`;
  
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  const requestOptions: RequestInit = {
    method,
    headers: requestHeaders,
  };

  if (body && (method === 'POST' || method === 'PUT')) {
    requestOptions.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, requestOptions);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        error: `Request failed with status ${response.status}`,
        message: response.statusText || 'Unknown error'
      }));
      const errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`;
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error: any) {
    // Don't log network errors as errors - they might be expected (backend down, etc.)
    if (error.message && !error.message.includes('Failed to fetch') && !error.message.includes('NetworkError')) {
      console.error('Backend API Error:', error);
    }
    throw error;
  }
}

// ============================================
// File Operations
// ============================================

export const BackendFileAPI = {
  /**
   * Upload file to backend (which stores in IPFS + DB)
   * 
   * FormData upload allows progress tracking and large file streaming. Backend handles
   * IPFS chunking and pinning, returning the CID for client-side metadata storage.
   */
  async upload(file: File, token: string, options?: {
    parentFolderId?: string;
    isPinned?: boolean;
  }): Promise<{
    id: string;
    cid: string;
    filename: string;
    size: number;
    mimeType: string;
    isPinned?: boolean;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    if (options?.parentFolderId) {
      formData.append('folderId', options.parentFolderId);
    }
    if (options?.isPinned !== undefined) {
      formData.append('isPinned', String(options.isPinned));
    }

    const url = `${BACKEND_URL}/api/ipfs/upload`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
      const errorMessage = errorData.error || errorData.message || 'Upload failed';
      
      // Provide more helpful error messages
      if (response.status === 0 || response.status === 500) {
        throw new Error(`Cannot connect to backend at ${url}. Make sure backend is running on ${BACKEND_URL}`);
      }
      if (response.status === 401) {
        throw new Error('Authentication failed. Please sign in again.');
      }
      if (response.status === 400 && (errorMessage.includes('Invalid folder') || errorMessage.includes('folder'))) {
        throw new Error('The selected folder no longer exists. Please navigate to a different folder and try again.');
      }
      if (response.status === 413) {
        throw new Error('File too large or storage quota exceeded.');
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    // Backend returns { success: true, file: {...} }
    if (data.file) {
      return data.file;
    }
    return data;
  },

  /**
   * List user's files from backend database
   */
  async list(token: string, folderId?: string | null): Promise<{
    files: any[];
    folders: any[];
  }> {
    const query = folderId ? `?folderId=${folderId}` : '';
    return backendRequest(`/api/ipfs/list${query}`, { token });
  },

  /**
   * Get file metadata
   */
  async get(fileId: string, token: string): Promise<any> {
    return backendRequest(`/api/files/${fileId}`, { token });
  },

  /**
   * Update file metadata
   */
  async update(fileId: string, updates: any, token: string): Promise<any> {
    return backendRequest(`/api/files/${fileId}`, {
      method: 'PUT',
      body: updates,
      token,
    });
  },

  /**
   * Delete file
   */
  async delete(fileId: string, token: string): Promise<void> {
    return backendRequest(`/api/files/${fileId}`, {
      method: 'DELETE',
      token,
    });
  },

  /**
   * Download file from IPFS via backend
   */
  async download(cid: string, token: string): Promise<Blob> {
    const url = `${BACKEND_URL}/api/ipfs/download?cid=${cid}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Download failed');
    }

    return await response.blob();
  },

  /**
   * Upload JSON/data to IPFS via backend
   */
  async addToIPFS(data: string, token: string, pin: boolean = true): Promise<{
    cid: string;
    size: number;
    ipfsUri: string;
  }> {
    return backendRequest('/api/ipfs/add', {
      method: 'POST',
      body: { data, pin },
      token,
    });
  },
};

// ============================================
// Folder Operations
// ============================================

export const BackendFolderAPI = {
  /**
   * Create a new folder in backend database
   */
  async create(name: string, parentFolderId: string | null, token: string): Promise<{
    id: string;
    name: string;
    parent_folder_id: string | null;
    user_id: string;
    created_at: string;
    updated_at: string;
  }> {
    return backendRequest('/api/folders', {
      method: 'POST',
      body: { name, parentFolderId },
      token,
    });
  },

  /**
   * List folders
   */
  async list(token: string, parentFolderId?: string | null): Promise<any[]> {
    const query = parentFolderId ? `?parentFolderId=${parentFolderId}` : '';
    return backendRequest(`/api/folders${query}`, { token });
  },

  /**
   * Update folder
   */
  async update(folderId: string, updates: any, token: string): Promise<any> {
    return backendRequest(`/api/folders/${folderId}`, {
      method: 'PUT',
      body: updates,
      token,
    });
  },

  /**
   * Delete folder
   */
  async delete(folderId: string, token: string): Promise<void> {
    return backendRequest(`/api/folders/${folderId}`, {
      method: 'DELETE',
      token,
    });
  },
};

// ============================================
// User Operations
// ============================================

export const BackendUserAPI = {
  /**
   * Get user profile and storage stats
   */
  async getProfile(token: string): Promise<{
    id: string;
    email: string;
    displayName: string;
    storageUsed: number;
    storageLimit: number;
  }> {
    return backendRequest('/api/user/profile', { token });
  },

  /**
   * Get storage stats
   */
  async getStorageStats(token: string): Promise<{
    used: number;
    limit: number;
    percentage: number;
  }> {
    return backendRequest('/api/user/storage', { token });
  },
};

// ============================================
// Activity Log Operations
// ============================================

export const BackendActivityAPI = {
  /**
   * Get recent activity
   */
  async getRecent(token: string, limit?: number): Promise<any[]> {
    const query = limit ? `?limit=${limit}` : '';
    return backendRequest(`/api/activity${query}`, { token });
  },
};

// ============================================
// Share Operations
// ============================================

export const BackendShareAPI = {
  /**
   * Create share link
   */
  async create(fileId: string, config: any, token: string): Promise<{
    shareId: string;
    shareToken: string;
    shareUrl: string;
    shortCode?: string;
    shortUrl?: string;
  }> {
    return backendRequest('/api/shares', {
      method: 'POST',
      body: { fileId, ...config },
      token,
    });
  },

  /**
   * Get share by token (public access)
   */
  async get(shareToken: string, password?: string): Promise<any> {
    return backendRequest(`/api/shares/${shareToken}`, {
      method: 'POST',
      body: password ? { password } : undefined,
    });
  },

  /**
   * Delete share
   */
  async delete(shareId: string, token: string): Promise<void> {
    return backendRequest(`/api/shares/${shareId}`, {
      method: 'DELETE',
      token,
    });
  },
};

// ============================================
// IPFS Status
// ============================================

export const BackendIPFSAPI = {
  /**
   * Get IPFS node status
   */
  async getStatus(token: string): Promise<{
    healthy: boolean;
    peerCount: number;
    repoSize: number;
    storageMax: number;
  }> {
    return backendRequest('/api/ipfs/status', { token });
  },
};

const backendClient = {
  backendRequest,
  FileAPI: BackendFileAPI,
  FolderAPI: BackendFolderAPI,
  UserAPI: BackendUserAPI,
  ActivityAPI: BackendActivityAPI,
  ShareAPI: BackendShareAPI,
  IPFSAPI: BackendIPFSAPI,
};

export default backendClient;

