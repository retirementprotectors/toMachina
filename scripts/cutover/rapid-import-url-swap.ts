#!/usr/bin/env npx tsx
/**
 * RAPID_IMPORT URL Swap Script
 *
 * Generates the diff needed to switch RAPID_IMPORT from the GAS Web App URL
 * to the Cloud Run API at api.tomachina.com.
 *
 * DOES NOT APPLY THE CHANGE — outputs the diff for Sprint 5 review + JDM approval.
 *
 * Changes:
 * 1. RAPID_API_CONFIG.URL: GAS Web App → Cloud Run API
 * 2. callRapidAPI_() function: query string routing → direct path routing + OIDC auth
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

const RAPID_IMPORT_CODE_GS = resolve(__dirname, '../../gas/RAPID_IMPORT/Code.gs')

// Read current Code.gs
let source: string
try {
  source = readFileSync(RAPID_IMPORT_CODE_GS, 'utf-8')
} catch {
  // Fallback path for running from repo root
  try {
    source = readFileSync(resolve(process.cwd(), 'gas/RAPID_IMPORT/Code.gs'), 'utf-8')
  } catch {
    console.error('ERROR: Cannot find gas/RAPID_IMPORT/Code.gs')
    console.error('Run this script from the toMachina repo root or scripts/cutover/ directory.')
    process.exit(1)
  }
}

console.log('='.repeat(80))
console.log('RAPID_IMPORT URL SWAP — Sprint 5 Cutover Preview')
console.log('='.repeat(80))
console.log()

// ─── Change 1: RAPID_API_CONFIG URL ───

const OLD_URL = "https://script.google.com/macros/s/AKfycbwaCzn-U1arJn17b4s2afF8ZIGJTs-Uf5PdA5t63o8Rx0hLNXuzZD4SJs7IJ0GLnaFb/exec"
const NEW_URL = "https://api.tomachina.com/api"

console.log('CHANGE 1: RAPID_API_CONFIG.URL')
console.log('-'.repeat(40))
console.log(`  OLD: ${OLD_URL}`)
console.log(`  NEW: ${NEW_URL}`)
console.log()

if (!source.includes(OLD_URL)) {
  console.warn('  WARNING: Old URL not found in Code.gs. It may have already been changed.')
}

// ─── Change 2: callRapidAPI_() function rewrite ───

console.log('CHANGE 2: callRapidAPI_() function rewrite')
console.log('-'.repeat(40))
console.log()

const OLD_FUNCTION = `function callRapidAPI_(endpoint, method, payload) {
  try {
    // Get API key from Script Properties
    const apiKey = PropertiesService.getScriptProperties().getProperty('RAPID_API_KEY') || '';

    // GAS web apps ONLY support GET and POST — use _method override for PUT/DELETE
    var httpMethod = method.toUpperCase() === 'GET' ? 'get' : 'post';
    var methodParam = '';
    if (method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'POST') {
      methodParam = '&_method=' + method.toUpperCase();
    }

    const url = RAPID_API_CONFIG.URL + '?path=' + endpoint + (apiKey ? '&api_key=' + apiKey : '') + methodParam;

    const options = {
      method: httpMethod,
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      timeout: 45000
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseText = response.getContentText();

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      result = { success: false, error: 'Invalid API response: ' + responseText.substring(0, 200) };
    }

    Logger.log('RAPID_API [' + endpoint + '] response: ' + JSON.stringify(result).substring(0, 500));
    return result;

  } catch (error) {
    Logger.log('RAPID_API call error: ' + error.message);
    return { success: false, error: error.message };
  }
}`

const NEW_FUNCTION = `function callRapidAPI_(endpoint, method, payload) {
  try {
    // Cloud Run API uses OIDC identity token for auth
    const idToken = ScriptApp.getIdentityToken();

    // Direct path routing — no query string params
    const url = RAPID_API_CONFIG.URL + '/' + endpoint;

    const options = {
      method: method.toLowerCase(),
      contentType: 'application/json',
      headers: {
        'Authorization': 'Bearer ' + idToken
      },
      payload: payload ? JSON.stringify(payload) : undefined,
      muteHttpExceptions: true,
      timeout: 45000
    };

    // Remove payload for GET requests
    if (method.toUpperCase() === 'GET') {
      delete options.payload;
    }

    const response = UrlFetchApp.fetch(url, options);
    const responseText = response.getContentText();

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      result = { success: false, error: 'Invalid API response: ' + responseText.substring(0, 200) };
    }

    Logger.log('RAPID_API [' + endpoint + '] response: ' + JSON.stringify(result).substring(0, 500));
    return result;

  } catch (error) {
    Logger.log('RAPID_API call error: ' + error.message);
    return { success: false, error: error.message };
  }
}`

console.log('--- OLD callRapidAPI_() ---')
console.log(OLD_FUNCTION)
console.log()
console.log('--- NEW callRapidAPI_() ---')
console.log(NEW_FUNCTION)
console.log()

// ─── Summary of Key Changes ───

console.log('='.repeat(80))
console.log('SUMMARY OF KEY CHANGES')
console.log('='.repeat(80))
console.log()
console.log('1. URL: GAS Web App exec endpoint → Cloud Run https://api.tomachina.com/api')
console.log('2. Auth: API key via query param → OIDC identity token via Bearer header')
console.log('3. Routing: ?path=endpoint&_method=PUT → /endpoint with native HTTP methods')
console.log('4. Method: GAS GET/POST limitation → Cloud Run supports GET/POST/PUT/PATCH/DELETE')
console.log('5. Payload: Always sent → Only sent for non-GET requests')
console.log()
console.log('PREREQUISITES (must be verified before applying):')
console.log('  [ ] Cloud Run API deployed and healthy at api.tomachina.com')
console.log('  [ ] OIDC auth configured on Cloud Run (accepts GAS identity tokens)')
console.log('  [ ] All 15+ callRapidAPI_ consumers tested against new URL')
console.log('  [ ] Rollback plan documented (revert RAPID_API_CONFIG.URL + function)')
console.log()
console.log('TO APPLY: Replace the above sections in gas/RAPID_IMPORT/Code.gs')
console.log('          Then: clasp push --force && verify all import functions work')
console.log()
console.log('STATUS: NOT APPLIED — Requires JDM approval in Sprint 5')
