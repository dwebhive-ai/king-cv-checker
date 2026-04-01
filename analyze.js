/**
 * ============================================================
 * KING CV CHECKER — Client-Side Analysis Engine (analyze.js)
 * Mirrors the PHP backend logic entirely in JavaScript.
 * Runs in the browser — no server required (GitHub Pages ready).
 * ============================================================
 */

// ============================================================
// FILE TEXT EXTRACTION
// ============================================================

/**
 * Extract plain text from an uploaded File object.
 * Supports PDF (via pdf.js), DOCX (via mammoth.js), TXT.
 */
async function extractTextFromFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();

  switch (ext) {
    case 'pdf':  return await extractFromPDF(file);
    case 'docx': return await extractFromDOCX(file);
    case 'txt':  return await extractFromTXT(file);
    default:     throw new Error('Unsupported file type.');
  }
}

async function extractFromPDF(file) {
  if (!window.pdfjsLib) throw new Error('PDF library not loaded.');

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ') + '\n';
  }

  return text.trim();
}

async function extractFromDOCX(file) {
  if (!window.mammoth) throw new Error('DOCX library not loaded.');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value.trim();
}

function extractFromTXT(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result.trim());
    reader.onerror = () => reject(new Error('Could not read TXT file.'));
    reader.readAsText(file);
  });
}

// ============================================================
// AI INTEGRATION PLACEHOLDER
// ============================================================

/**
 * Future AI integration hook.
 *
 * Uncomment one of the blocks below and set your API key to activate.
 * Returns structured analysis object, or null to use rule-based fallback.
 *
 * NOTE: Never expose API keys in client-side JS in production.
 * Use a backend proxy endpoint instead.
 */
async function analyzeWithAI(_cvText, _jobDescription) { // eslint-disable-line no-unused-vars
  // ---- OpenAI GPT Example ----
  /*
  const apiKey = 'YOUR_OPENAI_API_KEY'; // use a backend proxy in production
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: `Analyze this CV vs job description. Return JSON with keys:
          ats_score, job_match, strengths, gaps, keywords, bullet_points,
          skills_gap, cv_feedback, red_flags, professional_summary, interview_insights.
          CV:\n${cvText}\n\nJob Description:\n${jobDescription}`
      }]
    })
  });
  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
  */

  // ---- Claude (Anthropic) Example — use a backend proxy ----
  /*
  const response = await fetch('/api/analyze', { // your proxy endpoint
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cvText, jobDescription })
  });
  return await response.json();
  */

  return null; // Use rule-based analysis
}

// ============================================================
// MAIN ANALYSIS ORCHESTRATOR
// ============================================================

async function analyzeCV(cvText, jobDescription) {
  const cvLower = cvText.toLowerCase();
  const jdLower = jobDescription.toLowerCase();

  // Try AI first (returns null if not configured)
  const aiResult = await analyzeWithAI(cvText, jobDescription);
  if (aiResult) return aiResult;

  // Rule-based analysis
  const keywords    = analyzeKeywords(cvLower, jdLower);
  const atsScore    = calculateATSScore(cvLower, jdLower);
  const jobMatch    = calculateJobMatch(cvLower, jdLower);
  const redFlags    = detectRedFlags(cvText, cvLower);

  return {
    ats_score:            atsScore,
    job_match:            jobMatch,
    ...analyzeStrengthsAndGaps(cvLower, jdLower),
    keywords,
    bullet_points:        improveBulletPoints(cvText, jobDescription),
    skills_gap:           analyzeSkillsGap(cvLower, jdLower),
    cv_feedback:          generateCVFeedback(cvText, cvLower),
    red_flags:            redFlags,
    professional_summary: generateProfessionalSummary(cvText, jobDescription),
    interview_insights:   generateInterviewInsights(cvLower, jdLower),
    // ── NEW PREMIUM MODULES ──
    ats_boost_tips:       generateATSBoostTips(cvLower, jdLower, keywords),
    power_score:          calculatePowerScore(cvText),
    career_level:         detectCareerLevel(cvLower),
    salary_insights:      estimateSalaryRange(cvLower, jdLower),
    linkedin_headline:    generateLinkedInHeadline(cvText, jobDescription),
    tailoring_checklist:  generateTailoringChecklist(cvLower, jdLower, keywords, redFlags),
    // ── SCORE PROVISIONS + CV REWRITE ──
    score_provisions:     generateScoreProvisions(atsScore.score, cvLower, jdLower, keywords),
    rewritten_cv:         rewriteCVContent(cvText, jobDescription),
  };
}

// ============================================================
// KEYWORD UTILITIES
// ============================================================

function getStopWords() {
  return new Set([
    'a','an','the','and','or','but','in','on','at','to','for','of','with',
    'by','from','is','was','are','were','be','been','being','have','has',
    'had','do','does','did','will','would','could','should','may','might',
    'shall','can','need','i','we','you','he','she','they','it','my','our',
    'your','his','her','their','its','this','that','these','those','all',
    'each','every','both','few','more','most','other','some','such','no',
    'not','only','same','so','than','too','very','just','as','up','out',
    'if','about','into','through','during','before','after','above','below',
    'between','us','who','which','what','when','where','how','any','also',
    'while','one','two','three','four','five','six','seven','eight','nine',
    'ten','new','old','good','great','best','well','work','years','year',
    'make','made','making','use','using','used','across','within',
    // Generic JD filler words that are not meaningful keywords
    'role','roles','plus','must','meet','pass','learn','key','tasks','test',
    'clear','verbal','written','ability','skills','checks','check','degree',
    'police','drug','screening','background','able','level','high','strong',
    'suite','office','handle','successful','information','communication',
    'include','includes','including','required','requirements','preferred',
    'responsibilities','qualifications','experience','position','candidate',
    'apply','application','team','company','organization','please','send',
    'email','following','ensure','provide','support','help','assist','per',
    'review','report','reports','reporting','day','days','time','times',
    'full','part','based','related','relevant','equivalent','demonstrated',
  ]);
}

function extractKeywords(text) {
  const stopWords = getStopWords();
  const words = text.split(/[\s,;:.!?()\[\]{}\'"\/\\]+/)
    .filter(w => w.length >= 3 && !stopWords.has(w));

  const freq = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });

  // Bigrams
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i].length >= 3 && words[i+1].length >= 3) {
      const bigram = words[i] + ' ' + words[i+1];
      freq[bigram] = (freq[bigram] || 0) + 1;
    }
  }

  return freq;
}

// ============================================================
// SKILL DICTIONARIES
// ============================================================

function getTechSkills() {
  return [
    'python','javascript','typescript','java','php','ruby','swift','kotlin',
    'golang','go','rust','scala','r','perl','bash','shell','c++','c#','dart',
    'html','css','react','angular','vue','svelte','next.js','nuxt','gatsby',
    'webpack','vite','sass','tailwind','bootstrap','jquery',
    'node.js','express','fastapi','django','flask','rails','laravel','spring',
    'asp.net','.net','nestjs','graphql','rest','restful','api','microservices',
    'serverless','grpc','websockets',
    'mysql','postgresql','postgres','mongodb','redis','elasticsearch','oracle',
    'sqlite','dynamodb','cassandra','firestore','neo4j','mariadb','supabase',
    'aws','azure','gcp','google cloud','docker','kubernetes','k8s','terraform',
    'ansible','jenkins','github actions','ci/cd','devops','helm','nginx','linux',
    'machine learning','deep learning','tensorflow','pytorch','keras',
    'scikit-learn','pandas','numpy','spark','hadoop','airflow','nlp',
    'computer vision','llm','openai','langchain','data science',
    'power bi','tableau','looker','bigquery','snowflake','databricks',
    'android','ios','react native','flutter','xamarin',
    'git','github','gitlab','jira','confluence','agile','scrum','kanban',
    'tdd','jest','pytest','selenium','figma','sketch','photoshop',
    'excel','powerpoint','salesforce','sap','oauth','jwt','cybersecurity',
  ];
}

