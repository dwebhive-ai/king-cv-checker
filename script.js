/**
 * ============================================================
 * KING CV CHECKER — Frontend JavaScript
 * Handles: file upload, validation, async analysis, result rendering
 * ============================================================
 */

/* ------------------------------------------------------------
   STATE
   ------------------------------------------------------------ */
const state = {
  file: null,
  analysisData: null,
  isAnalyzing: false,
};

/* ------------------------------------------------------------
   DOM REFERENCES
   ------------------------------------------------------------ */
const dom = {
  form:          () => document.getElementById('cvForm'),
  dropZone:      () => document.getElementById('dropZone'),
  dropContent:   () => document.getElementById('dropContent'),
  fileInput:     () => document.getElementById('cvFile'),
  browseBtn:     () => document.getElementById('browseBtn'),
  filePreview:   () => document.getElementById('filePreview'),
  fileName:      () => document.getElementById('fileName'),
  fileSize:      () => document.getElementById('fileSize'),
  removeFile:    () => document.getElementById('removeFile'),
  fileError:     () => document.getElementById('fileError'),
  jobDesc:       () => document.getElementById('jobDescription'),
  jdError:       () => document.getElementById('jdError'),
  charCount:     () => document.getElementById('charCount'),
  analyzeBtn:    () => document.getElementById('analyzeBtn'),
  loadingOverlay:() => document.getElementById('loadingOverlay'),
  loadingMsg:    () => document.getElementById('loadingMsg'),
  loadingBar:    () => document.getElementById('loadingBar'),
  formCard:      () => document.getElementById('formCard'),
  resultsSection:() => document.getElementById('resultsSection'),
  uploadSection: () => document.querySelector('.upload-section'),
  reAnalyzeBtn:  () => document.getElementById('reAnalyzeBtn'),
  reAnalyzeBtn2: () => document.getElementById('reAnalyzeBtn2'),
  step1:         () => document.getElementById('step1'),
  step2:         () => document.getElementById('step2'),
  step3:         () => document.getElementById('step3'),
};

/* ------------------------------------------------------------
   INIT — Wire up all event listeners
   ------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', () => {
  initFileUpload();
  initJobDescriptionInput();
  initFormSubmission();
  initReanalyzeButtons();
  initScrollProgress();
});

/* ------------------------------------------------------------
   FILE UPLOAD LOGIC
   ------------------------------------------------------------ */
function initFileUpload() {
  const dropZone  = dom.dropZone();
  const fileInput = dom.fileInput();
  const browseBtn = dom.browseBtn();
  const removeBtn = dom.removeFile();

  // Click to browse
  browseBtn.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('click', (e) => {
    if (!e.target.closest('.file-preview') && !e.target.closest('.remove-file')) {
      fileInput.click();
    }
  });

  // File selected via input
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleFileSelect(fileInput.files[0]);
    }
  });

  // Drag & Drop events
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', (e) => {
    if (!dropZone.contains(e.relatedTarget)) {
      dropZone.classList.remove('dragover');
    }
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  });

  // Remove file
  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearFile();
  });
}

/**
 * Validate and display a selected file
 */
function handleFileSelect(file) {
  const allowedExts = ['pdf', 'docx', 'txt'];
  const ext = file.name.split('.').pop().toLowerCase();
  const maxSize = 5 * 1024 * 1024; // 5 MB

  clearFileError();

  // Validate extension
  if (!allowedExts.includes(ext)) {
    showFileError('Invalid file type. Please upload a PDF, DOCX, or TXT file.');
    return;
  }

  // Validate size
  if (file.size > maxSize) {
    showFileError('File is too large. Maximum size is 5 MB.');
    return;
  }

  // Store and display
  state.file = file;
  dom.fileName().textContent = file.name;
  dom.fileSize().textContent = formatFileSize(file.size);
  dom.dropContent().style.display = 'none';
  dom.filePreview().style.display = 'flex';

  // Mark step 1 done
  dom.step1().classList.add('active');
  dom.step2().classList.add('active');
}

function clearFile() {
  state.file = null;
  dom.fileInput().value = '';
  dom.filePreview().style.display = 'none';
  dom.dropContent().style.display = 'block';
  dom.step2().classList.remove('active');
  clearFileError();
}

function showFileError(msg) { dom.fileError().textContent = msg; }
function clearFileError()   { dom.fileError().textContent = ''; }

function formatFileSize(bytes) {
  if (bytes < 1024)        return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/* ------------------------------------------------------------
   JOB DESCRIPTION VALIDATION
   ------------------------------------------------------------ */
function initJobDescriptionInput() {
  const textarea = dom.jobDesc();
  const counter  = dom.charCount();

  textarea.addEventListener('input', () => {
    const count = textarea.value.length;
    counter.textContent = count.toLocaleString();
    clearJDError();

    // Activate step 3 indicator if enough content
    if (count >= 100) {
      dom.step3().classList.add('active');
    } else {
      dom.step3().classList.remove('active');
    }
  });
}

function showJDError(msg) { dom.jdError().textContent = msg; }
function clearJDError()   { dom.jdError().textContent = ''; }

/* ------------------------------------------------------------
   FORM SUBMISSION
   ------------------------------------------------------------ */
function initFormSubmission() {
  dom.form().addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.isAnalyzing) return;

    // Validate
    let valid = true;

    if (!state.file) {
      showFileError('Please upload your CV first.');
      valid = false;
    }

    const jd = dom.jobDesc().value.trim();
    if (jd.length < 50) {
      showJDError('Please paste a full job description (at least 50 characters).');
      valid = false;
    }

    if (!valid) return;

    // Build FormData
    const formData = new FormData();
    formData.append('cv_file', state.file);
    formData.append('job_description', jd);

    // Start analysis
    await runAnalysis(formData);
  });
}

/* ------------------------------------------------------------
   ASYNC ANALYSIS REQUEST (fully client-side — no server needed)
   ------------------------------------------------------------ */
async function runAnalysis(formData) {
  state.isAnalyzing = true;
  dom.analyzeBtn().disabled = true;

  showLoading();

  try {
    // Guard: ensure analysis engine loaded
    if (typeof analyzeCV !== 'function') {
      throw new Error('Analysis engine failed to load. Please hard-refresh the page (Ctrl+Shift+R) and try again.');
    }

    // Guard: check PDF library if needed
    const ext = state.file.name.split('.').pop().toLowerCase();
    if (ext === 'pdf' && !window.pdfjsLib) {
      throw new Error('PDF reader library failed to load. Please check your internet connection and refresh the page, or upload a DOCX/TXT file instead.');
    }
    if (ext === 'docx' && !window.mammoth) {
      throw new Error('DOCX reader library failed to load. Please check your internet connection and refresh the page, or upload a TXT file instead.');
    }

    // Step 1: Extract text from uploaded file in the browser
    const cvText = await extractTextFromFile(state.file);

    if (!cvText || cvText.trim().length < 80) {
      throw new Error(
        'Could not extract readable text from your CV. ' +
        'Try saving as TXT or DOCX for best results.'
      );
    }

    const jobDescription = formData.get('job_description');

    // Step 2: Run full analysis (analyze.js — pure JavaScript)
    const data = await analyzeCV(cvText, jobDescription);

    // Step 3: Render results
    state.analysisData = data;
    hideLoading();
    renderResults(data);

  } catch (err) {
    hideLoading();
    showGlobalError(err.message);
  } finally {
    state.isAnalyzing = false;
    dom.analyzeBtn().disabled = false;
  }
}

/* ------------------------------------------------------------
   LOADING ANIMATION
   ------------------------------------------------------------ */
const loadingMessages = [
  'Extracting content from your CV...',
  'Scanning for ATS keywords...',
  'Running deep skill analysis...',
  'Generating improvement suggestions...',
  'Crafting your professional summary...',
  'Finalizing your royal report...',
];

let loadingInterval = null;
let loadingStepIndex = 0;

