import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import compression from "compression";

function hashString(str: string): string {
  if (!str) return "";
  return crypto.createHash("sha256").update(str).digest("hex");
}

function hashPasswordForStorage(password: string): string {
  const salt = crypto.randomBytes(16);
  const iterations = 310000;
  const derived = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
  return `pbkdf2-sha256$${iterations}$${salt.toString("hex")}$${derived.toString("hex")}`;
}
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { INITIAL_ARTICLES } from "./src/data/initialBlogData";
import { ROUTES_SEO_MAP, getRouteSeoInfo, SITE_DOMAIN } from "./src/utils/seoManager";
import {
  CATEGORY_SLUGS,
  getArticleCategoryTaxonomy,
  getArticleTagTaxonomy,
  buildTaxonomyUrl,
  findCategoryNameBySlug
} from "./src/config/articleTaxonomy";
import {
  getAllUsers,
  saveUsers,
  registerUser,
  getCmsSettings,
  getCmsSettingsForClient,
  saveCmsSettings,
  addDeepseekLog,
  clearDeepseekLogs,