function getSoftSkills() {
  return [
    'leadership','communication','teamwork','collaboration','problem solving',
    'critical thinking','analytical','creativity','adaptability','flexibility',
    'time management','project management','strategic thinking','negotiation',
    'presentation','mentoring','coaching','stakeholder management',
    'cross-functional','initiative','proactive','decision making',
    'conflict resolution','customer service','relationship building',
    'organisational','multitasking','detail-oriented',
  ];
}

function getEducationKeywords() {
  return [
    'bachelor','master','phd','doctorate','degree','diploma','certificate',
    'bsc','ba','msc','mba','btech','mtech','engineering','computer science',
    'information technology','mathematics','statistics','business administration',
    'finance','accounting','marketing','design','certified','certification',
    'aws certified','google certified','pmp','cisco','microsoft certified',
    'comptia','oracle certified',
  ];
}

function getExperienceIndicators() {
  return [
    'senior','junior','mid','lead','principal','staff','manager','director',
    'vp','head of','chief','architect','specialist','consultant','analyst',
    'engineer','developer','designer','product manager','scrum master',
    'team lead','entry level','experienced',
  ];
}

// ============================================================
// MODULE 1: ATS SCORE
// ============================================================

function calculateATSScore(cvLower, jdLower) {
  const jdKeywords = extractKeywords(jdLower);
  const terms = Object.keys(jdKeywords);
  if (!terms.length) return { score: 0, matched: 0, total: 0 };

  let matched = 0;
  terms.forEach(kw => { if (cvLower.includes(kw)) matched++; });

  const score = Math.min(100, Math.round((matched / terms.length) * 100));
  return { score, matched, total: terms.length };
}

// ============================================================
// MODULE 2: JOB MATCH SCORE
// ============================================================

function calculateJobMatch(cvLower, jdLower) {
  // Skills
  const allSkills   = [...getTechSkills(), ...getSoftSkills()];
  const jdSkills    = allSkills.filter(s => jdLower.includes(s));
  const cvSkillHits = jdSkills.filter(s => cvLower.includes(s)).length;
  const skillScore  = jdSkills.length === 0 ? 65 : Math.min(100, Math.round((cvSkillHits / jdSkills.length) * 100));

  // Experience
  const expIndicators = getExperienceIndicators();
  const jdExpTerms    = expIndicators.filter(e => jdLower.includes(e));
  const cvExpHits     = jdExpTerms.filter(e => cvLower.includes(e)).length;

  const jdYears = [...jdLower.matchAll(/(\d+)\s*\+?\s*years?/g)].map(m => parseInt(m[1]));
  const cvYears = [...cvLower.matchAll(/(\d+)\s*\+?\s*years?/g)].map(m => parseInt(m[1]));
  let yearsScore = 60;
  if (jdYears.length && cvYears.length) {
    const jdMax = Math.max(...jdYears);
    const cvMax = Math.max(...cvYears);
    yearsScore = cvMax >= jdMax ? 100 : cvMax >= jdMax - 1 ? 80 : Math.max(20, Math.round((cvMax / jdMax) * 100));
  }
  const expScore = jdExpTerms.length === 0
    ? yearsScore
    : Math.min(100, Math.round(((cvExpHits / jdExpTerms.length) * 60) + (yearsScore * 0.4)));

  // Education
  const eduKws   = getEducationKeywords();
  const jdEdu    = eduKws.filter(e => jdLower.includes(e));
  const cvEduHit = jdEdu.filter(e => cvLower.includes(e)).length;
  const eduScore = jdEdu.length === 0 ? 70 : Math.min(100, Math.round((cvEduHit / jdEdu.length) * 100));

  // Industry
  const jdKws        = Object.keys(extractKeywords(jdLower)).slice(0, 30);
  const industryHits = jdKws.filter(kw => cvLower.includes(kw)).length;
  const industryScore = jdKws.length === 0 ? 60 : Math.min(100, Math.round((industryHits / jdKws.length) * 100));

  const overall = Math.min(100, Math.round(
    skillScore * 0.40 + expScore * 0.25 + eduScore * 0.20 + industryScore * 0.15
  ));

  return { overall, skills: skillScore, experience: expScore, education: eduScore, industry: industryScore };
}

// ============================================================
// MODULE 3: KEYWORD ANALYSIS
// ============================================================

function analyzeKeywords(cvLower, jdLower) {
  const stopWords   = getStopWords();
  const jdWords     = [...new Set(jdLower.split(/\s+/).filter(w => w.length >= 4 && !stopWords.has(w)))];
  const allSkills   = [...getTechSkills(), ...getSoftSkills(), ...getEducationKeywords()];
  const jdSkillTerms = [...new Set(allSkills.filter(s => jdLower.includes(s)))];
  const allTerms    = [...new Set([...jdWords, ...jdSkillTerms])];

  const missing  = allTerms.filter(t => !cvLower.includes(t)).sort((a,b) => a.length - b.length).slice(0, 25);
  const present  = allTerms.filter(t => cvLower.includes(t)).sort((a,b) => a.length - b.length).slice(0, 30);
  const suggested = [
    'quantified results','kpis','roi','stakeholder management','cross-functional',
    'agile methodology','data-driven','scalable','deployed','optimized',
    'automated','streamlined','reduced costs','mentored','collaborated',
  ].filter(k => !cvLower.includes(k) && !jdLower.includes(k)).slice(0, 15);

  return { missing, present, suggested };
}

// ============================================================
// MODULE 4: STRENGTHS & GAPS
// ============================================================

function analyzeStrengthsAndGaps(cvLower, jdLower) {
  const strengths = [];
  const gaps      = [];

  const techSkills = getTechSkills();
  const softSkills = getSoftSkills();

  const matchedTech = techSkills.filter(s => cvLower.includes(s) && jdLower.includes(s));
  if (matchedTech.length >= 5) {
    strengths.push(`Strong technical skill alignment — ${matchedTech.slice(0,4).join(', ')} and more match the role.`);
  } else if (matchedTech.length > 0) {
    strengths.push(`Relevant technical skills present: ${matchedTech.slice(0,3).join(', ')}.`);
  }

  const matchedSoft = softSkills.filter(s => cvLower.includes(s) && jdLower.includes(s));
  if (matchedSoft.length >= 3) {
    strengths.push(`Good soft skills demonstrated: ${matchedSoft.slice(0,3).join(', ')}.`);
  }

  if (/\d+%|\d+x|increased|improved|reduced|saved|generated|\$[\d,]+/i.test(cvLower)) {
    strengths.push('CV includes quantified achievements — excellent for ATS and hiring managers.');
  }

  if (/managed|led|directed|oversaw|supervised/i.test(cvLower)) {
    strengths.push('Leadership experience is evident in the CV.');
  }

  if (/certification|certified|credential/i.test(cvLower)) {
    strengths.push('Professional certifications add credibility.');
  }

  if (!strengths.length) {
    strengths.push('Your CV has a foundation to build on — focus on adding measurable results.');
  }

  const missingTech = techSkills.filter(s => jdLower.includes(s) && !cvLower.includes(s));
  if (missingTech.length > 3) {
    gaps.push(`Several required technical skills are missing: ${missingTech.slice(0,4).join(', ')}.`);
  }

  if (!/\d+%|\d+x|increased|improved|reduced|saved|\$[\d,]+/i.test(cvLower)) {
    gaps.push('No quantified achievements found. Add numbers (e.g., "Increased sales by 30%").');
  }

  if (!/summary|objective|profile|about me/i.test(cvLower)) {
    gaps.push('No professional summary detected. A tailored summary boosts ATS performance significantly.');
  }

  const jdEdu = getEducationKeywords().filter(e => jdLower.includes(e));
  const cvEdu = jdEdu.filter(e => cvLower.includes(e));
  if (jdEdu.length > cvEdu.length) {
    gaps.push('Education or certification requirements from the job description are not clearly reflected in your CV.');
  }

  return { strengths, gaps };
}

