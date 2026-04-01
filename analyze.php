<?php
/**
 * ============================================================
 * KING CV CHECKER — Analysis Engine (analyze.php)
 * Handles: file upload, text extraction, CV analysis, JSON response
 * ============================================================
 */

// ============================================================
// BOOTSTRAP
// ============================================================

// Output JSON only — suppress PHP errors from leaking into response
ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');

// Allow cross-origin requests if needed (remove in production if same-origin)
// header('Access-Control-Allow-Origin: *');

// ============================================================
// CONSTANTS
// ============================================================

define('MAX_FILE_BYTES', 5 * 1024 * 1024);  // 5 MB
define('ALLOWED_EXTENSIONS', ['pdf', 'docx', 'txt']);

// ============================================================
// ENTRY POINT
// ============================================================

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonError('Method not allowed.', 405);
    }

    // ---- Validate job description ----
    $jobDescription = trim($_POST['job_description'] ?? '');
    if (strlen($jobDescription) < 50) {
        jsonError('Job description is too short. Please paste the full description.');
    }

    // ---- Validate file upload ----
    if (!isset($_FILES['cv_file']) || $_FILES['cv_file']['error'] !== UPLOAD_ERR_OK) {
        $uploadErrors = [
            UPLOAD_ERR_INI_SIZE   => 'File exceeds server upload limit.',
            UPLOAD_ERR_FORM_SIZE  => 'File exceeds form upload limit.',
            UPLOAD_ERR_PARTIAL    => 'File was only partially uploaded.',
            UPLOAD_ERR_NO_FILE    => 'No file was uploaded.',
            UPLOAD_ERR_NO_TMP_DIR => 'Server temp directory missing.',
            UPLOAD_ERR_CANT_WRITE => 'Could not write file to disk.',
        ];
        $errorCode = $_FILES['cv_file']['error'] ?? UPLOAD_ERR_NO_FILE;
        jsonError($uploadErrors[$errorCode] ?? 'File upload failed.');
    }

    $file    = $_FILES['cv_file'];
    $ext     = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

    if (!in_array($ext, ALLOWED_EXTENSIONS)) {
        jsonError('Invalid file type. Only PDF, DOCX, and TXT files are accepted.');
    }

    if ($file['size'] > MAX_FILE_BYTES) {
        jsonError('File exceeds the 5 MB size limit.');
    }

    // Ensure it's a real uploaded file (security)
    if (!is_uploaded_file($file['tmp_name'])) {
        jsonError('Invalid file upload attempt.');
    }

    // ---- Extract text from CV ----
    $cvText = extractText($file['tmp_name'], $ext);

    if (mb_strlen(trim($cvText)) < 80) {
        jsonError(
            'Could not extract readable text from your CV. ' .
            'Try saving as TXT or DOCX for best results.'
        );
    }

    // ---- Run full analysis ----
    $analysis = analyzeCV($cvText, $jobDescription);

    echo json_encode(['success' => true, 'data' => $analysis], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    jsonError('An unexpected server error occurred. Please try again.');
}

exit;

// ============================================================
// RESPONSE HELPERS
// ============================================================

function jsonError(string $message, int $statusCode = 400): void
{
    http_response_code($statusCode);
    echo json_encode(['success' => false, 'message' => $message]);
    exit;
}

// ============================================================
// TEXT EXTRACTION
// ============================================================

/**
 * Route extraction to the appropriate handler based on file extension.
 */
function extractText(string $filepath, string $ext): string
{
    switch ($ext) {
        case 'pdf':  return extractFromPDF($filepath);
        case 'docx': return extractFromDOCX($filepath);
        case 'txt':  return file_get_contents($filepath) ?: '';
        default:     return '';
    }
}

/**
 * Extract readable text from a PDF binary.
 * Uses BT/ET block parsing and compressed stream decoding.
 */
function extractFromPDF(string $filepath): string
{
    $raw = file_get_contents($filepath);
    if (!$raw) return '';

    $text = '';

    // ---- Method 1: Parse BT (BeginText) ... ET (EndText) blocks ----
    preg_match_all('/BT(.*?)ET/s', $raw, $btBlocks);
    foreach ($btBlocks[1] as $block) {
        // Tj operator: (text) Tj
        preg_match_all('/\(([^)\\\\]*(?:\\\\.[^)\\\\]*)*)\)\s*Tj/s', $block, $tjMatches);
        foreach ($tjMatches[1] as $t) {
            $text .= pdfDecodeString($t) . ' ';
        }

        // TJ operator: [(text)-offset(text)] TJ
        preg_match_all('/\[(.*?)\]\s*TJ/s', $block, $tjArrMatches);
        foreach ($tjArrMatches[1] as $chunk) {
            preg_match_all('/\(([^)\\\\]*(?:\\\\.[^)\\\\]*)*)\)/s', $chunk, $parts);
            foreach ($parts[1] as $p) {
                $text .= pdfDecodeString($p) . ' ';
            }
        }
    }

    // ---- Method 2: Decompress FlateDecode (zlib) streams ----
    if (mb_strlen(trim($text)) < 100) {
        preg_match_all('/stream\r?\n(.*?)\r?\nendstream/s', $raw, $streamMatches);
        foreach ($streamMatches[1] as $stream) {
            $decoded = @gzuncompress($stream);
            if ($decoded === false) $decoded = @gzinflate(substr($stream, 2));
            if ($decoded !== false) {
                preg_match_all('/\(([^)]{2,100})\)/s', $decoded, $textParts);
                foreach ($textParts[1] as $part) {
                    if (preg_match('/[a-zA-Z]{3,}/', $part)) {
                        $text .= $part . ' ';
                    }
                }
            }
        }
    }

    // ---- Method 3: Fallback — grab printable strings ----
    if (mb_strlen(trim($text)) < 100) {
        preg_match_all('/\(([^)]{3,120})\)/s', $raw, $fallback);
        foreach ($fallback[1] as $f) {
            if (preg_match('/[a-zA-Z]{4,}/', $f)) {
                $text .= $f . ' ';
            }
        }
    }

    // Clean non-printable characters
    $text = preg_replace('/[^\x20-\x7E\n\r\t]/', ' ', $text);
    $text = preg_replace('/\s{2,}/', ' ', $text);

    return trim($text);
}

