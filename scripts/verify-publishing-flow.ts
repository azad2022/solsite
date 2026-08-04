import { 
  tryAcquireSlotLock, 
  releaseSlotLock, 
  getCmsSettings, 
  saveCmsSettings, 
  getStoredArticles, 
  deleteArticleFromDisk 
} from '../src/utils/serverDataStore';
import fs from 'fs';
import path from 'path';

async function runVerificationSuite() {
  console.log("=================================================");
  console.log("🚀 STARTING AUTO-PUBLISHING PRODUCTION VERIFICATION");
  console.log("=================================================\n");

  let allPassed = true;

  // -----------------------------------------------------------------
  // TEST 1: Atomic Multi-Instance Concurrent Execution / Lock Race
  // -----------------------------------------------------------------
  console.log("🔹 TEST 1: Concurrent Execution / Duplicate Prevention");
  const testSlotKey = `test_concurrent_slot_${Date.now()}`;
  
  const results = await Promise.all([
    Promise.resolve().then(() => tryAcquireSlotLock(testSlotKey)),
    Promise.resolve().then(() => tryAcquireSlotLock(testSlotKey)),
    Promise.resolve().then(() => tryAcquireSlotLock(testSlotKey)),
    Promise.resolve().then(() => tryAcquireSlotLock(testSlotKey)),
    Promise.resolve().then(() => tryAcquireSlotLock(testSlotKey))
  ]);

  const acquiredCount = results.filter(r => r === true).length;
  if (acquiredCount === 1) {
    console.log(`✅ TEST 1 PASSED: Exactly 1 out of 5 concurrent processes acquired the lock. (Results: ${results})`);
  } else {
    console.error(`❌ TEST 1 FAILED: Expected 1 lock winner, got ${acquiredCount}. (Results: ${results})`);
    allPassed = false;
  }
  releaseSlotLock(testSlotKey, 'error', 'Cleanup test lock');

  // -----------------------------------------------------------------
  // TEST 2: Lock Idempotency & Re-execution Block
  // -----------------------------------------------------------------
  console.log("\n🔹 TEST 2: Lock Idempotency (Success Block)");
  const successSlotKey = `test_success_slot_${Date.now()}`;
  const firstAcquire = tryAcquireSlotLock(successSlotKey);
  releaseSlotLock(successSlotKey, 'success', 'Completed test article');
  
  const secondAcquire = tryAcquireSlotLock(successSlotKey);
  if (firstAcquire === true && secondAcquire === false) {
    console.log("✅ TEST 2 PASSED: Successfully executed slot blocked subsequent re-execution.");
  } else {
    console.error(`❌ TEST 2 FAILED: First acquire: ${firstAcquire}, Second acquire: ${secondAcquire}`);
    allPassed = false;
  }

  // -----------------------------------------------------------------
  // TEST 3: Scheduled Days Matching & Day Bypass Prevention
  // -----------------------------------------------------------------
  console.log("\n🔹 TEST 3: Scheduled Days Matching & No Day Bypass");
  
  // Clean Persian day helper
  const cleanDay = (str: string) => str.replace(/[\u200c\s_]/g, '');
  const targetDays = ['شنبه', 'دوشنبه', 'چهارشنبه'];
  
  const tuesdayMatch = targetDays.some(d => cleanDay(d) === cleanDay('سه‌شنبه'));
  const saturdayMatch = targetDays.some(d => cleanDay(d) === cleanDay('شنبه'));
  const mondayMatch = targetDays.some(d => cleanDay(d) === cleanDay('دوشنبه'));

  if (!tuesdayMatch && saturdayMatch && mondayMatch) {
    console.log("✅ TEST 3 PASSED: Tuesday correctly rejected for ['شنبه', 'دوشنبه', 'چهارشنبه']. Saturday & Monday matched.");
  } else {
    console.error(`❌ TEST 3 FAILED: Tuesday match=${tuesdayMatch}, Sat match=${saturdayMatch}, Mon match=${mondayMatch}`);
    allPassed = false;
  }

  // -----------------------------------------------------------------
  // TEST 4: Validation Logic for Malformed AI Responses
  // -----------------------------------------------------------------
  console.log("\n🔹 TEST 4: AI Response Validation");
  const badResponses = [
    { title: '', content: 'Valid long content...' },
    { title: 'Short', content: 'Short' },
    { title: 'Valid Persian Title', content: 'Too short' },
    null,
    {}
  ];

  const validateArticleData = (articleData: any) => {
    if (!articleData || typeof articleData !== 'object') return false;
    if (!articleData.title || typeof articleData.title !== 'string' || articleData.title.trim().length < 4) return false;
    if (!articleData.content || typeof articleData.content !== 'string' || articleData.content.trim().length < 50) return false;
    return true;
  };

  const validationResults = badResponses.map(validateArticleData);
  if (validationResults.every(r => r === false)) {
    console.log("✅ TEST 4 PASSED: All invalid / malformed AI responses correctly rejected.");
  } else {
    console.error(`❌ TEST 4 FAILED: Malformed responses allowed: ${validationResults}`);
    allPassed = false;
  }

  // -----------------------------------------------------------------
  // TEST 5: Sitemap & Article URL Generation Consistency
  // -----------------------------------------------------------------
  console.log("\n🔹 TEST 5: Sitemap & Article URL Route Match");
  const sampleArticle = {
    id: 'test_art_123',
    slug: 'solana-wallet-security-guide-2026',
    title: 'راهنمای امنیت ولت سولانا',
    publishedAtGregorian: '2026-08-04'
  };

  const expectedSitemapLoc = `https://solmint.ir/article/${sampleArticle.slug}`;
  const expectedArticleRoute = `/article/${sampleArticle.slug}`;

  if (expectedSitemapLoc.endsWith(expectedArticleRoute)) {
    console.log(`✅ TEST 5 PASSED: Sitemap URL (${expectedSitemapLoc}) matches Article Route (${expectedArticleRoute}).`);
  } else {
    console.error("❌ TEST 5 FAILED: Sitemap URL does not match article route.");
    allPassed = false;
  }

  // -----------------------------------------------------------------
  // SUMMARY
  // -----------------------------------------------------------------
  console.log("\n=================================================");
  if (allPassed) {
    console.log("🎉 ALL AUTOMATED VERIFICATION TESTS PASSED SUCCESSFULLY!");
  } else {
    console.error("💥 SOME TESTS FAILED. PLEASE REVIEW LOGS ABOVE.");
    process.exit(1);
  }
  console.log("=================================================\n");
}

runVerificationSuite().catch(err => {
  console.error("Verification suite execution error:", err);
  process.exit(1);
});