// ============================================================
// MODULE 5: BULLET POINT IMPROVEMENT
// ============================================================

function improveBulletPoints(cvText, jobDescription) {
  const jdLower = (jobDescription || '').toLowerCase();

  const weakPatterns = [
    'responsible for','helped with','worked on','assisted in',
    'was involved in','duties included','tasks included',
    'helped to','tried to','participated in','contributed to',
    'involved in','tasked with','worked closely','assisted with',
    'part of the team','part of a team','provided support',
    'supported the','supported by','involved with',
  ];

  const actionVerbs = [
    'Delivered','Spearheaded','Orchestrated','Optimized','Engineered',
    'Designed','Built','Launched','Drove','Accelerated','Streamlined',
    'Transformed','Implemented','Executed','Achieved','Generated',
    'Elevated','Championed','Led','Reduced','Automated','Deployed',
    'Established','Modernized','Scaled','Negotiated','Trained',
  ];

  const metricSuffixes = [
    ', reducing manual effort by 30%.',
    ', resulting in measurable team efficiency gains of ~25%.',
    ', improving delivery speed by 25% quarter-on-quarter.',
    ', saving an estimated 8+ hours per week in operational overhead.',
    ', contributing to a 20% improvement in output quality.',
    ', cutting error rates by 40% within the first month.',
    ', increasing team throughput by 35% over two quarters.',
    ', enabling the team to hit 100% of sprint targets for 3 consecutive months.',
  ];

  const lines = cvText.split(/\n+/).map(l => l.trim()).filter(l => l.length >= 25 && l.length <= 350);
  const improvements = [];
  const usedLines = new Set();

  // ── Pass 1: lines with explicit weak phrases ──
  for (const line of lines) {
    if (improvements.length >= 8) break;
    const ll = line.toLowerCase();
    const weak = weakPatterns.find(p => ll.includes(p));
    if (!weak || usedLines.has(line)) continue;

    const verb    = actionVerbs[improvements.length % actionVerbs.length];
    const coreIdx = ll.indexOf(weak);
    let core      = line.slice(coreIdx + weak.length).replace(/^[,;: ]+/, '').trim();
    core          = core.charAt(0).toLowerCase() + core.slice(1);

    if (!/\d+[%x×]?|\$[\d,]+/i.test(core)) {
      core = core.replace(/\.$/, '') + metricSuffixes[improvements.length % metricSuffixes.length];
    }

    usedLines.add(line);
    improvements.push({ original: line, improved: `${verb} ${core}` });
  }

  // ── Pass 2: lines that start with a noun/gerund instead of a strong verb (no metric) ──
  // These are still improvable even without a weak trigger word.
  const startsWeak = /^(managed|handled|created|prepared|reviewed|maintained|supported|provided|processed|performed|completed|carried out|undertook)/i;
  for (const line of lines) {
    if (improvements.length >= 8) break;
    if (usedLines.has(line)) continue;
    if (!startsWeak.test(line)) continue;
    if (/\d+[%x×]?|\$[\d,]+/i.test(line)) continue; // already has a metric — leave it

    const verb = actionVerbs[(improvements.length + 3) % actionVerbs.length];
    const withoutFirst = line.replace(/^\w+\s*/i, '').trim();
    const core = withoutFirst.charAt(0).toLowerCase() + withoutFirst.slice(1);
    const improved = `${verb} ${core.replace(/\.$/, '')}${metricSuffixes[(improvements.length + 2) % metricSuffixes.length]}`;

    usedLines.add(line);
    improvements.push({ original: line, improved });
  }

  // ── Premium context-aware fallbacks (uses JD keywords where possible) ──
  const jdRoleHint = (() => {
    const roleWords = ['marketing','sales','finance','operations','engineering','design','data','hr','legal','customer'];
    return roleWords.find(r => jdLower.includes(r)) || 'operations';
  })();

  const contextFallbacks = {
    marketing: [
      { original: 'Responsible for managing social media accounts and content.',
        improved: 'Spearheaded social media strategy across 4 platforms, growing combined following by 62% and boosting engagement rate from 1.8% to 4.5% in 6 months.' },
      { original: 'Helped with campaign planning and execution.',
        improved: 'Orchestrated 12 integrated marketing campaigns annually, generating £340K in attributed pipeline and a 28% increase in qualified leads.' },
      { original: 'Worked on email marketing and newsletter content.',
        improved: 'Engineered automated email nurture sequences for 15K subscribers, lifting open rates by 34% and driving a 19% uplift in conversion to demo requests.' },
      { original: 'Assisted in preparing marketing reports for the team.',
        improved: 'Delivered weekly performance dashboards to senior leadership, enabling data-driven decisions that reallocated £80K in budget to highest-ROI channels.' },
      { original: 'Participated in product launch planning meetings.',
        improved: 'Led cross-functional product launch coordination for 3 major releases, achieving 110% of launch-week revenue targets on each occasion.' },
      { original: 'Responsible for managing relationships with agencies and suppliers.',
        improved: 'Negotiated and managed relationships with 6 external agencies, reducing agency spend by 22% while maintaining quality scores above 4.5/5.' },
    ],
    sales: [
      { original: 'Responsible for managing a portfolio of client accounts.',
        improved: 'Owned a £1.2M client portfolio, delivering 118% of annual revenue target and achieving a 94% client retention rate over two consecutive years.' },
      { original: 'Helped with lead generation and outbound prospecting.',
        improved: 'Engineered a structured outbound prospecting workflow, generating 45 qualified opportunities per quarter and reducing sales cycle by 18 days.' },
      { original: 'Worked on preparing proposals and presentations for prospects.',
        improved: 'Delivered tailored proposals and business cases to C-suite stakeholders, achieving a 38% pitch-to-close conversion rate — 15% above team average.' },
      { original: 'Assisted in onboarding new clients and managing handovers.',
        improved: 'Streamlined client onboarding process, cutting time-to-value from 21 days to 9 days and improving 90-day retention by 27%.' },
      { original: 'Participated in weekly sales meetings and pipeline reviews.',
        improved: 'Facilitated weekly pipeline reviews for a team of 8 AEs, implementing deal-scoring methodology that improved forecast accuracy to 91%.' },
      { original: 'Responsible for maintaining the CRM and updating deal records.',
        improved: 'Enforced CRM hygiene standards across the sales team, improving data completeness to 98% and enabling automated reporting that saved 5 hours of admin per week.' },
    ],
    data: [
      { original: 'Responsible for managing and analysing datasets.',
        improved: 'Engineered data pipelines processing 50M+ records daily, reducing ETL runtime by 60% and enabling real-time reporting for 3 business units.' },
      { original: 'Helped with building dashboards and reports.',
        improved: 'Built 14 executive dashboards in Power BI/Tableau, reducing ad-hoc report requests by 70% and saving the analytics team 12 hours per week.' },
      { original: 'Worked on data cleaning and preparation tasks.',
        improved: 'Automated data validation and cleaning workflows using Python, cutting data preparation time by 75% and improving model accuracy by 18%.' },
      { original: 'Assisted in statistical analysis and model building.',
        improved: 'Developed and deployed 3 predictive models that improved customer churn identification by 41%, contributing to £2.1M in retained ARR.' },
      { original: 'Participated in data governance and quality initiatives.',
        improved: 'Led data governance framework rollout across 6 departments, reducing data errors by 55% and achieving GDPR compliance 3 months ahead of deadline.' },
      { original: 'Responsible for querying databases and producing reports.',
        improved: 'Optimised 40+ complex SQL queries, reducing average report generation time from 4 minutes to 18 seconds and supporting decisions worth £6M+ annually.' },
    ],
    operations: [
      { original: 'Responsible for overseeing daily operational activities.',
        improved: 'Orchestrated end-to-end daily operations across 3 business units, improving on-time delivery rate from 82% to 97% and reducing escalations by 44%.' },
      { original: 'Helped with process improvement and efficiency initiatives.',
        improved: 'Led 5 Lean process improvement initiatives, eliminating 120+ hours of non-value-added work per month and saving £95K in annual operational costs.' },
      { original: 'Worked on coordinating teams and managing workloads.',
        improved: 'Managed resource allocation across a 22-person team, maintaining 95%+ utilisation and delivering all quarterly objectives on time and within budget.' },
      { original: 'Assisted in managing supplier relationships and procurement.',
        improved: 'Renegotiated 8 supplier contracts, achieving 17% cost reduction while improving SLA compliance from 79% to 96% across all critical vendors.' },
      { original: 'Participated in planning and strategy meetings.',
        improved: 'Contributed to quarterly strategic planning cycles, developing operational roadmaps that reduced time-to-market for 4 key initiatives by an average of 6 weeks.' },
      { original: 'Responsible for managing budgets and financial reporting.',
        improved: 'Managed £1.8M operational budget with 99.2% accuracy, implementing variance analysis processes that identified £210K in avoidable spend within the first quarter.' },
    ],
  };

  const fallbacks = contextFallbacks[jdRoleHint] || contextFallbacks.operations;
  let fi = 0;
  while (improvements.length < 6 && fi < fallbacks.length) {
    // Only add fallback if its original line isn't essentially already covered
    improvements.push(fallbacks[fi++]);
  }

  // Cap at 8 to keep the section focused and premium
  return improvements.slice(0, 8);
}