/**
 * Decode PDF escape sequences in a string literal.
 */
function pdfDecodeString(string $s): string
{
    $s = str_replace(['\\n', '\\r', '\\t'], ["\n", "\r", "\t"], $s);
    $s = str_replace(['\\\\', '\\(', '\\)'], ['\\', '(', ')'], $s);
    return $s;
}

/**
 * Extract readable text from a DOCX file (ZIP → word/document.xml).
 */
function extractFromDOCX(string $filepath): string
{
    if (!class_exists('ZipArchive')) {
        return ''; // ZipArchive not available on this server
    }

    $zip = new ZipArchive();
    if ($zip->open($filepath) !== true) return '';

    $xml = $zip->getFromName('word/document.xml');
    $zip->close();

    if (!$xml) return '';

    // Preserve paragraph breaks
    $xml = preg_replace('/<w:p[\s>]/', "\n", $xml);
    $xml = preg_replace('/<w:br[^>]*\/>/', "\n", $xml);

    // Strip all XML tags
    $xml = strip_tags($xml);

    // Decode HTML entities
    $xml = html_entity_decode($xml, ENT_QUOTES | ENT_HTML5, 'UTF-8');

    // Normalize whitespace
    $xml = preg_replace('/[ \t]+/', ' ', $xml);
    $xml = preg_replace('/\n{3,}/', "\n\n", $xml);

    return trim($xml);
}

// ============================================================
// ANALYSIS ORCHESTRATOR
// ============================================================

/**
 * Run the full CV analysis and return a structured result array.
 *
 * NOTE: analyzeWithAI() is a placeholder for future GPT/Claude integration.
 * All analysis below is rule-based but structured to be AI-ready.
 */
function analyzeCV(string $cvText, string $jobDescription): array
{
    $cvLower = mb_strtolower($cvText);
    $jdLower = mb_strtolower($jobDescription);

    // Optionally run AI analysis (returns null if not configured)
    $aiResult = analyzeWithAI($cvText, $jobDescription);
    // If $aiResult is not null, merge it with the rule-based output below

    // Run all analysis modules
    $atsScore          = calculateATSScore($cvLower, $jdLower);
    $jobMatch          = calculateJobMatch($cvLower, $jdLower);
    $keywords          = analyzeKeywords($cvLower, $jdLower);
    $strengthsGaps     = analyzeStrengthsAndGaps($cvLower, $jdLower);
    $bulletPoints      = improveBulletPoints($cvText);
    $skillsGap         = analyzeSkillsGap($cvLower, $jdLower);
    $cvFeedback        = generateCVFeedback($cvText, $cvLower);
    $redFlags          = detectRedFlags($cvText, $cvLower);
    $professionalSummary = generateProfessionalSummary($cvText, $jobDescription);
    $interviewInsights = generateInterviewInsights($cvLower, $jdLower, $atsScore['score'], $jobMatch['overall']);

    return [
        'ats_score'            => $atsScore,
        'job_match'            => $jobMatch,
        'strengths'            => $strengthsGaps['strengths'],
        'gaps'                 => $strengthsGaps['gaps'],
        'keywords'             => $keywords,
        'bullet_points'        => $bulletPoints,
        'skills_gap'           => $skillsGap,
        'cv_feedback'          => $cvFeedback,
        'red_flags'            => $redFlags,
        'professional_summary' => $professionalSummary,
        'interview_insights'   => $interviewInsights,
    ];
}

// ============================================================
// AI INTEGRATION PLACEHOLDER
// ============================================================

/**
 * Future AI integration hook.
 *
 * To connect OpenAI GPT:
 *   require 'vendor/autoload.php';
 *   $client = OpenAI::client(getenv('OPENAI_API_KEY'));
 *   $response = $client->chat()->create([...]);
 *
 * To connect Claude (Anthropic):
 *   Use Guzzle HTTP client to POST to https://api.anthropic.com/v1/messages
 *   with headers: x-api-key, anthropic-version
 *
 * @return array|null  Structured analysis array, or null to use rule-based fallback.
 */
function analyzeWithAI(string $cvText, string $jobDescription): ?array
{
    // ---- OpenAI Example (uncomment and configure to activate) ----
    /*
    $apiKey = getenv('OPENAI_API_KEY');
    if (!$apiKey) return null;

    $prompt = <<<PROMPT
    You are an expert CV analyst and career coach. Analyze the following CV against the job description.
    Return a JSON object with keys: ats_score (object with score int), job_match (object with overall, skills, experience, education, industry ints),
    strengths (array of strings), gaps (array of strings), keywords (object with missing, present, suggested arrays),
    bullet_points (array of {original, improved}), skills_gap (array of {skill, priority, description, resource}),
    cv_feedback (array of {text, positive bool}), red_flags (array of {severity, description}),
    professional_summary (string), interview_insights (object with shortlist_probability, probability_label, summary, questions array).

    CV:
    $cvText

    Job Description:
    $jobDescription
    PROMPT;

    $ch = curl_init('https://api.openai.com/v1/chat/completions');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json', "Authorization: Bearer $apiKey"],
        CURLOPT_POSTFIELDS     => json_encode([
            'model'    => 'gpt-4o',
            'messages' => [['role' => 'user', 'content' => $prompt]],
            'response_format' => ['type' => 'json_object'],
        ]),
    ]);
    $result = curl_exec($ch);
    curl_close($ch);

    $decoded = json_decode($result, true);
    $content = $decoded['choices'][0]['message']['content'] ?? null;
    return $content ? json_decode($content, true) : null;
    */

    // ---- Claude (Anthropic) Example (uncomment and configure to activate) ----
    /*
    $apiKey = getenv('ANTHROPIC_API_KEY');
    if (!$apiKey) return null;

    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            "x-api-key: $apiKey",
            'anthropic-version: 2023-06-01',
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'model'      => 'claude-opus-4-6',
            'max_tokens' => 4096,
            'messages'   => [['role' => 'user', 'content' => "Analyze this CV vs job description and return JSON..."]],
        ]),
    ]);
    $result = curl_exec($ch);
    curl_close($ch);

    $decoded = json_decode($result, true);
    $content = $decoded['content'][0]['text'] ?? null;
    return $content ? json_decode($content, true) : null;
    */

    return null; // Use rule-based analysis
}

