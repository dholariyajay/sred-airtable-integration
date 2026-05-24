const puppeteer = require('puppeteer');
const ScraperSession = require('../models/ScraperSession');
const logger = require('../utils/logger');

let activeBrowser = null;
let activePage = null;

async function initiateLogin(email, password) {
  if (activeBrowser) {
    await activeBrowser.close().catch(() => {});
  }

  activeBrowser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  activePage = await activeBrowser.newPage();
  await activePage.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  );

  await activePage.goto('https://airtable.com/login', { waitUntil: 'networkidle2' });

  await activePage.waitForSelector('input[name="email"], input[type="email"]', { timeout: 10000 });
  await activePage.type('input[name="email"], input[type="email"]', email, { delay: 50 });

  await activePage.waitForSelector('input[name="password"], input[type="password"]', { timeout: 5000 });
  await activePage.type('input[name="password"], input[type="password"]', password, { delay: 50 });

  await activePage.click('button[type="submit"]');

  try {
    await activePage.waitForNavigation({ timeout: 10000, waitUntil: 'networkidle2' });
  } catch {
    // MFA pages don't always trigger a full navigation
  }

  const currentUrl = activePage.url();
  const pageContent = await activePage.content();

  // TODO: replace string matching with a more reliable MFA detection approach
  const hasMfa = pageContent.includes('verification') ||
                 pageContent.includes('two-factor') ||
                 pageContent.includes('mfa') ||
                 pageContent.includes('Enter code') ||
                 currentUrl.includes('verify');

  if (hasMfa) {
    return { status: 'mfa_required', message: 'Please enter your MFA code' };
  }

  if (currentUrl.includes('airtable.com') && !currentUrl.includes('login')) {
    const cookies = await extractAndStoreCookies();
    return { status: 'authenticated', cookieCount: cookies.length };
  }

  return { status: 'login_failed', message: 'Could not authenticate — check credentials' };
}

async function submitMfaCode(mfaCode) {
  if (!activePage) {
    throw new Error('No active login session. Start login first.');
  }

  const mfaInput = await activePage.$('input[name="code"], input[type="text"], input[inputmode="numeric"]');
  if (!mfaInput) {
    throw new Error('MFA input field not found on page');
  }

  await mfaInput.type(mfaCode, { delay: 50 });

  const submitBtn = await activePage.$('button[type="submit"], button:not([disabled])');
  if (submitBtn) await submitBtn.click();

  try {
    await activePage.waitForNavigation({ timeout: 15000, waitUntil: 'networkidle2' });
  } catch {
    // manual check below
  }

  const currentUrl = activePage.url();
  if (currentUrl.includes('login') || currentUrl.includes('verify')) {
    return { status: 'mfa_failed', message: 'MFA verification failed — try again' };
  }

  const cookies = await extractAndStoreCookies();
  return { status: 'authenticated', cookieCount: cookies.length };
}

async function extractAndStoreCookies() {
  const cookies = await activePage.cookies();
  const airtableCookies = cookies.filter(c => c.domain.includes('airtable.com'));

  await ScraperSession.findOneAndUpdate(
    {},
    {
      cookies: airtableCookies.map(c => ({
        name: c.name, value: c.value, domain: c.domain,
        path: c.path, expires: c.expires
      })),
      isValid: true,
      mfaRequired: false,
      lastValidated: new Date()
    },
    { upsert: true }
  );

  if (activeBrowser) {
    await activeBrowser.close().catch(() => {});
    activeBrowser = null;
    activePage = null;
  }

  logger.info(`Extracted ${airtableCookies.length} cookies`);
  return airtableCookies;
}

async function validateCookies() {
  const session = await ScraperSession.findOne({});
  if (!session || !session.cookies || session.cookies.length === 0) {
    return { valid: false, reason: 'No cookies stored' };
  }

  try {
    const axios = require('axios');
    const cookieString = session.cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const response = await axios.get('https://airtable.com/v0.3/application/homeScreen', {
      headers: {
        'Cookie': cookieString,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      validateStatus: () => true
    });

    const isValid = response.status === 200;
    session.isValid = isValid;
    session.lastValidated = new Date();
    await session.save();

    return { valid: isValid, reason: isValid ? 'Cookies are valid' : 'Cookies expired' };
  } catch (err) {
    session.isValid = false;
    session.lastValidated = new Date();
    await session.save();
    return { valid: false, reason: err.message };
  }
}

async function getCookieString() {
  const session = await ScraperSession.findOne({});
  if (!session || !session.isValid) {
    throw new Error('No valid cookies. Please re-authenticate via the scraper.');
  }
  return session.cookies.map(c => `${c.name}=${c.value}`).join('; ');
}

module.exports = { initiateLogin, submitMfaCode, validateCookies, getCookieString };
