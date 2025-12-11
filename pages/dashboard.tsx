/**
 * Dashboard Page - Main File Management Interface
 * 
 * This is the heart of the app: a Google Drive-like interface backed by IPFS.
 * Key architectural decisions:
 * - State lives in useUserFileStorage hook (allows offline-first operation)
 * - Modals are controlled at page level to coordinate global state
 * - File operations are optimistic (UI updates immediately, save happens async)
 * - Keyboard shortcuts mirror Google Drive for familiar UX
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';
import JSZip from 'jszip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/DropdownMenu';
import { useAuth } from '../contexts/AuthContext';
import { useUserFileStorage } from '../hooks/useUserFileStorage';
import { ErrorHandler } from '../lib/errorHandler';
import ShareModal from '../components/ShareModal';
import PreviewModal from '../components/PreviewModal';
import FileDetailsPanel from '../components/FileDetailsPanel';
import SkeletonLoader from '../components/SkeletonLoader';
import StorageCleanupModal from '../components/StorageCleanupModal';
import TagManager from '../components/TagManager';
import FilePreviewHover from '../components/FilePreviewHover';
import ColumnSettings from '../components/ColumnSettings';
import GatewaySettings from '../components/GatewaySettings';
import TwoFactorSetup from '../components/TwoFactorSetup';
import VersionHistory from '../components/VersionHistory';
import NotificationBell from '../components/NotificationBell';
import Toast from '../components/Toast';
import ConfirmationModal from '../components/ConfirmationModal';
import InputModal from '../components/InputModal';
import PaymentModal from '../components/PaymentModal';
import DuplicateFileModal from '../components/DuplicateFileModal';
import { calculatePinningCost, getPinningServiceConfig, getPinningConfigFromEnv, DEFAULT_BILLING_CYCLE_DAYS } from '../lib/pinningService';
import { getOptimizedGatewayUrl } from '../lib/gatewayOptimizer';
import { getFileCache } from '../lib/fileCache';
import { BackendFileAPI } from '../lib/backendClient';
import { getBackendGatewayUrl } from '../lib/shareUtils';
import { checkAccess, getBillingStatus, BillingStatus } from '../lib/billingClient';
import styles from '../styles/Dashboard.module.css';
// RSuite Icons
import FolderIcon from '@rsuite/icons/FolderFill';
import StarIcon from '@rsuite/icons/Star';
import StarOutlineIcon from '@rsuite/icons/Star'; // Using Star for outline (no StarOutline available)
import PinIcon from '@rsuite/icons/Pin';
import PinedIcon from '@rsuite/icons/Pined';
import TrashIcon from '@rsuite/icons/Trash';
import ImageIcon from '@rsuite/icons/Image';
import VideoIcon from '@rsuite/icons/Video';
import AudioIcon from '@rsuite/icons/Audio'; // Using Audio instead of Music
import PageIcon from '@rsuite/icons/Page'; // Using Page for file icons
import TableIcon from '@rsuite/icons/Table';
import ArchiveIcon from '@rsuite/icons/Archive';
import WarningRoundIcon from '@rsuite/icons/WarningRound';
import StorageIcon from '@rsuite/icons/Storage';
import GearIcon from '@rsuite/icons/Gear'; // For cleanup button
// Moon and Sun not available - using emoji fallback in component
import SettingIcon from '@rsuite/icons/Setting';
import VisibleIcon from '@rsuite/icons/Visible';
import FileDownloadIcon from '@rsuite/icons/FileDownload'; // Using FileDownload instead of Download
import SearchIcon from '@rsuite/icons/Search';
import ShareRoundIcon from '@rsuite/icons/ShareRound';
import TagIcon from '@rsuite/icons/Tag';
import EditIcon from '@rsuite/icons/Edit';
import UndoIcon from '@rsuite/icons/Undo'; // Using Undo instead of RotateLeft
import CheckIcon from '@rsuite/icons/Check';
import CloseIcon from '@rsuite/icons/Close';
import FunnelIcon from '@rsuite/icons/Funnel'; // For filter toggle
import TimeIcon from '@rsuite/icons/Time'; // For Recent
import MenuIcon from '@rsuite/icons/Menu'; // For mobile menu
import PeoplesIcon from '@rsuite/icons/Peoples'; // For user icon
import ArrowDownIcon from '@rsuite/icons/ArrowDown'; // For dropdown arrow
import ListIcon from '@rsuite/icons/List'; // For list view button

interface ShareConfig {
  shareId: string;
  enabled: boolean;
  createdDate: number;
  createdBy: string;
  permission: 'viewer' | 'editor';
  expiryDate?: number;
  password?: string;
  accessCount?: number;
  lastAccessedDate?: number;
}

interface UploadedFile {
  id: string;
  name: string;
  ipfsUri: string;
  gatewayUrl: string;
  timestamp: number;
  type: string;
  size?: number;
  // Pinning metadata
  isPinned?: boolean;
  pinService?: string;
  pinDate?: number;
  pinExpiry?: number;
  pinSize?: number;
  autoPinEnabled?: boolean;
  // Folder/organization metadata
  parentFolderId?: string | null;
  isFolder?: boolean;
  starred?: boolean;
  trashed?: boolean;
  trashedDate?: number;
  lastAccessed?: number;
  modifiedDate?: number;
  // Sharing metadata (Phase 3)
  shareConfig?: ShareConfig;
  // Tags
  tags?: string[];
}

interface UploadProgress {
  name: string;
  progress: number;
  status: 'uploading' | 'complete' | 'error';
}

const getFriendlyPinServiceLabel = (): string => {
  const config = getPinningServiceConfig() || getPinningConfigFromEnv();
  const service = config?.service;
  if (service === 'pinata') return 'pinata';
  if (service === 'backend' || service === 'walt') return 'walt';
  return 'local';
};

const BILLING_WARNING_SNOOZE_DAYS = 14;
const BILLING_WARNING_SNOOZE_MS = BILLING_WARNING_SNOOZE_DAYS * 24 * 60 * 60 * 1000;

const Dashboard: NextPage = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadProgress[]>([]);
  const uploadCompleteTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [bulkOperationQueue, setBulkOperationQueue] = useState<UploadProgress[]>([]);
  const bulkOperationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [permanentDeleteQueue, setPermanentDeleteQueue] = useState<UploadProgress[]>([]);
  const permanentDeleteTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const uploadedFilesRef = useRef<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isFileInputProcessingRef = useRef<boolean>(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [savedSearches, setSavedSearches] = useState<Array<{ name: string; query: string; filters: typeof filters }>>([]);
  const [showSavedSearchesMenu, setShowSavedSearchesMenu] = useState(false);
  const [activeView, setActiveView] = useState<'drive' | 'recent' | 'starred' | 'trash'>('drive');
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [shareModalFile, setShareModalFile] = useState<UploadedFile | null>(null);
  const [previewModalFile, setPreviewModalFile] = useState<UploadedFile | null>(null);
  const [detailsPanelFile, setDetailsPanelFile] = useState<UploadedFile | null>(null);
  const [showStorageCleanup, setShowStorageCleanup] = useState(false);
  const [cleanupMode, setCleanupMode] = useState(false);
  const [tagManagerFile, setTagManagerFile] = useState<UploadedFile | null>(null);
  const [hoverPreviewFile, setHoverPreviewFile] = useState<UploadedFile | null>(null);
  const [hoverPreviewPosition, setHoverPreviewPosition] = useState({ x: 0, y: 0 });
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [showGatewaySettings, setShowGatewaySettings] = useState(false);
  const [showTwoFactorSetup, setShowTwoFactorSetup] = useState(false);
  const [versionHistoryFile, setVersionHistoryFile] = useState<UploadedFile | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState({
    name: true,
    size: true,
    type: true,
    modified: true,
    pinStatus: true,
    tags: true,
    starStatus: true,
  });
  const [filters, setFilters] = useState({
    fileType: 'all' as 'all' | 'image' | 'video' | 'audio' | 'document' | 'folder' | 'other',
    pinStatus: 'all' as 'all' | 'pinned' | 'unpinned',
    starStatus: 'all' as 'all' | 'starred' | 'unstarred',
    tags: [] as string[],
    sizeMin: '' as string,
    sizeMax: '' as string,
    dateFrom: '' as string,
    dateTo: '' as string,
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; title?: string; progress?: number } | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isDragging, setIsDragging] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    type?: 'warning' | 'danger' | 'info';
    showSuppressOption?: boolean;
    onSuppressChange?: (suppress: boolean) => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });
  const [inputModal, setInputModal] = useState<{
    isOpen: boolean;
    title: string;
    message?: string;
    placeholder?: string;
    defaultValue?: string;
    onConfirm: (value: string) => void;
  }>({
    isOpen: false,
    title: '',
    onConfirm: () => {}
  });
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showBillingWarning, setShowBillingWarning] = useState(false);
  const [duplicateFileModal, setDuplicateFileModal] = useState<{
    isOpen: boolean;
    fileName: string;
    newFile: UploadedFile | null;
    existingFileIndex: number | null;
    onResolve: (action: 'replace' | 'keepBoth' | 'cancel') => void;
    hasMultipleDuplicates?: boolean;
    remainingCount?: number;
    onYesToAll?: (action: 'replace' | 'keepBoth') => void;
    onNoToAll?: () => void;
  }>({
    isOpen: false,
    fileName: '',
    newFile: null,
    existingFileIndex: null,
    onResolve: () => {},
    hasMultipleDuplicates: false,
    remainingCount: 0
  });
  const [suppressUnpinWarnings, setSuppressUnpinWarnings] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('suppressUnpinWarnings') === 'true';
    }
    return false;
  });
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success', title?: string, progress?: number) => {
    setToast({ message, type, title, progress });
  };

  const getBillingWarningStorageKey = () => {
    return user ? `billing_warning_dismissed_until_${user.uid}` : null;
  };

  const getBillingWarningDismissedUntil = (): number | null => {
    if (typeof window === 'undefined') return null;
    const key = getBillingWarningStorageKey();
    if (!key) return null;
    const raw = localStorage.getItem(key);
    const parsed = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  };

  const dismissBillingWarning = () => {
    const key = getBillingWarningStorageKey();
    if (!key) return;
    const snoozeUntil = Date.now() + BILLING_WARNING_SNOOZE_MS;
    localStorage.setItem(key, snoozeUntil.toString());
    setShowBillingWarning(false);
  };
  
  // Use the IPFS-backed storage hook
  // All file operations go through this hook, which handles:
  // - Saving metadata to IPFS (decentralized, censorship-resistant storage)
  // - Syncing to Firestore (fast queries and search)
  // - Caching (instant access to recently viewed files)
  // - Conflict resolution (handles multiple devices editing simultaneously)
  const { 
    uploadedFiles, 
    loading: filesLoading, 
    error: filesError,
    clearError: clearFilesError,
    addFiles, 
    removeFile, 
    clearAllFiles,
    pinFile,
    unpinFile,
    pinningWarning,
    autoPinEnabled,
    setAutoPinEnabled,
    getStorageStats,
    // Folder functions
    currentFolderId,
    setCurrentFolderId,
    createFolder,
    renameItem,
    moveItem,
    // Organization functions
    toggleStarred,
    moveToTrash,
    restoreFromTrash,
    permanentlyDelete,
    autoCleanupTrash,
    updateLastAccessed,
    // View functions
    getCurrentFolderItems,
    getRecentFiles,
    getStarredItems,
    getTrashedItems,
    getFolderPath,
    // Sorting
    sortBy,
    setSortBy,
    sortDirection,
    setSortDirection,
    // Sharing functions
    enableSharing,
    disableSharing,
    addActivityLog,
    // Duplicate functions
    checkDuplicates,
    duplicateFile,
    getFileDuplicates,
    // Tag functions
    addTags,
    removeTags,
    setTags,
    getAllTags,
    getFilesByTag,
    // Custom Properties functions
    updateCustomProperties
  } = useUserFileStorage(user?.uid || null, async () => {
    // Provide auth token getter for authenticated backend operations
    if (user) {
      return await user.getIdToken();
    }
    return null;
  });

  // Keep ref in sync with uploadedFiles state (must be after useUserFileStorage hook)
  useEffect(() => {
    uploadedFilesRef.current = uploadedFiles;
  }, [uploadedFiles]);

  // Deactivate cleanup mode when switching views/tabs
  useEffect(() => {
    if (cleanupMode) {
      setCleanupMode(false);
      setSelectedFiles(new Set());
    }
  }, [activeView]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load column preferences from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vault_list_columns');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setVisibleColumns(prev => ({ ...prev, ...parsed }));
        } catch (e) {
          console.error('Failed to load column preferences:', e);
        }
      }
    }
  }, []);

  // Save column preferences to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('vault_list_columns', JSON.stringify(visibleColumns));
    }
  }, [visibleColumns]);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) {
      setShowBillingWarning(false);
    }
  }, [user]);

  // Load recent searches and saved searches from localStorage
  useEffect(() => {
    if (user) {
      const saved = localStorage.getItem(`recent_searches_${user.uid}`);
      if (saved) {
        try {
          setRecentSearches(JSON.parse(saved));
        } catch (e) {
          // Ignore parse errors
        }
      }
      const savedSearchesData = localStorage.getItem(`saved_searches_${user.uid}`);
      if (savedSearchesData) {
        try {
          setSavedSearches(JSON.parse(savedSearchesData));
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }, [user]);

  useEffect(() => {
    if (pinningWarning) {
      showToast(pinningWarning, 'error');
    }
  }, [pinningWarning]);

  const isTodayBillingDay = (billingDay?: number) => {
    if (typeof billingDay !== 'number' || Number.isNaN(billingDay)) return false;
    const today = new Date();
    return today.getDate() === billingDay;
  };

  // Load billing status
  const loadBillingStatus = useCallback(async () => {
    const status = await getBillingStatus();
    if (!status) {
      setShowBillingWarning(false);
      return;
    }

    setBillingStatus(status);

    const billingDayToday = isTodayBillingDay(status.billingDay);
    // Only force payment if user exceeds limit AND doesn't have payment info AND (it's billing day OR services are blocked)
    const shouldForcePayment = status.exceedsLimit && !status.paymentInfoReceived && (billingDayToday || status.servicesBlocked);

    if (shouldForcePayment) {
      setShowPaymentModal(true);
      setShowBillingWarning(false);
      return;
    }

    // Get billing warning dismissed until inside callback
    const getBillingWarningDismissedUntil = (): number | null => {
      if (typeof window === 'undefined') return null;
      const key = user ? `billing_warning_dismissed_until_${user.uid}` : null;
      if (!key) return null;
      const raw = localStorage.getItem(key);
      const parsed = raw ? parseInt(raw, 10) : NaN;
      return Number.isFinite(parsed) ? parsed : null;
    };

    const dismissedUntil = getBillingWarningDismissedUntil();
    const now = Date.now();
    const shouldShowWarning = status.exceedsLimit && !billingDayToday && (!dismissedUntil || now >= dismissedUntil);
    setShowBillingWarning(shouldShowWarning);
  }, [user]);

  useEffect(() => {
    if (user) {
      loadBillingStatus();
    }
  }, [user, loadBillingStatus]);

  // Auto-hide upload panel after completion
  useEffect(() => {
    if (uploadQueue.length === 0) {
      return;
    }

    const allComplete = uploadQueue.every(item => item.status === 'complete' || item.status === 'error');
    
    if (allComplete) {
      // Clear any existing timeout
      if (uploadCompleteTimeoutRef.current) {
        clearTimeout(uploadCompleteTimeoutRef.current);
      }
      
      // Auto-hide after 5 seconds
      uploadCompleteTimeoutRef.current = setTimeout(() => {
        setUploadQueue([]);
      }, 5000);
    } else {
      // Clear timeout if uploads are still in progress
      if (uploadCompleteTimeoutRef.current) {
        clearTimeout(uploadCompleteTimeoutRef.current);
        uploadCompleteTimeoutRef.current = null;
      }
    }

    return () => {
      if (uploadCompleteTimeoutRef.current) {
        clearTimeout(uploadCompleteTimeoutRef.current);
      }
    };
  }, [uploadQueue]);

  // Auto-hide bulk operation panel after completion
  useEffect(() => {
    if (bulkOperationQueue.length === 0) {
      return;
    }

    const allComplete = bulkOperationQueue.every(item => item.status === 'complete' || item.status === 'error');
    
    if (allComplete) {
      // Clear any existing timeout
      if (bulkOperationTimeoutRef.current) {
        clearTimeout(bulkOperationTimeoutRef.current);
      }
      
      // Auto-hide after 5 seconds
      bulkOperationTimeoutRef.current = setTimeout(() => {
        setBulkOperationQueue([]);
      }, 5000);
    } else {
      // Clear timeout if operations are still in progress
      if (bulkOperationTimeoutRef.current) {
        clearTimeout(bulkOperationTimeoutRef.current);
        bulkOperationTimeoutRef.current = null;
      }
    }

    return () => {
      if (bulkOperationTimeoutRef.current) {
        clearTimeout(bulkOperationTimeoutRef.current);
      }
    };
  }, [bulkOperationQueue]);

  // Auto-hide permanent delete panel after completion
  useEffect(() => {
    if (permanentDeleteQueue.length === 0) {
      return;
    }

    const allComplete = permanentDeleteQueue.every(item => item.status === 'complete' || item.status === 'error');
    
    if (allComplete) {
      // Clear any existing timeout
      if (permanentDeleteTimeoutRef.current) {
        clearTimeout(permanentDeleteTimeoutRef.current);
      }
      
      // Auto-hide after 5 seconds
      permanentDeleteTimeoutRef.current = setTimeout(() => {
        setPermanentDeleteQueue([]);
        permanentDeleteTimeoutRef.current = null;
      }, 5000);
    } else {
      // Clear timeout if not all complete
      if (permanentDeleteTimeoutRef.current) {
        clearTimeout(permanentDeleteTimeoutRef.current);
        permanentDeleteTimeoutRef.current = null;
      }
    }

    return () => {
      if (permanentDeleteTimeoutRef.current) {
        clearTimeout(permanentDeleteTimeoutRef.current);
      }
    };
  }, [permanentDeleteQueue]);

  const checkBillingAccess = async (): Promise<boolean> => {
    const access = await checkAccess();
    if (!access) {
      return true; // If check fails, allow access (fail open)
    }
    await loadBillingStatus(); // Keep sidebar/modal limits in sync with backend

    if (!access.allowed) {
      // Show payment modal
      setShowPaymentModal(true);
      return false;
    }
    
    return true;
  };

  // Generate search suggestions based on file names
  useEffect(() => {
    if (searchTerm.length > 0) {
      const suggestions = uploadedFiles
        .filter(file => 
          !file.trashed && 
          file.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .map(file => file.name)
        .slice(0, 5);
      setSearchSuggestions(suggestions);
      setShowSuggestions(true);
    } else {
      setSearchSuggestions([]);
      setShowSuggestions(false);
    }
  }, [searchTerm, uploadedFiles]);

  // Save search to recent searches
  const saveSearch = (term: string) => {
    if (!user || !term.trim()) return;
    
    const updated = [term, ...recentSearches.filter(s => s !== term)].slice(0, 10);
    setRecentSearches(updated);
    localStorage.setItem(`recent_searches_${user.uid}`, JSON.stringify(updated));
  };

  // Save current search as a saved search
  const saveCurrentSearch = () => {
    if (!user) return;
    
    const hasActiveSearch = searchTerm.trim() || Object.values(filters).some(v => v !== 'all' && v !== '');
    if (!hasActiveSearch) {
      showToast('No search query or filters to save', 'info');
      return;
    }

    setInputModal({
      isOpen: true,
      title: 'Save Search',
      message: 'Enter a name for this search:',
      placeholder: 'Search name (e.g., "Large PDFs", "Pinned Images")',
      defaultValue: '',
      onConfirm: (name) => {
        if (!name.trim()) {
          setInputModal({ ...inputModal, isOpen: false });
          return;
        }
        const newSavedSearch = {
          name: name.trim(),
          query: searchTerm,
          filters: { ...filters }
        };
        const updated = [...savedSearches.filter(s => s.name !== name.trim()), newSavedSearch];
        setSavedSearches(updated);
        localStorage.setItem(`saved_searches_${user.uid}`, JSON.stringify(updated));
        setInputModal({ ...inputModal, isOpen: false });
        showToast('Search saved successfully', 'success');
      }
    });
  };

  // Load a saved search
  const loadSavedSearch = (savedSearch: { name: string; query: string; filters: typeof filters }) => {
    setSearchTerm(savedSearch.query);
    setFilters(savedSearch.filters);
    setShowSuggestions(false);
    showToast(`Loaded search: ${savedSearch.name}`, 'success');
  };

  // Delete a saved search
  const deleteSavedSearch = (name: string) => {
    if (!user) return;
    const updated = savedSearches.filter(s => s.name !== name);
    setSavedSearches(updated);
    localStorage.setItem(`saved_searches_${user.uid}`, JSON.stringify(updated));
    showToast('Search deleted', 'success');
  };

  // Auto-cleanup trash on mount and when entering trash view
  // Keeps storage costs down by automatically removing old trashed files
  // 30-day retention matches industry standard (Google Drive, Dropbox, etc.)
  useEffect(() => {
    if (activeView === 'trash' && user && uploadedFiles.length > 0) {
      // Cleanup files older than 30 days automatically
      autoCleanupTrash().catch(console.error);
    }
  }, [activeView, user, uploadedFiles.length]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Keyboard shortcuts
   * 
   * Power users expect keyboard shortcuts in file managers. We mirror Google Drive's
   * shortcuts where possible for familiarity. Must handle modal states carefully to
   * avoid shortcut conflicts when typing in inputs.
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts when typing in inputs, textareas, or when modals are open
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || confirmationModal.isOpen || inputModal.isOpen || shareModalFile) {
        // Allow Escape to close modals
        if (e.key === 'Escape' && (confirmationModal.isOpen || inputModal.isOpen || shareModalFile)) {
          if (shareModalFile) {
            setShareModalFile(null);
          } else if (inputModal.isOpen) {
            setInputModal({ ...inputModal, isOpen: false });
          } else if (confirmationModal.isOpen) {
            setConfirmationModal({ ...confirmationModal, isOpen: false });
          }
        }
        return;
      }

      // Ctrl+K or Cmd+K or / - Focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector(`.${styles.searchInput}`) as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      } else if (e.key === '/' && !searchTerm) {
        e.preventDefault();
        const searchInput = document.querySelector(`.${styles.searchInput}`) as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }
      // Escape - Clear search, close menus
      else if (e.key === 'Escape') {
        if (searchTerm) {
          setSearchTerm('');
          setShowSuggestions(false);
        }
        // Dropdowns will close automatically via onOpenChange
      }
      // Ctrl+N or Cmd+N - New folder (when in drive view)
      else if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        if (activeView === 'drive') {
          // Trigger folder creation via input modal directly
          setInputModal({
            isOpen: true,
            title: 'Create Folder',
            message: 'Enter folder name:',
            placeholder: 'Folder name',
            defaultValue: '',
            onConfirm: async (folderName: string) => {
              if (folderName.trim()) {
                const success = await createFolder(folderName.trim(), currentFolderId);
                if (success) {
                  showToast('Folder created successfully', 'success');
                } else {
                  const appError = ErrorHandler.createAppError(new Error('Failed to create folder'));
          showToast(appError.userMessage, 'error');
                }
                setInputModal({ isOpen: false, title: '', message: '', placeholder: '', defaultValue: '', onConfirm: async () => {} });
              }
            }
          });
        }
      }
      // Ctrl+, or Cmd+, - Toggle theme
      else if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setTheme(theme === 'light' ? 'dark' : 'light');
      }
      // 1 - My Drive
      else if (e.key === '1' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setActiveView('drive');
        setCurrentFolderId(null);
      }
      // 2 - Recent
      else if (e.key === '2' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setActiveView('recent');
      }
      // 3 - Starred
      else if (e.key === '3' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setActiveView('starred');
      }
      // 4 - Trash
      else if (e.key === '4' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setActiveView('trash');
      }
      // g then v - Grid view
      else if (e.key === 'g' && !e.ctrlKey && !e.metaKey) {
        // Will handle on next key press
        const handleNextKey = (nextEvent: KeyboardEvent) => {
          if (nextEvent.key === 'v' || nextEvent.key === 'V') {
            e.preventDefault();
            setViewMode('grid');
          } else if (nextEvent.key === 'l' || nextEvent.key === 'L') {
            e.preventDefault();
            setViewMode('list');
          }
          document.removeEventListener('keydown', handleNextKey);
        };
        document.addEventListener('keydown', handleNextKey, { once: true });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [searchTerm, showFilters, activeView, theme, confirmationModal.isOpen, inputModal.isOpen, shareModalFile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle URL navigation for folders
  useEffect(() => {
    if (!router.isReady || !user) return;

    const { folder } = router.query;
    
    if (folder === 'root' || folder === undefined) {
      setCurrentFolderId(null);
    } else if (typeof folder === 'string') {
      // Check if this folder exists in our files
      const folderExists = uploadedFiles.some(f => f.id === folder && f.isFolder);
      if (folderExists) {
        setCurrentFolderId(folder);
      } else {
        // Invalid folder ID, redirect to root
        router.replace('/dashboard?folder=root');
      }
    }
  }, [router.isReady, router.query.folder, uploadedFiles, user, setCurrentFolderId, router]);

  // Update URL when folder changes
  useEffect(() => {
    if (!router.isReady) return;

    const currentFolder = router.query.folder;
    const newFolder = currentFolderId || 'root';
    
    if (currentFolder !== newFolder) {
      router.replace(`/dashboard?folder=${newFolder}`, undefined, { shallow: true });
    }
  }, [currentFolderId, router]);


  // Safety mechanism: reset dragging state if drag seems stuck
  useEffect(() => {
    if (isDragging) {
      const timeout = setTimeout(() => {
        setIsDragging(false);
      }, 5000); // Reset after 5 seconds if still dragging
      
      return () => clearTimeout(timeout);
    }
  }, [isDragging]);

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    // Large file warning (> 100MB)
    const largeFiles = acceptedFiles.filter(f => f.size > 100 * 1024 * 1024);
    if (largeFiles.length > 0) {
      const totalSize = largeFiles.reduce((sum, f) => sum + f.size, 0);
      const costEstimate = calculatePinningCost(totalSize, DEFAULT_BILLING_CYCLE_DAYS);
      const fileNames = largeFiles.map(f => `${f.name} (${formatFileSize(f.size)})`).join(', ');
      setConfirmationModal({
        isOpen: true,
        title: 'Large Files Detected',
        message: `Large files detected:\n${fileNames}\n\nTotal size: ${formatFileSize(totalSize)}\nEstimated pinning cost (${billingCycleTitle}): ${costEstimate}\n\nLarge files may take longer to upload and cost more to pin. Continue?`,
        confirmText: 'Continue',
        cancelText: 'Cancel',
        onConfirm: async () => {
          setConfirmationModal({ ...confirmationModal, isOpen: false });
          await performUpload(acceptedFiles);
        },
        type: 'warning'
      });
      return;
    }
    
    await performUpload(acceptedFiles);
  };

  const handleFolderDrop = async (folderId: string, acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    // Large file warning (> 100MB)
    const largeFiles = acceptedFiles.filter(f => f.size > 100 * 1024 * 1024);
    if (largeFiles.length > 0) {
      const totalSize = largeFiles.reduce((sum, f) => sum + f.size, 0);
      const costEstimate = calculatePinningCost(totalSize, DEFAULT_BILLING_CYCLE_DAYS);
      const fileNames = largeFiles.map(f => `${f.name} (${formatFileSize(f.size)})`).join(', ');
      setConfirmationModal({
        isOpen: true,
        title: 'Large Files Detected',
        message: `Large files detected:\n${fileNames}\n\nTotal size: ${formatFileSize(totalSize)}\nEstimated pinning cost (${billingCycleTitle}): ${costEstimate}\n\nLarge files may take longer to upload and cost more to pin. Continue?`,
        confirmText: 'Continue',
        cancelText: 'Cancel',
        onConfirm: async () => {
          setConfirmationModal({ ...confirmationModal, isOpen: false });
          await performUploadToFolder(acceptedFiles, folderId);
        },
        type: 'warning'
      });
      return;
    }
    
    await performUploadToFolder(acceptedFiles, folderId);
  };

  const handleFileMove = async (fileId: string, targetFolderId: string | null) => {
    const fileIndex = uploadedFiles.findIndex(f => f.id === fileId);
    if (fileIndex === -1) {
      setIsDragging(false);
      return;
    }

    const success = await moveItem(fileIndex, targetFolderId);
    if (success) {
      showToast(`File moved to ${targetFolderId ? 'folder' : 'root'}`, 'success');
    } else {
      const appError = ErrorHandler.createAppError(new Error('Failed to move file'));
      showToast(appError.userMessage, 'error');
    }
    
    // Reset dragging state after move
    setIsDragging(false);
  };

  const performUploadToFolder = async (acceptedFiles: File[], folderId: string) => {
    if (!user) {
      showToast('Please sign in to upload files', 'error');
      return;
    }

    // Check for duplicates BEFORE uploading
    const filesToUpload: File[] = [];
    const filesToProcess: { file: File; duplicateFileId: string; duplicateFile: UploadedFile }[] = [];

    for (const file of acceptedFiles) {
      // Check for duplicates by name in the same folder (primary check)
      // Size check is secondary - if both have sizes and they match, it's more confident
      const existingFile = uploadedFiles.find(f => 
        !f.isFolder &&
        !f.trashed &&
        f.parentFolderId === folderId &&
        f.name.toLowerCase() === file.name.toLowerCase()
      );

      if (existingFile) {
        // Found a duplicate - will show modal
        filesToProcess.push({ 
          file, 
          duplicateFileId: existingFile.id,
          duplicateFile: existingFile
        });
      } else {
        // No duplicate, add to upload queue
        filesToUpload.push(file);
      }
    }

    // Process duplicates one at a time BEFORE uploading
    let batchAction: 'replace' | 'keepBoth' | null = null;
    let applyToAll = false;
    
    for (let i = 0; i < filesToProcess.length; i++) {
      const { file, duplicateFileId, duplicateFile } = filesToProcess[i];
      const remainingCount = filesToProcess.length - i - 1;
      const hasMultiple = filesToProcess.length > 1;
      
      // If "Yes to All" was selected, apply the batch action to all remaining files
      if (applyToAll && batchAction) {
        if (batchAction === 'replace') {
          const currentFiles = uploadedFilesRef.current;
          const fileIndex = currentFiles.findIndex(f => f.id === duplicateFileId);
          if (fileIndex !== -1) {
            await removeFile(fileIndex);
          }
          filesToUpload.push(file);
        } else {
          const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
          const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
          let newName = `${nameWithoutExt} (1)${ext}`;
          let counter = 1;
          const currentFiles = uploadedFilesRef.current;
          while (currentFiles.some(f => !f.isFolder && !f.trashed && f.name === newName && f.parentFolderId === folderId)) {
            counter++;
            newName = `${nameWithoutExt} (${counter})${ext}`;
          }
          const renamedFile = new File([file], newName, { type: file.type });
          filesToUpload.push(renamedFile);
        }
        continue;
      }
      
      await new Promise<void>((resolve) => {
        let resolved = false;
        const handleResolve = async (action: 'replace' | 'keepBoth' | 'cancel') => {
          if (resolved) return;
          resolved = true;
          
          try {
            if (action === 'cancel') {
              setDuplicateFileModal({ isOpen: false, fileName: '', newFile: null, existingFileIndex: null, onResolve: () => {}, hasMultipleDuplicates: false, remainingCount: 0 });
              resolve();
              return;
            }
            
            if (action === 'replace') {
              const currentFiles = uploadedFilesRef.current;
              const fileIndex = currentFiles.findIndex(f => f.id === duplicateFileId);
              if (fileIndex !== -1) {
                await removeFile(fileIndex);
              }
              filesToUpload.push(file);
            } else {
              const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
              const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
              let newName = `${nameWithoutExt} (1)${ext}`;
              let counter = 1;
              const currentFiles = uploadedFilesRef.current;
              while (currentFiles.some(f => !f.isFolder && !f.trashed && f.name === newName && f.parentFolderId === folderId)) {
                counter++;
                newName = `${nameWithoutExt} (${counter})${ext}`;
              }
              const renamedFile = new File([file], newName, { type: file.type });
              filesToUpload.push(renamedFile);
            }
          } finally {
            setDuplicateFileModal({ isOpen: false, fileName: '', newFile: null, existingFileIndex: null, onResolve: () => {}, hasMultipleDuplicates: false, remainingCount: 0 });
            resolve();
          }
        };
        
        const handleYesToAll = (action: 'replace' | 'keepBoth') => {
          if (resolved) return;
          resolved = true;
          batchAction = action; // Use the selected option
          applyToAll = true;
          // Apply to current file with the selected action
          handleResolve(action).then(() => {
            setDuplicateFileModal({ isOpen: false, fileName: '', newFile: null, existingFileIndex: null, onResolve: () => {}, hasMultipleDuplicates: false, remainingCount: 0 });
            resolve();
          });
        };
        
        const handleNoToAll = () => {
          if (resolved) return;
          resolved = true;
          applyToAll = true;
          batchAction = null; // Skip all
          setDuplicateFileModal({ isOpen: false, fileName: '', newFile: null, existingFileIndex: null, onResolve: () => {}, hasMultipleDuplicates: false, remainingCount: 0 });
          resolve();
        };
        
        setDuplicateFileModal({
          isOpen: true,
          fileName: file.name,
          newFile: null,
          existingFileIndex: uploadedFiles.findIndex(f => f.id === duplicateFileId),
          onResolve: handleResolve,
          hasMultipleDuplicates: hasMultiple,
          remainingCount: remainingCount,
          onYesToAll: hasMultiple ? handleYesToAll : undefined,
          onNoToAll: hasMultiple ? handleNoToAll : undefined
        });
      });
    }

    // If no files to upload after processing duplicates, return
    if (filesToUpload.length === 0) {
      setIsUploading(false);
      return;
    }

    setIsUploading(true);
    
    // Initialize upload queue only for files that will be uploaded
    const initialQueue: UploadProgress[] = filesToUpload.map(file => ({
      name: file.name,
      progress: 0,
      status: 'uploading' as const
    }));
    setUploadQueue(initialQueue);
    
    try {
      // Get Firebase ID token
      const token = await user.getIdToken();

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadQueue(prev => prev.map(item => 
          item.status === 'uploading' && item.progress < 90
            ? { ...item, progress: Math.min(item.progress + Math.random() * 15, 90) }
            : item
        ));
      }, 300);
      
      // Upload files to backend
      const uploadPromises = filesToUpload.map(file => 
        BackendFileAPI.upload(file, token, {
          parentFolderId: folderId,
          isPinned: autoPinEnabled
        })
      );
      const uploadResults = await Promise.all(uploadPromises);
      clearInterval(progressInterval);

      // Mark all as complete
      setUploadQueue(prev => prev.map(item => ({
        ...item,
        progress: 100,
        status: 'complete' as const
      })));

      // Create uploaded file objects from backend response
      const pinServiceLabel = getFriendlyPinServiceLabel();
      const newFiles: UploadedFile[] = uploadResults.map((result) => ({
        id: result.id,
        name: result.filename,
        ipfsUri: `ipfs://${result.cid}`,
        gatewayUrl: getOptimizedGatewayUrl(`ipfs://${result.cid}`),
        timestamp: Date.now(),
        type: result.mimeType || 'unknown',
        size: result.size,
        isPinned: result.isPinned || autoPinEnabled,
        pinService: (result.isPinned || autoPinEnabled) ? pinServiceLabel : undefined,
        pinDate: (result.isPinned || autoPinEnabled) ? Date.now() : undefined,
        parentFolderId: folderId,
        modifiedDate: Date.now()
      }));

      // Add all files (duplicates already handled)
      await addFiles(newFiles, folderId);
      
      // Clear queue after 2 seconds
      setTimeout(() => setUploadQueue([]), 2000);
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadQueue(prev => prev.map(item => ({
        ...item,
        status: 'error' as const
      })));
      showToast('Upload failed. Please try again.', 'error');
      setTimeout(() => setUploadQueue([]), 3000);
    } finally {
      setIsUploading(false);
    }
  };

  const performUpload = async (acceptedFiles: File[]) => {
    if (!user) {
      showToast('Please sign in to upload files', 'error');
      return;
    }

    // Check billing access before upload
    const hasAccess = await checkBillingAccess();
    if (!hasAccess) {
      showToast('Please add payment information to continue', 'error');
      return;
    }

    // Check for duplicates BEFORE uploading
    const filesToUpload: File[] = [];
    const filesToProcess: { file: File; duplicateFileId: string; duplicateFile: UploadedFile }[] = [];

    for (const file of acceptedFiles) {
      // Check for duplicates by name in the same folder (primary check)
      // Size check is secondary - if both have sizes and they match, it's more confident
      const existingFile = uploadedFiles.find(f => 
        !f.isFolder &&
        !f.trashed &&
        f.parentFolderId === currentFolderId &&
        f.name.toLowerCase() === file.name.toLowerCase()
      );

      if (existingFile) {
        // Found a duplicate - will show modal
        filesToProcess.push({ 
          file, 
          duplicateFileId: existingFile.id,
          duplicateFile: existingFile
        });
      } else {
        // No duplicate, add to upload queue
        filesToUpload.push(file);
      }
    }

    // Process duplicates one at a time BEFORE uploading
    let batchAction: 'replace' | 'keepBoth' | null = null;
    let applyToAll = false;
    
    for (let i = 0; i < filesToProcess.length; i++) {
      const { file, duplicateFileId, duplicateFile } = filesToProcess[i];
      const remainingCount = filesToProcess.length - i - 1;
      const hasMultiple = filesToProcess.length > 1;
      
      // If "Yes to All" was selected, apply the batch action to all remaining files
      if (applyToAll && batchAction) {
        if (batchAction === 'replace') {
          const currentFiles = uploadedFilesRef.current;
          const fileIndex = currentFiles.findIndex(f => f.id === duplicateFileId);
          if (fileIndex !== -1) {
            await removeFile(fileIndex);
          }
          filesToUpload.push(file);
        } else {
          const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
          const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
          let newName = `${nameWithoutExt} (1)${ext}`;
          let counter = 1;
          const currentFiles = uploadedFilesRef.current;
          while (currentFiles.some(f => !f.isFolder && !f.trashed && f.name === newName && f.parentFolderId === currentFolderId)) {
            counter++;
            newName = `${nameWithoutExt} (${counter})${ext}`;
          }
          const renamedFile = new File([file], newName, { type: file.type });
          filesToUpload.push(renamedFile);
        }
        continue;
      }
      
      // If "No to All" was selected, skip all remaining files
      if (applyToAll && !batchAction) {
        continue;
      }
      
      await new Promise<void>((resolve) => {
        let resolved = false;
        const handleResolve = async (action: 'replace' | 'keepBoth' | 'cancel') => {
          if (resolved) return;
          resolved = true;
          
          try {
            if (action === 'cancel') {
              setDuplicateFileModal({ isOpen: false, fileName: '', newFile: null, existingFileIndex: null, onResolve: () => {}, hasMultipleDuplicates: false, remainingCount: 0 });
              resolve();
              return;
            }
            
            if (action === 'replace') {
              const currentFiles = uploadedFilesRef.current;
              const fileIndex = currentFiles.findIndex(f => f.id === duplicateFileId);
              if (fileIndex !== -1) {
                await removeFile(fileIndex);
              }
              filesToUpload.push(file);
            } else {
              const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
              const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
              let newName = `${nameWithoutExt} (1)${ext}`;
              let counter = 1;
              const currentFiles = uploadedFilesRef.current;
              while (currentFiles.some(f => !f.isFolder && !f.trashed && f.name === newName && f.parentFolderId === currentFolderId)) {
                counter++;
                newName = `${nameWithoutExt} (${counter})${ext}`;
              }
              const renamedFile = new File([file], newName, { type: file.type });
              filesToUpload.push(renamedFile);
            }
          } finally {
            setDuplicateFileModal({ isOpen: false, fileName: '', newFile: null, existingFileIndex: null, onResolve: () => {}, hasMultipleDuplicates: false, remainingCount: 0 });
            resolve();
          }
        };
        
        const handleYesToAll = (action: 'replace' | 'keepBoth') => {
          if (resolved) return;
          resolved = true;
          batchAction = action; // Use the selected option
          applyToAll = true;
          // Apply to current file with the selected action
          handleResolve(action).then(() => {
            setDuplicateFileModal({ isOpen: false, fileName: '', newFile: null, existingFileIndex: null, onResolve: () => {}, hasMultipleDuplicates: false, remainingCount: 0 });
            resolve();
          });
        };
        
        const handleNoToAll = () => {
          if (resolved) return;
          resolved = true;
          applyToAll = true;
          batchAction = null; // Skip all
          setDuplicateFileModal({ isOpen: false, fileName: '', newFile: null, existingFileIndex: null, onResolve: () => {}, hasMultipleDuplicates: false, remainingCount: 0 });
          resolve();
        };
        
        setDuplicateFileModal({
          isOpen: true,
          fileName: file.name,
          newFile: null,
          existingFileIndex: uploadedFiles.findIndex(f => f.id === duplicateFileId),
          onResolve: handleResolve,
          hasMultipleDuplicates: hasMultiple,
          remainingCount: remainingCount,
          onYesToAll: hasMultiple ? handleYesToAll : undefined,
          onNoToAll: hasMultiple ? handleNoToAll : undefined
        });
      });
    }

    // If no files to upload after processing duplicates, return
    if (filesToUpload.length === 0) {
      setIsUploading(false);
      return;
    }

    setIsUploading(true);
    
    // Initialize upload queue only for files that will be uploaded
    const initialQueue: UploadProgress[] = filesToUpload.map(file => ({
      name: file.name,
      progress: 0,
      status: 'uploading' as const
    }));
    setUploadQueue(initialQueue);
    
    try {
      // Get Firebase ID token
      const token = await user.getIdToken();

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadQueue(prev => prev.map(item => 
          item.status === 'uploading' && item.progress < 90
            ? { ...item, progress: Math.min(item.progress + Math.random() * 15, 90) }
            : item
        ));
      }, 300);
      
      // Upload files to backend
      const uploadPromises = filesToUpload.map(file => 
        BackendFileAPI.upload(file, token, {
          parentFolderId: currentFolderId || undefined,
          isPinned: autoPinEnabled
        })
      );
      const uploadResults = await Promise.all(uploadPromises);
      clearInterval(progressInterval);

      // Mark all as complete
      setUploadQueue(prev => prev.map(item => ({
        ...item,
        progress: 100,
        status: 'complete' as const
      })));

      // Create uploaded file objects from backend response
      const pinServiceLabel = getFriendlyPinServiceLabel();
      const newFiles: UploadedFile[] = uploadResults.map((result) => ({
        id: result.id,
        name: result.filename,
        ipfsUri: `ipfs://${result.cid}`,
        gatewayUrl: getOptimizedGatewayUrl(`ipfs://${result.cid}`),
        timestamp: Date.now(),
        type: result.mimeType || 'unknown',
        size: result.size,
        isPinned: result.isPinned || autoPinEnabled,
        pinService: (result.isPinned || autoPinEnabled) ? pinServiceLabel : undefined,
        pinDate: (result.isPinned || autoPinEnabled) ? Date.now() : undefined,
        parentFolderId: currentFolderId,
        modifiedDate: Date.now()
      }));

      // Add all files (duplicates already handled)
      await addFiles(newFiles, currentFolderId);
      
      // Clear queue after 2 seconds
      setTimeout(() => setUploadQueue([]), 2000);
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadQueue(prev => prev.map(item => ({
        ...item,
        status: 'error' as const
      })));
      showToast('Upload failed. Please try again.', 'error');
      setTimeout(() => setUploadQueue([]), 3000);
    } finally {
      setIsUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    multiple: true,
    noClick: false
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Link copied to clipboard!', 'success');
  };

  const deleteFile = async (index: number) => {
    const file = uploadedFiles[index];
    setConfirmationModal({
      isOpen: true,
      title: 'Remove File',
      message: 'Remove this file from your dashboard?',
      confirmText: 'Remove',
      cancelText: 'Cancel',
      onConfirm: async () => {
        await removeFile(index);
        showToast(`Removed "${file?.name || 'file'}"`, 'success');
        setConfirmationModal({ ...confirmationModal, isOpen: false });
      },
      type: 'warning'
    });
  };

  const clearAll = async () => {
    setConfirmationModal({
      isOpen: true,
      title: 'Clear All Files',
      message: 'Clear all files from your dashboard?',
      confirmText: 'Clear All',
      cancelText: 'Cancel',
      onConfirm: async () => {
        await clearAllFiles();
        setConfirmationModal({ ...confirmationModal, isOpen: false });
      },
      type: 'danger'
    });
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const shouldShowBillingCTA = () => {
    if (!billingStatus) return false;
    
    // Only show Pay Now button if:
    // 1. User exceeds the free tier limit
    // 2. There's an actual amount to pay
    // 3. Payment info hasn't been received yet
    // 4. It's billing day OR services are blocked
    const hasAmountToPay = billingStatus.chargeAmountINR > 0 || billingStatus.exceedsLimit;
    const needsPayment = !billingStatus.paymentInfoReceived && hasAmountToPay;
    const isBillingDay = isTodayBillingDay(billingStatus.billingDay);
    
    return needsPayment && (isBillingDay || billingStatus.servicesBlocked);
  };

  const formatDate = (isoDate?: string) => {
    if (!isoDate) return '—';
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatChargeAmount = (status?: BillingStatus | null) => {
    if (!status) return '';
    if (status.chargeAmountINR > 0) {
      return `₹${status.chargeAmountINR.toFixed(2)}`;
    }
    const overageUSD = Math.max(0, status.monthlyCostUSD - status.freeTierLimitUSD);
    return `$${overageUSD.toFixed(2)}`;
  };

  const getBillingDayLabel = (status: BillingStatus) => {
    const dateLabel = formatDate(status.nextBillingDate);
    if (dateLabel !== '—') return dateLabel;
    if (status.billingDay) {
      return `day ${status.billingDay}`;
    }
    return 'your billing day';
  };

  const formatBillingPeriod = (period?: { start: string; end: string }) => {
    if (!period?.start || !period?.end) return null;
    return `${formatDate(period.start)} - ${formatDate(period.end)}`;
  };

  const billingCycleLabel = DEFAULT_BILLING_CYCLE_DAYS === 30 ? 'month' : `${DEFAULT_BILLING_CYCLE_DAYS}-day cycle`;
  const billingCycleTitle = DEFAULT_BILLING_CYCLE_DAYS === 30 ? 'Monthly' : `${DEFAULT_BILLING_CYCLE_DAYS}-Day Cycle`;

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon />;
    if (type.startsWith('video/')) return <VideoIcon />;
    if (type.startsWith('audio/')) return <AudioIcon />;
    if (type.includes('pdf')) return <PageIcon />;
    if (type.includes('word') || type.includes('document')) return <PageIcon />;
    if (type.includes('sheet') || type.includes('excel')) return <TableIcon />;
    if (type.includes('zip') || type.includes('rar')) return <ArchiveIcon />;
    return <PageIcon />;
  };

  // Get files based on active view
  const getViewFiles = () => {
    // If searching, return all files (not limited to current folder)
    if (searchTerm) {
      return uploadedFiles.filter(f => !f.trashed);
    }
    
    switch (activeView) {
      case 'recent':
        return getRecentFiles();
      case 'starred':
        return getStarredItems();
      case 'trash':
        return getTrashedItems();
      case 'drive':
      default:
        // If filtering by file type (not 'all'), show files from all folders
        if (filters.fileType !== 'all') {
          return uploadedFiles.filter(f => !f.trashed);
        }
        return getCurrentFolderItems();
    }
  };

  const displayFiles = getViewFiles();
  
  // Apply search and filters
  const filteredFiles = displayFiles.filter(file => {
    // Text search
    if (searchTerm && !file.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    // File type filter
    if (filters.fileType !== 'all') {
      if (filters.fileType === 'folder' && !file.isFolder) return false;
      if (filters.fileType === 'image' && !file.type.startsWith('image/')) return false;
      if (filters.fileType === 'video' && !file.type.startsWith('video/')) return false;
      if (filters.fileType === 'audio' && !file.type.startsWith('audio/')) return false;
      if (filters.fileType === 'document' && !file.type.includes('pdf') && !file.type.includes('document') && !file.type.includes('text') && !file.type.includes('spreadsheet') && !file.type.includes('excel') && !file.type.includes('sheet')) return false;
      if (filters.fileType === 'other' && (file.isFolder || file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/'))) return false;
    }
    
    // Pin status filter
    if (!file.isFolder && filters.pinStatus !== 'all') {
      if (filters.pinStatus === 'pinned' && !file.isPinned) return false;
      if (filters.pinStatus === 'unpinned' && file.isPinned) return false;
    }
    
    // Star status filter
    if (filters.starStatus !== 'all') {
      if (filters.starStatus === 'starred' && !file.starred) return false;
      if (filters.starStatus === 'unstarred' && file.starred) return false;
    }
    
    // Tags filter
    if (filters.tags.length > 0) {
      const fileTags = file.tags || [];
      const hasAllTags = filters.tags.every(filterTag =>
        fileTags.some(fileTag => fileTag.toLowerCase() === filterTag.toLowerCase())
      );
      if (!hasAllTags) return false;
    }
    
    // Size filter (in MB)
    if (!file.isFolder && file.size) {
      const sizeInMB = file.size / (1024 * 1024);
      if (filters.sizeMin && sizeInMB < parseFloat(filters.sizeMin)) return false;
      if (filters.sizeMax && sizeInMB > parseFloat(filters.sizeMax)) return false;
    }
    
    // Date filter
    const fileDate = file.modifiedDate || file.timestamp;
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom).getTime();
      if (fileDate < fromDate) return false;
    }
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo).getTime() + (24 * 60 * 60 * 1000); // End of day
      if (fileDate > toDate) return false;
    }
    
    return true;
  });

  const handlePinToggle = async (fileId: string, file: UploadedFile, event?: React.MouseEvent) => {
    // Check billing access before pinning
    if (!file.isPinned) {
      const hasAccess = await checkBillingAccess();
      if (!hasAccess) {
        showToast('Please add payment information to pin files', 'error');
        return;
      }
    }
    if (event) {
      event.stopPropagation();
    }
    
    const index = uploadedFiles.findIndex(f => f.id === fileId);
    if (file.isPinned) {
      // Check if warnings are suppressed
      if (suppressUnpinWarnings) {
        // Skip modal and directly unpin
        const success = await unpinFile(index);
        if (success) {
          showToast('Unpinned successfully', 'success');
        } else {
          showToast('Failed to unpin file', 'error');
        }
      } else {
        // Show confirmation modal with suppress option
        setConfirmationModal({
          isOpen: true,
          title: 'Unpin File',
          message: `🆓 Unpin "${file.name}"?\n\nUnpinned files are FREE but may be garbage collected from IPFS and become unavailable. Pinned files cost money but are guaranteed to persist.`,
          confirmText: 'Unpin (Free)',
          cancelText: 'Keep Pinned',
          onConfirm: async () => {
            const success = await unpinFile(index);
            if (success) {
              showToast('Unpinned successfully', 'success');
            } else {
              showToast('Failed to unpin file', 'error');
            }
            setConfirmationModal({ ...confirmationModal, isOpen: false });
          },
          type: 'warning',
          showSuppressOption: true,
          onSuppressChange: (suppress: boolean) => {
            setSuppressUnpinWarnings(suppress);
            if (typeof window !== 'undefined') {
              localStorage.setItem('suppressUnpinWarnings', suppress.toString());
            }
          }
        });
      }
    } else {
      const success = await pinFile(index);
      if (success) {
        showToast('File pinned successfully', 'success');
      } else {
        const appError = ErrorHandler.createAppError(new Error('Failed to pin file'));
        showToast(appError.userMessage, 'error');
      }
    }
  };

  const storageStats = getStorageStats();

  // Handler functions
  const handleFileUploadClick = (e?: React.MouseEvent) => {
    // Prevent event propagation
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    // Prevent multiple clicks
    if (isFileInputProcessingRef.current) {
      return;
    }
    
    // Trigger file input click
    if (fileInputRef.current) {
      // Use setTimeout to ensure the click happens after any dropdown menu closes
      setTimeout(() => {
        if (fileInputRef.current && !isFileInputProcessingRef.current) {
          fileInputRef.current.click();
        }
      }, 0);
    }
  };

  const handleCreateFolder = async () => {
    setInputModal({
      isOpen: true,
      title: 'Create Folder',
      message: 'Enter folder name:',
      placeholder: 'Folder name',
      defaultValue: '',
      onConfirm: async (folderName) => {
        const success = await createFolder(folderName, currentFolderId);
        if (success) {
          showToast('Folder created successfully', 'success');
        } else {
          const appError = ErrorHandler.createAppError(new Error('Failed to create folder'));
          showToast(appError.userMessage, 'error');
        }
        setInputModal({ ...inputModal, isOpen: false });
      }
    });
  };

  const handleFolderClick = (folder: UploadedFile) => {
    if (folder.isFolder) {
      setCurrentFolderId(folder.id);
      setActiveView('drive');
    }
  };

  const handleFileClick = (file: UploadedFile) => {
    if (file.isFolder) {
      handleFolderClick(file);
    } else {
      const index = uploadedFiles.findIndex(f => f.id === file.id);
      updateLastAccessed(index);
      window.open(file.gatewayUrl, '_blank');
    }
  };

  const handlePreview = (file: UploadedFile) => {
    if (file.isFolder) return;
    setPreviewModalFile(file);
    const index = uploadedFiles.findIndex(f => f.id === file.id);
    if (index !== -1) {
      updateLastAccessed(index);
      
      // Cache the file when previewed
      const fileCache = getFileCache();
      fileCache.set(file.id, file);
    }
  };

  const handleShowDetails = (file: UploadedFile) => {
    if (file.isFolder) return;
    setDetailsPanelFile(file);
  };

  const handleShowVersionHistory = (file: UploadedFile) => {
    if (file.isFolder) return;
    setVersionHistoryFile(file);
  };

  const handleRestoreVersion = async (version: any) => {
    if (!versionHistoryFile || !user) return;

    try {
      const index = uploadedFiles.findIndex(f => f.id === versionHistoryFile.id);
      if (index === -1) {
        throw new Error('File not found');
      }

      // Restore file to the selected version
      const updatedFiles = [...uploadedFiles];
      updatedFiles[index] = {
        ...updatedFiles[index],
        ipfsUri: version.ipfsUri,
        gatewayUrl: version.gatewayUrl,
        modifiedDate: Date.now(),
        size: version.size,
      };
      
      // Update the file in storage
      const fileIndex = uploadedFiles.findIndex(f => f.id === versionHistoryFile.id);
      if (fileIndex !== -1) {
        await renameItem(fileIndex, versionHistoryFile.name); // This will trigger a save
        // Manually update the file
        const currentFiles = uploadedFiles;
        currentFiles[fileIndex] = updatedFiles[index];
        await addFiles([currentFiles[fileIndex]], currentFiles[fileIndex].parentFolderId || null);
      }

      // Create a new version entry for the restore action
      const token = await user.getIdToken();
      await fetch(`/api/versions/${versionHistoryFile.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: {
            ...version,
            versionId: undefined, // Will be generated
            version: undefined, // Will be calculated
            changeDescription: `Restored from version ${version.version}`,
            timestamp: Date.now(),
            modifiedDate: Date.now(),
          },
        }),
      });

      showToast(`Restored to version ${version.version}`, 'success');
      setVersionHistoryFile(null);
    } catch (error: any) {
      const appError = ErrorHandler.createAppError(error);
      showToast(appError.userMessage, 'error');
    }
  };

  const handleRename = async (fileId: string) => {
    const index = uploadedFiles.findIndex(f => f.id === fileId);
    if (index === -1) return;

    setInputModal({
      isOpen: true,
      title: 'Rename Item',
      message: 'Enter new name:',
      placeholder: 'New name',
      defaultValue: uploadedFiles[index].name,
      onConfirm: async (newName) => {
        if (newName === uploadedFiles[index].name) {
          setInputModal({ ...inputModal, isOpen: false });
          return;
        }
        
        const success = await renameItem(index, newName);
        if (success) {
          showToast('Renamed successfully', 'success');
        } else {
          const appError = ErrorHandler.createAppError(new Error('Failed to rename'));
          showToast(appError.userMessage, 'error');
        }
        setInputModal({ ...inputModal, isOpen: false });
      }
    });
  };

  const handleToggleStar = async (fileId: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    
    const index = uploadedFiles.findIndex(f => f.id === fileId);
    if (index === -1) return;
    
    const file = uploadedFiles[index];
    await toggleStarred(index);
    showToast(file.starred ? 'Removed from starred' : 'Added to starred', 'success');
  };

  const handleDelete = async (fileId: string) => {
    const index = uploadedFiles.findIndex(f => f.id === fileId);
    if (index === -1) return;

    const file = uploadedFiles[index];
    
    if (activeView === 'trash') {
      // Permanently delete from trash
      setConfirmationModal({
        isOpen: true,
        title: 'Permanently Delete',
        message: `Permanently delete "${file.name}"?\n\nThis action cannot be undone!`,
        confirmText: 'Delete Forever',
        cancelText: 'Cancel',
        onConfirm: async () => {
          await permanentlyDelete(index);
          showToast(`Permanently deleted "${file.name}"`, 'success');
          setConfirmationModal({ ...confirmationModal, isOpen: false });
        },
        type: 'danger'
      });
    } else {
      // Move to trash
      setConfirmationModal({
        isOpen: true,
        title: 'Move to Trash',
        message: `Move "${file.name}" to trash?`,
        confirmText: 'Move to Trash',
        cancelText: 'Cancel',
        onConfirm: async () => {
          await moveToTrash(index);
          showToast(`Moved "${file.name}" to trash`, 'success');
          setConfirmationModal({ ...confirmationModal, isOpen: false });
        },
        type: 'warning'
      });
    }
  };

  const handleRestore = async (fileId: string) => {
    const index = uploadedFiles.findIndex(f => f.id === fileId);
    if (index === -1) return;
    
    const success = await restoreFromTrash(index);
    if (success) {
      showToast('Restored successfully', 'success');
    }
  };

  const handleDownload = async (file: UploadedFile) => {
    try {
      const fileCache = getFileCache();
      
      // Check cache first
      const cached = fileCache.get(file.id);
      let blob: Blob;
      
      if (cached?.content instanceof Blob) {
        // Use cached content
        blob = cached.content;
      } else {
        // Fetch from gateway
        const response = await fetch(file.gatewayUrl);
        blob = await response.blob();
        
        // Cache the file content
        fileCache.set(file.id, file, blob);
      }
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      // Log download
      const index = uploadedFiles.findIndex(f => f.id === file.id);
      if (index !== -1) {
        await addActivityLog(index, 'downloaded');
      }
    } catch (error) {
      const appError = ErrorHandler.createAppError(error);
      ErrorHandler.logError(appError, 'handleDownload');
      showToast(appError.userMessage || 'Download failed. Please try opening the file instead.', 'error');
    }
  };

  // Selection handlers
  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  const selectAllFiles = () => {
    setSelectedFiles(new Set(filteredFiles.map(f => f.id)));
  };

  const deselectAllFiles = () => {
    setSelectedFiles(new Set());
  };

  // Bulk download
  const handleBulkDownload = async () => {
    if (selectedFiles.size === 0) return;
    
    const filesToDownload = filteredFiles.filter(f => selectedFiles.has(f.id) && !f.isFolder);
    if (filesToDownload.length === 0) {
      showToast('Please select files to download', 'error');
      return;
    }

    // Temporary limitation: Only allow up to 2 files until ZIP feature is implemented
    if (filesToDownload.length > 2) {
      showToast('Download is currently limited to 2 files at a time. ZIP download feature coming soon!', 'info');
      return;
    }

    const downloadCount = filesToDownload.length;
    showToast(`Downloading ${downloadCount} file${downloadCount !== 1 ? 's' : ''}...`, 'info');

    try {
      // Process downloads sequentially to avoid browser blocking
      let successCount = 0;
      let failCount = 0;
      
      for (const file of filesToDownload) {
        try {
          await handleDownload(file);
          successCount++;
          // Small delay between downloads to avoid browser blocking
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.error(`Failed to download ${file.name}:`, error);
          failCount++;
        }
      }
      
      if (failCount === 0) {
        showToast(`Downloaded ${successCount} file${successCount !== 1 ? 's' : ''}`, 'success');
      } else {
        showToast(`Downloaded ${successCount} file${successCount !== 1 ? 's' : ''}, ${failCount} failed`, 'error');
      }
      setSelectedFiles(new Set());
    } catch (error) {
      console.error('Bulk download error:', error);
      showToast('Some downloads failed', 'error');
      setSelectedFiles(new Set());
    }
  };

  // Bulk restore from trash
  const handleBulkRestore = async () => {
    if (selectedFiles.size === 0) return;
    
    const filesToRestore = filteredFiles.filter(f => selectedFiles.has(f.id) && !f.isFolder);
    if (filesToRestore.length === 0) {
      showToast('Please select files to restore', 'error');
      return;
    }

    try {
      let processed = 0;
      for (const file of filesToRestore) {
        const index = uploadedFiles.findIndex(f => f.id === file.id);
        if (index !== -1) {
          await restoreFromTrash(index);
          processed++;
        }
      }
      showToast(`Restored ${processed} file${processed !== 1 ? 's' : ''}`, 'success');
      setSelectedFiles(new Set());
    } catch (error) {
      console.error('Bulk restore error:', error);
      showToast('Failed to restore some files', 'error');
      setSelectedFiles(new Set());
    }
  };

  // Bulk permanently delete
  const handleBulkPermanentlyDelete = async () => {
    if (selectedFiles.size === 0) return;
    
    const filesToDelete = filteredFiles.filter(f => selectedFiles.has(f.id) && !f.isFolder);
    if (filesToDelete.length === 0) {
      showToast('Please select files to delete', 'error');
      return;
    }

    setConfirmationModal({
      isOpen: true,
      title: 'Permanently Delete',
      message: `Permanently delete ${filesToDelete.length} file${filesToDelete.length !== 1 ? 's' : ''}?\n\nThis action cannot be undone!`,
      confirmText: 'Delete Forever',
      cancelText: 'Cancel',
      onConfirm: async () => {
        // Close modal immediately - progress will be shown in the progress tracker
        setConfirmationModal({ ...confirmationModal, isOpen: false });
        
        try {
          // Store file IDs to avoid index shifting issues
          const fileIdsToDelete = Array.from(new Set(filesToDelete.map(f => f.id)));
          const fileMap = new Map(filesToDelete.map(f => [f.id, f]));
          
          // Initialize progress queue
          const initialQueue: UploadProgress[] = filesToDelete.map(file => ({
            name: file.name,
            progress: 0,
            status: 'uploading' as const
          }));
          setPermanentDeleteQueue(initialQueue);
          
          // Process files using the same pattern as move to trash
          let processed = 0;
          const totalFiles = fileIdsToDelete.length;
          
          // Update progress as we process
          const updateProgress = (fileId: string, progress: number, status: 'uploading' | 'complete' | 'error') => {
            const file = fileMap.get(fileId);
            if (file) {
              setPermanentDeleteQueue(prev => prev.map(item => 
                item.name === file.name 
                  ? { ...item, progress, status }
                  : item
              ));
            }
          };
          
          // Process files one at a time, but use file IDs to find them fresh each time
          for (const fileId of fileIdsToDelete) {
            try {
              // Find the file index fresh each time (state might have updated)
              let found = false;
              let attempts = 0;
              
              while (!found && attempts < 15) {
                // Use ref to get the latest state (always fresh)
                const currentFiles = uploadedFilesRef.current;
                const currentIndex = currentFiles.findIndex(f => f.id === fileId);
                
                if (currentIndex !== -1) {
                  // Found the file, delete it
                  await permanentlyDelete(currentIndex);
                  
                  // Wait for React state to update (functional update should make this faster)
                  await new Promise(resolve => setTimeout(resolve, 200));
                  
                  // Verify it was actually deleted by checking the ref again
                  const verifyFiles = uploadedFilesRef.current;
                  const fileStillExists = verifyFiles.find(f => f.id === fileId);
                  
                  if (!fileStillExists) {
                    found = true; // Successfully deleted
                  } else {
                    // State hasn't updated yet, wait more and retry
                    await new Promise(resolve => setTimeout(resolve, 100));
                    attempts++;
                  }
                } else {
                  // File not found - might already be deleted
                  found = true; // Consider it processed
                }
              }
              
              if (found) {
                updateProgress(fileId, 100, 'complete');
                processed++;
                
                // Update overall progress
                const progressPercent = Math.round((processed / totalFiles) * 100);
                setPermanentDeleteQueue(prev => prev.map(item => 
                  item.status === 'uploading' && item.progress < progressPercent
                    ? { ...item, progress: Math.min(progressPercent, 95) }
                    : item
                ));
              } else {
                updateProgress(fileId, 0, 'error');
              }
            } catch (error) {
              console.error(`Failed to delete file ${fileId}:`, error);
              updateProgress(fileId, 0, 'error');
            }
          }
          
          // Mark all remaining as complete
          setPermanentDeleteQueue(prev => prev.map(item => 
            item.status === 'uploading' 
              ? { ...item, progress: 100, status: 'complete' as const }
              : item
          ));
          
          setSelectedFiles(new Set());
        } catch (error) {
          console.error('Bulk permanently delete error:', error);
          showToast('Failed to delete some files', 'error');
        }
      },
      type: 'danger'
    });
  };

  // Empty trash - delete all files in trash
  const handleEmptyTrash = () => {
    const trashedFiles = getTrashedItems();
    if (trashedFiles.length === 0) {
      showToast('Trash is already empty', 'info');
      return;
    }

    setConfirmationModal({
      isOpen: true,
      title: 'Empty Trash',
      message: `Permanently delete all ${trashedFiles.length} item${trashedFiles.length !== 1 ? 's' : ''} in trash?\n\nThis action cannot be undone!`,
      confirmText: 'Empty Trash',
      cancelText: 'Cancel',
      onConfirm: async () => {
        // Close modal immediately - progress will be shown in the progress tracker
        setConfirmationModal({ ...confirmationModal, isOpen: false });
        
        try {
          // Store file IDs to avoid index shifting issues
          const fileIdsToDelete = Array.from(new Set(trashedFiles.map(f => f.id)));
          const fileMap = new Map(trashedFiles.map(f => [f.id, f]));
          
          // Initialize progress queue
          const initialQueue: UploadProgress[] = trashedFiles.map(file => ({
            name: file.name,
            progress: 0,
            status: 'uploading' as const
          }));
          setPermanentDeleteQueue(initialQueue);
          
          // Process files using the same pattern as move to trash
          let processed = 0;
          const totalTrashFiles = fileIdsToDelete.length;
          
          // Update progress as we process
          const updateProgress = (fileId: string, progress: number, status: 'uploading' | 'complete' | 'error') => {
            const file = fileMap.get(fileId);
            if (file) {
              setPermanentDeleteQueue(prev => prev.map(item => 
                item.name === file.name 
                  ? { ...item, progress, status }
                  : item
              ));
            }
          };
          
          // Process files one at a time, but use file IDs to find them fresh each time
          for (const fileId of fileIdsToDelete) {
            try {
              // Find the file index fresh each time (state might have updated)
              let found = false;
              let attempts = 0;
              
              while (!found && attempts < 15) {
                // Use ref to get the latest state (always fresh)
                const currentFiles = uploadedFilesRef.current;
                const currentIndex = currentFiles.findIndex(f => f.id === fileId);
                
                if (currentIndex !== -1) {
                  // Found the file, delete it
                  await permanentlyDelete(currentIndex);
                  
                  // Wait for React state to update (functional update should make this faster)
                  await new Promise(resolve => setTimeout(resolve, 200));
                  
                  // Verify it was actually deleted by checking the ref again
                  const verifyFiles = uploadedFilesRef.current;
                  const fileStillExists = verifyFiles.find(f => f.id === fileId);
                  
                  if (!fileStillExists) {
                    found = true; // Successfully deleted
                  } else {
                    // State hasn't updated yet, wait more and retry
                    await new Promise(resolve => setTimeout(resolve, 100));
                    attempts++;
                  }
                } else {
                  // File not found - might already be deleted
                  found = true; // Consider it processed
                }
              }
              
              if (found) {
                updateProgress(fileId, 100, 'complete');
                processed++;
                
                // Update overall progress
                const progressPercent = Math.round((processed / totalTrashFiles) * 100);
                setPermanentDeleteQueue(prev => prev.map(item => 
                  item.status === 'uploading' && item.progress < progressPercent
                    ? { ...item, progress: Math.min(progressPercent, 95) }
                    : item
                ));
              } else {
                updateProgress(fileId, 0, 'error');
              }
            } catch (error) {
              console.error(`Failed to delete file ${fileId}:`, error);
              updateProgress(fileId, 0, 'error');
            }
          }
          
          // Mark all remaining as complete
          setPermanentDeleteQueue(prev => prev.map(item => 
            item.status === 'uploading' 
              ? { ...item, progress: 100, status: 'complete' as const }
              : item
          ));
        } catch (error) {
          console.error('Empty trash error:', error);
          showToast('Failed to empty trash', 'error');
        }
      },
      type: 'danger'
    });
  };

  // Bulk move to trash - process all files and folders by directly updating state
  const handleBulkMoveToTrash = async () => {
    if (selectedFiles.size === 0) return;
    
    const itemsToTrash = filteredFiles.filter(f => selectedFiles.has(f.id));
    if (itemsToTrash.length === 0) {
      showToast('Please select items to move to trash', 'error');
      return;
    }

    // Store item IDs (files and folders)
    const itemIdsToTrash = new Set(itemsToTrash.map(f => f.id));
    const itemMap = new Map(itemsToTrash.map(f => [f.id, f]));

    // Initialize progress queue
    const initialQueue: UploadProgress[] = itemsToTrash.map(item => ({
      name: item.name,
      progress: 0,
      status: 'uploading' as const
    }));
    setBulkOperationQueue(initialQueue);

    try {
      // Process items by directly updating the uploadedFiles state
      // This avoids the index shifting issue
      let processed = 0;
      const total = itemsToTrash.length;
      
      // Update progress as we process
      const updateProgress = (itemId: string, progress: number, status: 'uploading' | 'complete' | 'error') => {
        const item = itemMap.get(itemId);
        if (item) {
          setBulkOperationQueue(prev => prev.map(queueItem => 
            queueItem.name === item.name 
              ? { ...queueItem, progress, status }
              : queueItem
          ));
        }
      };
      
      // Process items one at a time, but use item IDs to find them fresh each time
      for (const itemId of Array.from(itemIdsToTrash)) {
        try {
          // Find the item index fresh each time (state might have updated)
          let found = false;
          let attempts = 0;
          
          while (!found && attempts < 15) {
            // Use ref to get the latest state (always fresh)
            const currentFiles = uploadedFilesRef.current;
            const currentIndex = currentFiles.findIndex(f => f.id === itemId && !f.trashed);
            
            if (currentIndex !== -1) {
              // Found the item, move it to trash
              await moveToTrash(currentIndex);
              
              // Wait for React state to update (functional update should make this faster)
              await new Promise(resolve => setTimeout(resolve, 200));
              
              // Verify it was actually moved by checking the ref again
              const verifyFiles = uploadedFilesRef.current;
              const itemState = verifyFiles.find(f => f.id === itemId);
              
              if (itemState?.trashed) {
                found = true; // Successfully moved
              } else {
                // State hasn't updated yet, wait more and retry
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
              }
            } else {
              // Check if already trashed
              const itemState = currentFiles.find(f => f.id === itemId);
              if (itemState?.trashed) {
                found = true; // Already processed
              } else {
                // Item not found and not trashed - wait for state to update
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
              }
            }
          }
          
          if (found) {
            updateProgress(itemId, 100, 'complete');
            processed++;
            
            // Update overall progress
            const progressPercent = Math.round((processed / total) * 100);
            setBulkOperationQueue(prev => prev.map(queueItem => 
              queueItem.status === 'uploading' && queueItem.progress < progressPercent
                ? { ...queueItem, progress: Math.min(progressPercent, 95) }
                : queueItem
            ));
          } else {
            updateProgress(itemId, 0, 'error');
          }
        } catch (error) {
          console.error(`Failed to move item ${itemId} to trash:`, error);
          updateProgress(itemId, 0, 'error');
        }
      }
      
      // Mark all remaining as complete
      setBulkOperationQueue(prev => prev.map(item => 
        item.status === 'uploading' 
          ? { ...item, progress: 100, status: 'complete' as const }
          : item
      ));
      
      // Clear queue after 3 seconds
      setTimeout(() => setBulkOperationQueue([]), 3000);
      setSelectedFiles(new Set());
    } catch (error) {
      console.error('Bulk move to trash error:', error);
      setBulkOperationQueue(prev => prev.map(item => ({
        ...item,
        status: 'error' as const
      })));
      setTimeout(() => setBulkOperationQueue([]), 3000);
      setSelectedFiles(new Set());
    }
  };

  const handleDuplicate = async (fileId: string) => {
    const file = uploadedFiles.find(f => f.id === fileId);
    if (!file || file.isFolder) return;

    const index = uploadedFiles.findIndex(f => f.id === fileId);
    const success = await duplicateFile(index);
    if (success) {
      showToast(`File duplicated: "${file.name}"`, 'success');
    } else {
      const appError = ErrorHandler.createAppError(new Error('Failed to duplicate file'));
      showToast(appError.userMessage, 'error');
    }
  };

  const handleManageTags = async (fileId: string) => {
    const file = uploadedFiles.find(f => f.id === fileId);
    if (file) {
      setTagManagerFile(file);
    }
  };

  const handleAddTag = async (fileId: string, tag: string) => {
    const index = uploadedFiles.findIndex(f => f.id === fileId);
    if (index !== -1) {
      const success = await addTags(index, [tag]);
      if (success) {
        showToast(`Tag "${tag}" added`, 'success');
      } else {
        const appError = ErrorHandler.createAppError(new Error('Failed to add tag'));
        showToast(appError.userMessage, 'error');
      }
    }
  };

  const handleRemoveTag = async (fileId: string, tag: string) => {
    const index = uploadedFiles.findIndex(f => f.id === fileId);
    if (index !== -1) {
      const success = await removeTags(index, [tag]);
      if (success) {
        showToast(`Tag "${tag}" removed`, 'success');
      } else {
        const appError = ErrorHandler.createAppError(new Error('Failed to remove tag'));
        showToast(appError.userMessage, 'error');
      }
    }
  };

  const handleShare = async (fileId: string) => {
    const file = uploadedFiles.find(f => f.id === fileId);
    if (file) {
      setShareModalFile(file);
    }
  };

  const handleCreateShare = async (
    permission: 'viewer' | 'editor',
    expiryDate?: number,
    password?: string
  ): Promise<string | null> => {
    if (!shareModalFile) return null;
    
    const index = uploadedFiles.findIndex(f => f.id === shareModalFile.id);
    if (index === -1) return null;

    return await enableSharing(index, permission, expiryDate, password);
  };

  const handleDisableShare = async (): Promise<boolean> => {
    if (!shareModalFile) return false;
    
    const index = uploadedFiles.findIndex(f => f.id === shareModalFile.id);
    if (index === -1) return false;

    return await disableSharing(index);
  };

  const handleViewChange = (view: 'drive' | 'recent' | 'starred' | 'trash') => {
    setActiveView(view);
    if (view === 'drive') {
      // Stay in current folder
    } else {
      // Other views ignore folder navigation
    }
  };

  // Get all files recursively (build folder structure)
  const getAllFilesRecursively = (folderId: string | null, files: UploadedFile[], path: string = ''): Array<{file: UploadedFile, path: string}> => {
    const result: Array<{file: UploadedFile, path: string}> = [];
    
    files.forEach(file => {
      if (file.parentFolderId === folderId && !file.isFolder && !file.trashed) {
        result.push({ file, path });
      }
    });

    // Recurse into folders
    files.forEach(folder => {
      if (folder.isFolder && folder.parentFolderId === folderId && !folder.trashed) {
        const folderPath = path ? `${path}/${folder.name}` : folder.name;
        const folderFiles = getAllFilesRecursively(folder.id, files, folderPath);
        result.push(...folderFiles);
      }
    });

    return result;
  };

  const handleExportAll = async () => {
    const nonTrashedFiles = uploadedFiles.filter(f => !f.trashed && !f.isFolder);
    
    if (nonTrashedFiles.length === 0) {
      showToast('No files to export', 'info');
      return;
    }

    try {
      showToast('Preparing ZIP file...', 'info');
      const zip = new JSZip();
      
      // Get all files with their folder paths
      const allFilesWithPaths = getAllFilesRecursively(null, uploadedFiles);
      
      if (allFilesWithPaths.length === 0) {
        showToast('No files to export', 'info');
        return;
      }

      let processed = 0;
      const total = allFilesWithPaths.length;
      
      // Download and add each file to ZIP
      for (const { file, path } of allFilesWithPaths) {
        try {
          const response = await fetch(file.gatewayUrl);
          if (!response.ok) {
            console.warn(`Failed to fetch ${file.name}, skipping...`);
            continue;
          }
          const blob = await response.blob();
          const zipPath = path ? `${path}/${file.name}` : file.name;
          zip.file(zipPath, blob);
          
          processed++;
          if (processed % 10 === 0 || processed === total) {
            showToast(`Exporting... ${processed}/${total} files`, 'info');
          }
        } catch (error) {
          console.error(`Error fetching ${file.name}:`, error);
          // Continue with other files even if one fails
        }
      }

      // Generate ZIP file
      showToast('Generating ZIP file...', 'info');
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // Download the ZIP
      const url = window.URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vault-export-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      showToast(`Exported ${processed} files successfully!`, 'success');
    } catch (error) {
      console.error('Export failed:', error);
      showToast('❌ Export failed. Please try again.', 'error');
    }
  };

  const folderPath = getFolderPath(currentFolderId);

  const getViewTitle = () => {
    switch (activeView) {
      case 'recent':
        return 'Recent';
      case 'starred':
        return 'Starred';
      case 'trash':
        return 'Trash';
      case 'drive':
      default:
        if (currentFolderId) {
          const currentFolder = uploadedFiles.find(f => f.id === currentFolderId);
          return currentFolder?.name || 'My Drive';
        }
        return 'My Drive';
    }
  };

  // Show loading spinner only for initial auth check
  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Loading...</p>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!user) {
    return null;
  }

  return (
    <div className={`${styles.dashboard} ${styles[theme]} ${isDragging ? styles.draggingActive : ''}`}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.logoBtn} onClick={() => router.push('/')}>
            <span className={styles.logoText}>Walt</span>
          </button>
          <div className={styles.searchContainer}>
            <div className={styles.searchBar}>
              <span className={styles.searchIcon}><SearchIcon /></span>
              <input
                type="text"
                placeholder="Search in Drive"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (e.target.value.trim() && e.target.value !== searchTerm) {
                    saveSearch(e.target.value.trim());
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchTerm.trim()) {
                    saveSearch(searchTerm.trim());
                    setShowSuggestions(false);
                  }
                }}
                onFocus={() => {
                  if (searchTerm.length > 0 || recentSearches.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                onBlur={() => {
                  // Delay to allow click on suggestions
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                className={styles.searchInput}
              />
              <DropdownMenu open={showFilters} onOpenChange={setShowFilters}>
                <DropdownMenuTrigger asChild>
                  <button 
                    className={styles.filterToggle}
                    title="Show filters"
                  >
                    <FunnelIcon />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="start" 
                  className={styles.filterPanel}
                  sideOffset={8}
                >
                  <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>Type</label>
                    <select 
                      value={filters.fileType} 
                      onChange={(e) => setFilters({...filters, fileType: e.target.value as any})}
                      className={styles.filterSelect}
                    >
                      <option value="all">All Types</option>
                      <option value="folder">Folders</option>
                      <option value="image">Images</option>
                      <option value="video">Videos</option>
                      <option value="audio">Audio</option>
                      <option value="document">Documents</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  
                  <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>Pin Status</label>
                    <select 
                      value={filters.pinStatus} 
                      onChange={(e) => setFilters({...filters, pinStatus: e.target.value as any})}
                      className={styles.filterSelect}
                    >
                      <option value="all">All Files</option>
                      <option value="pinned">Pinned</option>
                      <option value="unpinned">Unpinned</option>
                    </select>
                  </div>
                  
                  <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>Star Status</label>
                    <select 
                      value={filters.starStatus} 
                      onChange={(e) => setFilters({...filters, starStatus: e.target.value as any})}
                      className={styles.filterSelect}
                    >
                      <option value="all">All</option>
                      <option value="starred">Starred</option>
                      <option value="unstarred">Unstarred</option>
                    </select>
                  </div>

                  <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>Tags</label>
                    <div className={styles.tagFilter}>
                      {getAllTags().length > 0 ? (
                        <select
                          multiple
                          value={filters.tags}
                          onChange={(e) => {
                            const selectedTags = Array.from(e.target.selectedOptions, option => option.value);
                            setFilters({...filters, tags: selectedTags});
                          }}
                          className={styles.tagSelect}
                          size={Math.min(5, getAllTags().length + 1)}
                        >
                          {getAllTags().map(tag => (
                            <option key={tag} value={tag}>{tag}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={styles.noTagsHint}>No tags yet - add tags to files to filter by them</span>
                      )}
                      {filters.tags.length > 0 && (
                        <button
                          className={styles.clearTagFilterBtn}
                          onClick={() => setFilters({...filters, tags: []})}
                          title="Clear tag filter"
                        >
                          Clear Tags
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>Size (MB)</label>
                    <div className={styles.filterRange}>
                      <input 
                        type="number" 
                        placeholder="Min"
                        value={filters.sizeMin}
                        onChange={(e) => setFilters({...filters, sizeMin: e.target.value})}
                        className={styles.filterInput}
                      />
                      <span>to</span>
                      <input 
                        type="number" 
                        placeholder="Max"
                        value={filters.sizeMax}
                        onChange={(e) => setFilters({...filters, sizeMax: e.target.value})}
                        className={styles.filterInput}
                      />
                    </div>
                  </div>
                  
                  <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>Date Range</label>
                    <div className={styles.filterRange}>
                      <input 
                        type="date" 
                        placeholder="From"
                        value={filters.dateFrom}
                        onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                        className={styles.filterInput}
                      />
                      <span>to</span>
                      <input 
                        type="date" 
                        placeholder="To"
                        value={filters.dateTo}
                        onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                        className={styles.filterInput}
                      />
                    </div>
                  </div>
                  
                  <div className={styles.filterButtons}>
                    <button 
                      className={styles.clearFilters}
                      onClick={() => setFilters({
                        fileType: 'all',
                        pinStatus: 'all',
                        starStatus: 'all',
                        tags: [],
                        sizeMin: '',
                        sizeMax: '',
                        dateFrom: '',
                        dateTo: ''
                      })}
                    >
                      Clear All Filters
                    </button>
                    <button 
                      className={styles.saveSearchBtnFilter}
                      onClick={() => {
                        saveCurrentSearch();
                        setShowFilters(false);
                      }}
                      title="Save current search with filters"
                    >
                      💾 Save Search
                    </button>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {/* Search Suggestions Dropdown */}
            <DropdownMenu open={showSuggestions && (searchSuggestions.length > 0 || (searchTerm.length === 0 && (recentSearches.length > 0 || savedSearches.length > 0)))} onOpenChange={setShowSuggestions}>
              <DropdownMenuTrigger asChild>
                <div style={{ display: 'none' }} />
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="start"
                className={styles.searchSuggestions}
                sideOffset={4}
              >
                {searchTerm.length === 0 && savedSearches.length > 0 && (
                  <>
                    <div className={styles.suggestionHeader}>
                      <span>Saved Searches</span>
                      <button 
                        className={styles.saveSearchBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          saveCurrentSearch();
                        }}
                        title="Save current search"
                      >
                        💾 Save
                      </button>
                    </div>
                    {savedSearches.map((savedSearch, idx) => (
                      <DropdownMenuItem
                        key={`saved-${idx}`}
                        className={styles.suggestionItem}
                        onClick={() => {
                          loadSavedSearch(savedSearch);
                          setShowSuggestions(false);
                        }}
                      >
                        <span className={styles.suggestionIcon}><StarIcon /></span>
                        <span className={styles.suggestionText}>{savedSearch.name}</span>
                        <button
                          className={styles.deleteSavedSearchBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSavedSearch(savedSearch.name);
                          }}
                          title="Delete saved search"
                        >
                          <CloseIcon />
                        </button>
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
                {searchTerm.length === 0 && recentSearches.length > 0 && (
                  <>
                    {savedSearches.length > 0 && <div className={styles.suggestionDivider}></div>}
                    <div className={styles.suggestionHeader}>Recent Searches</div>
                    {recentSearches.map((search, idx) => (
                      <DropdownMenuItem
                        key={`recent-${idx}`}
                        className={styles.suggestionItem}
                        onClick={() => {
                          setSearchTerm(search);
                          saveSearch(search);
                          setShowSuggestions(false);
                        }}
                      >
                        <span className={styles.suggestionIcon}>🕐</span>
                        <span>{search}</span>
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
                {searchSuggestions.length > 0 && (
                  <>
                    {searchTerm.length > 0 && recentSearches.length > 0 && <div className={styles.suggestionDivider}></div>}
                    <div className={styles.suggestionHeader}>Suggestions</div>
                    {searchSuggestions.map((suggestion, idx) => (
                      <DropdownMenuItem
                        key={`suggestion-${idx}`}
                        className={styles.suggestionItem}
                        onClick={() => {
                          setSearchTerm(suggestion);
                          saveSearch(suggestion);
                          setShowSuggestions(false);
                        }}
                      >
                        <span className={styles.suggestionIcon}><SearchIcon /></span>
                        <span>{suggestion}</span>
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className={styles.headerRight}>
          {/* Keyboard Shortcuts Card - Hidden on mobile */}
          <DropdownMenu open={showKeyboardShortcuts} onOpenChange={setShowKeyboardShortcuts}>
            <DropdownMenuTrigger asChild>
              <div className={styles.keyboardShortcutsCard}>
                <span className={styles.keyboardShortcutsLabel}>Keyboard Shortcuts</span>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="end"
              className={styles.keyboardShortcutsTooltip}
              sideOffset={8}
            >
                <div className={styles.shortcutItem}>
                  <span className={styles.shortcutKey}>Ctrl+K</span> or <span className={styles.shortcutKey}>/</span>
                  <span className={styles.shortcutAction}>Focus search</span>
                </div>
                <div className={styles.shortcutItem}>
                  <span className={styles.shortcutKey}>Esc</span>
                  <span className={styles.shortcutAction}>Clear search / Close menus</span>
                </div>
                <div className={styles.shortcutItem}>
                  <span className={styles.shortcutKey}>Ctrl+N</span>
                  <span className={styles.shortcutAction}>New folder</span>
                </div>
                <div className={styles.shortcutItem}>
                  <span className={styles.shortcutKey}>Ctrl+,</span>
                  <span className={styles.shortcutAction}>Toggle theme</span>
                </div>
                <div className={styles.shortcutItem}>
                  <span className={styles.shortcutKey}>1</span>
                  <span className={styles.shortcutAction}>My Drive</span>
                </div>
                <div className={styles.shortcutItem}>
                  <span className={styles.shortcutKey}>2</span>
                  <span className={styles.shortcutAction}>Recent</span>
                </div>
                <div className={styles.shortcutItem}>
                  <span className={styles.shortcutKey}>3</span>
                  <span className={styles.shortcutAction}>Starred</span>
                </div>
                <div className={styles.shortcutItem}>
                  <span className={styles.shortcutKey}>4</span>
                  <span className={styles.shortcutAction}>Trash</span>
                </div>
                <div className={styles.shortcutItem}>
                  <span className={styles.shortcutKey}>g + v</span>
                  <span className={styles.shortcutAction}>Grid view</span>
                </div>
                <div className={styles.shortcutItem}>
                  <span className={styles.shortcutKey}>g + l</span>
                  <span className={styles.shortcutAction}>List view</span>
                </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile Menu Button */}
          <button
            className={styles.mobileMenuBtn}
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            title="Menu"
            aria-label="Toggle menu"
          >
            {showMobileMenu ? <CloseIcon /> : <MenuIcon />}
          </button>
          
          <button 
            className={styles.themeToggle}
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          >
            {theme === 'light' ? <span>🌙</span> : <span>☀️</span>}
          </button>

          {shouldShowBillingCTA() && (
            <button
              className={styles.billingDueButton}
              onClick={() => setShowPaymentModal(true)}
              title="Billing day: add payment info now"
            >
              💳 Pay now
            </button>
          )}
          
          {/* Notifications */}
          <NotificationBell />

          {/* User Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className={styles.userDropdownTrigger}>
              <span className={styles.userEmail}>{user.email}</span>
              <span className={styles.userIcon}><PeoplesIcon /></span>
              <span className={styles.dropdownArrow}><ArrowDownIcon /></span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={styles.userDropdownContent}>
              <DropdownMenuItem onClick={() => router.push('/settings')}>
                <span className={styles.dropdownIcon}><SettingIcon /></span>
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem className={styles.menuDisabled} onClick={(e) => { e.stopPropagation(); }}>
                <span className={styles.dropdownIcon}>🔒</span>
                2FA (Coming Soon)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportAll}>
                <span className={styles.dropdownIcon}><StorageIcon /></span>
                Export All
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <span className={styles.dropdownIcon}>🚪</span>
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <div className={styles.mobileMenuOverlay} onClick={() => setShowMobileMenu(false)}>
          <div className={styles.mobileMenu} onClick={(e) => e.stopPropagation()}>
            <div className={styles.mobileMenuHeader}>
              <h3>Menu</h3>
              <button 
                className={styles.mobileMenuClose}
                onClick={() => setShowMobileMenu(false)}
                aria-label="Close menu"
              >
                <CloseIcon />
              </button>
            </div>
            
            {/* Upload Section */}
            <div {...getRootProps()} className={styles.uploadSection}>
              <input {...getInputProps()} />
              <DropdownMenu>
                <DropdownMenuTrigger 
                className={styles.newButton} 
                disabled={isUploading}
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <span className={styles.plusIcon}>+</span>
                {isUploading ? 'Uploading...' : 'New'}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => {
                    handleCreateFolder();
                    setShowMobileMenu(false);
                  }}>
                    <FolderIcon /> New Folder
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    handleFileUploadClick(e);
                    setShowMobileMenu(false);
                  }}>
                    <PageIcon /> File Upload
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {/* Navigation */}
            <nav className={styles.mobileNav}>
              <div 
                className={`${styles.navItem} ${activeView === 'drive' ? styles.active : ''}`}
                onClick={() => {
                  handleViewChange('drive');
                  setCurrentFolderId(null);
                  setShowMobileMenu(false);
                }}
              >
                <span className={styles.navIcon}><FolderIcon /></span>
                <span>My Drive</span>
              </div>
              <div 
                className={`${styles.navItem} ${activeView === 'recent' ? styles.active : ''}`}
                onClick={() => {
                  handleViewChange('recent');
                  setShowMobileMenu(false);
                }}
              >
                <span className={styles.navIcon}><TimeIcon /></span>
                <span>Recent</span>
              </div>
              <div 
                className={`${styles.navItem} ${activeView === 'starred' ? styles.active : ''}`}
                onClick={() => {
                  handleViewChange('starred');
                  setShowMobileMenu(false);
                }}
              >
                <span className={styles.navIcon}>{activeView === 'starred' ? <StarIcon /> : <StarOutlineIcon />}</span>
                <span>Starred</span>
              </div>
              <div 
                className={`${styles.navItem} ${activeView === 'trash' ? styles.active : ''}`}
                onClick={() => {
                  handleViewChange('trash');
                  setShowMobileMenu(false);
                }}
              >
                <span className={styles.navIcon}><TrashIcon /></span>
                <span>Trash</span>
              </div>
            </nav>

            {/* Auto-pin Toggle */}
            <div className={styles.autoPinSection}>
              <label className={styles.autoPinLabel}>
                <input 
                  type="checkbox" 
                  checked={autoPinEnabled}
                  onChange={(e) => setAutoPinEnabled(e.target.checked)}
                  className={styles.autoPinCheckbox}
                />
                <span className={styles.autoPinText}>
                  <PinedIcon /> Auto-pin uploads
                </span>
              </label>
              <p className={styles.autoPinHint}>
                {autoPinEnabled 
                  ? 'New files will be pinned automatically (guaranteed persistence)' 
                  : 'Unpinned files are FREE but may be lost! Turn on auto-pin for guaranteed persistence.'}
              </p>
            </div>

            {/* Storage Info */}
            <div className={styles.storageInfo}>
              <div className={styles.storageStats}>
                <div className={styles.storageHeader}>
                  <div className={styles.storageActions}>
                    <button
                      className={styles.cleanupBtn}
                      onClick={() => {
                        setShowStorageCleanup(true);
                        setShowMobileMenu(false);
                      }}
                      title="Clean up storage"
                    >
                      <GearIcon /> Clean Up Storage
                    </button>
                    <button
                      className={styles.gatewayBtn}
                      onClick={() => {
                        setShowGatewaySettings(true);
                        setShowMobileMenu(false);
                      }}
                      title="Gateway/CDN settings"
                    >
                      <SettingIcon /> Gateways
                    </button>
                  </div>
                  <h4 className={styles.storageTitle}>Storage Overview</h4>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Total Files:</span>
                  <span className={styles.statValue}>{storageStats.totalFiles}</span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Total Size:</span>
                  <span className={styles.statValue}>{formatFileSize(storageStats.totalSize)}</span>
                </div>
                <hr className={styles.statDivider} />
                <div className={styles.statRow}>
                  <span className={styles.statLabel}><PinedIcon /> Pinned (Paid):</span>
                  <span className={styles.statValue}>
                    {storageStats.pinnedCount} ({formatFileSize(storageStats.pinnedSize)})
                  </span>
                </div>
                {storageStats.pinnedSize > 0 && (
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}>💰 Est. {billingCycleTitle} Cost:</span>
                    <span className={styles.statValue}>
                      {calculatePinningCost(storageStats.pinnedSize, DEFAULT_BILLING_CYCLE_DAYS)}
                    </span>
                  </div>
                )}
                {billingStatus && (
                  <>
                    <div className={styles.statRow}>
                      <span className={styles.statLabel}>Next Billing:</span>
                      <span className={styles.statValue}>{formatDate(billingStatus.nextBillingDate)}</span>
                    </div>
                    <div className={styles.statRow}>
                      <span className={styles.statLabel}>Free Tier Limit:</span>
                      <span className={styles.statValue}>${billingStatus.freeTierLimitUSD.toFixed(2)}/month</span>
                    </div>
                  </>
                )}
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>🆓 Unpinned (Free):</span>
                  <span className={styles.statValue}>
                    {storageStats.unpinnedCount} ({formatFileSize(storageStats.unpinnedSize)})
                  </span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statLabel}><TableIcon /> Total Size:</span>
                  <span className={styles.statValue}>
                    {formatFileSize(storageStats.totalSize)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div {...getRootProps()} className={styles.uploadSection}>
            <input {...getInputProps()} />
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={async (e) => {
                // Prevent multiple triggers
                if (isFileInputProcessingRef.current) {
                  e.target.value = '';
                  return;
                }
                
                if (e.target.files && e.target.files.length > 0) {
                  isFileInputProcessingRef.current = true;
                  const files = Array.from(e.target.files);
                  
                  try {
                    // Process files asynchronously
                    await onDrop(files);
                  } catch (error) {
                    console.error('File upload error:', error);
                  } finally {
                    // Reset input so same file can be selected again
                    e.target.value = '';
                    // Allow file input to be used again after a short delay
                    setTimeout(() => {
                      isFileInputProcessingRef.current = false;
                    }, 300);
                  }
                } else {
                  e.target.value = '';
                  isFileInputProcessingRef.current = false;
                }
              }}
            />
            <DropdownMenu>
              <DropdownMenuTrigger 
              className={styles.newButton} 
              disabled={isUploading}
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <span className={styles.plusIcon}>+</span>
              {isUploading ? 'Uploading...' : 'New'}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={handleCreateFolder}>
                  <FolderIcon /> New Folder
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation();
                  handleFileUploadClick(e);
                }}>
                  <PageIcon /> File Upload
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <nav className={styles.sidebarNav}>
            <div 
              className={`${styles.navItem} ${activeView === 'drive' ? styles.active : ''}`}
              onClick={() => {
                handleViewChange('drive');
                setCurrentFolderId(null);
              }}
            >
              <span className={styles.navIcon}><FolderIcon /></span>
              <span>My Drive</span>
            </div>
            <div 
              className={`${styles.navItem} ${activeView === 'recent' ? styles.active : ''}`}
              onClick={() => handleViewChange('recent')}
            >
              <span className={styles.navIcon}><TimeIcon /></span>
              <span>Recent</span>
            </div>
            <div 
              className={`${styles.navItem} ${activeView === 'starred' ? styles.active : ''}`}
              onClick={() => handleViewChange('starred')}
            >
              <span className={styles.navIcon}>{activeView === 'starred' ? <StarIcon /> : <StarOutlineIcon />}</span>
              <span>Starred</span>
            </div>
            <div 
              className={`${styles.navItem} ${activeView === 'trash' ? styles.active : ''}`}
              onClick={() => handleViewChange('trash')}
            >
              <span className={styles.navIcon}><TrashIcon /></span>
              <span>Trash</span>
            </div>
          </nav>

          {/* Auto-pin Toggle */}
          <div className={styles.autoPinSection}>
            <label className={styles.autoPinLabel}>
              <input 
                type="checkbox" 
                checked={autoPinEnabled}
                onChange={(e) => setAutoPinEnabled(e.target.checked)}
                className={styles.autoPinCheckbox}
              />
              <span className={styles.autoPinText}>
                <PinedIcon /> Auto-pin uploads
              </span>
            </label>
            <p className={styles.autoPinHint}>
              {autoPinEnabled 
                ? 'New files will be pinned automatically (guaranteed persistence)' 
                : ''}
            </p>

            {!autoPinEnabled && (
              <p className={styles.autoPinHint} style={{ marginTop: '8px', color: '#10b981' }}>
                Tip: Unpinned files are FREE but may be lost. Enable auto-pin for guaranteed persistence.
              </p>
            )}
          </div>

          <div className={styles.storageInfo}>
            <div className={styles.storageStats}>
              <div className={styles.storageHeader}>
                <div className={styles.storageActions}>
                  <button
                    className={styles.cleanupBtn}
                    onClick={() => setShowStorageCleanup(true)}
                    title="Clean up storage"
                  >
                    <GearIcon /> Clean Up Storage
                  </button>
                  <button
                    className={styles.gatewayBtn}
                    onClick={() => setShowGatewaySettings(true)}
                    title="Gateway/CDN settings"
                  >
                    <SettingIcon /> Gateways
                  </button>
                </div>
                <h4 className={styles.storageTitle}>Storage Overview</h4>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Total Files:</span>
                <span className={styles.statValue}>{storageStats.totalFiles}</span>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Total Size:</span>
                <span className={styles.statValue}>{formatFileSize(storageStats.totalSize)}</span>
              </div>
              <hr className={styles.statDivider} />
              <div className={styles.statRow}>
                <span className={styles.statLabel}><PinedIcon /> Pinned (Paid):</span>
                <span className={styles.statValue}>
                  {storageStats.pinnedCount} ({formatFileSize(storageStats.pinnedSize)})
                </span>
              </div>
              {billingStatus && storageStats.pinnedSize > 0 && (
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>💰 Usage:</span>
                  <span className={styles.statValue}>
                    {billingStatus.pinnedSizeGB.toFixed(2)} GB / {billingStatus.freeTierGB} GB free
                  </span>
                </div>
              )}
              {billingStatus && billingStatus.monthlyCostUSD > 0 && (
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Est. Monthly Cost:</span>
                  <span className={styles.statValue}>
                    ${billingStatus.monthlyCostUSD.toFixed(2)}/month
                  </span>
                </div>
              )}
              {billingStatus && (
                <>
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}>Next Billing:</span>
                    <span className={styles.statValue}>{formatDate(billingStatus.nextBillingDate)}</span>
                  </div>
                  <div className={styles.statRow}>
                    <span className={styles.statLabel}>Pricing:</span>
                    <span className={styles.statValue}>{billingStatus.freeTierGB} GB free, then ${billingStatus.costPerGB}/GB</span>
                  </div>
                </>
              )}
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Unpinned (FREE):</span>
                <span className={styles.statValue + ' ' + (storageStats.unpinnedCount > 0 ? styles.warning : '')}>
                  {storageStats.unpinnedCount} ({formatFileSize(storageStats.unpinnedSize)})
                </span>
              </div>
              {storageStats.unpinnedCount > 0 && (
                <p className={styles.warningText}>
                  Unpinned files are FREE but may be lost! Pin them for guaranteed persistence.
                </p>
              )}
            </div>
          </div>
        </aside>

        {/* File Display Area */}
        <main className={styles.fileArea}>
          {showBillingWarning && billingStatus && (
            <div className={styles.billingWarningBanner}>
              <div className={styles.billingWarningIcon}><WarningRoundIcon /></div>
              <div className={styles.billingWarningContent}>
                <div className={styles.billingWarningTitle}>Free tier exceeded</div>
                <p className={styles.billingWarningText}>
                  You&apos;re using {billingStatus.pinnedSizeGB.toFixed(2)} GB (free tier: {billingStatus.freeTierGB} GB). 
                  Overage of {formatChargeAmount(billingStatus)} will be charged on {getBillingDayLabel(billingStatus)}.
                </p>
                <div className={styles.billingWarningActions}>
                  <button
                    className={styles.billingWarningAction}
                    onClick={() => setShowPaymentModal(true)}
                  >
                    Add payment now
                  </button>
                  <button
                    className={styles.billingWarningDismiss}
                    onClick={dismissBillingWarning}
                  >
                    Dismiss for 14 days
                  </button>
                </div>
              </div>
            </div>
          )}
          {pinningWarning && (
            <div className={styles.pinningWarningBanner}>
              <div className={styles.pinningWarningIcon}><WarningRoundIcon /></div>
              <div>
                <div className={styles.pinningWarningTitle}>Pinning Service Attention Needed</div>
                <p className={styles.pinningWarningText}>{pinningWarning}</p>
              </div>
            </div>
          )}
          {/* Breadcrumb Navigation */}
          {activeView === 'drive' && (
            <div className={styles.breadcrumb}>
              <span 
                className={styles.breadcrumbItem}
                onClick={() => {
                  setCurrentFolderId(null);
                  setActiveView('drive');
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  (e.currentTarget as HTMLElement).classList.add('dragOver');
                }}
                onDragLeave={(e) => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  const isOutside = e.clientX < rect.left || e.clientX >= rect.right ||
                                   e.clientY < rect.top || e.clientY >= rect.bottom;
                  if (isOutside) {
                    (e.currentTarget as HTMLElement).classList.remove('dragOver');
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  (e.currentTarget as HTMLElement).classList.remove('dragOver');
                  
                  const draggedFileId = e.dataTransfer.getData('text/plain');
                  if (draggedFileId) {
                    handleFileMove(draggedFileId, null);
                  }
                }}
              >
                My Drive
              </span>
              {folderPath.map((folder, index) => (
                <React.Fragment key={folder.id}>
                  <span className={styles.breadcrumbSep}> / </span>
                  <span 
                    className={styles.breadcrumbItem}
                    onClick={() => {
                      setCurrentFolderId(folder.id);
                      setActiveView('drive');
                    }}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      (e.currentTarget as HTMLElement).classList.add('dragOver');
                    }}
                    onDragLeave={(e) => {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      const isOutside = e.clientX < rect.left || e.clientX >= rect.right ||
                                       e.clientY < rect.top || e.clientY >= rect.bottom;
                      if (isOutside) {
                        (e.currentTarget as HTMLElement).classList.remove('dragOver');
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      (e.currentTarget as HTMLElement).classList.remove('dragOver');
                      
                      const draggedFileId = e.dataTransfer.getData('text/plain');
                      if (draggedFileId) {
                        handleFileMove(draggedFileId, folder.id);
                      }
                    }}
                  >
                    {folder.name}
                  </span>
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Trash Auto-Delete Warning */}
          {activeView === 'trash' && (() => {
            const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
            const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
            const now = Date.now();
            const trashedFiles = getTrashedItems();
            const expiredFiles = trashedFiles.filter(f => f.trashedDate && (now - f.trashedDate) >= thirtyDaysMs);
            const warningFiles = trashedFiles.filter(f => {
              if (!f.trashedDate) return false;
              const age = now - f.trashedDate;
              return age >= (thirtyDaysMs - sevenDaysMs) && age < thirtyDaysMs;
            });
            
            if (expiredFiles.length === 0 && warningFiles.length === 0) return null;
            
            return (
              <div className={styles.trashWarningBanner}>
                <div className={styles.trashWarningContent}>
                  <span className={styles.trashWarningIcon}><WarningRoundIcon /></span>
                  <div className={styles.trashWarningText}>
                    {expiredFiles.length > 0 && (
                      <strong>{expiredFiles.length} item{expiredFiles.length !== 1 ? 's' : ''} will be permanently deleted and unpinned automatically (older than 30 days)</strong>
                    )}
                    {expiredFiles.length > 0 && warningFiles.length > 0 && <span> • </span>}
                    {warningFiles.length > 0 && (() => {
                      const oldestWarningFile = warningFiles.reduce((oldest, f) => {
                        if (!oldest.trashedDate) return f;
                        if (!f.trashedDate) return oldest;
                        const age = now - f.trashedDate;
                        const oldestAge = now - oldest.trashedDate;
                        return age > oldestAge ? f : oldest;
                      }, warningFiles[0]);
                      const daysRemaining = oldestWarningFile.trashedDate 
                        ? Math.max(0, Math.ceil((thirtyDaysMs - (now - oldestWarningFile.trashedDate)) / (24 * 60 * 60 * 1000)))
                        : 0;
                      return (
                        <span>{warningFiles.length} item{warningFiles.length !== 1 ? 's' : ''} will be deleted in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}</span>
                      );
                    })()}
                  </div>
                  {expiredFiles.length > 0 && (
                    <button
                      className={styles.cleanupTrashBtn}
                      onClick={async () => {
                        const result = await autoCleanupTrash();
                        if (result.deleted > 0 || result.unpinned > 0) {
                          showToast(`${result.deleted} item${result.deleted !== 1 ? 's' : ''} deleted${result.unpinned > 0 ? `, ${result.unpinned} unpinned` : ''}`, 'success');
                        }
                      }}
                    >
                      Clean Up Now
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Selection Toolbar - Only in cleanup mode */}
          {cleanupMode && selectedFiles.size > 0 && (
            <div className={styles.selectionToolbar}>
              <div className={styles.selectionInfo}>
                <span className={styles.selectionCount}>
                  {selectedFiles.size} {selectedFiles.size === 1 ? 'item' : 'items'} selected
                </span>
                <span className={styles.selectionSize}>
                  {formatFileSize(
                    filteredFiles
                      .filter(f => selectedFiles.has(f.id) && !f.isFolder)
                      .reduce((sum, f) => sum + (f.size || 0), 0)
                  )}
                </span>
              </div>
              <div className={styles.selectionActions}>
                {activeView === 'trash' ? (
                  <>
                    <button 
                      className={styles.selectionBtn}
                      onClick={handleBulkRestore}
                      title="Restore selected files"
                    >
                      <UndoIcon /> Restore
                    </button>
                    <button 
                      className={`${styles.selectionBtn} ${styles.selectionBtnDanger}`}
                      onClick={handleBulkPermanentlyDelete}
                      title="Permanently delete selected files"
                    >
                      <TrashIcon /> Delete Permanently
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      className={styles.selectionBtn}
                      onClick={handleBulkDownload}
                      disabled={selectedFiles.size > 2}
                      title={
                        selectedFiles.size > 2 
                          ? "Download is limited to 2 files at a time. ZIP download feature coming soon!"
                          : "Download selected files"
                      }
                      style={selectedFiles.size > 2 ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                    >
                      <FileDownloadIcon /> Download
                    </button>
                    <button 
                      className={`${styles.selectionBtn} ${styles.selectionBtnDanger}`}
                      onClick={handleBulkMoveToTrash}
                      title="Move selected files to trash"
                    >
                      <TrashIcon /> Move to trash
                    </button>
                  </>
                )}
                <button 
                  className={styles.selectionBtn}
                  onClick={deselectAllFiles}
                  title="Deselect all"
                >
                  ✕ Deselect
                </button>
                <button 
                  className={styles.selectionBtn}
                  onClick={() => {
                    setCleanupMode(false);
                    setSelectedFiles(new Set());
                  }}
                  title="Exit cleanup mode"
                >
                  Exit Cleanup Mode
                </button>
              </div>
            </div>
          )}

          {/* Empty Trash Button - Only in trash view and cleanup mode */}
          {cleanupMode && activeView === 'trash' && (
            <div className={styles.emptyTrashContainer}>
              <button 
                className={`${styles.selectionBtn} ${styles.selectionBtnDanger}`}
                onClick={handleEmptyTrash}
                title="Permanently delete all items in trash"
              >
                <TrashIcon /> Empty Trash
              </button>
            </div>
          )}

          {/* Toolbar */}
          <div className={styles.toolbar}>
            <div className={styles.toolbarLeft}>
              {activeView === 'drive' && !cleanupMode && (
                <button 
                  className={styles.newFolderBtn}
                  onClick={handleCreateFolder}
                  title="Create new folder"
                >
                  <FolderIcon />+ New Folder
                </button>
              )}
              {cleanupMode && (
                <button 
                  className={styles.selectAllBtn}
                  onClick={selectedFiles.size === filteredFiles.length ? deselectAllFiles : selectAllFiles}
                  title={selectedFiles.size === filteredFiles.length ? "Deselect all files" : "Select all files"}
                >
                  {selectedFiles.size === filteredFiles.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>
            <div className={styles.toolbarRight}>
              {/* Sorting dropdown */}
              <select 
                className={styles.sortSelect}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                title="Sort by"
              >
                <option value="name">Name</option>
                <option value="date">Modified</option>
                <option value="size">Size</option>
                <option value="type">Type</option>
              </select>
              <button 
                className={styles.sortDirection}
                onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                title={`Sort ${sortDirection === 'asc' ? 'descending' : 'ascending'}`}
              >
                {sortDirection === 'asc' ? '↑' : '↓'}
              </button>
              <button 
                className={viewMode === 'grid' ? styles.viewBtnActive : styles.viewBtn}
                onClick={() => setViewMode('grid')}
                title="Grid view"
              >
                ▦
              </button>
              <button 
                className={viewMode === 'list' ? styles.viewBtnActive : styles.viewBtn}
                onClick={() => setViewMode('list')}
                title="List view"
              >
                <ListIcon />
              </button>
              {viewMode === 'list' && (
                <button
                  className={styles.columnSettingsBtn}
                  onClick={() => setShowColumnSettings(!showColumnSettings)}
                  title="Column settings"
                >
                  <TableIcon />
                </button>
              )}
              {uploadedFiles.length > 0 && (activeView === 'drive' || activeView === 'trash') && (
                <button 
                  className={styles.clearBtn} 
                  onClick={() => {
                    if (cleanupMode) {
                      setCleanupMode(false);
                      setSelectedFiles(new Set());
                    } else {
                      setCleanupMode(true);
                    }
                  }}
                >
                  {cleanupMode ? 'Exit Cleanup Mode' : 'Clean Up Storage'}
                </button>
              )}
            </div>
          </div>

          {/* Upload Dropzone Overlay */}
          {isDragActive && (
            <div className={styles.dropOverlay}>
              <div className={styles.dropMessage}>
                <span className={styles.dropIcon}>📤</span>
                <p>Drop files here to upload</p>
              </div>
            </div>
          )}

          {/* Files Display */}
          {filesLoading ? (
            viewMode === 'grid' ? (
              <div className={styles.fileGrid}>
                <SkeletonLoader type="file-card" count={8} />
              </div>
            ) : (
              <div className={styles.fileList}>
                <SkeletonLoader type="file-row" count={10} />
              </div>
            )
          ) : filteredFiles.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>
                {activeView === 'trash' ? <TrashIcon /> : activeView === 'starred' ? <StarIcon /> : <FolderIcon />}
              </span>
              <h3>
                {activeView === 'trash' ? 'Trash is empty' : 
                 activeView === 'starred' ? 'No starred items' :
                 activeView === 'recent' ? 'No recent files' :
                 'No files yet'}
              </h3>
              <p>
                {activeView === 'trash' ? 'Items you delete will appear here' :
                 activeView === 'starred' ? 'Star items to find them easily' :
                 activeView === 'recent' ? 'Recently accessed files will appear here' :
                 'Upload files to see them here'}
              </p>
              {activeView === 'drive' && (
                <>
              <div {...getRootProps()}>
                <input {...getInputProps()} />
                <button className={styles.emptyUploadBtn}>
                  Upload Files
                </button>
              </div>
              
              {/* Sync from IPFS URI */}
              <div className={styles.syncSection}>
                <p>Or sync files from another browser:</p>
                <input
                  type="text"
                  placeholder="Paste IPFS URI here (ipfs://...)"
                  className={styles.syncInput}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      const uri = (e.target as HTMLInputElement).value;
                      if (uri.startsWith('ipfs://') && user) {
                        localStorage.setItem(`user_file_list_uri_${user.uid}`, uri);
                        window.location.reload();
                      } else {
                        showToast('Please enter a valid IPFS URI (starts with ipfs://)', 'error');
                      }
                    }
                  }}
                />
                <p className={styles.syncHint}>Press Enter to sync</p>
              </div>
                </>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className={styles.fileGrid}>
              {filteredFiles.map((file) => {
                return (
                <div 
                  key={file.id} 
                  className={`${styles.fileCard} ${cleanupMode && selectedFiles.has(file.id) ? styles.fileCardSelected : ''}`}
                  onClick={(e) => {
                    if (cleanupMode) {
                      e.stopPropagation();
                      if (!file.isFolder) {
                        toggleFileSelection(file.id);
                      }
                    } else if (file.isFolder) {
                      handleFileClick(file);
                    }
                  }}
                  onDoubleClick={() => {
                    if (!cleanupMode && !file.isFolder) {
                      handleFileClick(file);
                    }
                  }}
                  onMouseEnter={(e) => {
                    if (!file.isFolder && file.type?.startsWith('image/')) {
                      // Clear any existing timeout
                      if (hoverTimeoutRef.current) {
                        clearTimeout(hoverTimeoutRef.current);
                        hoverTimeoutRef.current = null;
                      }
                      
                      // Set timeout for 2+ seconds before showing preview
                      hoverTimeoutRef.current = setTimeout(() => {
                        // Center the preview on viewport
                        const viewportWidth = window.innerWidth;
                        const viewportHeight = window.innerHeight;
                        setHoverPreviewPosition({
                          x: viewportWidth / 2,
                          y: viewportHeight / 2,
                        });
                        setHoverPreviewFile(file);
                      }, 2000);
                    }
                  }}
                  onMouseLeave={() => {
                    // Clear timeout if mouse leaves before 2 seconds
                    if (hoverTimeoutRef.current) {
                      clearTimeout(hoverTimeoutRef.current);
                      hoverTimeoutRef.current = null;
                    }
                    // Small delay to allow moving to preview
                    setTimeout(() => {
                      setHoverPreviewFile(null);
                    }, 100);
                  }}
                  data-folder-id={file.isFolder ? file.id : undefined}
                  data-file-id={!file.isFolder ? file.id : undefined}
                  draggable={!file.isFolder}
                  onDragStart={(e) => {
                    if (!file.isFolder) {
                      e.dataTransfer.setData('text/plain', file.id);
                      e.dataTransfer.effectAllowed = 'move';
                      
                      // Create custom drag image
                      const dragElement = e.currentTarget as HTMLElement;
                      const clone = dragElement.cloneNode(true) as HTMLElement;
                      clone.style.position = 'absolute';
                      clone.style.top = '-9999px';
                      clone.style.width = dragElement.offsetWidth + 'px';
                      clone.style.height = dragElement.offsetHeight + 'px';
                      clone.style.transform = 'scale(0.8) rotate(5deg)';
                      clone.style.opacity = '1.0';
                      clone.style.pointerEvents = 'none';
                      document.body.appendChild(clone);
                      
                      // Set the clone as the drag image
                      e.dataTransfer.setDragImage(clone, dragElement.offsetWidth / 2, dragElement.offsetHeight / 2);
                      
                      // Remove clone after a short delay
                      setTimeout(() => {
                        document.body.removeChild(clone);
                      }, 0);
                      
                      e.currentTarget.classList.add(styles.dragging);
                      setIsDragging(true);
                      // Prevent event from bubbling
                      e.stopPropagation();
                    } else {
                      e.preventDefault();
                    }
                  }}
                  onDragEnd={(e) => {
                    if (!file.isFolder) {
                      e.currentTarget.classList.remove(styles.dragging);
                      setIsDragging(false);
                    }
                  }}
                  onDragEnter={(e) => {
                    if (file.isFolder) {
                      e.preventDefault();
                      e.stopPropagation();
                      (e.currentTarget as HTMLElement).classList.add('dragOver');
                    }
                  }}
                  onDragLeave={(e) => {
                    if (file.isFolder) {
                      // Only remove if we're actually leaving the element (not a child)
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      const isOutside = e.clientX < rect.left || e.clientX >= rect.right ||
                                       e.clientY < rect.top || e.clientY >= rect.bottom;
                      if (isOutside) {
                        (e.currentTarget as HTMLElement).classList.remove('dragOver');
                      }
                    }
                  }}
                  onDragOver={(e) => {
                    if (file.isFolder) {
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = 'move';
                    }
                  }}
                  onDrop={(e) => {
                    if (file.isFolder) {
                      e.preventDefault();
                      e.stopPropagation();
                      (e.currentTarget as HTMLElement).classList.remove('dragOver');
                      
                      // Check if we're dropping files from the file system
                      const droppedFiles = Array.from(e.dataTransfer.files);
                      
                      if (droppedFiles.length > 0) {
                        // Dropping files from file system
                        handleFolderDrop(file.id, droppedFiles);
                      } else {
                        // Dropping a file card (moving existing file)
                        const draggedFileId = e.dataTransfer.getData('text/plain');
                        if (draggedFileId && draggedFileId !== file.id) {
                          handleFileMove(draggedFileId, file.id);
                        }
                      }
                    }
                  }}
                >
                  {/* Circular Checkbox - Only in cleanup mode */}
                  {cleanupMode && (
                    <div 
                      className={`${styles.fileCheckbox} ${selectedFiles.has(file.id) ? styles.fileCheckboxChecked : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFileSelection(file.id);
                      }}
                    >
                      {selectedFiles.has(file.id) && <CheckIcon />}
                    </div>
                  )}
                  
                  {/* File Preview/Icon */}
                  <div className={styles.filePreview}>
                    {file.isFolder ? (
                      <>
                        <div className={styles.folderIconLarge}>
                          <FolderIcon />
                        </div>
                        {/* Overlay buttons for folders - hidden in cleanup mode */}
                        {!cleanupMode && (
                        <div className={styles.imageOverlay}>
                          <button
                            className={styles.overlayBtn + ' ' + styles.overlayBtnTopLeft}
                            onClick={(e) => handleToggleStar(file.id, e)}
                            title={file.starred ? "Unstar" : "Star"}
                          >
                            {file.starred ? <StarIcon /> : <StarOutlineIcon />}
                          </button>
                          <button
                            className={styles.overlayBtn + ' ' + styles.overlayBtnTopRight}
                            onClick={(e) => handlePinToggle(file.id, file, e)}
                            title={file.isPinned ? "Pinned - Click to unpin (file may be lost)" : "Unpinned - Click to pin (file may be lost)"}
                          >
                            {file.isPinned ? <PinedIcon /> : <PinIcon />}
                          </button>
                        </div>
                        )}
                      </>
                    ) : file.type.startsWith('image/') ? (
                      <>
                        <Image 
                          src={file.gatewayUrl} 
                          alt={file.name} 
                          className={styles.fileThumbnail}
                          width={200}
                          height={200}
                          unoptimized
                          style={{ objectFit: 'cover' }}
                        />
                      </>
                    ) : (
                      <>
                        <div className={styles.fileIconLarge}>
                          {getFileIcon(file.type)}
                        </div>
                      </>
                    )}
                  </div>

                  {/* File Info */}
                  <div className={styles.fileInfo}>
                    <div className={styles.fileNameRow}>
                    <h4 className={styles.fileName} title={file.name}>{file.name}</h4>
                      {file.starred && (
                        <span className={styles.starredBadge} title="Starred"><StarIcon /></span>
                      )}
                    </div>
                    <div className={styles.fileMeta}>
                      {file.isFolder ? (
                        <span>Folder</span>
                      ) : (
                        <>
                      <span>{formatFileSize(file.size)}</span>
                      <span>•</span>
                        </>
                      )}
                      <span>{new Date(file.modifiedDate || file.timestamp).toLocaleDateString()}</span>
                      {file.pinService && !file.isFolder && (
                        <>
                          <span>•</span>
                          <span title="Pinning service">{file.pinService}</span>
                        </>
                      )}
                    </div>
                    {file.tags && file.tags.length > 0 && (
                      <div className={styles.fileTags}>
                        {file.tags.slice(0, 3).map((tag, idx) => (
                          <span key={idx} className={styles.tagBadge} title={`Tag: ${tag}`}>
                            {tag}
                          </span>
                        ))}
                        {file.tags.length > 3 && (
                          <span className={styles.tagBadge} title={`${file.tags.length - 3} more tags`}>
                            +{file.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* File Actions */}
                  <div className={styles.fileActions}>
                    {/* Star button */}
                    <button
                      className={styles.actionBtn}
                      data-active={file.starred}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleStar(file.id, e);
                      }}
                      title={file.starred ? "Unstar" : "Star"}
                    >
                      {file.starred ? <StarIcon /> : <StarOutlineIcon />}
                    </button>
                    
                    {/* Pin button */}
                    <button
                      className={styles.actionBtn}
                      data-pinned={file.isPinned}
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePinToggle(file.id, file, e);
                      }}
                      title={file.isPinned ? "Pinned - Click to unpin (file may be lost)" : "Unpinned - Click to pin (file may be lost)"}
                    >
                      {file.isPinned ? <PinedIcon /> : <PinIcon />}
                    </button>
                    
                    {/* 3-dot menu button */}
                    <div className={styles.menuContainer}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button 
                          className={styles.moreBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          title="More actions"
                        >
                          ⋮
                        </button>
                      </DropdownMenuTrigger>
                      
                      <DropdownMenuContent align="end" className={styles.userDropdownContent}>
                        {activeView !== 'trash' ? (
                          <>
                            {!file.isFolder && (
                              <>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handlePreview(file); }}>
                                  <VisibleIcon /> Preview
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleShowDetails(file); }}>
                                  🧾 Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDownload(file); }}>
                                  <FileDownloadIcon /> Download
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); window.open(file.gatewayUrl, '_blank'); }}>
                                  <SearchIcon /> Open in new tab
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); copyToClipboard(getBackendGatewayUrl(file.ipfsUri)); }}>
                              <ShareRoundIcon /> Share Link
                            </DropdownMenuItem>
                            <DropdownMenuItem className={styles.menuDisabled} onClick={(e) => { e.stopPropagation(); }}>
                              📋 Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem className={styles.menuDisabled} onClick={(e) => { e.stopPropagation(); }}>
                              <TagIcon /> Manage Tags
                            </DropdownMenuItem>
                            <DropdownMenuItem className={styles.menuDisabled} onClick={(e) => { e.stopPropagation(); }}>
                              📜 Version History
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRename(file.id); }}>
                              <EditIcon /> Rename
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(file.id); }} className={styles.menuDanger}>
                              <TrashIcon /> Trash
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRestore(file.id); }}>
                              <UndoIcon /> Restore
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(file.id); }} className={styles.menuDanger}>
                              ❌ Delete Forever
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.fileList}>
              {/* Column Headers */}
              <div className={styles.listHeader}>
                {visibleColumns.name && <div className={styles.listColumn} style={{ flex: '2' }}>Name</div>}
                {visibleColumns.size && <div className={styles.listColumn} style={{ flex: '1' }}>Size</div>}
                {visibleColumns.type && <div className={styles.listColumn} style={{ flex: '1' }}>Type</div>}
                {visibleColumns.modified && <div className={styles.listColumn} style={{ flex: '1' }}>Modified</div>}
                {visibleColumns.pinStatus && <div className={styles.listColumn} style={{ flex: '0.5' }}>Pin</div>}
                {visibleColumns.tags && <div className={styles.listColumn} style={{ flex: '1.5' }}>Tags</div>}
                {visibleColumns.starStatus && <div className={styles.listColumn} style={{ flex: '0.5' }}><StarIcon /></div>}
                <div className={styles.listColumn} style={{ flex: '0.5' }}>Actions</div>
              </div>
              
              {/* File Rows */}
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  className={`${styles.fileRow} ${cleanupMode && selectedFiles.has(file.id) ? styles.fileRowSelected : ''}`}
                  onClick={(e) => {
                    if (cleanupMode) {
                      e.stopPropagation();
                      toggleFileSelection(file.id);
                    } else if (file.isFolder) {
                      handleFileClick(file);
                    }
                  }}
                  onDoubleClick={() => {
                    if (!cleanupMode && !file.isFolder) {
                      handleFileClick(file);
                    }
                  }}
                  data-folder-id={file.isFolder ? file.id : undefined}
                  data-file-id={!file.isFolder ? file.id : undefined}
                >
                  {/* Name Column */}
                  {visibleColumns.name && (
                    <div className={styles.listColumn} style={{ flex: '2' }}>
                      {/* Circular Checkbox - Only in cleanup mode */}
                      {cleanupMode && (
                        <div 
                          className={`${styles.fileCheckbox} ${styles.fileCheckboxList} ${selectedFiles.has(file.id) ? styles.fileCheckboxChecked : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFileSelection(file.id);
                          }}
                        >
                          {selectedFiles.has(file.id) && <CheckIcon />}
                        </div>
                      )}
                      <div className={styles.fileIconSmall}>
                        {file.isFolder ? <FolderIcon /> : getFileIcon(file.type)}
                      </div>
                      <span className={styles.fileNameList} title={file.name}>{file.name}</span>
                    </div>
                  )}
                  
                  {/* Size Column */}
                  {visibleColumns.size && (
                    <div className={styles.listColumn} style={{ flex: '1' }}>
                      {file.isFolder ? '—' : formatFileSize(file.size)}
                    </div>
                  )}
                  
                  {/* Type Column */}
                  {visibleColumns.type && (
                    <div className={styles.listColumn} style={{ flex: '1' }}>
                      {file.isFolder ? 'Folder' : file.type || 'unknown'}
                    </div>
                  )}
                  
                  {/* Modified Column */}
                  {visibleColumns.modified && (
                    <div className={styles.listColumn} style={{ flex: '1' }}>
                      {new Date(file.modifiedDate || file.timestamp).toLocaleDateString()}
                    </div>
                  )}
                  
                  {/* Pin Status Column */}
                  {visibleColumns.pinStatus && (
                    <div className={styles.listColumn} style={{ flex: '0.5' }}>
                      {!file.isFolder && (file.isPinned ? <PinedIcon /> : <PinIcon />)}
                    </div>
                  )}
                  
                  {/* Tags Column */}
                  {visibleColumns.tags && (
                    <div className={styles.listColumn} style={{ flex: '1.5' }}>
                      {file.tags && file.tags.length > 0 ? (
                        <div className={styles.tagsListInline}>
                          {file.tags.slice(0, 2).map((tag, idx) => (
                            <span key={idx} className={styles.tagBadgeSmall}>{tag}</span>
                          ))}
                          {file.tags.length > 2 && <span className={styles.tagBadgeSmall}>+{file.tags.length - 2}</span>}
                        </div>
                      ) : '—'}
                    </div>
                  )}
                  
                  {/* Star Status Column - hidden for folders in cleanup mode */}
                  {visibleColumns.starStatus && !(cleanupMode && file.isFolder) && (
                    <div className={styles.listColumn} style={{ flex: '0.5' }}>
                      {file.starred ? <StarIcon /> : <StarOutlineIcon />}
                    </div>
                  )}
                  
                  {/* Actions Column */}
                  <div className={styles.listColumn} style={{ flex: '0.5' }}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button 
                          className={styles.moreBtn}
                          onClick={(e) => e.stopPropagation()}
                          title="More actions"
                        >
                          ⋮
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className={styles.userDropdownContent}>
                        {activeView !== 'trash' ? (
                          <>
                            {!file.isFolder && (
                              <>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handlePreview(file); }}>
                                  <VisibleIcon /> Preview
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleShowDetails(file); }}>
                                  🧾 Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDownload(file); }}>
                                  <FileDownloadIcon /> Download
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); copyToClipboard(getBackendGatewayUrl(file.ipfsUri)); }}>
                              <ShareRoundIcon /> Share Link
                            </DropdownMenuItem>
                            <DropdownMenuItem className={styles.menuDisabled} onClick={(e) => { e.stopPropagation(); }}>
                              📋 Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem className={styles.menuDisabled} onClick={(e) => { e.stopPropagation(); }}>
                              <TagIcon /> Manage Tags
                            </DropdownMenuItem>
                            <DropdownMenuItem className={styles.menuDisabled} onClick={(e) => { e.stopPropagation(); }}>
                              📜 Version History
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRename(file.id); }}>
                              <EditIcon /> Rename
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(file.id); }} className={styles.menuDanger}>
                              <TrashIcon /> Trash
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRestore(file.id); }}>
                              <UndoIcon /> Restore
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(file.id); }} className={styles.menuDanger}>
                              ❌ Delete Forever
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Share Modal */}
      {shareModalFile && (
        <ShareModal
          fileName={shareModalFile.name}
          isOpen={true}
          onClose={() => setShareModalFile(null)}
          onShare={handleCreateShare}
          onDisableShare={handleDisableShare}
          existingShare={shareModalFile.shareConfig}
          isFolder={shareModalFile.isFolder}
        />
      )}

      {/* Preview Modal */}
      {previewModalFile && (
        <PreviewModal
          isOpen={true}
          fileName={previewModalFile.name}
          fileType={previewModalFile.type}
          gatewayUrl={previewModalFile.gatewayUrl}
          onClose={() => setPreviewModalFile(null)}
        />
      )}

      {/* Column Settings Modal */}
      {showColumnSettings && (
        <ColumnSettings
          visibleColumns={visibleColumns}
          onToggleColumn={(column) => {
            setVisibleColumns(prev => ({
              ...prev,
              [column]: !prev[column as keyof typeof prev]
            }));
          }}
          onClose={() => setShowColumnSettings(false)}
        />
      )}

      {/* Tag Manager Modal */}
      {tagManagerFile && (
        <TagManager
          fileId={tagManagerFile.id}
          currentTags={tagManagerFile.tags || []}
          allTags={getAllTags()}
          onAddTag={(tag) => {
            handleAddTag(tagManagerFile.id, tag);
            // Update local state to reflect the change
            const index = uploadedFiles.findIndex(f => f.id === tagManagerFile.id);
            if (index !== -1) {
              const updatedFile = { ...tagManagerFile, tags: [...(tagManagerFile.tags || []), tag.toLowerCase()] };
              setTagManagerFile(updatedFile);
            }
          }}
          onRemoveTag={(tag) => {
            handleRemoveTag(tagManagerFile.id, tag);
            // Update local state to reflect the change
            const index = uploadedFiles.findIndex(f => f.id === tagManagerFile.id);
            if (index !== -1) {
              const updatedFile = { ...tagManagerFile, tags: (tagManagerFile.tags || []).filter(t => t.toLowerCase() !== tag.toLowerCase()) };
              setTagManagerFile(updatedFile);
            }
          }}
          onClose={() => setTagManagerFile(null)}
        />
      )}

      {/* Storage Cleanup Modal */}
      {showStorageCleanup && (
        <StorageCleanupModal
          isOpen={true}
          files={uploadedFiles}
          onClose={() => setShowStorageCleanup(false)}
          onDelete={(fileIds) => {
            // Delete selected files
            fileIds.forEach(fileId => {
              const index = uploadedFiles.findIndex(f => f.id === fileId);
              if (index !== -1) {
                permanentlyDelete(index);
              }
            });
            showToast(`Deleted ${fileIds.length} file${fileIds.length !== 1 ? 's' : ''}`, 'success');
            setShowStorageCleanup(false);
          }}
          onCategoryClick={(category) => {
            // Map category names to filter types
            let fileType: 'all' | 'image' | 'video' | 'audio' | 'document' | 'folder' | 'other' = 'all';
            
            if (category === 'Images') {
              fileType = 'image';
            } else if (category === 'Videos') {
              fileType = 'video';
            } else if (category === 'Audio') {
              fileType = 'audio';
            } else if (category === 'PDFs' || category === 'Documents' || category === 'Spreadsheets') {
              fileType = 'document';
            } else if (category === 'Archives' || category === 'Other') {
              fileType = 'other';
            }
            
            // Navigate to root folder and set filter
            setCurrentFolderId(null);
            setActiveView('drive');
            setFilters({
              ...filters,
              fileType: fileType
            });
            setShowStorageCleanup(false);
            showToast(`Filtered by ${category.toLowerCase()}`, 'success');
          }}
        />
      )}

      {/* Hover Preview */}
      {hoverPreviewFile && (
        <FilePreviewHover
          file={hoverPreviewFile}
          position={hoverPreviewPosition}
          onClose={() => setHoverPreviewFile(null)}
        />
      )}

      {/* Details Panel */}
      {detailsPanelFile && (
        <FileDetailsPanel
          isOpen={true}
          file={detailsPanelFile as any}
          onClose={() => setDetailsPanelFile(null)}
          onDownload={() => handleDownload(detailsPanelFile)}
          onUpdateProperties={async (properties: Record<string, string>) => {
            const index = uploadedFiles.findIndex(f => f.id === detailsPanelFile.id);
            if (index !== -1) {
              const success = await updateCustomProperties(index, properties);
              if (success) {
                showToast('Custom properties updated', 'success');
                // Update the details panel file
                const updatedFile = uploadedFiles[index];
                setDetailsPanelFile({ ...updatedFile });
              } else {
                const appError = ErrorHandler.createAppError(new Error('Failed to update custom properties'));
                showToast(appError.userMessage, 'error');
              }
            }
          }}
          onShare={() => handleShare(detailsPanelFile.id)}
          onTogglePin={() => handlePinToggle(detailsPanelFile.id, detailsPanelFile)}
        />
      )}

      {/* Toast Notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          title={toast.title}
          progress={toast.progress}
        />
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmationModal.isOpen}
        title={confirmationModal.title}
        message={confirmationModal.message}
        confirmText={confirmationModal.confirmText}
        cancelText={confirmationModal.cancelText}
        onConfirm={confirmationModal.onConfirm}
        onCancel={() => setConfirmationModal({ ...confirmationModal, isOpen: false })}
        type={confirmationModal.type}
        showSuppressOption={confirmationModal.showSuppressOption}
        onSuppressChange={confirmationModal.onSuppressChange}
      />

      {/* Input Modal */}
      <InputModal
        isOpen={inputModal.isOpen}
        title={inputModal.title}
        message={inputModal.message}
        placeholder={inputModal.placeholder}
        defaultValue={inputModal.defaultValue}
        onConfirm={inputModal.onConfirm}
        onCancel={() => setInputModal({ ...inputModal, isOpen: false })}
      />

      {/* Duplicate File Modal */}
      <DuplicateFileModal
        isOpen={duplicateFileModal.isOpen}
        fileName={duplicateFileModal.fileName}
        onReplace={() => duplicateFileModal.onResolve('replace')}
        onKeepBoth={() => duplicateFileModal.onResolve('keepBoth')}
        onCancel={() => duplicateFileModal.onResolve('cancel')}
        hasMultipleDuplicates={duplicateFileModal.hasMultipleDuplicates}
        remainingCount={duplicateFileModal.remainingCount}
        onYesToAll={duplicateFileModal.onYesToAll}
        onNoToAll={duplicateFileModal.onNoToAll}
      />

      {/* Payment Modal */}
      {billingStatus && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          monthlyCostUSD={billingStatus.monthlyCostUSD}
          chargeAmountINR={billingStatus.chargeAmountINR}
          freeTierLimitUSD={billingStatus.freeTierLimitUSD}
          pinnedSizeGB={billingStatus.pinnedSizeGB}
          freeTierGB={billingStatus.freeTierGB}
          costPerGB={billingStatus.costPerGB}
          billingPeriod={billingStatus.billingPeriod}
          nextBillingDate={billingStatus.nextBillingDate}
          billingCycleDays={DEFAULT_BILLING_CYCLE_DAYS}
          onPaymentSuccess={async () => {
            await loadBillingStatus();
            showToast('Payment information added successfully!', 'success');
          }}
        />
      )}

      {/* Gateway Settings Modal */}
      <GatewaySettings
        isOpen={showGatewaySettings}
        onClose={() => setShowGatewaySettings(false)}
      />

      {/* Two-Factor Authentication Setup */}
      <TwoFactorSetup
        isOpen={showTwoFactorSetup}
        onClose={() => setShowTwoFactorSetup(false)}
        onEnabled={() => {
          showToast('Two-factor authentication enabled!', 'success');
          setShowTwoFactorSetup(false);
        }}
      />

      {/* Version History Modal */}
      {versionHistoryFile && (
        <VersionHistory
          isOpen={true}
          fileId={versionHistoryFile.id}
          fileName={versionHistoryFile.name}
          onClose={() => setVersionHistoryFile(null)}
          onRestore={handleRestoreVersion}
        />
      )}

      {/* Upload Progress Panel */}
      {uploadQueue.length > 0 && (() => {
        const allComplete = uploadQueue.every(item => item.status === 'complete' || item.status === 'error');
        const completedCount = uploadQueue.filter(item => item.status === 'complete').length;
        const isUploading = uploadQueue.some(item => item.status === 'uploading');
        
        return (
        <div className={styles.uploadPanel}>
          <div className={styles.uploadHeader}>
              <h4>
                {allComplete 
                  ? `${completedCount} upload${completedCount !== 1 ? 's' : ''} complete`
                  : `Uploading ${uploadQueue.length} file${uploadQueue.length > 1 ? 's' : ''}`
                }
              </h4>
              <button onClick={() => {
                if (uploadCompleteTimeoutRef.current) {
                  clearTimeout(uploadCompleteTimeoutRef.current);
                  uploadCompleteTimeoutRef.current = null;
                }
                setUploadQueue([]);
              }} className={styles.closeUploadPanel}><CloseIcon /></button>
          </div>
          <div className={styles.uploadList}>
            {uploadQueue.map((item, index) => (
              <div key={index} className={styles.uploadItem}>
                <div className={styles.uploadItemInfo}>
                  <span className={styles.uploadItemName}>{item.name}</span>
                  <span className={styles.uploadItemProgress}>
                    {item.status === 'complete' ? <CheckIcon /> : item.status === 'error' ? <CloseIcon /> : `${Math.round(item.progress)}%`}
                  </span>
                </div>
                <div className={styles.progressBar}>
                  <div 
                    className={`${styles.progressFill} ${styles[item.status]}`}
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        );
      })()}

      {/* Bulk Operation Progress Panel */}
      {bulkOperationQueue.length > 0 && (() => {
        const allComplete = bulkOperationQueue.every(item => item.status === 'complete' || item.status === 'error');
        const completedCount = bulkOperationQueue.filter(item => item.status === 'complete').length;
        
        return (
          <div className={styles.uploadPanel}>
            <div className={styles.uploadHeader}>
              <h4>
                {allComplete 
                  ? `${completedCount} file${completedCount !== 1 ? 's' : ''} moved to trash`
                  : `Moving ${bulkOperationQueue.length} file${bulkOperationQueue.length > 1 ? 's' : ''} to trash`
                }
              </h4>
              <button onClick={() => {
                if (bulkOperationTimeoutRef.current) {
                  clearTimeout(bulkOperationTimeoutRef.current);
                  bulkOperationTimeoutRef.current = null;
                }
                setBulkOperationQueue([]);
              }} className={styles.closeUploadPanel}><CloseIcon /></button>
            </div>
            <div className={styles.uploadList}>
              {bulkOperationQueue.map((item, index) => (
                <div key={index} className={styles.uploadItem}>
                  <div className={styles.uploadItemInfo}>
                    <span className={styles.uploadItemName}>{item.name}</span>
                    <span className={styles.uploadItemProgress}>
                      {item.status === 'complete' ? <CheckIcon /> : item.status === 'error' ? <CloseIcon /> : `${Math.round(item.progress)}%`}
                    </span>
                  </div>
                  <div className={styles.progressBar}>
                    <div 
                      className={`${styles.progressFill} ${styles[item.status]}`}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Permanent Delete Progress Panel */}
      {permanentDeleteQueue.length > 0 && (() => {
        const allComplete = permanentDeleteQueue.every(item => item.status === 'complete' || item.status === 'error');
        const completedCount = permanentDeleteQueue.filter(item => item.status === 'complete').length;
        
        return (
          <div className={styles.uploadPanel}>
            <div className={styles.uploadHeader}>
              <h4>
                {allComplete 
                  ? `${completedCount} file${completedCount !== 1 ? 's' : ''} permanently deleted`
                  : `Permanently deleting ${permanentDeleteQueue.length} file${permanentDeleteQueue.length > 1 ? 's' : ''}`
                }
              </h4>
              <button onClick={() => {
                if (permanentDeleteTimeoutRef.current) {
                  clearTimeout(permanentDeleteTimeoutRef.current);
                  permanentDeleteTimeoutRef.current = null;
                }
                setPermanentDeleteQueue([]);
              }} className={styles.closeUploadPanel}><CloseIcon /></button>
            </div>
            <div className={styles.uploadList}>
              {permanentDeleteQueue.map((item, index) => (
                <div key={index} className={styles.uploadItem}>
                  <div className={styles.uploadItemInfo}>
                    <span className={styles.uploadItemName}>{item.name}</span>
                    <span className={styles.uploadItemProgress}>
                      {item.status === 'complete' ? <CheckIcon /> : item.status === 'error' ? <CloseIcon /> : `${Math.round(item.progress)}%`}
                    </span>
                  </div>
                  <div className={styles.progressBar}>
                    <div 
                      className={`${styles.progressFill} ${styles[item.status]}`}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Dashboard;