// ============================================================
// KEYWORD UTILITIES
// ============================================================

/**
 * Common English stop-words to exclude from keyword extraction.
 */
function getStopWords(): array
{
    return [
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
    ];
}

/**
 * Extract meaningful keywords from text (single and two-word phrases).
 *
 * @return array  Associative array: keyword => frequency
 */
function extractKeywords(string $text): array
{
    $stopWords = getStopWords();
    $words     = preg_split('/[\s,;:.!?()\[\]{}\'"\/\\\\]+/', $text, -1, PREG_SPLIT_NO_EMPTY);
    $words     = array_filter($words, fn($w) => strlen($w) >= 3 && !in_array($w, $stopWords));
    $words     = array_values($words);

    $freq = [];
    foreach ($words as $w) {
        $freq[$w] = ($freq[$w] ?? 0) + 1;
    }

    // Also extract two-word phrases (bigrams)
    for ($i = 0; $i < count($words) - 1; $i++) {
        if (strlen($words[$i]) >= 3 && strlen($words[$i + 1]) >= 3) {
            $bigram = $words[$i] . ' ' . $words[$i + 1];
            $freq[$bigram] = ($freq[$bigram] ?? 0) + 1;
        }
    }

    arsort($freq);
    return $freq;
}

// ============================================================
// SKILL DICTIONARIES
// ============================================================

function getTechSkills(): array
{
    return [
        // Languages
        'python','javascript','typescript','java','php','ruby','swift','kotlin',
        'golang','go','rust','scala','r','perl','matlab','bash','shell','c++',
        'c#','c','objective-c','dart','elixir','haskell','lua',
        // Web / Frontend
        'html','css','react','angular','vue','svelte','next.js','nuxt','gatsby',
        'webpack','vite','sass','less','tailwind','bootstrap','jquery',
        // Backend / Frameworks
        'node.js','express','fastapi','django','flask','rails','laravel','spring',
        'asp.net','.net','symfony','nestjs','graphql','rest','restful','api',
        'grpc','microservices','serverless','websockets',
        // Databases
        'mysql','postgresql','postgres','mongodb','redis','elasticsearch','oracle',
        'sqlite','dynamodb','cassandra','firestore','neo4j','mariadb','mssql',
        'sql server','supabase',
        // Cloud & DevOps
        'aws','azure','gcp','google cloud','docker','kubernetes','k8s','terraform',
        'ansible','jenkins','github actions','ci/cd','devops','helm','nginx',
        'apache','linux','ubuntu','centos','debian',
        // Data / AI / ML
        'machine learning','deep learning','tensorflow','pytorch','keras','scikit-learn',
        'pandas','numpy','spark','hadoop','airflow','data science','nlp',
        'computer vision','llm','openai','langchain','rag','vector database',
        'power bi','tableau','looker','bigquery','snowflake','databricks',
        // Mobile
        'android','ios','react native','flutter','xamarin','ionic',
        // Tools & Methodology
        'git','github','gitlab','bitbucket','jira','confluence','agile','scrum',
        'kanban','tdd','bdd','unit testing','jest','pytest','selenium',
        'figma','sketch','adobe xd','photoshop','illustrator',
        'excel','powerpoint','vba','sharepoint','salesforce','sap',
        // Security
        'oauth','jwt','ssl','tls','cybersecurity','penetration testing','sso',
    ];
}

function getSoftSkills(): array
{
    return [
        'leadership','communication','teamwork','collaboration','problem solving',
        'critical thinking','analytical','creativity','adaptability','flexibility',
        'time management','project management','strategic thinking','negotiation',
        'presentation','mentoring','coaching','stakeholder management',
        'cross-functional','initiative','proactive','detail-oriented',
        'decision making','conflict resolution','empathy','customer service',
        'relationship building','organizational','multitasking',
    ];
}

function getEducationKeywords(): array
{
    return [
        'bachelor','master','phd','doctorate','degree','diploma','certificate',
        'bsc','ba','msc','mba','btech','mtech','engineering','computer science',
        'information technology','mathematics','statistics','physics','chemistry',
        'business administration','finance','accounting','marketing','design',
        'certified','certification','aws certified','google certified','pmp',
        'cisco','microsoft certified','oracle certified','comptia',
    ];
}

function getExperienceIndicators(): array
{
    return [
        'senior','junior','mid','lead','principal','staff','manager','director',
        'vp','head of','chief','architect','specialist','consultant','analyst',
        'engineer','developer','designer','product manager','scrum master',
        'team lead','entry level','experienced','years of experience',
    ];
}

// ============================================================
// MODULE 1: ATS SCORE
// ============================================================

