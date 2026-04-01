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

  // Wire up quick action buttons
  document.getElementById('downloadReportBtn')?.addEventListener('click', () => downloadReport(data));
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