// ============================================================
// MODULE 6: SKILLS GAP ANALYSIS
// ============================================================

function analyzeSkillsGap(cvLower, jdLower) {
  const techSkills    = getTechSkills();
  const missingSkills = techSkills.filter(s => jdLower.includes(s) && !cvLower.includes(s));
  if (!missingSkills.length) return [];

  const resourceMap = {
    'python':           'Python.org docs / Automate the Boring Stuff (free)',
    'javascript':       'javascript.info (free) / freeCodeCamp',
    'react':            'react.dev (official docs) / Scrimba React Course',
    'node.js':          'nodejs.org docs / The Odin Project',
    'aws':              'AWS Free Tier + AWS Skill Builder',
    'docker':           'Docker Getting Started Guide (docker.com)',
    'kubernetes':       'Kubernetes.io interactive tutorials',
    'machine learning': 'fast.ai (free) / Coursera ML Specialization',
    'typescript':       'typescriptlang.org / Execute Program',
    'figma':            'Figma Academy (figma.com) — free',
    'agile':            'Scrum.org free guides / Coursera Agile courses',
    'git':              'learngitbranching.js.org (free interactive)',
    'sql':              'SQLZoo.net (free) / Mode Analytics SQL Tutorial',
  };

  return missingSkills.slice(0, 8).map(skill => {
    const freq     = (jdLower.match(new RegExp(skill, 'g')) || []).length;
    const priority = freq >= 3 ? 'HIGH' : freq >= 2 ? 'MEDIUM' : 'LOW';
    return {
      skill:       skill.charAt(0).toUpperCase() + skill.slice(1),
      priority,
      description: `The job requires ${skill}. Adding this to your CV and portfolio will improve your match score.`,
      resource:    resourceMap[skill] || `Search: "Learn ${skill} free" on Coursera, Udemy, or YouTube`,
    };
  }).sort((a, b) => ({ HIGH: 0, MEDIUM: 1, LOW: 2 }[a.priority] - { HIGH: 0, MEDIUM: 1, LOW: 2 }[b.priority]));
}

// ============================================================
// MODULE 7: CV FEEDBACK
// ============================================================

function generateCVFeedback(cvText, cvLower) {
  const feedback  = [];
  const wordCount = cvText.split(/\s+/).filter(Boolean).length;
  const metrics   = cvText.match(/\d+[%x]?|\$[\d,]+/gi) || [];

  if (wordCount > 700 && wordCount < 1400) {
    feedback.push({ text: `Good CV length (${wordCount} words). Aim for 1–2 pages.`, positive: true });
  } else if (wordCount < 300) {
    feedback.push({ text: `CV is too short (${wordCount} words). Expand with role details and achievements.`, positive: false });
  } else if (wordCount > 1400) {
    feedback.push({ text: `CV is too long (${wordCount} words). Trim to 2 pages — hiring managers skim.`, positive: false });
  }

  if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(cvText)) {
    feedback.push({ text: 'Email address is present — good.', positive: true });
  } else {
    feedback.push({ text: 'No email address found. Add contact information at the top of your CV.', positive: false });
  }

  if (cvLower.includes('linkedin')) {
    feedback.push({ text: 'LinkedIn profile referenced — valued by recruiters.', positive: true });
  } else {
    feedback.push({ text: 'Consider adding your LinkedIn URL to the CV header.', positive: false });
  }

  if (metrics.length >= 5) {
    feedback.push({ text: `Strong use of metrics (${metrics.length} found). Quantified achievements stand out.`, positive: true });
  } else if (metrics.length > 0) {
    feedback.push({ text: `Some metrics found (${metrics.length}). Aim for 5–8 quantified achievements.`, positive: false });
  } else {
    feedback.push({ text: 'No metrics found. Add numbers: "saved 10 hrs/week", "grew revenue by 35%".', positive: false });
  }

  const strongVerbs = ['achieved','delivered','built','launched','led','drove','increased','reduced','managed','designed'];
  const foundVerbs  = strongVerbs.filter(v => cvLower.includes(v));
  if (foundVerbs.length >= 4) {
    feedback.push({ text: 'Good use of strong action verbs throughout your CV.', positive: true });
  } else {
    feedback.push({ text: 'Use strong action verbs: Delivered, Engineered, Spearheaded, Optimized.', positive: false });
  }

  if (cvLower.includes('skills')) {
    feedback.push({ text: 'Skills section detected — ensure it mirrors the job description keywords.', positive: true });
  } else {
    feedback.push({ text: 'No dedicated skills section found. Add one listing key technical and soft skills.', positive: false });
  }

  return feedback;
}

// ============================================================
// MODULE 8: RED FLAGS
// ============================================================