function calculateATSScore(string $cvLower, string $jdLower): array
{
    $jdKeywords = extractKeywords($jdLower);
    // Only consider keywords that appear 2+ times in JD (meaningful terms)
    $jdImportant = array_filter($jdKeywords, fn($freq) => $freq >= 1);

    if (empty($jdImportant)) {
        return ['score' => 0, 'matched' => 0, 'total' => 0];
    }

    $matched = 0;
    foreach (array_keys($jdImportant) as $kw) {
        if (mb_strpos($cvLower, $kw) !== false) {
            $matched++;
        }
    }

    $total = count($jdImportant);
    $score = (int) round(($matched / $total) * 100);
    $score = min(100, $score); // cap at 100

    return [
        'score'   => $score,
        'matched' => $matched,
        'total'   => $total,
    ];
}

// ============================================================
// MODULE 2: JOB MATCH SCORE
// ============================================================

function calculateJobMatch(string $cvLower, string $jdLower): array
{
    // ---- Skills Match (40 pts) ----
    $techSkills  = getTechSkills();
    $softSkills  = getSoftSkills();
    $allSkills   = array_merge($techSkills, $softSkills);

    $jdSkills   = array_filter($allSkills, fn($s) => mb_strpos($jdLower, $s) !== false);
    $cvMatchSkills = 0;
    foreach ($jdSkills as $s) {
        if (mb_strpos($cvLower, $s) !== false) $cvMatchSkills++;
    }
    $skillScore = empty($jdSkills) ? 65 : (int) min(100, round(($cvMatchSkills / count($jdSkills)) * 100));

    // ---- Experience Match (25 pts) ----
    $expIndicators = getExperienceIndicators();
    $jdExpTerms    = array_filter($expIndicators, fn($e) => mb_strpos($jdLower, $e) !== false);
    $cvExpMatch    = 0;
    foreach ($jdExpTerms as $e) {
        if (mb_strpos($cvLower, $e) !== false) $cvExpMatch++;
    }

    // Also score based on years of experience mentions
    preg_match_all('/(\d+)\s*\+?\s*years?/i', $jdLower, $jdYears);
    preg_match_all('/(\d+)\s*\+?\s*years?/i', $cvLower, $cvYears);

    $yearsScore = 60;
    if (!empty($jdYears[1]) && !empty($cvYears[1])) {
        $jdYearVal  = max(array_map('intval', $jdYears[1]));
        $cvYearVals = array_map('intval', $cvYears[1]);
        $cvMaxYears = max($cvYearVals);
        if ($cvMaxYears >= $jdYearVal) {
            $yearsScore = 100;
        } elseif ($cvMaxYears >= $jdYearVal - 1) {
            $yearsScore = 80;
        } else {
            $yearsScore = max(20, (int) round(($cvMaxYears / $jdYearVal) * 100));
        }
    }

    $expScore = empty($jdExpTerms)
        ? $yearsScore
        : (int) min(100, round((($cvExpMatch / max(count($jdExpTerms), 1)) * 60) + ($yearsScore * 0.4)));

    // ---- Education Fit (20 pts) ----
    $eduKeywords = getEducationKeywords();
    $jdEduTerms  = array_filter($eduKeywords, fn($e) => mb_strpos($jdLower, $e) !== false);
    $cvEduMatch  = 0;
    foreach ($jdEduTerms as $e) {
        if (mb_strpos($cvLower, $e) !== false) $cvEduMatch++;
    }
    $eduScore = empty($jdEduTerms) ? 70 : (int) min(100, round(($cvEduMatch / count($jdEduTerms)) * 100));

    // ---- Industry Relevance (15 pts) ----
    $jdKwFreq = extractKeywords($jdLower);
    $topJDKws = array_slice(array_keys($jdKwFreq), 0, 30);
    $industryMatch = 0;
    foreach ($topJDKws as $kw) {
        if (mb_strpos($cvLower, $kw) !== false) $industryMatch++;
    }
    $industryScore = empty($topJDKws) ? 60 : (int) min(100, round(($industryMatch / count($topJDKws)) * 100));

    // ---- Weighted Overall ----
    $overall = (int) round(
        ($skillScore   * 0.40) +
        ($expScore     * 0.25) +
        ($eduScore     * 0.20) +
        ($industryScore * 0.15)
    );

    return [
        'overall'    => min(100, $overall),
        'skills'     => $skillScore,
        'experience' => $expScore,
        'education'  => $eduScore,
        'industry'   => $industryScore,
    ];
}

// ============================================================
// MODULE 3: KEYWORD ANALYSIS
// ============================================================

function analyzeKeywords(string $cvLower, string $jdLower): array
{
    $stopWords = getStopWords();

    // Extract top JD keywords (single words only for clarity)
    $jdWords = preg_split('/\s+/', $jdLower, -1, PREG_SPLIT_NO_EMPTY);
    $jdWords = array_unique(array_filter($jdWords, fn($w) => strlen($w) >= 4 && !in_array($w, $stopWords)));

    // Also extract multi-word skill terms from dictionaries
    $allSkills = array_merge(getTechSkills(), getSoftSkills(), getEducationKeywords());
    $jdSkillTerms = array_filter($allSkills, fn($s) => mb_strpos($jdLower, $s) !== false);

    $allJDTerms = array_unique(array_merge(array_values($jdWords), array_values($jdSkillTerms)));

    $missing  = [];
    $present  = [];

    foreach ($allJDTerms as $term) {
        if (mb_strpos($cvLower, $term) !== false) {
            $present[] = $term;
        } else {
            $missing[] = $term;
        }
    }

    // Sort: shorter (single-word) terms first for readability
    usort($missing, fn($a, $b) => strlen($a) - strlen($b));
    usort($present, fn($a, $b) => strlen($a) - strlen($b));

    // Suggested: popular industry keywords not in JD but commonly expected
    $suggested = suggestKeywords($cvLower, $jdLower);

    return [
        'missing'   => array_slice($missing, 0, 25),
        'present'   => array_slice($present, 0, 30),
        'suggested' => array_slice($suggested, 0, 15),
    ];
}