function showLoading() {
  dom.loadingOverlay().style.display = 'flex';
  dom.uploadSection().style.display = 'none';
  loadingStepIndex = 0;
  dom.loadingBar().style.width = '0%';

  const steps = ['ls1', 'ls2', 'ls3', 'ls4'];
  steps.forEach(id => {
    const el = document.getElementById(id);
    el.classList.remove('active', 'done');
  });
  document.getElementById('ls1').classList.add('active');

  let progress = 0;
  let stepTimer = 0;

  loadingInterval = setInterval(() => {
    progress += 1.5;
    if (progress > 95) progress = 95;
    dom.loadingBar().style.width = progress + '%';
    dom.loadingBar().classList.add('loading-bar-active');

    // Cycle through loading messages
    stepTimer++;
    if (stepTimer % 18 === 0) {
      const msgIdx = Math.floor(stepTimer / 18) % loadingMessages.length;
      dom.loadingMsg().textContent = loadingMessages[msgIdx];

      // Update step indicators
      const stepIdx = Math.min(Math.floor(stepTimer / 18), 3);
      steps.forEach((id, i) => {
        const el = document.getElementById(id);
        el.classList.remove('active', 'done');
        if (i < stepIdx)     el.classList.add('done');
        if (i === stepIdx)   el.classList.add('active');
      });
    }
  }, 50);
}

function hideLoading() {
  clearInterval(loadingInterval);
  dom.loadingBar().style.width = '100%';
  setTimeout(() => {
    dom.loadingOverlay().style.display = 'none';
  }, 400);
}

/* ------------------------------------------------------------
   RE-ANALYZE BUTTONS
   ------------------------------------------------------------ */
function initReanalyzeButtons() {
  [dom.reAnalyzeBtn(), dom.reAnalyzeBtn2()].forEach(btn => {
    if (!btn) return;
    btn.addEventListener('click', resetToForm);
  });
}

/* ------------------------------------------------------------
   SCROLL PROGRESS BAR
   ------------------------------------------------------------ */
function initScrollProgress() {
  const bar = document.getElementById('scrollProgress');
  if (!bar) return;
  window.addEventListener('scroll', () => {
    const scrollTop  = document.documentElement.scrollTop;
    const scrollMax  = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width  = (scrollMax > 0 ? (scrollTop / scrollMax) * 100 : 0) + '%';
  }, { passive: true });
}

/* ------------------------------------------------------------
   FLOATING SCORE BADGE
   ------------------------------------------------------------ */