function detectRedFlags(cvText, cvLower) {
  const flags = [];

  const weakPhrases = {
    'responsible for': 'Passive ownership language. Use strong action verbs: Led, Managed, Delivered.',
    'duties included': 'Task-listing with no impact. Reframe as achievements.',
    'assisted':        '"Assisted" downplays your contribution. Use "Contributed", "Built", "Delivered".',
    'hard worker':     'Cliché. Show work ethic through specific achievements.',
    'team player':     'Overused cliché. Demonstrate collaboration with concrete examples.',
    'go-getter':       'Meaningless buzzword. Replace with a specific accomplishment.',
    'synergy':         'Corporate jargon. Use plain, direct language.',
    'detail oriented': 'Prove it through your CV\'s formatting and content rather than stating it.',
  };

  for (const [phrase, desc] of Object.entries(weakPhrases)) {
    if (cvLower.includes(phrase)) {
      flags.push({ severity: 'MEDIUM', description: `"${phrase}" detected. ${desc}` });
    }
  }

  if (!/\d+[%x]?|\$[\d,]+/i.test(cvText)) {
    flags.push({ severity: 'HIGH', description: 'No quantifiable metrics found. CVs without numbers are 40% less likely to reach interview stage.' });
  }

  if (/seeking.*?position|looking for.*?opportunity|obtain.*?role/i.test(cvLower)) {
    flags.push({ severity: 'MEDIUM', description: 'Generic objective statement detected. Replace with a targeted professional summary.' });
  }

  const years = [...cvText.matchAll(/20(1[0-9]|2[0-5])/g)].map(m => parseInt(m[0]));
  const uniqueYears = [...new Set(years)].sort((a,b) => a-b);
  for (let i = 0; i < uniqueYears.length - 1; i++) {
    if (uniqueYears[i+1] - uniqueYears[i] >= 2) {
      flags.push({ severity: 'MEDIUM', description: `Potential employment gap between ${uniqueYears[i]} and ${uniqueYears[i+1]}. Be prepared to address this.` });
      break;
    }
  }

  const wordCount = cvText.split(/\s+/).filter(Boolean).length;
  if (wordCount < 250) {
    flags.push({ severity: 'HIGH', description: 'CV content is very sparse. A professional CV should be 400–700 words minimum.' });
  }

  if (!/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(cvText)) {
    flags.push({ severity: 'HIGH', description: 'No email address detected. Contact information must be visible at the top.' });
  }

  return flags;
}

// ============================================================
// MODULE 9: PROFESSIONAL SUMMARY GENERATOR
// ============================================================

function generateProfessionalSummary(cvText, jobDescription) {
  const cvLower = cvText.toLowerCase();
  const jdLower = jobDescription.toLowerCase();

  const jdFirstLine = jobDescription.trim().split('\n')[0];
  const jobTitle    = extractJobTitle(jdFirstLine) || 'the advertised role';

  const techSkills    = getTechSkills();
  const matchedSkills = techSkills.filter(s => cvLower.includes(s) && jdLower.includes(s));
  const topSkills     = matchedSkills.slice(0, 4).join(', ') || 'a diverse range of relevant skills';

  const yearMatches = [...cvText.matchAll(/(\d+)\s*\+?\s*years?/gi)].map(m => parseInt(m[1]));
  const yearsExp    = yearMatches.length ? Math.max(...yearMatches) : null;
  const expPhrase   = yearsExp ? `${yearsExp}+ years of professional experience` : 'proven professional experience';

  const seniority = /senior|lead|principal|staff|manager|director|head/i.test(cvLower) ? 'senior-level ' : '';
  const domain    = detectDomain(cvLower, jdLower);

  return (
    `Results-driven ${seniority}professional with ${expPhrase} in ${domain}. ` +
    `Skilled in ${topSkills}, with a track record of delivering measurable outcomes and driving business value. ` +
    `Seeking to bring strategic thinking and technical expertise to ${jobTitle}, contributing to a high-performance team from day one.`
  );
}

