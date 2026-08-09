const KNOWN_BOTS = [
  'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider', 'yandexbot',
  'sogou', 'exabot', 'facebot', 'facebookexternalhit', 'ia_archiver',
  'chrome-lighthouse', 'lighthouse', 'gtmetrix', 'pingdom', 'uptimerobot',
  'statuscake', 'webpagetest', 'site24x7', 'newrelic', 'catchpoint',
  'gptbot', 'chatgpt-user', 'claude-web', 'anthropic-ai', 'cohere-ai',
  'perplexitybot', 'youbot', 'diffbot', 'applebot-extended', 'applebot',
  'bytespider', 'bytedance', 'ccbot', 'dataforseotbot', 'petalbot',
  'mj12bot', 'ahrefsbot', 'semrushbot', 'dotbot', 'rogerbot', 'blexbot',
  'seznambot', 'linkdexbot', 'voidbot', 'screaming frog', 'deepcrawl',
  'twitterbot', 'telegrambot', 'whatsapp', 'slackbot', 'linkedinbot',
  'discordbot', 'redditbot', 'pinterestbot', 'tumblr', 'embedly',
  'outbrain', 'quora-link-preview', 'bitlybot', 'showyoubot', 'vkshare',
  'w3c_validator', 'validator.nu', 'jigsaw', 'feedfetcher', 'feedparser',
  'java/', 'python', 'curl', 'wget', 'libwww', 'http-client', 'axios',
  'okhttp', 'go-http-client', 'apache-httpclient', 'scrapy', 'mechanize',
  'phantomjs', 'headless', 'selenium', 'webdriver', 'puppeteer', 'playwright',
  'chromium', 'htmlunit', 'jsdom', 'splash', 'casperjs', 'zombie',
  'bot', 'crawler', 'spider', 'scraper', 'fetcher', 'checker', 'monitor',
  'preview', 'proxy', 'downloader', 'aggregator', 'reader', 'scan',
  'archive', 'indexer', 'seo', 'link', 'sitemap', 'extract', 'scrape',
  'http_request', 'http.rb', 'ruby', 'pycurl', 'urllib', 'requests',
  'aiohttp', 'httpx', 'guzzle', 'reactor', 'httparty', 'mechanize',
  'nethttp', 'asynchttp', 'scalaj', 'spray', 'akka', 'finagle',
  'apach-', 'node-fetch', 'got', 'superagent', 'needle', 'unirest',
  'rest-client', 'restsharp', 'httpclient', 'http_', 'download',
  'loadimpact', 'k6/', 'jmeter', 'gatling', 'locust', 'vegeta',
  'ab-benchmarking', 'bombardier', 'wrk', 'siege', 'tsung', 'httperf',
  'apis-google', 'mediapartners-google', 'adsbot-google', 'feedburner',
  'google-read-aloud', 'google-structured-data', 'storebot-google',
  'amazonbot', 'ia_archiver', 'alexabot', 'yahoo-ad-monitoring',
  'yahoo-blogs', 'yahoo-mmcrawler', 'yahoo-newscrawler', 'yahoo-verticalcrawler',
  'microsoft-cryptoapi', 'msnbot', 'bingpreview', 'adidxbot', 'binglocalsearch',
  'msnbot-media', 'msnbot-newsblogs', 'msnbot-products', 'msnbot-webmaster',
  'seznambot', 'seznam', 'coccoc', 'naver', 'whale', 'yeti', 'mojeek',
  'mediatoolkitbot', 'brandwatch', 'trendictionbot', 'buzzbot', 'awariobot',
  'dataminr', 'crowdtangle', 'brandverity', 'netcraft', 'phishtank',
  'virustotal', 'safebrowsing', 'scanii', 'metauri', 'urlchecker',
  'securitytrails', 'shodan', 'censys', 'zmap', 'masscan', 'nmap',
  'nuclei', 'acunetix', 'burpsuite', 'nessus', 'qualys', 'openvas',
  'nikto', 'wapiti', 'skipfish', 'w3af', 'zaproxy', 'sqlmap',
  'wpscan', 'dirbuster', 'gobuster', 'ffuf', 'feroxbuster', 'wfuzz',
  'commoncrawl', 'archive.org', 'wayback', 'heritrix', 'wget/httrack',
  'grabber', 'sitesucker', 'webcopier', 'webzip', 'teleport', 'getright',
  'webstripper', 'webmirror', 'offline', 'httrack', 'pavuk', 'larbin',
  'linkwalker', 'cosmos', 'harvest', 'asterias', 'iconsurf', 'email',
  'collector', 'stripper', 'digger', 'ripper', 'copier', 'mirror',
  'reaper', 'siphon', 'leech', 'vacuum', 'sucker', 'magnet',
  'webbandit', 'netants', 'flashget', 'jetcar', 'massa', 'superbot',
  'postrank', 'openlink', 'moreover', 'moreover', 'bloglines', 'feedfetcher',
  'feedzirra', 'newsgator', 'feedreader', 'feed', 'rss', 'atom',
  'syndication', 'newsreader', 'newsbot', 'news', 'feed', 'xml',
  'sentry', 'bugsnag', 'raygun', 'rollbar', 'airbrake', 'honeybadger',
  'loggly', 'papertrail', 'splunk', 'datadog', 'newrelic', 'appdynamics',
  'pingback', 'trackback', 'xmlrpc', 'webmention', 'micropub',
  'indieauth', 'microsub', 'monocle', 'indigenous', 'quill', 'omnibear',
  'aws-cloudwatch', 'aws-lambda', 'aws-stepfunctions', 'amazon-cloudfront',
  'google-cloud', 'azure-functions', 'azure-monitor', 'gcp-monitoring',
  'vercel-edge', 'cloudflare-worker', 'fastly', 'akamai', 'imperva',
  'datadome', 'distil', 'perimeterx', 'kasada', 'shapesecurity',
  'postman', 'insomnia', 'paw', 'httpie', 'rest', 'api',
  'graphql', 'swagger', 'openapi', 'soapui', 'katalon', 'testim',
  'cypress', 'jest', 'mocha', 'karma', 'jasmine', 'qunit',
  'testcafe', 'nightwatch', 'webdriverio', 'protractor', 'codecept',
  'survey', 'form', 'questionnaire', 'poll', 'quiz', 'ballot',
  'integration', 'zapier', 'ifttt', 'integromat', 'make', 'n8n',
  'huginn', 'activepieces', 'pipedream', 'tray', 'workato', 'mulesoft',
  'twilio', 'plivo', 'nexmo', 'vonage', 'messagebird', 'sinch',
  'bandwidth', 'signalwire', 'telnyx', 'phone', 'sms', 'voice',
  'shopify', 'woocommerce', 'magento', 'prestashop', 'bigcommerce',
  'opencart', 'commerce', 'shop', 'store', 'cart', 'checkout',
  'git', 'github', 'gitlab', 'bitbucket', 'dependabot', 'renovate',
  'snyk', 'whitesource', 'blackduck', 'sonatype', 'artifactory', 'nexus',
  'ansible', 'puppet', 'chef', 'terraform', 'kubernetes', 'docker',
  'jenkins', 'travis', 'circleci', 'actions', 'codeship', 'bamboo',
  'wordpress', 'drupal', 'joomla', 'typo3', 'contao', 'umbraco',
  'sitecore', 'adobe', 'experience', 'manager', 'craft', 'statamic',
  'grav', 'ghost', 'netlify', 'vercel', 'render', 'railway',
  'heroku', 'digital', 'ocean', 'linode', 'vultr', 'hetzner',
  'cloudways', 'kinsta', 'wpengine', 'flywheel', 'pantheon', 'acquia',
  'platform.sh', 'cloudflare', 'pages', 'github-pages', 'gitlab-pages'
];

