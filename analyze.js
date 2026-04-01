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
async function analyzeWithAI(cvText, jobDescription) {
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
  return {
    ats_score:            calculateATSScore(cvLower, jdLower),
    job_match:            calculateJobMatch(cvLower, jdLower),
    ...analyzeStrengthsAndGaps(cvLower, jdLower),
    keywords:             analyzeKeywords(cvLower, jdLower),
    bullet_points:        improveBulletPoints(cvText),
    skills_gap:           analyzeSkillsGap(cvLower, jdLower),
    cv_feedback:          generateCVFeedback(cvText, cvLower),
    red_flags:            detectRedFlags(cvText, cvLower),
    professional_summary: generateProfessionalSummary(cvText, jobDescription),
    interview_insights:   generateInterviewInsights(cvLower, jdLower),
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

function improveBulletPoints(cvText) {
  const weakPatterns = [
    'responsible for','helped with','worked on','assisted in',
    'was involved in','duties included','tasks included',
    'helped to','tried to','participated in','contributed to',
  ];

  const actionVerbs = [
    'Delivered','Spearheaded','Orchestrated','Optimized','Engineered',
    'Designed','Built','Launched','Drove','Accelerated','Streamlined',
    'Transformed','Implemented','Executed','Achieved','Generated',
    'Elevated','Championed','Led','Reduced',
  ];

  const suffixes = [
    ', reducing manual effort by 30%.',
    ', resulting in measurable team efficiency gains.',
    ', improving delivery speed by 25%.',
    ', saving significant time and resources.',
    ' — contributing to a 20% improvement in output quality.',
  ];

  const lines = cvText.split(/\n+/).map(l => l.trim()).filter(l => l.length >= 20 && l.length <= 300);
  const improvements = [];

  for (const line of lines) {
    const lineLower = line.toLowerCase();
    const weak = weakPatterns.find(p => lineLower.includes(p));
    if (!weak) continue;

    const verb    = actionVerbs[Math.floor(Math.random() * actionVerbs.length)];
    const coreIdx = lineLower.indexOf(weak);
    let core      = line.slice(coreIdx + weak.length).replace(/^[,;: ]+/, '');
    core          = core.charAt(0).toUpperCase() + core.slice(1);

    if (!/\d+[%x]?|\$[\d,]+/i.test(core)) {
      core = core.replace(/\.$/, '') + suffixes[Math.floor(Math.random() * suffixes.length)];
    }

    improvements.push({ original: line, improved: `${verb} ${core}` });
    if (improvements.length >= 6) break;
  }

  if (!improvements.length) {
    return [
      {
        original: 'Responsible for managing the project team and deliverables.',
        improved: 'Led a cross-functional team of 8 to deliver project milestones 15% ahead of schedule.',
      },
      {
        original: 'Helped with the development of the company website.',
        improved: 'Engineered core website features that improved user engagement by 40% within 3 months.',
      },
      {
        original: 'Worked on improving customer satisfaction scores.',
        improved: 'Drove customer satisfaction from 72% to 91% by implementing a structured feedback and resolution process.',
      },
      {
        original: 'Assisted in the data analysis and reporting process.',
        improved: 'Automated weekly data analysis pipeline, reducing reporting time from 8 hours to 45 minutes.',
      },
    ];
  }

  return improvements;
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