function suggestKeywords(string $cvLower, string $jdLower): array
{
    // Common power keywords worth adding to most CVs
    $powerKeywords = [
        'quantified results','kpis','roi','stakeholder management',
        'cross-functional','agile methodology','data-driven','scalable',
        'deployed','architected','optimized','automated','streamlined',
        'reduced costs','increased revenue','mentored','collaborated',
    ];

    $suggested = [];
    foreach ($powerKeywords as $kw) {
        if (mb_strpos($cvLower, $kw) === false && mb_strpos($jdLower, $kw) === false) {
            $suggested[] = $kw;
        }
    }
    return $suggested;
}

// ============================================================
// MODULE 4: STRENGTHS & GAPS
// ============================================================

function analyzeStrengthsAndGaps(string $cvLower, string $jdLower): array
{
    $strengths = [];
    $gaps      = [];

    $techSkills = getTechSkills();
    $softSkills = getSoftSkills();

    // ---- Detect strengths ----
    $matchedTech = array_filter($techSkills, fn($s) => mb_strpos($cvLower, $s) !== false && mb_strpos($jdLower, $s) !== false);
    if (count($matchedTech) >= 5) {
        $strengths[] = 'Strong technical skill alignment — ' . implode(', ', array_slice($matchedTech, 0, 4)) . ' and more match the role.';
    } elseif (count($matchedTech) > 0) {
        $strengths[] = 'Relevant technical skills present: ' . implode(', ', array_slice($matchedTech, 0, 3)) . '.';
    }

    $matchedSoft = array_filter($softSkills, fn($s) => mb_strpos($cvLower, $s) !== false && mb_strpos($jdLower, $s) !== false);
    if (count($matchedSoft) >= 3) {
        $strengths[] = 'Good soft skills demonstrated: ' . implode(', ', array_slice($matchedSoft, 0, 3)) . '.';
    }

    if (preg_match('/\d+%|\d+x|increased|improved|reduced|saved|generated|\$[\d,]+/i', $cvLower)) {
        $strengths[] = 'CV includes quantified achievements — excellent for ATS and hiring managers.';
    }

    if (preg_match('/managed|led|directed|oversaw|supervised/i', $cvLower)) {
        $strengths[] = 'Leadership experience is evident in the CV.';
    }

    if (preg_match('/certification|certified|credential/i', $cvLower)) {
        $strengths[] = 'Professional certifications or credentials add credibility.';
    }

    if (count($strengths) === 0) {
        $strengths[] = 'Your CV has a foundation to build on — focus on adding measurable results.';
    }

    // ---- Detect gaps ----
    $missingTech = array_filter($techSkills, fn($s) => mb_strpos($jdLower, $s) !== false && mb_strpos($cvLower, $s) === false);
    if (count($missingTech) > 3) {
        $gaps[] = 'Several required technical skills are missing from your CV: ' . implode(', ', array_slice($missingTech, 0, 4)) . '.';
    }

    if (!preg_match('/\d+%|\d+x|increased|improved|reduced|saved|\$[\d,]+/i', $cvLower)) {
        $gaps[] = 'No quantified achievements found. Add numbers to your accomplishments (e.g., "Increased sales by 30%").';
    }

    if (!preg_match('/summary|objective|profile|about me/i', $cvLower)) {
        $gaps[] = 'No professional summary detected. A tailored summary significantly boosts ATS performance.';
    }

    $eduKeywords = getEducationKeywords();
    $jdNeedsEdu  = array_filter($eduKeywords, fn($e) => mb_strpos($jdLower, $e) !== false);
    $cvHasEdu    = array_filter($jdNeedsEdu,  fn($e) => mb_strpos($cvLower, $e) !== false);
    if (count($jdNeedsEdu) > count($cvHasEdu)) {
        $gaps[] = 'Education or certification requirements from the job description are not clearly reflected in your CV.';
    }

    return ['strengths' => $strengths, 'gaps' => $gaps];
}

// ============================================================
// MODULE 5: BULLET POINT IMPROVEMENT
// ============================================================

function improveBulletPoints(string $cvText): array
{
    $weakPatterns = [
        'responsible for',
        'helped with',
        'worked on',
        'assisted in',
        'was involved in',
        'duties included',
        'tasks included',
        'helped to',
        'tried to',
        'participated in',
        'contributed to',
    ];

    $lines = preg_split('/\n+/', $cvText, -1, PREG_SPLIT_NO_EMPTY);

    $improvements = [];

    foreach ($lines as $line) {
        $line     = trim($line);
        $lineLower = mb_strtolower($line);

        if (strlen($line) < 20 || strlen($line) > 300) continue;

        $isWeak = false;
        $weakPhrase = '';
        foreach ($weakPatterns as $pattern) {
            if (mb_strpos($lineLower, $pattern) !== false) {
                $isWeak    = true;
                $weakPhrase = $pattern;
                break;
            }
        }

        if ($isWeak) {
            $improved = rewriteBullet($line, $weakPhrase);
            if ($improved !== $line) {
                $improvements[] = [
                    'original' => $line,
                    'improved' => $improved,
                ];
            }
        }

        if (count($improvements) >= 6) break;
    }

    // If no weak lines found, fabricate useful examples
    if (empty($improvements)) {
        $improvements = getGenericBulletExamples();
    }

    return $improvements;
}

/**
 * Rewrite a weak bullet point using strong action verbs and achievement framing.
 */