interface BotDetectionResult {
  isBot: boolean;
  reason?: string;
  confidence: 'high' | 'medium' | 'low';
}

class BotDetector {
  private userAgent: string;

  constructor() {
    this.userAgent = navigator.userAgent.toLowerCase();
  }

  detectBot(): BotDetectionResult {
    const checks = [
      this.checkUserAgent(),
      this.checkWebDriver(),
      this.checkHeadless(),
      this.checkAutomation(),
      this.checkBrowserFeatures(),
      this.checkPlugins(),
      this.checkLanguages(),
      this.checkScreenSize(),
      this.checkTouchSupport(),
      this.checkBehavioralPatterns()
    ];

    const botChecks = checks.filter(check => check.isBot);

    if (botChecks.length === 0) {
      return { isBot: false, confidence: 'high' };
    }

    const highConfidence = botChecks.filter(c => c.confidence === 'high');
    if (highConfidence.length > 0) {
      return highConfidence[0];
    }

    if (botChecks.length >= 3) {
      return {
        isBot: true,
        reason: 'Multiple bot indicators detected',
        confidence: 'high'
      };
    }

    if (botChecks.length >= 2) {
      return {
        isBot: true,
        reason: botChecks.map(c => c.reason).join(', '),
        confidence: 'medium'
      };
    }

    return botChecks[0];
  }

