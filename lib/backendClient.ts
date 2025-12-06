/**
 * Backend API Client
 * Handles all communication with api-walt.aayushman.dev backend
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'https://api-walt.aayushman.dev';

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
      const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Backend API Error:', error);
    throw error;
  }
}

// ============================================
// File Operations
// ============================================

export const BackendFileAPI = {
  /**
   * Upload file to backend (which stores in IPFS + DB)
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
      throw new Error(errorData.error || 'Upload failed');
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
   * Create folder
   */
  async create(name: string, token: string, parentFolderId?: string): Promise<any> {
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