function extractJobTitle(text) {
  const cleaned = text.replace(/^(we are (looking for|hiring)|hiring for|job title:|position:)\s*/i, '').trim();
  return cleaned.split(/\s+/).slice(0, 4).join(' ')
    .replace(/[^a-zA-Z\s/\-]/g, '')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function detectDomain(cvLower, jdLower) {
  const domains = {
    'software engineering':         ['software','developer','engineer','backend','frontend','fullstack'],
    'data science & analytics':     ['data science','machine learning','analytics','data analyst'],
    'cloud & devops':               ['aws','azure','devops','kubernetes','infrastructure'],
    'product management':           ['product manager','product owner','roadmap','stakeholder'],
    'digital marketing':            ['seo','sem','content','social media','marketing'],
    'finance & accounting':         ['finance','accounting','audit','financial','cpa'],
    'design & UX':                  ['ux','ui','figma','design','user experience'],
    'project management':           ['project manager','pmp','scrum master','agile','delivery'],
    'cybersecurity':                ['security','penetration','threat','vulnerability','compliance'],
    'sales & business development': ['sales','business development','crm','revenue','client'],
  };

  const combined = cvLower + ' ' + jdLower;
  let best = 'technology and business', bestScore = 0;

  for (const [domain, keywords] of Object.entries(domains)) {
    const score = keywords.filter(k => combined.includes(k)).length;
    if (score > bestScore) { bestScore = score; best = domain; }
  }

  return best;
}

// ============================================================
// MODULE 10: INTERVIEW INSIGHTS
// ============================================================

function generateInterviewInsights(cvLower, jdLower) {
  const atsData   = calculateATSScore(cvLower, jdLower);
  const matchData = calculateJobMatch(cvLower, jdLower);
  const prob      = Math.min(98, Math.max(5, Math.round(atsData.score * 0.45 + matchData.overall * 0.55)));

  let label, summary;
  if (prob >= 75) {
    label   = 'Very Likely to be Shortlisted';
    summary = 'Your CV strongly aligns with this role. Keep your LinkedIn updated with the same keywords.';
  } else if (prob >= 55) {
    label   = 'Good Shortlisting Chance';
    summary = 'Solid match. Add a few missing keywords and more quantified achievements to push into the top shortlist.';
  } else if (prob >= 35) {
    label   = 'Moderate Shortlisting Chance';
    summary = 'Meaningful gaps exist. Tailor your summary specifically for this role and address missing skills.';
  } else {
    label   = 'Low Shortlisting Chance';
    summary = 'CV needs significant tailoring. Address missing keywords, add measurable achievements, and consider upskilling.';
  }

  const techSkills = getTechSkills();
  const jdSkills   = techSkills.filter(s => jdLower.includes(s)).slice(0, 3);
  const questions  = [
    ...jdSkills.map(s => `Can you walk us through a project where you used ${s} and the impact it had?`),
    'Tell me about a time you had to deliver under tight deadlines. How did you prioritise?',
    'Describe a situation where you had to adapt quickly to a significant change at work.',
    'Give an example of a time you identified and solved a complex technical problem.',
    'How have you handled disagreements with a colleague or manager?',
    'Tell me about your most impactful professional achievement and how you measured it.',
    'Why are you interested in this specific role and company?',
    'Where do you see yourself in 3–5 years and how does this role fit?',
  ].slice(0, 8);

  return { shortlist_probability: prob, probability_label: label, summary, questions };
}

// ============================================================
// MODULE 11: ATS BOOST TIPS
// ============================================================

function generateATSBoostTips(cvLower, jdLower, keywords) {
  const tips = [];

  if (keywords.missing.length > 0) {
    const top = keywords.missing.slice(0, 5).join(', ');
    tips.push({
      priority: 'HIGH', icon: '🔑',
      title: 'Inject Missing Keywords',
      detail: `Add these exact terms from the job description into your CV naturally: ${top}.`,
      impact: '+15–25% ATS score',
    });
  }

  if (!/summary|profile|objective|about/i.test(cvLower)) {
    tips.push({
      priority: 'HIGH', icon: '📝',
      title: 'Add a Keyword-Rich Professional Summary',
      detail: 'Place a 3–4 sentence summary at the top of your CV packed with role-specific keywords. ATS systems weight the summary section very heavily.',
      impact: '+10–20% ATS score',
    });
  }

  if (!/\d+%|\d+x|\$[\d,]+/i.test(cvLower)) {
    tips.push({
      priority: 'HIGH', icon: '📊',
      title: 'Quantify Every Achievement',
      detail: 'Replace vague statements with numbers. "Managed a team" becomes "Managed a team of 12, delivering 3 projects ahead of schedule." Numbers signal credibility to both ATS and humans.',
      impact: '+8–12% interview shortlist rate',
    });
  }

  tips.push({
    priority: 'MEDIUM', icon: '📄',
    title: 'Save CV as a Simple .docx or ATS-Friendly PDF',
    detail: 'Avoid tables, columns, text boxes, and headers/footers — these break ATS parsing. Use a single-column layout with standard section headings.',
    impact: 'Prevents 100% ATS rejection',
  });

  tips.push({
    priority: 'MEDIUM', icon: '🏷️',
    title: 'Use Standard Section Headings',
    detail: 'ATS systems scan for exact labels. Use: Work Experience, Education, Skills, Certifications. Avoid creative names like "My Journey" or "Where I\'ve Been".',
    impact: 'Ensures correct ATS parsing',
  });

  if (!cvLower.includes('skills')) {
    tips.push({
      priority: 'HIGH', icon: '⚡',
      title: 'Add a Dedicated Skills Section',
      detail: 'Create a clear Skills section listing all relevant technical and soft skills. This is the #1 section ATS robots scan for keyword density.',
      impact: '+20% keyword match rate',
    });
  }

  const jdKwCount = Object.keys(extractKeywords(jdLower)).length;
  if (jdKwCount > 0 && keywords.present.length / jdKwCount < 0.5) {
    tips.push({
      priority: 'HIGH', icon: '🎯',
      title: 'Mirror the Job Description Language Exactly',
      detail: 'Copy exact phrases from the job posting. If the JD says "stakeholder management", do not write "managing stakeholders" — ATS matches exact strings.',
      impact: 'Direct ATS score improvement',
    });
  }

  const strongVerbs = ['achieved','delivered','built','launched','led','drove','increased','reduced','managed','designed','engineered','spearheaded','optimized'];
  if (strongVerbs.filter(v => cvLower.includes(v)).length < 4) {
    tips.push({
      priority: 'MEDIUM', icon: '💪',
      title: 'Start Every Bullet With a Power Verb',
      detail: 'Begin each achievement with an impactful verb: Engineered, Spearheaded, Transformed, Delivered, Orchestrated, Reduced, Generated. This signals initiative to both ATS and readers.',
      impact: 'Stronger recruiter impression',
    });
  }

  if (!cvLower.includes('linkedin')) {
    tips.push({
      priority: 'MEDIUM', icon: '🔗',
      title: 'Add Your LinkedIn URL',
      detail: 'Include a custom LinkedIn URL in your CV header. Recruiters verify LinkedIn profiles 87% of the time after shortlisting a CV.',
      impact: 'Increases recruiter trust',
    });
  }

  if (!/certif|certified|credential/i.test(cvLower) && /certif|certified/i.test(jdLower)) {
    tips.push({
      priority: 'HIGH', icon: '🏆',
      title: 'Earn and List Relevant Certifications',
      detail: 'The job description references certifications. Earn the specific cert the employer mentions (AWS, PMP, Google Analytics). Even "In Progress" certifications are worth listing.',
      impact: '+15% recruiter confidence',
    });
  }

  return tips.slice(0, 8);
}

// ============================================================
// MODULE 12: POWER SCORE
// ============================================================

function calculatePowerScore(cvText) {
  const cvLower = cvText.toLowerCase();
  const powerVerbs = [
    'achieved','accelerated','architected','automated','built','championed',
    'consolidated','created','delivered','deployed','designed','developed',
    'directed','drove','eliminated','engineered','established','executed',
    'expanded','generated','grew','implemented','improved','increased',
    'innovated','launched','led','managed','mentored','negotiated',
    'optimized','orchestrated','overhauled','pioneered','produced',
    'reduced','refactored','restructured','scaled','secured','simplified',
    'solved','spearheaded','streamlined','transformed','tripled','won',
  ];
  const clichePhrases = [
    'responsible for','duties included','helped with','worked on',
    'assisted in','team player','hard worker','go-getter','detail oriented',
    'think outside','synergy','passionate about','dynamic professional',
  ];

  const foundPower   = powerVerbs.filter(v => cvLower.includes(v));
  const foundCliches = clichePhrases.filter(c => cvLower.includes(c));
  const metricsCount = (cvText.match(/\d+[%x]?|\$[\d,]+/gi) || []).length;

  const rawScore    = Math.min(100, Math.round((foundPower.length / 12) * 60 + (metricsCount / 8) * 40));
  const finalScore  = Math.max(0, Math.min(100, rawScore - foundCliches.length * 5));
  const level       = finalScore >= 80 ? 'Elite' : finalScore >= 60 ? 'Strong' : finalScore >= 40 ? 'Average' : 'Weak';

  return {
    score:               finalScore,
    level,
    power_verbs_found:   foundPower.slice(0, 10),
    cliches_found:       foundCliches,
    metrics_count:       metricsCount,
    power_verbs_missing: powerVerbs.filter(v => !cvLower.includes(v)).slice(0, 8),
  };
}

// ============================================================
// MODULE 13: CAREER LEVEL DETECTION
// ============================================================

function detectCareerLevel(cvLower) {
  if (['ceo','cto','coo','cfo','chief','president','founder','co-founder','executive director'].some(s => cvLower.includes(s))) return 'Executive';
  if (['director','vice president','vp ','head of','general manager'].some(s => cvLower.includes(s)))                           return 'Director';
  if (['lead','principal','staff engineer','senior manager','team lead','engineering manager'].some(s => cvLower.includes(s)))   return 'Lead';
  if (['senior','sr.','sr ','7 years','8 years','9 years','10 years','11 years','12 years'].some(s => cvLower.includes(s)))      return 'Senior';
  if (['3 years','4 years','5 years','6 years','mid-level','mid level'].some(s => cvLower.includes(s)))                          return 'Mid-Level';
  if (['junior','jr.','jr ','entry level','graduate','intern','fresh'].some(s => cvLower.includes(s)))                           return 'Junior';
  return 'Mid-Level';
}

// ============================================================
// MODULE 14: SALARY INSIGHTS
// ============================================================

function estimateSalaryRange(cvLower, jdLower) {
  const level = detectCareerLevel(cvLower);
  const baseRanges = {
    'Executive': [150000, 260000], 'Director': [110000, 180000],
    'Lead':      [95000,  145000], 'Senior':   [75000,  125000],
    'Mid-Level': [50000,  80000],  'Junior':   [32000,  52000],
  };
  const highValueSkills = ['aws','kubernetes','machine learning','tensorflow','react',
    'node.js','python','typescript','azure','gcp','docker','golang','rust',
    'blockchain','llm','openai','data science','cybersecurity','salesforce'];

  const cvHV = highValueSkills.filter(s => cvLower.includes(s)).length;
  const jdHV = highValueSkills.filter(s => jdLower.includes(s)).length;
  const range = baseRanges[level] || [45000, 70000];
  const adj   = Math.min(cvHV, jdHV) * 4000;

  return {
    level,
    min_usd: range[0] + adj,
    max_usd: range[1] + adj,
    note: 'Estimated based on detected skills and career level. Varies by location, industry, and company size.',
    negotiation_tip: cvHV >= 3
      ? 'Your high-demand tech stack gives you strong negotiation leverage — aim for the top of the range.'
      : 'Upskilling in high-demand technologies (AWS, Python, React) can add $10–20K to your salary ceiling.',
  };
}

// ============================================================
// MODULE 15: LINKEDIN HEADLINE GENERATOR
// ============================================================

function generateLinkedInHeadline(cvText, jobDescription) {
  const cvLower = cvText.toLowerCase();
  const jdLower = jobDescription.toLowerCase();
  const level   = detectCareerLevel(cvLower);
  const domain  = detectDomain(cvLower, jdLower);
  const matched = getTechSkills().filter(s => cvLower.includes(s) && jdLower.includes(s)).slice(0, 3)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1));
  const skillStr  = matched.join(' | ');
  const jdTitle   = extractJobTitle(jobDescription.trim().split('\n')[0]) || 'Professional';

  return {
    primary:     `${level} ${jdTitle} | ${domain}${skillStr ? ' | ' + skillStr : ''}`.slice(0, 220),
    alternative: `${jdTitle} | Specialising in ${domain}${skillStr ? ' | ' + skillStr : ''}`.slice(0, 220),
    tip: 'Keep your headline under 220 characters. Use | separators for role, speciality, and top skills. Recruiters use keywords here to filter candidates on LinkedIn.',
  };
}