  private checkUserAgent(): BotDetectionResult {
    for (const botPattern of KNOWN_BOTS) {
      if (this.userAgent.includes(botPattern)) {
        return {
          isBot: true,
          reason: `Known bot pattern: ${botPattern}`,
          confidence: 'high'
        };
      }
    }

    if (!this.userAgent || this.userAgent.length < 20) {
      return {
        isBot: true,
        reason: 'Suspicious user agent (too short)',
        confidence: 'medium'
      };
    }

    const suspiciousPatterns = [
      /^mozilla\/\d\.\d$/i,
      /^mozilla\/[45]\.0 \(compatible; \)$/i,
      /^python/i,
      /^ruby/i,
      /^java\//i,
      /^go-http-client/i,
      /^http/i
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(this.userAgent)) {
        return {
          isBot: true,
          reason: 'Suspicious user agent pattern',
          confidence: 'high'
        };
      }
    }

    return { isBot: false, confidence: 'high' };
  }

  private checkWebDriver(): BotDetectionResult {
    if ((navigator as any).webdriver) {
      return {
        isBot: true,
        reason: 'WebDriver detected',
        confidence: 'high'
      };
    }
    return { isBot: false, confidence: 'high' };
  }

  private checkHeadless(): BotDetectionResult {
    if (
      /headless/i.test(this.userAgent) ||
      (navigator as any).userAgentData?.platform === 'Linux' && !('ontouchstart' in window)
    ) {
      return {
        isBot: true,
        reason: 'Headless browser detected',
        confidence: 'high'
      };
    }

    if (window.outerWidth === 0 && window.outerHeight === 0) {
      return {
        isBot: true,
        reason: 'Headless browser (zero outer dimensions)',
        confidence: 'high'
      };
    }

    return { isBot: false, confidence: 'high' };
  }

  private checkAutomation(): BotDetectionResult {
    const automationIndicators = [
      '_phantom',
      '__nightmare',
      'callPhantom',
      '_Selenium_IDE_Recorder',
      'callSelenium',
      '__selenium_unwrapped',
      '__webdriver_evaluate',
      '__driver_evaluate',
      '__webdriver_script_function',
      '__webdriver_script_func',
      '__webdriver_script_fn',
      '__fxdriver_evaluate',
      '__driver_unwrapped',
      '__webdriver_unwrapped',
      '__fxdriver_unwrapped',
      '__selenium_evaluate',
      'domAutomation',
      'domAutomationController'
    ];

    for (const indicator of automationIndicators) {
      if ((window as any)[indicator] || (document as any)[indicator]) {
        return {
          isBot: true,
          reason: `Automation tool detected: ${indicator}`,
          confidence: 'high'
        };
      }
    }

    return { isBot: false, confidence: 'high' };
  }

  private checkBrowserFeatures(): BotDetectionResult {
    const missingFeatures = [];
    const nav = navigator as any;

    if (typeof navigator.plugins === 'undefined') missingFeatures.push('plugins');
    if (typeof navigator.mimeTypes === 'undefined') missingFeatures.push('mimeTypes');
    if (typeof navigator.languages === 'undefined') missingFeatures.push('languages');
    if (typeof nav.deviceMemory === 'undefined' &&
        typeof navigator.hardwareConcurrency === 'undefined') {
      missingFeatures.push('hardware info');
    }

    if (missingFeatures.length >= 2) {
      return {
        isBot: true,
        reason: `Missing browser features: ${missingFeatures.join(', ')}`,
        confidence: 'medium'
      };
    }

    return { isBot: false, confidence: 'high' };
  }

  private checkPlugins(): BotDetectionResult {
    if (navigator.plugins && navigator.plugins.length === 0) {
      return {
        isBot: true,
        reason: 'No browser plugins detected',
        confidence: 'low'
      };
    }
    return { isBot: false, confidence: 'high' };
  }

  private checkLanguages(): BotDetectionResult {
    if (!navigator.language && !navigator.languages) {
      return {
        isBot: true,
        reason: 'No language settings',
        confidence: 'medium'
      };
    }

    if (navigator.languages && navigator.languages.length === 0) {
      return {
        isBot: true,
        reason: 'Empty languages array',
        confidence: 'medium'
      };
    }

    return { isBot: false, confidence: 'high' };
  }

  private checkScreenSize(): BotDetectionResult {
    if (screen.width === 0 || screen.height === 0) {
      return {
        isBot: true,
        reason: 'Invalid screen dimensions',
        confidence: 'high'
      };
    }

    const commonBotResolutions = [
      '800x600', '1024x768', '1280x1024', '1920x1080'
    ];

    const currentRes = `${screen.width}x${screen.height}`;
    if (commonBotResolutions.includes(currentRes) &&
        window.innerWidth === screen.width &&
        window.innerHeight === screen.height) {
      return {
        isBot: true,
        reason: 'Bot-like screen configuration',
        confidence: 'low'
      };
    }

    return { isBot: false, confidence: 'high' };
  }

  private checkTouchSupport(): BotDetectionResult {
    const isMobile = /mobile|tablet|android|iphone|ipad|ipod/i.test(this.userAgent);
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    if (isMobile && !hasTouch) {
      return {
        isBot: true,
        reason: 'Mobile user agent without touch support',
        confidence: 'medium'
      };
    }

    return { isBot: false, confidence: 'high' };
  }

  private checkBehavioralPatterns(): BotDetectionResult {
    const mouseEvents = (window as any).__mouseEvents || 0;
    const scrollEvents = (window as any).__scrollEvents || 0;
    const sessionAge = Date.now() - (sessionStorage.getItem('session_start') ?
      parseInt(sessionStorage.getItem('session_start')!) : Date.now());

    if (sessionAge > 5000 && mouseEvents === 0 && scrollEvents === 0) {
      return {
        isBot: true,
        reason: 'No user interaction detected after 5 seconds',
        confidence: 'low'
      };
    }

    return { isBot: false, confidence: 'high' };
  }
}

let mouseEventCount = 0;
let scrollEventCount = 0;

if (typeof window !== 'undefined') {
  sessionStorage.setItem('session_start', Date.now().toString());

  document.addEventListener('mousemove', () => {
    mouseEventCount++;
    (window as any).__mouseEvents = mouseEventCount;
  });

  window.addEventListener('scroll', () => {
    scrollEventCount++;
    (window as any).__scrollEvents = scrollEventCount;
  });
}

export function isBot(): BotDetectionResult {
  const detector = new BotDetector();
  return detector.detectBot();
}

export function shouldTrackAnalytics(): boolean {
  const result = isBot();

  if (result.isBot && result.confidence === 'high') {
    console.log(`[Analytics] Bot detected: ${result.reason} - Skipping tracking`);
    return false;
  }

  return true;
}