function rewriteBullet(string $line, string $weakPhrase): string
{
    $actionVerbs = [
        'Delivered','Spearheaded','Orchestrated','Optimized','Engineered',
        'Designed','Built','Launched','Drove','Accelerated','Streamlined',
        'Transformed','Implemented','Executed','Achieved','Generated',
        'Elevated','Championed','Led','Reduced',
    ];

    $verb = $actionVerbs[array_rand($actionVerbs)];

    // Extract the core task (after the weak phrase)
    $coreIdx = mb_strpos(mb_strtolower($line), $weakPhrase);
    $core    = trim(mb_substr($line, $coreIdx + mb_strlen($weakPhrase)));
    $core    = ltrim($core, '.,;: ');

    if (strlen($core) < 5) return $line;

    // Capitalize first letter
    $core = ucfirst($core);

    // Add achievement framing if no metric is present
    if (!preg_match('/\d+[%x]?|\$[\d,]+/i', $core)) {
        $suffixes = [
            ', reducing manual effort by 30%.',
            ', resulting in measurable team efficiency gains.',
            ', improving delivery speed by 25%.',
            ', saving significant time and resources.',
            ' — contributing to a 20% improvement in output quality.',
        ];
        $core = rtrim($core, '.') . $suffixes[array_rand($suffixes)];
    }

    return "$verb $core";
}

function getGenericBulletExamples(): array
{
    return [
        [
            'original' => 'Responsible for managing the project team and deliverables.',
            'improved' => 'Led a cross-functional team of 8 to deliver project milestones 15% ahead of schedule.',
        ],
        [
            'original' => 'Helped with the development of the company website.',
            'improved' => 'Engineered core website features that improved user engagement by 40% within 3 months.',
        ],
        [
            'original' => 'Worked on improving customer satisfaction scores.',
            'improved' => 'Drove customer satisfaction from 72% to 91% by implementing a structured feedback and resolution process.',
        ],
        [
            'original' => 'Assisted in the data analysis and reporting process.',
            'improved' => 'Automated weekly data analysis pipeline, reducing reporting time from 8 hours to 45 minutes.',
        ],
    ];
}

// ============================================================
// MODULE 6: SKILLS GAP ANALYSIS
// ============================================================

function analyzeSkillsGap(string $cvLower, string $jdLower): array
{
    $techSkills    = getTechSkills();
    $missingSkills = array_filter($techSkills, fn($s) => mb_strpos($jdLower, $s) !== false && mb_strpos($cvLower, $s) === false);

    if (empty($missingSkills)) return [];

    // Resource mapping for common skills
    $resourceMap = [
        'python'          => 'Python.org docs / Automate the Boring Stuff (free)',
        'javascript'      => 'javascript.info (free) / freeCodeCamp',
        'react'           => 'react.dev (official docs) / Scrimba React Course',
        'node.js'         => 'nodejs.org docs / The Odin Project',
        'aws'             => 'AWS Free Tier + AWS Skill Builder (free tier)',
        'docker'          => 'Docker Getting Started Guide (docker.com)',
        'kubernetes'      => 'Kubernetes.io interactive tutorials',
        'machine learning'=> 'fast.ai (free) / Coursera ML Specialization',
        'sql'             => 'SQLZoo.net (free) / Mode Analytics SQL Tutorial',
        'typescript'      => 'typescriptlang.org / Execute Program',
        'figma'           => 'Figma Academy (figma.com) — free',
        'agile'           => 'Scrum.org free guides / Coursera Agile courses',
        'scrum'           => 'Scrum.org free Scrum Guide',
        'git'             => 'learngitbranching.js.org (free interactive)',
    ];

    $priorityMap = ['high' => 0, 'medium' => 1, 'low' => 2];
    $result = [];

    foreach (array_slice($missingSkills, 0, 8) as $skill) {
        // Determine priority based on frequency in JD
        $freq = substr_count($jdLower, $skill);
        $priority = $freq >= 3 ? 'HIGH' : ($freq >= 2 ? 'MEDIUM' : 'LOW');

        $resource = $resourceMap[$skill] ?? "Search: \"Learn $skill free\" on Coursera, Udemy, or YouTube";

        $result[] = [
            'skill'       => ucwords($skill),
            'priority'    => $priority,
            'description' => "The job requires $skill. Adding this skill to your CV and portfolio will significantly improve your match score.",
            'resource'    => $resource,
        ];
    }

    // Sort by priority
    usort($result, fn($a, $b) => ($priorityMap[strtolower($a['priority'])] ?? 2) - ($priorityMap[strtolower($b['priority'])] ?? 2));

    return $result;
}

// ============================================================
// MODULE 7: CV FEEDBACK
// ============================================================

function generateCVFeedback(string $cvText, string $cvLower): array
{
    $feedback = [];
    $lineCount = count(array_filter(preg_split('/\n/', $cvText), fn($l) => strlen(trim($l)) > 5));
    $wordCount = str_word_count($cvText);

    // Length
    if ($wordCount > 700 && $wordCount < 1400) {
        $feedback[] = ['text' => "Good CV length ({$wordCount} words). Aim for 1–2 pages.", 'positive' => true];
    } elseif ($wordCount < 300) {
        $feedback[] = ['text' => "Your CV is very short ({$wordCount} words). Expand with more detail on roles and achievements.", 'positive' => false];
    } elseif ($wordCount > 1400) {
        $feedback[] = ['text' => "Your CV is too long ({$wordCount} words). Trim to 2 pages maximum — hiring managers skim.", 'positive' => false];
    }

    // Contact info
    if (preg_match('/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/', $cvText)) {
        $feedback[] = ['text' => 'Email address is present — good.', 'positive' => true];
    } else {
        $feedback[] = ['text' => 'No email address found. Ensure your contact information is visible at the top of your CV.', 'positive' => false];
    }

    // LinkedIn
    if (mb_strpos($cvLower, 'linkedin') !== false) {
        $feedback[] = ['text' => 'LinkedIn profile reference detected — this is valued by recruiters.', 'positive' => true];
    } else {
        $feedback[] = ['text' => 'Consider adding your LinkedIn URL to your CV header.', 'positive' => false];
    }

    // Metrics / numbers
    preg_match_all('/\d+[%x]?|\$[\d,]+/i', $cvText, $metrics);
    $metricCount = count($metrics[0]);
    if ($metricCount >= 5) {
        $feedback[] = ['text' => "Strong use of metrics ({$metricCount} found). Quantified achievements stand out to recruiters.", 'positive' => true];
    } elseif ($metricCount > 0) {
        $feedback[] = ['text' => "Some metrics found ({$metricCount}). Aim for at least 5–8 quantified achievements throughout your CV.", 'positive' => false];
    } else {
        $feedback[] = ['text' => 'No quantifiable metrics found. Add numbers to demonstrate impact (e.g., "saved 10 hours/week", "grew sales by 35%").', 'positive' => false];
    }

    // Action verbs
    $strongVerbs = ['achieved','delivered','built','launched','led','drove','increased','reduced','managed','designed'];
    $foundVerbs = array_filter($strongVerbs, fn($v) => mb_strpos($cvLower, $v) !== false);
    if (count($foundVerbs) >= 4) {
        $feedback[] = ['text' => 'Good use of strong action verbs throughout your CV.', 'positive' => true];
    } else {
        $feedback[] = ['text' => 'Use more strong action verbs to start bullet points: Delivered, Engineered, Spearheaded, Optimized, etc.', 'positive' => false];
    }

    // Skills section
    if (mb_strpos($cvLower, 'skills') !== false) {
        $feedback[] = ['text' => 'Skills section detected — ensure it mirrors keywords from the job description.', 'positive' => true];
    } else {
        $feedback[] = ['text' => 'No dedicated skills section found. Add one listing your top technical and soft skills.', 'positive' => false];
    }

    // Education
    if (mb_strpos($cvLower, 'education') !== false || mb_strpos($cvLower, 'degree') !== false) {
        $feedback[] = ['text' => 'Education section is present.', 'positive' => true];
    }

    return $feedback;
}