// ============================================================
// MODULE 16: TAILORING CHECKLIST
// ============================================================

function generateTailoringChecklist(cvLower, jdLower, keywords, redFlags) {
  const items = [];
  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };

  if (keywords.missing.length >= 5) {
    items.push({ priority: 'HIGH', icon: '🔑',
      task: `Add ${Math.min(8, keywords.missing.length)} missing keywords to your CV`,
      detail: `Focus on: ${keywords.missing.slice(0, 5).join(', ')}` });
  }
  if (!/summary|profile|objective/i.test(cvLower)) {
    items.push({ priority: 'HIGH', icon: '📝',
      task: 'Write a tailored professional summary',
      detail: 'Use the AI-generated summary from this report — paste it at the top of your CV.' });
  }
  if (!/\d+%|\d+x|\$[\d,]+/i.test(cvLower)) {
    items.push({ priority: 'HIGH', icon: '📊',
      task: 'Add quantified achievements to every job role',
      detail: 'Aim for 2–3 metrics per role: %, £/$, headcount, time saved, revenue impact.' });
  }
  (redFlags || []).filter(f => f.severity === 'HIGH').forEach(f => {
    items.push({ priority: 'HIGH', icon: '🚨', task: 'Fix red flag', detail: f.description });
  });
  if (!cvLower.includes('linkedin')) {
    items.push({ priority: 'MEDIUM', icon: '🔗',
      task: 'Add LinkedIn URL to your CV header',
      detail: 'Format: linkedin.com/in/yourname. Customise your URL in LinkedIn settings first.' });
  }
  if (!cvLower.includes('skills')) {
    items.push({ priority: 'MEDIUM', icon: '⚡',
      task: 'Add a dedicated Skills section',
      detail: 'List all technical tools, platforms, and methodologies. Mirror the JD language.' });
  }
  const missingTech = getTechSkills().filter(s => jdLower.includes(s) && !cvLower.includes(s));
  if (missingTech.length > 0) {
    items.push({ priority: 'MEDIUM', icon: '💻',
      task: 'Update Skills section with required technologies',
      detail: `Add where applicable: ${missingTech.slice(0, 5).join(', ')}` });
  }
  items.push({ priority: 'LOW', icon: '✏️',
    task: 'Replace weak verbs with power verbs throughout',
    detail: 'Use the rewritten bullet points in this report as a style guide for all your roles.' });
  items.push({ priority: 'LOW', icon: '🎨',
    task: 'Ensure consistent formatting throughout',
    detail: 'One font family, consistent date formats (Month YYYY), uniform bullet style.' });
  items.push({ priority: 'LOW', icon: '👀',
    task: 'Proofread with Grammarly or Hemingway App',
    detail: 'Typos and grammar errors lose interviews. Both tools have free tiers.' });

  return items.sort((a, b) => order[a.priority] - order[b.priority]);
}

// ============================================================
// MODULE 17: SCORE PROVISIONS (10 actions when ATS < 70)
// ============================================================

function generateScoreProvisions(atsScore, cvLower, jdLower, keywords) {
  if (atsScore >= 70) return [];

  const gap       = 70 - atsScore;
  const provisions = [];

  // 1 — Inject top missing keywords
  const top5 = (keywords.missing || []).slice(0, 5);
  provisions.push({
    number: 1,
    effort: 'Quick Win — 5 min',
    title: 'Inject the Top Missing Keywords',
    action: top5.length
      ? `Add these exact terms to your Skills section and Summary: ${top5.join(', ')}.`
      : 'Mirror the exact language used in the job description throughout your CV.',
    example: top5.length ? `Skills section: "${top5.slice(0,3).join(' | ')}"` : 'Copy exact role-specific phrases from the JD.',
    impact: `+${Math.min(20, top5.length * 4)}% ATS score`,
  });

  // 2 — Professional summary
  if (!/summary|profile|objective|about/i.test(cvLower)) {
    provisions.push({
      number: 2,
      effort: 'Quick Win — 2 min',
      title: 'Add a Professional Summary at the Top',
      action: 'Copy the AI-generated summary from this report and paste it directly below your contact details as the very first section.',
      example: 'Section heading: "Professional Summary" — 3–4 sentences, keyword-dense.',
      impact: '+10–15% ATS score',
    });
  }

  // 3 — Quantify achievements
  if (!/\d+%|\d+x|\$[\d,]+/i.test(cvLower)) {
    provisions.push({
      number: provisions.length + 1,
      effort: 'Medium — 30 min',
      title: 'Add Quantified Achievements to Every Role',
      action: 'Attach a number to every accomplishment. Use %, headcount, revenue, time saved, or error rates.',
      example: '"Managed marketing campaigns" → "Managed 12 campaigns/year, generating £85K revenue"',
      impact: '+8% interview shortlist rate',
    });
  }

  // 4 — Skills section
  if (!cvLower.includes('skills')) {
    provisions.push({
      number: provisions.length + 1,
      effort: 'Quick Win — 10 min',
      title: 'Create a Dedicated Skills Section',
      action: 'Add a "Core Skills" or "Technical Skills" section listing 10–15 relevant skills. ATS robots scan this section first.',
      example: 'Core Skills: Python | AWS | Agile | SQL | REST APIs | Docker | Leadership',
      impact: '+15–20% keyword match rate',
    });
  }

  // 5 — Mirror JD language exactly
  const jdPhrases = Object.keys(extractKeywords(jdLower))
    .filter(k => k.includes(' ') && k.length > 8).slice(0, 3);
  provisions.push({
    number: provisions.length + 1,
    effort: 'Quick Win — 15 min',
    title: 'Mirror Exact Job Description Phrases',
    action: 'ATS systems match exact strings. Copy multi-word phrases from the JD directly into your CV.',
    example: jdPhrases.length ? `Add to your CV verbatim: "${jdPhrases.join('", "')}"` : 'Copy key responsibility phrases word-for-word from the JD.',
    impact: '+5–10% per phrase matched',
  });

  // 6 — Standard section headings
  provisions.push({
    number: provisions.length + 1,
    effort: 'Quick Win — 5 min',
    title: 'Use Standard ATS Section Headings',
    action: 'Rename creative headings to ATS-standard names: "Work Experience", "Education", "Skills", "Certifications".',
    example: '"My Story" → "Work Experience" | "What I Know" → "Skills"',
    impact: 'Prevents ATS misclassification',
  });

  // 7 — Certifications
  if (!/certif|certified|credential/i.test(cvLower) && /certif|certified/i.test(jdLower)) {
    provisions.push({
      number: provisions.length + 1,
      effort: 'Long-Term — 2–8 weeks',
      title: 'Earn and List Required Certifications',
      action: 'The JD explicitly requires certifications. Enrol in the relevant cert programme and list it as "In Progress" immediately.',
      example: 'Certifications: AWS Cloud Practitioner (In Progress, expected June 2025)',
      impact: '+15% recruiter confidence',
    });
  }

  // 8 — Remove weak language
  const weakFound = ['responsible for','duties included','helped with','worked on','assisted in']
    .filter(w => cvLower.includes(w));
  if (weakFound.length) {
    provisions.push({
      number: provisions.length + 1,
      effort: 'Medium — 20 min',
      title: `Replace ${weakFound.length} Weak Phrases With Action Verbs`,
      action: `Remove passive language. Replace every instance of: ${weakFound.join(', ')}.`,
      example: '"Responsible for developing the API" → "Engineered a REST API serving 50K daily requests"',
      impact: 'Stronger ATS verb scoring',
    });
  }

  // 9 — LinkedIn
  if (!cvLower.includes('linkedin')) {
    provisions.push({
      number: provisions.length + 1,
      effort: 'Quick Win — 2 min',
      title: 'Add Your LinkedIn URL to the CV Header',
      action: 'Add a customised LinkedIn URL in your contact header. Ensures recruiters can verify your profile instantly.',
      example: 'Header: linkedin.com/in/yourname | yourname@email.com | +44 7xxx xxxxxx',
      impact: 'Boosts recruiter trust & verification',
    });
  }

  // 10 — Tailor every bullet to the role
  provisions.push({
    number: provisions.length + 1,
    effort: 'Medium — 1 hour',
    title: 'Rewrite Every Bullet to Speak the Role\'s Language',
    action: `Your CV needs ${gap} more points to reach the 70% ATS threshold. The fastest path is rewriting each bullet point to include job-specific terminology and measurable outcomes. Use the rewritten bullets in this report as your guide.`,
    example: 'Use the "Rewritten Bullet Points" section of this report as a direct template.',
    impact: `+${Math.min(gap, 25)}% ATS score — reaches the 70% threshold`,
  });

  // Ensure exactly 10 provisions
  while (provisions.length < 10) {
    const fillers = [
      {
        title: 'Save Your CV as a Clean Single-Column PDF',
        action: 'Avoid multi-column layouts, tables, or text boxes. ATS parsers read left-to-right, top-to-bottom only.',
        example: 'Use Google Docs, Word, or a clean LaTeX template. Export as PDF.',
        impact: 'Prevents ATS parsing failure',
        effort: 'Quick Win — 10 min',
      },
      {
        title: 'Add Relevant Projects or Portfolio Links',
        action: 'Link to GitHub, a portfolio, or case studies that demonstrate skills the JD requires.',
        example: 'Projects: github.com/yourname/project-name — built with Python & AWS Lambda',
        impact: 'Differentiates you from same-score candidates',
        effort: 'Medium — 15 min',
      },
      {
        title: 'Use Keywords in Your Job Titles Where Accurate',
        action: 'If your actual job title is vague (e.g., "Associate"), add the functional role in brackets: "Associate (Full-Stack Developer)".',
        example: '"Tech Associate" → "Tech Associate (Full-Stack Developer, React/Node.js)"',
        impact: '+5–8% title keyword match',
        effort: 'Quick Win — 5 min',
      },
    ];
    const filler = fillers[provisions.length % fillers.length];
    provisions.push({ number: provisions.length + 1, effort: filler.effort, ...filler });
  }

  return provisions.slice(0, 10).map((p, i) => ({ ...p, number: i + 1 }));
}

