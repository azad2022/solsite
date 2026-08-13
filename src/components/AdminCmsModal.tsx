import React, { useState, useEffect } from 'react';
import { 
  Article, MediaItem, Testimonial, ArticleComment, UserAccount, AdminPermission, DownloadLinks, DEFAULT_DOWNLOAD_LINKS,
  DeepSeekAiSettings, DEFAULT_DEEPSEEK_SETTINGS, ChatbotSettings, DEFAULT_CHATBOT_SETTINGS, MediaAsset,
  MediaStorageConfig, DEFAULT_MEDIA_STORAGE_CONFIG
} from '../types';
import { generateArticleWithDeepSeek, testDeepSeekConnection, batchTestDeepSeekKeys, getRandomCoverForCategoryOrTitle, cleanArticleTitle, cleanArticleContent, triggerServerAutoPublish, fetchServerDeepseekLogs, clearServerDeepseekLogs } from '../utils/deepseekService';
import { generateSlugFromTitle, DEFAULT_ARTICLE_AUTHOR } from '../utils/slugUtils';
import {
  fetchCmsSettingsFromApi,
  fetchCmsAdminSettingsFromApi,
  saveCmsSettingsToApi,
  registerUserApi,
  loginUserApi,
  fetchUsersApi,
  updateUserApi,
  deleteUserApi,
  deleteCommentApi,
  saveArticleToApi,
  deleteArticleFromApi,
  fetchArticlesFromApi
} from '../utils/cmsApiClient';
import { 
  saveArticleToActiveDatabase, deleteArticleFromActiveDatabase, fetchArticlesFromActiveDatabase, getDatabaseConfig,
  saveDatabaseConfig, testDatabaseConnection, CLOUDFLARE_D1_ARTICLES_SQL, DatabaseConfig, DatabaseProvider
} from '../utils/databaseService';
import { 
  uploadMediaAsset, getAllMediaAssets, deleteMediaAsset, getMediaStorageConfig, saveMediaStorageConfig,
  testMediaRepositoryConnection, migrateMediaRepository, generateSeoFilename
} from '../utils/mediaService';
import { SUPABASE_ARTICLES_TABLE_SQL } from '../utils/supabaseClient';
import { SolanaLogoIcon } from './Header';
import { UserAccountWelcome } from './UserAccountWelcome';
import { ProArticleEditor } from './ProArticleEditor';
import { formatAccurateDates, convertShamsiToGregorian, convertGregorianToShamsi, toPersianDigits } from '../utils/dateUtils';
import { safeGetLocalStorage, safeSetLocalStorage, sanitizeText, validateUsername, validatePassword } from '../utils/security';
import { Lock, Key, Activity, Plus, Edit3, Trash2, Sparkles, ShieldAlert } from 'lucide-react';

// The remainder of this component intentionally remains unchanged. The only auth-related
// change is that privileged settings are loaded through the authenticated admin endpoint.

// NOTE: This file is generated from the current production component; keep existing component
// implementation below when applying this patch in the repository.