// ============================================================
// MODULE 8: RED FLAGS
// ============================================================

function detectRedFlags(string $cvText, string $cvLower): array
{
    $flags = [];

    // Weak language patterns
    $weakPhrases = [
        'responsible for' => 'Passive ownership language. Replace with strong action verbs (e.g., "Led", "Managed", "Delivered").',
        'duties included' => 'Task-listing language with no impact. Reframe as achievements.',
        'assisted'        => '"Assisted" downplays your contribution. Own your work with "Contributed", "Built", "Delivered".',
        'hard worker'     => 'Clichéd phrase. Show work ethic through specific achievements instead.',
        'team player'     => 'Overused cliché. Demonstrate collaboration through concrete examples.',
        'go-getter'       => 'Meaningless buzzword. Replace with a specific accomplishment.',
        'synergy'         => 'Corporate jargon. Use plain, direct language.',
        'think outside'   => 'Cliché. Replace with actual creative problem-solving examples.',
        'detail oriented' => '"Detail-oriented" is expected — prove it through your CV formatting and content instead.',
    ];

    foreach ($weakPhrases as $phrase => $desc) {
        if (mb_strpos($cvLower, $phrase) !== false) {
            $flags[] = ['severity' => 'MEDIUM', 'description' => "\"$phrase\" detected. $desc"];
        }
    }

    // No metrics
    if (!preg_match('/\d+[%x]?|\$[\d,]+/i', $cvText)) {
        $flags[] = [
            'severity'    => 'HIGH',
            'description' => 'No quantifiable metrics or results found. CVs without numbers are 40% less likely to reach the interview stage.',
        ];
    }

    // Generic objective statement
    if (preg_match('/seeking.*?position|looking for.*?opportunity|obtain.*?role/i', $cvLower)) {
        $flags[] = [
            'severity'    => 'MEDIUM',
            'description' => 'Generic objective statement detected. Replace with a targeted professional summary tailored to this specific role.',
        ];
    }

    // Potential employment gap (check for 2+ year gaps in dates)
    preg_match_all('/20(1[0-9]|2[0-5])/', $cvText, $yearMatches);
    if (!empty($yearMatches[0])) {
        $years = array_map('intval', $yearMatches[0]);
        sort($years);
        $uniqueYears = array_unique($years);
        for ($i = 0; $i < count($uniqueYears) - 1; $i++) {
            if ($uniqueYears[$i + 1] - $uniqueYears[$i] >= 2) {
                $flags[] = [
                    'severity'    => 'MEDIUM',
                    'description' => "Potential employment gap detected between {$uniqueYears[$i]} and {$uniqueYears[$i+1]}. Be prepared to address this in interviews.",
                ];
                break;
            }
        }
    }

    // Very short CV
    if (str_word_count($cvText) < 250) {
        $flags[] = [
            'severity'    => 'HIGH',
            'description' => 'CV content is very sparse. A professional CV should be 400–700 words minimum.',
        ];
    }

    // No contact info
    if (!preg_match('/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/', $cvText)) {
        $flags[] = [
            'severity'    => 'HIGH',
            'description' => 'No email address detected. Contact information must be visible at the top of your CV.',
        ];
    }

    return $flags;
}

// ============================================================
// MODULE 9: PROFESSIONAL SUMMARY GENERATOR
// ============================================================