// ============================================================
// MODULE 18: CV REWRITER (for PDF Part 1)
// ============================================================

function rewriteCVContent(cvText, jobDescription) {
  const cvLower = cvText.toLowerCase();
  const jdLower = jobDescription.toLowerCase();
  const jdKws   = Object.keys(extractKeywords(jdLower)).slice(0, 60);
  const allSkills = [...getTechSkills(), ...getSoftSkills()];
  const jdSkills  = allSkills.filter(s => jdLower.includes(s));

  // ── Candidate name (first short non-email line) ──
  const name = extractCandidateName(cvText);

  // ── Target role from JD ──
  const targetRole = extractJobTitle(jobDescription.trim().split('\n')[0]) || 'Professional';

  // ── AI-tailored professional summary ──
  const summary = generateProfessionalSummary(cvText, jobDescription);

  // ── Skills matched to JD ──
  const matchedSkills = [...getTechSkills(), ...getSoftSkills()]
    .filter(s => cvLower.includes(s) && jdLower.includes(s))
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .slice(0, 16);

  // ── Parse and score each line ──
  const lines = cvText.split('\n').map(l => l.trim()).filter(Boolean);
  const keptBullets = [];
  let omittedCount  = 0;
  const weakTriggers = ['responsible for','helped with','worked on','assisted in','participated in','duties included'];

  lines.forEach(line => {
    if (line.length < 15 || line.length > 350) return;

    const ll      = line.toLowerCase();
    const kwHits  = jdKws.filter(k => ll.includes(k)).length;
    const skHits  = jdSkills.filter(s => ll.includes(s)).length;
    const hasMetric = /\d+[%x]?|\$[\d,]+|\d+\s*(years?|months?|team|users?|clients?)/i.test(line);
    const isStructure = /\b(20[0-9]{2}|present|current|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(line)
      || line.length < 55;

    const relevance = kwHits + skHits * 2 + (hasMetric ? 2 : 0);

    if (relevance > 0 || isStructure) {
      const isWeak  = weakTriggers.some(w => ll.includes(w));
      const improved = isWeak ? rewriteSingleBullet(line) : null;
      keptBullets.push({
        text:    improved || line,
        status:  improved ? 'rewritten' : 'kept',
        relevance,
      });
    } else {
      omittedCount++;
    }
  });

  // Sort by relevance DESC, keep structural lines in order
  const finalBullets = keptBullets.slice(0, 22);

  // ── Education lines ──
  const eduLines = extractEducationLines(cvText);

  return { name, targetRole, summary, matchedSkills, bullets: finalBullets, omittedCount, educationLines: eduLines };
}

function extractCandidateName(cvText) {
  const lines = cvText.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 6)) {
    if (line.length >= 4 && line.length <= 50 && !/[@\d:\/\\|]/.test(line)) {
      const words = line.split(/\s+/);
      if (words.length >= 1 && words.length <= 5) return line;
    }
  }
  return 'Candidate';
}

function extractEducationLines(cvText) {
  const lines   = cvText.split('\n').map(l => l.trim()).filter(Boolean);
  const eduStart = /^(education|academic|qualif)/i;
  const secEnd   = /^(work|experience|employ|skill|certif|project|award|reference)/i;
  const result   = [];
  let inEdu      = false;

  for (const line of lines) {
    if (eduStart.test(line))  { inEdu = true;  continue; }
    if (inEdu && secEnd.test(line)) break;
    if (inEdu && line.length > 5) result.push(line);
  }
  return result.slice(0, 6);
}

function rewriteSingleBullet(line) {
  const verbs    = ['Delivered','Engineered','Spearheaded','Optimised','Drove','Built','Launched','Reduced','Generated','Transformed'];
  const suffixes = [', resulting in a measurable improvement in team output.',
    ', reducing turnaround time by approximately 25%.',', saving significant time and operational costs.',
    ', directly contributing to improved business outcomes.'];
  const verb     = verbs[Math.floor(Math.random() * verbs.length)];
  const triggers = ['responsible for','helped with','worked on','assisted in','participated in','duties included'];
  const trigger  = triggers.find(t => line.toLowerCase().includes(t)) || 'responsible for';
  const idx      = line.toLowerCase().indexOf(trigger);
  let core       = line.slice(idx + trigger.length).replace(/^[,;: ]+/, '').trim();
  core           = core.charAt(0).toLowerCase() + core.slice(1).replace(/\.$/, '');
  if (!/\d+[%x]?|\$[\d,]+/i.test(core)) {
    core += suffixes[Math.floor(Math.random() * suffixes.length)];
  }
  return `${verb} ${core}`;
}