function showFloatingBadge(score) {
  const badge = document.getElementById('floatingBadge');
  const num   = document.getElementById('fbScore');
  if (!badge || !num) return;
  num.textContent   = score;
  badge.style.display = 'block';
  // Clicking the badge scrolls back to the ATS score card
  badge.addEventListener('click', () => {
    document.getElementById('atsCard')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

/* ------------------------------------------------------------
   CONFETTI (fires when ATS score >= 70)
   ------------------------------------------------------------ */
function launchConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  if (!canvas) return;
  canvas.style.display = 'block';
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx     = canvas.getContext('2d');

  const colors  = ['#ffd700','#d4af37','#fff8dc','#f0e68c','#ffffff','#b8860b'];
  const pieces  = Array.from({ length: 120 }, () => ({
    x:    Math.random() * canvas.width,
    y:    Math.random() * -canvas.height,
    w:    Math.random() * 10 + 4,
    h:    Math.random() * 6  + 3,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot:  Math.random() * Math.PI * 2,
    vx:   (Math.random() - 0.5) * 3,
    vy:   Math.random() * 4 + 2,
    vr:   (Math.random() - 0.5) * 0.15,
  }));

  let frame;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      p.x  += p.vx;
      p.y  += p.vy;
      p.rot += p.vr;
      p.vy += 0.05; // gravity
      if (p.y > canvas.height) { p.y = -20; p.x = Math.random() * canvas.width; }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    frame = requestAnimationFrame(draw);
  }
  draw();
  setTimeout(() => { cancelAnimationFrame(frame); canvas.style.display = 'none'; }, 4000);
}

/* ------------------------------------------------------------
   DOWNLOAD REPORT
   ------------------------------------------------------------ */
function downloadReport(data) {
  const ats   = data.ats_score;
  const match = data.job_match;
  const lines = [
    '╔══════════════════════════════════════════════════════════╗',
    '║              👑 KING CV CHECKER — ANALYSIS REPORT       ║',
    '║              Built by Digital Web Hive                  ║',
    '╚══════════════════════════════════════════════════════════╝',
    '',
    `Generated: ${new Date().toLocaleString()}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '👑 ATS SCORE',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `Score: ${ats.score}%  (${ats.matched} of ${ats.total} keywords matched)`,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '🎯 JOB MATCH SCORE',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `Overall:             ${match.overall}/100`,
    `Skills Match:        ${match.skills}/100`,
    `Experience Match:    ${match.experience}/100`,
    `Education Fit:       ${match.education}/100`,
    `Industry Relevance:  ${match.industry}/100`,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '✅ KEY STRENGTHS',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    ...(data.strengths || []).map(s => `• ${s}`),
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '⚠️ KEY GAPS',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    ...(data.gaps || []).map(g => `• ${g}`),
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '🔑 MISSING KEYWORDS',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    (data.keywords?.missing || []).join(', ') || 'None',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '🚨 RED FLAGS',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    ...(data.red_flags || []).map(f => `[${f.severity}] ${f.description}`),
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '🧠 PROFESSIONAL SUMMARY',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    data.professional_summary || '',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '🎤 INTERVIEW INSIGHTS',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `Shortlisting Probability: ${data.interview_insights?.shortlist_probability}% — ${data.interview_insights?.probability_label}`,
    '',
    'Predicted Interview Questions:',
    ...(data.interview_insights?.questions || []).map((q, i) => `Q${i+1}. ${q}`),
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '👑 King CV Checker  |  Built by Digital Web Hive',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `king-cv-report-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------
   COPY FULL REPORT
   ------------------------------------------------------------ */
function copyFullReport(data) {
  const summary = [
    `👑 CV Analysis Report — King CV Checker`,
    `ATS Score: ${data.ats_score?.score}% | Job Match: ${data.job_match?.overall}/100`,
    ``,
    `✅ Strengths: ${(data.strengths || []).join(' | ')}`,
    `⚠️ Gaps: ${(data.gaps || []).join(' | ')}`,
    `🔑 Missing Keywords: ${(data.keywords?.missing || []).slice(0,10).join(', ')}`,
    ``,
    `🧠 Professional Summary:`,
    data.professional_summary || '',
    ``,
    `Built by Digital Web Hive — King CV Checker`,
  ].join('\n');

  navigator.clipboard.writeText(summary).then(() => {
    const btn = document.getElementById('copyReportBtn');
    if (btn) {
      btn.innerHTML = '<span>✅</span> Copied!';
      setTimeout(() => { btn.innerHTML = '<span>📋</span> Copy Full Report'; }, 2500);
    }
  });
}

function resetToForm() {
  dom.resultsSection().style.display = 'none';
  dom.uploadSection().style.display = 'block';
  const badge = document.getElementById('floatingBadge');
  if (badge) badge.style.display = 'none';
  clearFile();
  dom.jobDesc().value = '';
  dom.charCount().textContent = '0';
  dom.step1().classList.remove('active');
  dom.step2().classList.remove('active');
  dom.step3().classList.remove('active');
  dom.step1().classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ------------------------------------------------------------
   GLOBAL ERROR DISPLAY
   ------------------------------------------------------------ */
function showGlobalError(message) {
  // Restore upload form
  dom.uploadSection().style.display = 'block';

  // Show prominent bottom banner
  const banner    = document.getElementById('errorBanner');
  const bannerMsg = document.getElementById('errorBannerMsg');
  const closeBtn  = document.getElementById('errorBannerClose');

  if (banner && bannerMsg) {
    bannerMsg.textContent = message;
    banner.style.display  = 'block';
    closeBtn.onclick = () => { banner.style.display = 'none'; };
    // Auto-dismiss after 10 seconds
    setTimeout(() => { banner.style.display = 'none'; }, 10000);
  }

  // Also show inline under file upload for context
  showFileError(message);
  console.error('[King CV Checker]', message);
}

/* ------------------------------------------------------------
   RESULTS RENDERER
   Orchestrates rendering of all 11 analysis sections
   ------------------------------------------------------------ */
function renderResults(data) {
  // Show results section
  dom.resultsSection().style.display = 'block';

  // Scroll to results
  setTimeout(() => {
    dom.resultsSection().scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);

  // Render all sections
  renderScores(data);
  renderStrengths(data.strengths);
  renderGaps(data.gaps);
  renderKeywords(data.keywords);
  renderBulletPoints(data.bullet_points);
  renderSkillsGap(data.skills_gap);
  renderCVFeedback(data.cv_feedback);
  renderRedFlags(data.red_flags);
  renderProfessionalSummary(data.professional_summary);
  renderInterviewInsights(data.interview_insights);

  // Render new premium sections
  renderCrownBadge(data.ats_score?.score ?? 0);
  renderATSBoostTips(data.ats_boost_tips);
  renderPowerScore(data.power_score);
  renderCareerLevel(data.career_level, data.salary_insights);
  renderLinkedInHeadline(data.linkedin_headline);
  renderTailoringChecklist(data.tailoring_checklist);

  // Render new ultra-premium sections
  renderScoreProvisions(data.score_provisions, data.ats_score?.score ?? 0);

  // Wire up quick action buttons
  document.getElementById('downloadReportBtn')?.addEventListener('click', () => generatePDFReport(data));
  document.getElementById('copyReportBtn')?.addEventListener('click', () => copyFullReport(data));

  // Floating badge
  showFloatingBadge(data.ats_score?.score ?? 0);

  // Confetti for high scorers
  if ((data.ats_score?.score ?? 0) >= 70) {
    setTimeout(launchConfetti, 800);
  }
}

/* ------------------------------------------------------------
   SCORE RENDERING — Rings + Sub-scores
   ------------------------------------------------------------ */
function renderScores(data) {
  const ats   = data.ats_score;
  const match = data.job_match;

  // ATS Score ring animation
  animateScoreRing('atsRingFill', ats.score, '#d4af37');
  animateCounter('atsScoreNum', ats.score);
  setVerdict('atsVerdict', ats.score, [
    [80, 'Excellent', '#22c55e', '#052e16'],
    [60, 'Good',      '#d4af37', '#1c1400'],
    [40, 'Fair',      '#f97316', '#1c0e00'],
    [0,  'Poor',      '#ef4444', '#1c0000'],
  ]);

  // Job Match ring animation
  animateScoreRing('matchRingFill', match.overall, '#3b82f6');
  animateCounter('matchScoreNum', match.overall);
  setVerdict('matchVerdict', match.overall, [
    [80, 'Strong Match',  '#22c55e', '#052e16'],
    [60, 'Good Match',    '#d4af37', '#1c1400'],
    [40, 'Partial Match', '#f97316', '#1c0e00'],
    [0,  'Weak Match',    '#ef4444', '#1c0000'],
  ]);

  // Sub-scores
  const subScoresEl = document.getElementById('subScores');
  const subItems = [
    { label: 'Skills Match',        value: match.skills,    color: 'pb-gold'   },
    { label: 'Experience Match',     value: match.experience, color: 'pb-blue'   },
    { label: 'Education Fit',        value: match.education, color: 'pb-green'  },
    { label: 'Industry Relevance',   value: match.industry,  color: 'pb-orange' },
  ];

  subScoresEl.innerHTML = subItems.map(item => `
    <div class="sub-score-item">
      <div class="sub-score-header">
        <span class="sub-score-label">${item.label}</span>
        <span class="sub-score-value">${item.value}/100</span>
      </div>
      <div class="progress-bar-wrap">
        <div class="progress-bar ${item.color}" data-target="${item.value}"></div>
      </div>
    </div>
  `).join('');

  // Animate progress bars
  setTimeout(() => {
    subScoresEl.querySelectorAll('.progress-bar').forEach(bar => {
      bar.style.width = bar.dataset.target + '%';
    });
  }, 300);
}

function animateScoreRing(ringId, score, color) {
  const ring = document.getElementById(ringId);
  if (!ring) return;
  const circumference = 314; // 2 * π * 50
  const offset = circumference - (score / 100) * circumference;
  ring.style.stroke = color;
  setTimeout(() => {
    ring.style.strokeDashoffset = offset;
  }, 300);
}

function animateCounter(elId, targetValue) {
  const el = document.getElementById(elId);
  if (!el) return;
  let current = 0;
  const duration = 1200;
  const stepTime = 16;
  const steps = duration / stepTime;
  const increment = targetValue / steps;

  const timer = setInterval(() => {
    current = Math.min(current + increment, targetValue);
    el.textContent = Math.round(current);
    if (current >= targetValue) clearInterval(timer);
  }, stepTime);
}

function setVerdict(elId, score, thresholds) {
  const el = document.getElementById(elId);
  if (!el) return;
  const match = thresholds.find(t => score >= t[0]);
  if (match) {
    el.textContent = match[1];
    el.style.background = match[3];
    el.style.color = match[2];
    el.style.border = `1px solid ${match[2]}40`;
  }
}

/* ------------------------------------------------------------
   STRENGTHS
   ------------------------------------------------------------ */
function renderStrengths(strengths) {
  const el = document.getElementById('strengthsContent');
  if (!strengths || !strengths.length) {
    el.innerHTML = '<p>No specific strengths identified. Enrich your CV with measurable achievements.</p>';
    return;
  }

  el.innerHTML = strengths.map(s => `
    <div class="strength-item">
      <div class="item-dot dot-green"></div>
      <span>${escHtml(s)}</span>
    </div>
  `).join('');
}

/* ------------------------------------------------------------
   GAPS
   ------------------------------------------------------------ */
function renderGaps(gaps) {
  const el = document.getElementById('gapsContent');
  if (!gaps || !gaps.length) {
    el.innerHTML = '<p style="color:var(--green)">No major gaps found! Your CV aligns well with the role.</p>';
    return;
  }

  el.innerHTML = gaps.map(g => `
    <div class="gap-item">
      <div class="item-dot dot-red"></div>
      <span>${escHtml(g)}</span>
    </div>
  `).join('');
}

/* ------------------------------------------------------------
   KEYWORD ANALYSIS
   ------------------------------------------------------------ */
function renderKeywords(keywords) {
  const el = document.getElementById('keywordsContent');

  const missing   = keywords.missing   || [];
  const present   = keywords.present   || [];
  const suggested = keywords.suggested || [];

  el.innerHTML = `
    <div class="keyword-section">
      <div class="keyword-section-title missing">
        ✗ Missing Keywords (${missing.length}) — Add these to your CV
      </div>
      <div class="keyword-tags">
        ${missing.length
          ? missing.map(k => `<span class="kw-tag missing">${escHtml(k)}</span>`).join('')
          : '<span style="color:var(--green);font-size:0.85rem">All key terms found!</span>'
        }
      </div>
    </div>

    <div class="keyword-section">
      <div class="keyword-section-title present">
        ✓ Present Keywords (${present.length}) — Already in your CV
      </div>
      <div class="keyword-tags">
        ${present.map(k => `<span class="kw-tag present">${escHtml(k)}</span>`).join('')}
      </div>
    </div>

    <div class="keyword-section">
      <div class="keyword-section-title suggested">
        ★ Suggested Additions — Boost your ATS score
      </div>
      <div class="keyword-tags">
        ${suggested.map(k => `<span class="kw-tag suggested">${escHtml(k)}</span>`).join('')}
      </div>
    </div>
  `;
}

/* ------------------------------------------------------------
   BULLET POINT IMPROVEMENTS
   ------------------------------------------------------------ */
function renderBulletPoints(bullets) {
  const el = document.getElementById('bulletsContent');

  if (!bullets || !bullets.length) {
    el.innerHTML = '<p>No weak bullet points detected, or CV text could not be parsed. Try a TXT or DOCX file for better parsing.</p>';
    return;
  }

  el.innerHTML = bullets.map(b => `
    <div class="bullet-item">
      <div class="bullet-before">
        <span class="bullet-label label-before">Before</span>
        <span class="bullet-text">${escHtml(b.original)}</span>
      </div>
      <div class="bullet-divider"></div>
      <div class="bullet-after">
        <span class="bullet-label label-after">After</span>
        <span class="bullet-text">${escHtml(b.improved)}</span>
      </div>
    </div>
  `).join('');
}

/* ------------------------------------------------------------
   SKILLS IMPROVEMENT PLAN
   ------------------------------------------------------------ */
function renderSkillsGap(skills) {
  const el = document.getElementById('skillsContent');

  if (!skills || !skills.length) {
    el.innerHTML = '<p style="color:var(--green)">Your skills profile matches the job requirements well!</p>';
    return;
  }

  el.innerHTML = skills.map(s => `
    <div class="skill-plan-item">
      <div class="skill-plan-header">
        <span class="skill-priority priority-${s.priority.toLowerCase()}">${escHtml(s.priority)}</span>
        <span class="skill-plan-name">${escHtml(s.skill)}</span>
      </div>
      <p class="skill-plan-desc">${escHtml(s.description)}</p>
      <p class="skill-plan-resource">📚 ${escHtml(s.resource)}</p>
    </div>
  `).join('');
}

/* ------------------------------------------------------------
   CV FEEDBACK
   ------------------------------------------------------------ */
function renderCVFeedback(feedback) {
  const el = document.getElementById('feedbackContent');

  if (!feedback || !feedback.length) {
    el.innerHTML = '<p>No specific feedback available.</p>';
    return;
  }

  el.innerHTML = feedback.map(f => `
    <div class="feedback-item">
      <span class="feedback-icon">${f.positive ? '✅' : '⚡'}</span>
      <span class="feedback-text">${escHtml(f.text)}</span>
    </div>
  `).join('');
}

/* ------------------------------------------------------------
   RED FLAGS
   ------------------------------------------------------------ */
function renderRedFlags(flags) {
  const el = document.getElementById('redFlagsContent');

  if (!flags || !flags.length) {
    el.innerHTML = '<div class="no-flags">🎉 No red flags detected! Your CV looks clean.</div>';
    return;
  }

  el.innerHTML = flags.map(f => `
    <div class="red-flag-item">
      <span class="flag-severity severity-${f.severity.toLowerCase()}">${escHtml(f.severity)}</span>
      <span class="flag-desc">${escHtml(f.description)}</span>
    </div>
  `).join('');
}

/* ------------------------------------------------------------
   PROFESSIONAL SUMMARY
   ------------------------------------------------------------ */
function renderProfessionalSummary(summary) {
  const el = document.getElementById('summaryContent');

  if (!summary) {
    el.innerHTML = '<p>Could not generate summary. Ensure your CV has enough content.</p>';
    return;
  }

  el.innerHTML = `
    <div class="summary-box" id="summaryText">
      ${escHtml(summary)}
    </div>
    <button class="summary-copy-btn" id="copySummaryBtn">
      📋 Copy to Clipboard
    </button>
  `;

  document.getElementById('copySummaryBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(summary).then(() => {
      const btn = document.getElementById('copySummaryBtn');
      btn.textContent = '✅ Copied!';
      setTimeout(() => { btn.textContent = '📋 Copy to Clipboard'; }, 2000);
    });
  });
}

/* ------------------------------------------------------------
   INTERVIEW INSIGHTS
   ------------------------------------------------------------ */
function renderInterviewInsights(insights) {
  const el = document.getElementById('interviewContent');

  if (!insights) {
    el.innerHTML = '<p>Could not generate interview insights.</p>';
    return;
  }

  const { shortlist_probability, probability_label, questions } = insights;

  const shortlistColor = shortlist_probability >= 70
    ? 'var(--green)'
    : shortlist_probability >= 40
      ? 'var(--gold-main)'
      : 'var(--red)';

  el.innerHTML = `
    <div class="interview-grid">
      <div class="interview-predictions">
        <div class="interview-col-title">📊 Shortlisting Probability</div>
        <div class="shortlist-meter">
          <div class="shortlist-label">
            <span class="shortlist-text">${escHtml(probability_label)}</span>
            <span class="shortlist-pct" style="color:${shortlistColor}">${shortlist_probability}%</span>
          </div>
          <div class="progress-bar-wrap">
            <div class="progress-bar" style="background:${shortlistColor}; width:0%" data-target="${shortlist_probability}"></div>
          </div>
        </div>
        <p style="font-size:0.82rem;color:var(--text-muted);line-height:1.6">
          ${escHtml(insights.summary || '')}
        </p>
      </div>

      <div class="interview-questions-col">
        <div class="interview-col-title">🎤 Likely Interview Questions</div>
        <ul class="interview-questions">
          ${(questions || []).map((q, i) => `
            <li>
              <span class="q-num">Q${i + 1}.</span>
              <span>${escHtml(q)}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    </div>
  `;

  // Animate the shortlist bar
  setTimeout(() => {
    const bar = el.querySelector('.progress-bar[data-target]');
    if (bar) bar.style.width = bar.dataset.target + '%';
  }, 300);
}

/* ------------------------------------------------------------
   UTILITY: HTML Escape (prevent XSS)
   ------------------------------------------------------------ */
function escHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ============================================================
   PREMIUM RENDER FUNCTIONS
   ============================================================ */

/* ------------------------------------------------------------
   CROWN BADGE
   ------------------------------------------------------------ */
function renderCrownBadge(atsScore) {
  const row = document.getElementById('crownBadgeRow');
  if (!row) return;

  let cls, label, icon;
  if (atsScore >= 80)      { cls = 'badge-platinum'; label = 'Platinum Crown'; icon = '👑'; }
  else if (atsScore >= 60) { cls = 'badge-gold';     label = 'Gold Crown';     icon = '👑'; }
  else if (atsScore >= 40) { cls = 'badge-silver';   label = 'Silver Crown';   icon = '🥈'; }
  else                     { cls = 'badge-bronze';   label = 'Bronze Crown';   icon = '🥉'; }

  row.innerHTML = `
    <div class="crown-badge ${cls}">
      <span>${icon}</span>
      <span>${label}</span>
      <span style="font-weight:400;opacity:0.7">— ATS Score: ${atsScore}%</span>
    </div>`;
}

/* ------------------------------------------------------------
   ATS BOOST TIPS
   ------------------------------------------------------------ */
function renderATSBoostTips(tips) {
  const el = document.getElementById('atsTipsContent');
  if (!tips || !tips.length) {
    el.innerHTML = '<p style="color:var(--green)">Your CV is already well-optimised for ATS. Keep maintaining keyword alignment with each job application.</p>';
    return;
  }

  const priorityColor = { HIGH: 'priority-high', MEDIUM: 'priority-medium', LOW: 'priority-low' };

  el.innerHTML = tips.map(tip => `
    <div class="ats-tip-item">
      <span class="ats-tip-icon">${escHtml(tip.icon)}</span>
      <div class="ats-tip-body">
        <div class="ats-tip-title">
          <span class="skill-priority ${priorityColor[tip.priority] || 'priority-low'}">${escHtml(tip.priority)}</span>
          &nbsp;${escHtml(tip.title)}
        </div>
        <div class="ats-tip-detail">${escHtml(tip.detail)}</div>
      </div>
      <span class="ats-tip-impact">${escHtml(tip.impact)}</span>
    </div>
  `).join('');
}

/* ------------------------------------------------------------
   POWER SCORE
   ------------------------------------------------------------ */
function renderPowerScore(power) {
  const el = document.getElementById('powerContent');
  if (!power) { el.innerHTML = '<p>Could not calculate power score.</p>'; return; }

  const levelColors = { Elite: '#ffd700', Strong: '#22c55e', Average: '#f97316', Weak: '#ef4444' };
  const color = levelColors[power.level] || '#888';

  el.innerHTML = `
    <div class="power-score-display">
      <div class="power-score-num">${power.score}</div>
      <div class="power-level-badge" style="background:${color}22;color:${color};border:1px solid ${color}55">
        ${escHtml(power.level)} Power
      </div>
    </div>
    <div class="power-stats">
      <div class="power-stat">
        <span class="power-stat-num">${power.power_verbs_found.length}</span>
        <span class="power-stat-label">Power Verbs Found</span>
      </div>
      <div class="power-stat">
        <span class="power-stat-num">${power.metrics_count}</span>
        <span class="power-stat-label">Metrics Used</span>
      </div>
      <div class="power-stat" style="grid-column:1/-1">
        <span class="power-stat-num" style="color:var(--red)">${power.cliches_found.length}</span>
        <span class="power-stat-label">Clichés Detected</span>
      </div>
    </div>
    ${power.power_verbs_found.length ? `
      <div class="power-verb-row" style="margin-top:var(--space-md)">
        <div class="power-verb-row-title">✅ Power verbs found</div>
        <div class="keyword-tags">${power.power_verbs_found.map(v => `<span class="kw-tag present">${escHtml(v)}</span>`).join('')}</div>
      </div>` : ''}
    ${power.power_verbs_missing.length ? `
      <div class="power-verb-row" style="margin-top:var(--space-sm)">
        <div class="power-verb-row-title">💡 Add these power verbs</div>
        <div class="keyword-tags">${power.power_verbs_missing.map(v => `<span class="kw-tag suggested">${escHtml(v)}</span>`).join('')}</div>
      </div>` : ''}
    ${power.cliches_found.length ? `
      <div class="power-verb-row" style="margin-top:var(--space-sm)">
        <div class="power-verb-row-title">🚫 Remove these clichés</div>
        <div class="keyword-tags">${power.cliches_found.map(c => `<span class="kw-tag missing">${escHtml(c)}</span>`).join('')}</div>
      </div>` : ''}
  `;
}

/* ------------------------------------------------------------
   CAREER LEVEL + SALARY INSIGHTS
   ------------------------------------------------------------ */
function renderCareerLevel(level, salary) {
  const el = document.getElementById('careerContent');
  if (!level || !salary) { el.innerHTML = '<p>Could not detect career level.</p>'; return; }

  const levelIcons = { Executive: '🏛️', Director: '🎖️', Lead: '🌟', Senior: '💼', 'Mid-Level': '🚀', Junior: '🌱' };
  const icon = levelIcons[level] || '💼';

  const formatSalary = n => '$' + Math.round(n / 1000) + 'K';

  el.innerHTML = `
    <div class="career-level-display">
      <span class="career-level-icon">${icon}</span>
      <div>
        <div class="career-level-label">${escHtml(level)}</div>
        <div class="career-level-sub">Detected career level</div>
      </div>
    </div>
    <div class="salary-range">
      <div class="salary-figures">${formatSalary(salary.min_usd)} – ${formatSalary(salary.max_usd)}</div>
      <div class="salary-period">Estimated Annual Salary (USD)</div>
    </div>
    <div class="salary-tip">💡 ${escHtml(salary.negotiation_tip)}</div>
    <p style="font-size:0.72rem;color:var(--text-muted);margin-top:var(--space-sm)">${escHtml(salary.note)}</p>
  `;
}

/* ------------------------------------------------------------
   LINKEDIN HEADLINE
   ------------------------------------------------------------ */
function renderLinkedInHeadline(linkedin) {
  const el = document.getElementById('linkedinContent');
  if (!linkedin) { el.innerHTML = '<p>Could not generate headline.</p>'; return; }

  el.innerHTML = `
    <div class="linkedin-headline-box">
      <div class="linkedin-headline-label">🏆 Primary Headline (Recommended)</div>
      <div class="linkedin-headline-text" id="linkedinPrimary">${escHtml(linkedin.primary)}</div>
      <button class="linkedin-copy-btn" data-copy="primary">Copy Headline</button>
    </div>
    <div class="linkedin-headline-box" style="margin-bottom:var(--space-md)">
      <div class="linkedin-headline-label">✦ Alternative Option</div>
      <div class="linkedin-headline-text" id="linkedinAlt">${escHtml(linkedin.alternative)}</div>
      <button class="linkedin-copy-btn" data-copy="alt">Copy Headline</button>
    </div>
    <div class="linkedin-tip">💡 ${escHtml(linkedin.tip)}</div>
  `;

  el.querySelectorAll('.linkedin-copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.dataset.copy === 'primary' ? linkedin.primary : linkedin.alternative;
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = '✅ Copied!';
        setTimeout(() => { btn.textContent = 'Copy Headline'; }, 2000);
      });
    });
  });
}

/* ------------------------------------------------------------
   TAILORING CHECKLIST
   ------------------------------------------------------------ */
function renderTailoringChecklist(items) {
  const el = document.getElementById('checklistContent');
  if (!items || !items.length) { el.innerHTML = '<p>Checklist unavailable.</p>'; return; }

  const priorityClass = { HIGH: 'priority-high', MEDIUM: 'priority-medium', LOW: 'priority-low' };

  el.innerHTML = `<div class="checklist-grid">${
    items.map(item => `
      <div class="checklist-item">
        <span class="checklist-icon">${escHtml(item.icon)}</span>
        <div class="checklist-body">
          <div class="checklist-task">
            <span class="checklist-priority ${priorityClass[item.priority] || 'priority-low'}">${escHtml(item.priority)}</span>
            &nbsp;${escHtml(item.task)}
          </div>
          <div class="checklist-detail">${escHtml(item.detail)}</div>
        </div>
      </div>
    `).join('')
  }</div>`;
}

/* ------------------------------------------------------------
   SCORE PROVISIONS (shown when ATS < 70)
   ------------------------------------------------------------ */
function renderScoreProvisions(provisions, atsScore) {
  const card  = document.getElementById('cardProvisions');
  const intro = document.getElementById('provisionsIntro');
  const el    = document.getElementById('provisionsContent');

  if (!card || !el) return;

  // Only show when ATS < 70
  if (!provisions || !provisions.length || atsScore >= 70) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';
  const gap = 70 - atsScore;
  if (intro) {
    intro.textContent = `Your ATS score is ${atsScore}% — ${gap} points below the 70% recruiter threshold. Here are 10 targeted actions to close that gap fast. Work through these from top to bottom; each one adds measurable score points.`;
  }

  el.innerHTML = `<div class="provisions-list">${
    provisions.map(p => `
      <div class="provision-item">
        <div class="provision-num">${p.number}</div>
        <div class="provision-body">
          <div class="provision-effort">${escHtml(p.effort)}</div>
          <div class="provision-title">${escHtml(p.title)}</div>
          <div class="provision-action">${escHtml(p.action)}</div>
          <div class="provision-example">💡 ${escHtml(p.example)}</div>
        </div>
        <div class="provision-impact">${escHtml(p.impact)}</div>
      </div>
    `).join('')
  }</div>`;
}

/* ============================================================
   PDF REPORT GENERATOR (jsPDF) — v2: compact, emoji-free, professional
   ============================================================ */
async function generatePDFReport(data) {
  if (!window.jspdf) {
    showGlobalError('PDF library not loaded. Please refresh and try again.');
    return;
  }

  const btn = document.getElementById('downloadReportBtn');
  if (btn) { btn.innerHTML = '<span>⏳</span> Generating...'; btn.disabled = true; }

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const W = 210, H = 297, M = 16, CW = W - M * 2;
    let y = M, pageN = 1;

    // ── Palette ──
    const GOLD   = [180, 148, 40];
    const DKGOLD = [120, 96,  18];
    const DARK   = [30,  30,  45];
    const MID    = [70,  70,  90];
    const WHITE  = [255, 255, 255];
    const LGRAY  = [247, 247, 252];
    const BGRAY  = [228, 228, 238];
    const GREEN  = [22,  163, 74];
    const LTGRN  = [240, 253, 244];
    const RED    = [200, 40,  40];
    const LTRED  = [254, 242, 242];
    const BLUE   = [37,  99,  235];
    const LTBLU  = [239, 246, 255];
    const ORANGE = [217, 89,  0];
    const LTOR   = [255, 247, 237];

    // Strip non-ASCII (emojis, special chars) so Helvetica renders cleanly
    const clean = s => String(s || '').replace(/[^\x00-\x7E]/g, '').replace(/\s+/g, ' ').trim();

    const rgb  = (c, t = 'text') => t === 'fill' ? doc.setFillColor(...c) : t === 'draw' ? doc.setDrawColor(...c) : doc.setTextColor(...c);
    const font = (sz, st = 'normal') => { doc.setFontSize(sz); doc.setFont('helvetica', st); };
    const txt  = (s, x, xOpts) => doc.text(clean(s), x, y, xOpts);

    // ── Footer ──
    function footer() {
      rgb(GOLD, 'fill'); doc.rect(0, H - 8, W, 8, 'F');
      rgb(DARK); font(7);
      doc.text('King CV Checker  |  Built by Digital Web Hive', M, H - 2.5);
      doc.text(`Page ${pageN}`, W - M, H - 2.5, { align: 'right' });
    }

    // ── New page (white + thin gold left bar) ──
    function newPage() {
      doc.addPage(); pageN++; y = M;
      rgb(WHITE, 'fill'); doc.rect(0, 0, W, H, 'F');
      rgb(GOLD, 'fill');  doc.rect(0, 0, 4, H, 'F');
      footer();
    }

    // ── Space check — add page if needed ──
    function check(need) { if (y + need > H - 11) newPage(); }

    // ── Section heading (no emoji — colored accent bar) ──
    function sectionHead(title, color, light) {
      check(11); y += 3;
      rgb(light, 'fill'); doc.roundedRect(M, y - 3, CW, 9, 1.5, 1.5, 'F');
      rgb(color, 'fill'); doc.rect(M, y - 3, 3, 9, 'F');
      rgb(color); font(9, 'bold');
      doc.text(title.toUpperCase(), M + 7, y + 3.2);
      y += 10;
    }

    // ── Divider ──
    function divider() {
      check(5); y += 2;
      rgb(BGRAY, 'draw'); doc.setLineWidth(0.3); doc.line(M, y, W - M, y); y += 3;
    }

    // ── Bullet item ──
    function bullet(text, color) {
      check(7);
      const lines = doc.splitTextToSize(clean(text), CW - 8);
      rgb(color || MID); font(8.5);
      doc.text('-', M + 1, y);
      doc.text(lines, M + 6, y);
      y += lines.length * 4.6 + 1;
    }

    // ── Tag row ──
    function tagRow(arr, bg, fg) {
      if (!arr || !arr.length) return;
      const H6 = 5.5, pad = 2.5, gap = 1.8;
      let x = M;
      arr.slice(0, 24).forEach(tag => {
        const t = clean(tag);
        font(6.5, 'bold');
        const tw = doc.getTextWidth(t) + pad * 2;
        if (x + tw > W - M) { x = M; y += H6 + gap + 1; check(H6 + 4); }
        rgb(bg, 'fill'); doc.roundedRect(x, y - 4, tw, H6, 1.2, 1.2, 'F');
        rgb(fg); doc.text(t, x + pad, y);
        x += tw + gap;
      });
      y += H6 + 2;
    }

    // ══════════════════════════════════════════════════════════
    // PAGE 1 — COVER
    // ══════════════════════════════════════════════════════════
    rgb(DARK, 'fill'); doc.rect(0, 0, W, H, 'F');
    // Gold frame
    rgb(GOLD, 'fill');
    doc.rect(0, 0, W, 4, 'F'); doc.rect(0, H - 4, W, 4, 'F');
    doc.rect(0, 0, 4, H, 'F'); doc.rect(W - 4, 0, 4, H, 'F');
    // Thin inner frame
    rgb(DKGOLD, 'draw'); doc.setLineWidth(0.4);
    doc.rect(8, 8, W - 16, H - 16, 'S');

    rgb(GOLD); font(42, 'bold'); doc.text('KING', W / 2, 88, { align: 'center' });
    rgb(WHITE); font(24, 'bold'); doc.text('CV CHECKER', W / 2, 102, { align: 'center' });
    rgb(GOLD, 'draw'); doc.setLineWidth(0.5); doc.line(M + 30, 109, W - M - 30, 109);
    rgb([190, 170, 110]); font(10); doc.text('AI-Powered CV Analysis Report', W / 2, 117, { align: 'center' });

    // Score cards
    const atsS   = data.ats_score?.score ?? 0;
    const matchS = data.job_match?.overall ?? 0;
    [[atsS + '%', 'ATS SCORE', GOLD, W / 2 - 50],
     [matchS + ' / 100', 'JOB MATCH', BLUE, W / 2 + 10]].forEach(([val, lbl, col, bx]) => {
      rgb([18, 18, 32], 'fill'); doc.roundedRect(bx, 128, 42, 32, 3, 3, 'F');
      rgb(col, 'draw'); doc.setLineWidth(0.6); doc.roundedRect(bx, 128, 42, 32, 3, 3, 'S');
      rgb(col); font(18, 'bold'); doc.text(val, bx + 21, 143, { align: 'center' });
      rgb([160, 145, 90]); font(6.5); doc.text(lbl, bx + 21, 152, { align: 'center' });
    });

    if (data.career_level) {
      rgb([28, 28, 48], 'fill'); doc.roundedRect(M + 28, 167, CW - 56, 13, 3, 3, 'F');
      rgb([175, 155, 95]); font(9, 'bold');
      const salStr = data.salary_insights
        ? '  |  Est. $' + Math.round(data.salary_insights.min_usd / 1000) + 'K - $' + Math.round(data.salary_insights.max_usd / 1000) + 'K'
        : '';
      doc.text(data.career_level + ' Level' + salStr, W / 2, 176, { align: 'center' });
    }

    rgb([90, 75, 40]); font(8);
    doc.text('Generated: ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), W / 2, 190, { align: 'center' });
    rgb(GOLD); font(8); doc.text('Built by Digital Web Hive', W / 2, H - 14, { align: 'center' });

    // ══════════════════════════════════════════════════════════
    // PAGE 2 — SCORES + STRENGTHS + GAPS
    // ══════════════════════════════════════════════════════════
    newPage();
    rgb(DARK); font(14, 'bold'); doc.text('Score Breakdown', M, y); y += 2;
    rgb(GOLD, 'draw'); doc.setLineWidth(0.7); doc.line(M, y, M + 50, y); y += 7;

    [['Skills Match',       data.job_match?.skills,     GREEN],
     ['Experience Match',   data.job_match?.experience,  BLUE],
     ['Education Fit',      data.job_match?.education,   ORANGE],
     ['Industry Relevance', data.job_match?.industry,    GOLD]].forEach(([lbl, val, col]) => {
      val = val || 0;
      check(8);
      rgb(MID); font(8.5); doc.text(lbl, M, y);
      rgb(BGRAY, 'fill'); doc.roundedRect(M + 50, y - 5, 96, 6, 1.5, 1.5, 'F');
      rgb(col, 'fill'); doc.roundedRect(M + 50, y - 5, 96 * val / 100, 6, 1.5, 1.5, 'F');
      rgb(col); font(8.5, 'bold'); doc.text(val + '/100', W - M, y, { align: 'right' });
      y += 9;
    });

    y += 2; divider();
    sectionHead('Key Strengths', GREEN, LTGRN);
    (data.strengths || []).forEach(s => bullet(s, [20, 110, 50]));

    y += 2; divider();
    sectionHead('Key Gaps', RED, LTRED);
    if (!data.gaps?.length) { rgb(GREEN); font(8.5); txt('No major gaps detected — well aligned with the role.'); y += 7; }
    else (data.gaps || []).forEach(g => bullet(g, RED));

    // ══════════════════════════════════════════════════════════
    // PAGE 3 — KEYWORD ANALYSIS
    // ══════════════════════════════════════════════════════════
    newPage();
    rgb(DARK); font(14, 'bold'); doc.text('Keyword Analysis', M, y); y += 2;
    rgb(GOLD, 'draw'); doc.line(M, y, M + 50, y); y += 7;

    sectionHead('Missing Keywords — Add These to Your CV', RED, LTRED);
    if (!data.keywords?.missing?.length) { rgb(GREEN); font(8.5); txt('All key terms already present!'); y += 7; }
    else tagRow(data.keywords.missing.slice(0, 24), [255, 228, 228], RED);

    y += 2; divider();
    sectionHead('Present Keywords — Already in Your CV', GREEN, LTGRN);
    tagRow(data.keywords?.present?.slice(0, 24), LTGRN, [15, 100, 40]);

    y += 2; divider();
    sectionHead('Suggested Additions — Boost Your Score', GOLD, [255, 252, 230]);
    tagRow(data.keywords?.suggested?.slice(0, 18), [255, 250, 220], DKGOLD);

    // ══════════════════════════════════════════════════════════
    // PAGE 4 — BULLET POINT IMPROVEMENTS
    // ══════════════════════════════════════════════════════════
    newPage();
    rgb(DARK); font(14, 'bold'); doc.text('Bullet Point Improvements', M, y); y += 2;
    rgb(GOLD, 'draw'); doc.line(M, y, M + 65, y); y += 2;
    rgb(MID); font(7.5); doc.text('Weak phrases rewritten with strong action verbs and measurable outcomes.', M, y); y += 7;

    (data.bullet_points || []).forEach(bp => {
      const bfL = doc.splitTextToSize(clean(bp.original), CW - 22);
      const afL = doc.splitTextToSize(clean(bp.improved), CW - 22);
      const bH  = bfL.length * 4.6 + 7;
      const aH  = afL.length * 4.6 + 7;
      check(bH + aH + 4);

      // BEFORE block
      rgb(LTRED, 'fill'); doc.roundedRect(M, y - 3, CW, bH, 1.5, 1.5, 'F');
      rgb(RED, 'fill'); doc.roundedRect(M, y - 3, 18, bH, 1.5, 1.5, 'F');
      rgb(WHITE); font(6.5, 'bold'); doc.text('BEFORE', M + 2, y + 1.5);
      rgb([140, 30, 30]); font(8); doc.text(bfL, M + 21, y); y += bH + 1;

      // AFTER block
      rgb(LTGRN, 'fill'); doc.roundedRect(M, y - 3, CW, aH, 1.5, 1.5, 'F');
      rgb(GREEN, 'fill'); doc.roundedRect(M, y - 3, 18, aH, 1.5, 1.5, 'F');
      rgb(WHITE); font(6.5, 'bold'); doc.text('AFTER', M + 2.5, y + 1.5);
      rgb([15, 85, 35]); font(8); doc.text(afL, M + 21, y); y += aH + 4;
    });

    // ══════════════════════════════════════════════════════════
    // PAGE 5 — RED FLAGS + CV FEEDBACK + PROFESSIONAL SUMMARY
    // ══════════════════════════════════════════════════════════
    newPage();
    rgb(DARK); font(14, 'bold'); doc.text('CV Audit & Professional Summary', M, y); y += 2;
    rgb(GOLD, 'draw'); doc.line(M, y, M + 70, y); y += 7;

    sectionHead('Red Flags', RED, LTRED);
    if (!data.red_flags?.length) {
      rgb(GREEN); font(8.5); txt('No red flags detected — your CV looks clean.'); y += 7;
    } else {
      (data.red_flags || []).forEach(f => {
        check(12);
        const sCol = f.severity === 'HIGH' ? RED : f.severity === 'MEDIUM' ? ORANGE : GOLD;
        const lt   = f.severity === 'HIGH' ? LTRED : f.severity === 'MEDIUM' ? LTOR : [255,252,230];
        const dL   = doc.splitTextToSize(clean(f.description), CW - 22);
        rgb(lt, 'fill'); doc.roundedRect(M, y - 3, CW, dL.length * 4.5 + 7, 1.5, 1.5, 'F');
        rgb(sCol, 'fill'); doc.roundedRect(M, y - 3, 20, dL.length * 4.5 + 7, 1.5, 1.5, 'F');
        rgb(WHITE); font(6, 'bold'); doc.text(clean(f.severity), M + 2, y + 1);
        rgb([50, 50, 70]); font(8); doc.text(dL, M + 23, y);
        y += dL.length * 4.5 + 8;
      });
    }

    y += 1; divider();
    sectionHead('CV Feedback', BLUE, LTBLU);
    (data.cv_feedback || []).forEach(f => {
      const isPos = f.positive;
      bullet((isPos ? '[+] ' : '[!] ') + clean(f.text), isPos ? GREEN : [80, 80, 130]);
    });

    y += 1; divider();
    sectionHead('AI-Generated Professional Summary', GOLD, [255, 252, 230]);
    const sumL = doc.splitTextToSize(clean(data.professional_summary || ''), CW - 8);
    check(sumL.length * 5 + 14);
    rgb([255, 252, 230], 'fill'); rgb(GOLD, 'draw'); doc.setLineWidth(0.3);
    doc.roundedRect(M, y - 2, CW, sumL.length * 5.2 + 8, 2, 2, 'FD');
    rgb(DKGOLD); font(8.5, 'italic'); doc.text(sumL, M + 4, y + 4);
    y += sumL.length * 5.2 + 12;

    // ══════════════════════════════════════════════════════════
    // PAGE 6 — SKILLS PLAN + INTERVIEW INSIGHTS
    // ══════════════════════════════════════════════════════════
    newPage();
    rgb(DARK); font(14, 'bold'); doc.text('Skills Plan & Interview Insights', M, y); y += 2;
    rgb(GOLD, 'draw'); doc.line(M, y, M + 72, y); y += 7;

    const skills = data.skills_gap || [];
    if (skills.length) {
      sectionHead('Skills Improvement Plan', BLUE, LTBLU);
      skills.forEach(sk => {
        check(16);
        const pCol = sk.priority === 'HIGH' ? RED : sk.priority === 'MEDIUM' ? ORANGE : BLUE;
        const lt   = sk.priority === 'HIGH' ? LTRED : sk.priority === 'MEDIUM' ? LTOR : LTBLU;
        const dL   = doc.splitTextToSize(clean(sk.description), CW - 24);
        const resL = doc.splitTextToSize('Resource: ' + clean(sk.resource), CW - 24);
        const bH   = dL.length * 4.5 + resL.length * 4 + 14;
        check(bH);
        rgb(lt, 'fill'); doc.roundedRect(M, y - 3, CW, bH, 1.5, 1.5, 'F');
        rgb(pCol, 'fill'); doc.roundedRect(M, y - 3, 20, bH, 1.5, 1.5, 'F');
        rgb(WHITE); font(6, 'bold'); doc.text(clean(sk.priority), M + 1.5, y + 1);
        rgb(DARK); font(9, 'bold'); doc.text(clean(sk.skill), M + 23, y);
        rgb(MID); font(7.5); doc.text(dL, M + 23, y + 5.5);
        rgb(DKGOLD); font(7, 'italic'); doc.text(resL, M + 23, y + 5.5 + dL.length * 4.5);
        y += bH + 3;
      });
      y += 1; divider();
    }

    sectionHead('Interview Insights', BLUE, LTBLU);
    const ins  = data.interview_insights;
    const prob = ins?.shortlist_probability ?? 0;
    const pC   = prob >= 70 ? GREEN : prob >= 40 ? ORANGE : RED;
    check(22);
    rgb(LGRAY, 'fill'); doc.roundedRect(M, y, CW, 20, 2, 2, 'F');
    rgb(DARK); font(9, 'bold'); doc.text('Shortlisting Probability', M + 4, y + 8);
    rgb(pC); font(18, 'bold'); doc.text(prob + '%', W - M - 2, y + 10, { align: 'right' });
    const insL = doc.splitTextToSize(clean(ins?.summary || ''), CW - 12);
    rgb(MID); font(7); doc.text(insL, M + 4, y + 15); y += 26;

    sectionHead('Predicted Interview Questions', BLUE, LTBLU);
    (ins?.questions || []).forEach((q, i) => {
      check(12);
      const qL = doc.splitTextToSize(clean(q), CW - 16);
      rgb(LTBLU, 'fill'); doc.roundedRect(M, y - 3, CW, qL.length * 4.5 + 7, 1.5, 1.5, 'F');
      rgb(BLUE); font(8, 'bold'); doc.text('Q' + (i + 1) + '.', M + 2, y);
      rgb([40, 55, 100]); font(8); doc.text(qL, M + 13, y);
      y += qL.length * 4.5 + 8;
    });

    // ══════════════════════════════════════════════════════════
    // PAGE 7 — ATS TIPS + LINKEDIN + CHECKLIST
    // ══════════════════════════════════════════════════════════
    newPage();
    rgb(DARK); font(14, 'bold'); doc.text('ATS Tips, LinkedIn & Tailoring Checklist', M, y); y += 2;
    rgb(GOLD, 'draw'); doc.line(M, y, M + 80, y); y += 7;

    sectionHead('Top ATS Boost Tips', GOLD, [255, 252, 230]);
    (data.ats_boost_tips || []).slice(0, 6).forEach(tip => {
      check(14);
      const tL = doc.splitTextToSize(clean(tip.title) + ': ' + clean(tip.detail), CW - 24);
      const pC = tip.priority === 'HIGH' ? RED : tip.priority === 'MEDIUM' ? ORANGE : BLUE;
      const lt = tip.priority === 'HIGH' ? LTRED : tip.priority === 'MEDIUM' ? LTOR : LTBLU;
      rgb(lt, 'fill'); doc.roundedRect(M, y - 3, CW, tL.length * 4.5 + 7, 1.5, 1.5, 'F');
      rgb(pC, 'fill'); doc.roundedRect(M, y - 3, 20, tL.length * 4.5 + 7, 1.5, 1.5, 'F');
      rgb(WHITE); font(6, 'bold'); doc.text(clean(tip.priority), M + 1.5, y + 1);
      rgb([60, 55, 15]); font(8); doc.text(tL, M + 23, y);
      y += tL.length * 4.5 + 8;
    });

    y += 1; divider();
    sectionHead('LinkedIn Headline Generator', BLUE, LTBLU);
    const li = data.linkedin_headline;
    if (li) {
      [['Primary Headline', li.primary], ['Alternative Headline', li.alternative]].forEach(([lbl, txt2]) => {
        check(18);
        const hL = doc.splitTextToSize(clean(txt2), CW - 8);
        rgb([10, 22, 42], 'fill'); doc.roundedRect(M, y - 3, CW, hL.length * 5 + 13, 2, 2, 'F');
        rgb([74, 158, 255]); font(7, 'bold'); doc.text(lbl, M + 3, y + 2);
        rgb([215, 230, 255]); font(9, 'bold'); doc.text(hL, M + 3, y + 8); y += hL.length * 5 + 14;
      });
      const tipL = doc.splitTextToSize(clean(li.tip), CW - 6);
      rgb(LGRAY, 'fill'); doc.roundedRect(M, y - 2, CW, tipL.length * 4.5 + 7, 2, 2, 'F');
      rgb(MID); font(7.5); doc.text(tipL, M + 3, y + 3); y += tipL.length * 4.5 + 10;
    }

    y += 1; divider();
    sectionHead('CV Tailoring Checklist', GREEN, LTGRN);
    (data.tailoring_checklist || []).forEach(item => {
      check(13);
      const dL = doc.splitTextToSize(clean(item.detail), CW - 24);
      const pC = item.priority === 'HIGH' ? RED : item.priority === 'MEDIUM' ? ORANGE : BLUE;
      const lt = item.priority === 'HIGH' ? LTRED : item.priority === 'MEDIUM' ? LTOR : LTBLU;
      rgb(lt, 'fill'); doc.roundedRect(M, y - 3, CW, dL.length * 4.5 + 12, 1.5, 1.5, 'F');
      rgb(pC, 'fill'); doc.roundedRect(M, y - 3, 20, dL.length * 4.5 + 12, 1.5, 1.5, 'F');
      rgb(WHITE); font(6, 'bold'); doc.text(clean(item.priority), M + 1.5, y + 1);
      rgb(DARK); font(8.5, 'bold'); doc.text(clean(item.task), M + 23, y);
      rgb(MID); font(7.5); doc.text(dL, M + 23, y + 5.5);
      y += dL.length * 4.5 + 13;
    });

    // ══════════════════════════════════════════════════════════
    // PAGE 8 (conditional) — SCORE BOOST ACTION PLAN
    // ══════════════════════════════════════════════════════════
    const provisions = data.score_provisions || [];
    if (provisions.length && atsS < 70) {
      newPage();
      rgb(DARK); font(14, 'bold'); doc.text('Score Boost Action Plan', M, y); y += 2;
      rgb(RED, 'draw'); doc.setLineWidth(0.7); doc.line(M, y, M + 65, y); y += 3;
      const introL = doc.splitTextToSize(
        'Your ATS score is ' + atsS + '% - ' + (70 - atsS) + ' points below the 70% recruiter threshold. Complete these actions in order to close the gap.',
        CW
      );
      rgb(MID); font(8); doc.text(introL, M, y); y += introL.length * 4.5 + 5;

      provisions.forEach(p => {
        const actL = doc.splitTextToSize(clean(p.action), CW - 46);
        const exL  = doc.splitTextToSize('e.g. ' + clean(p.example), CW - 46);
        const bH   = actL.length * 4.5 + exL.length * 4 + 18;
        check(bH + 2);

        rgb(LTRED, 'fill'); doc.roundedRect(M, y - 3, CW, bH, 2, 2, 'F');

        // Number badge
        rgb(RED, 'fill'); doc.circle(M + 6, y + 3.5, 5, 'F');
        rgb(WHITE); font(7.5, 'bold'); doc.text(String(p.number), M + 6, y + 5.5, { align: 'center' });

        // Content
        const cx = M + 14;
        rgb(RED); font(6.5, 'bold'); doc.text(clean(p.effort), cx, y);
        rgb(DARK); font(9, 'bold'); doc.text(clean(p.title), cx, y + 5.5);
        rgb(MID); font(7.5); doc.text(actL, cx, y + 11);
        rgb(DKGOLD); font(7, 'italic'); doc.text(exL, cx, y + 11 + actL.length * 4.5);

        // Impact pill
        const impT = clean(p.impact);
        font(6.5, 'bold');
        const impW = doc.getTextWidth(impT) + 5;
        const ipX  = W - M - impW - 1;
        rgb(LTGRN, 'fill'); doc.roundedRect(ipX, y - 2, impW + 2, 8, 2, 2, 'F');
        rgb(GREEN, 'draw'); doc.setLineWidth(0.3); doc.roundedRect(ipX, y - 2, impW + 2, 8, 2, 2, 'S');
        rgb(GREEN); doc.text(impT, ipX + 3.5, y + 3.5);

        y += bH + 3;
      });
    }

    // ── Save ──
    doc.save('King-CV-Report-' + Date.now() + '.pdf');

  } finally {
    if (btn) { btn.innerHTML = '<span>&#8595;</span> Download Report'; btn.disabled = false; }
  }
}