function generateProfessionalSummary(string $cvText, string $jobDescription): string
{
    $cvLower = mb_strtolower($cvText);
    $jdLower = mb_strtolower($jobDescription);

    // Extract job title from JD (first line or first sentence usually contains it)
    $jdFirstLine = trim(strtok($jobDescription, "\n"));
    $jobTitle    = extractJobTitle($jdFirstLine) ?: 'the advertised role';

    // Identify top matching skills
    $techSkills    = getTechSkills();
    $matchedSkills = array_filter($techSkills, fn($s) => mb_strpos($cvLower, $s) !== false && mb_strpos($jdLower, $s) !== false);
    $topSkills     = implode(', ', array_slice($matchedSkills, 0, 4));
    if (empty($topSkills)) {
        $topSkills = 'a diverse range of relevant technical skills';
    }

    // Extract approximate years of experience from CV
    preg_match_all('/(\d+)\s*\+?\s*years?/i', $cvText, $yearMatches);
    $yearsExp = !empty($yearMatches[1]) ? max(array_map('intval', $yearMatches[1])) : null;
    $expPhrase = $yearsExp ? "$yearsExp+ years of professional experience" : 'proven professional experience';

    // Detect seniority
    $seniority = '';
    if (preg_match('/senior|lead|principal|staff|manager|director|head/i', $cvLower)) {
        $seniority = 'senior-level ';
    }

    // Detect industry domain
    $domain = detectDomain($cvLower, $jdLower);

    // Generate summary
    $summary = "Results-driven {$seniority}professional with {$expPhrase} in {$domain}. ";
    $summary .= "Skilled in {$topSkills}, with a track record of delivering measurable outcomes and driving business value. ";
    $summary .= "Seeking to bring strategic thinking and technical expertise to {$jobTitle}, contributing to a high-performance team from day one.";

    return $summary;
}

function extractJobTitle(string $text): string
{
    // Remove common prefixes like "We are looking for a..."
    $text = preg_replace('/^(we are (looking for|hiring)|hiring for|job title:|position:)\s*/i', '', trim($text));
    // Take the first ~4 words as the title
    $words = preg_split('/\s+/', $text, 5);
    $title = implode(' ', array_slice($words, 0, 4));
    return ucwords(strtolower(preg_replace('/[^a-zA-Z\s\/\-]/', '', $title)));
}

function detectDomain(string $cvLower, string $jdLower): string
{
    $domains = [
        'software engineering'   => ['software','developer','engineer','backend','frontend','fullstack'],
        'data science & analytics' => ['data science','machine learning','analytics','data analyst'],
        'cloud & devops'         => ['aws','azure','devops','kubernetes','infrastructure'],
        'product management'     => ['product manager','product owner','roadmap','stakeholder'],
        'digital marketing'      => ['seo','sem','content','social media','marketing'],
        'finance & accounting'   => ['finance','accounting','audit','financial','cpa'],
        'design & UX'            => ['ux','ui','figma','design','user experience'],
        'project management'     => ['project manager','pmp','scrum master','agile','delivery'],
        'cybersecurity'          => ['security','penetration','threat','vulnerability','compliance'],
        'sales & business development' => ['sales','business development','crm','revenue','client'],
    ];

    $combined = $cvLower . ' ' . $jdLower;
    $best     = 'technology and business';
    $bestScore = 0;

    foreach ($domains as $domain => $keywords) {
        $score = 0;
        foreach ($keywords as $kw) {
            if (mb_strpos($combined, $kw) !== false) $score++;
        }
        if ($score > $bestScore) {
            $bestScore = $score;
            $best = $domain;
        }
    }

    return $best;
}

// ============================================================
// MODULE 10: INTERVIEW INSIGHTS
// ============================================================

function generateInterviewInsights(string $cvLower, string $jdLower, int $atsScore, int $matchScore): array
{
    // Calculate shortlist probability (weighted blend of scores)
    $probability = (int) round(($atsScore * 0.45) + ($matchScore * 0.55));
    $probability = max(5, min(98, $probability));

    $label   = '';
    $summary = '';

    if ($probability >= 75) {
        $label   = 'Very Likely to be Shortlisted';
        $summary = "Your CV strongly aligns with this role. Keep your CV updated with the latest keywords and ensure your LinkedIn mirrors the same.";
    } elseif ($probability >= 55) {
        $label   = 'Good Shortlisting Chance';
        $summary = "Your profile is a solid match. Strengthen a few missing keywords and add more quantified achievements to push into the top shortlist.";
    } elseif ($probability >= 35) {
        $label   = 'Moderate Shortlisting Chance';
        $summary = "There are meaningful gaps between your profile and the role requirements. Focus on the missing skills and tailor your summary specifically for this job.";
    } else {
        $label   = 'Low Shortlisting Chance';
        $summary = "Your CV needs significant tailoring for this role. Address the missing keywords, add measurable achievements, and consider upskilling in the key areas flagged.";
    }

    // Generate role-specific interview questions from JD keywords
    $questions = generateInterviewQuestions($cvLower, $jdLower);

    return [
        'shortlist_probability' => $probability,
        'probability_label'     => $label,
        'summary'               => $summary,
        'questions'             => $questions,
    ];
}

function generateInterviewQuestions(string $cvLower, string $jdLower): array
{
    $techSkills = getTechSkills();
    $jdSkills   = array_filter($techSkills, fn($s) => mb_strpos($jdLower, $s) !== false);

    $questions = [];

    // Technical questions based on matched skills
    foreach (array_slice($jdSkills, 0, 3) as $skill) {
        $questions[] = "Can you walk us through a project where you used {$skill} and the impact it had?";
    }

    // Behavioural questions (standard)
    $behaviouralQuestions = [
        'Tell me about a time you had to deliver under tight deadlines. How did you prioritise?',
        'Describe a situation where you had to adapt quickly to a significant change at work.',
        'Give an example of a time you identified and solved a complex technical problem.',
        'How have you handled disagreements with a colleague or manager?',
        'Tell me about your most impactful professional achievement and how you measured it.',
        'Describe a project where things went wrong. What did you learn?',
        'How do you stay up-to-date with the latest developments in your field?',
    ];

    // Experience / Situational
    $situationalQuestions = [
        'Why are you interested in this specific role and company?',
        'Where do you see yourself in 3–5 years and how does this role fit that vision?',
        'What is your greatest professional strength? Give a specific example.',
        'How do you handle feedback and criticism of your work?',
    ];

    $questions = array_merge($questions, array_slice($behaviouralQuestions, 0, 4));
    $questions = array_merge($questions, array_slice($situationalQuestions, 0, 2));

    return array_slice($questions, 0, 8);
}
