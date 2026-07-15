import { analyzeResume } from './analyzer.js';
import { JOB_TEMPLATES, SAMPLE_RESUMES } from './data.js';

console.log("Starting verification tests for analyzer.js...");

const job = JOB_TEMPLATES[0]; // Software Engineer (Frontend)
console.log(`\nTesting Job Profile: ${job.title}`);

// 1. Perfect Fit test
console.log("\n--- Running Test 1: Perfect Fit Resume ---");
const perfectResult = analyzeResume(SAMPLE_RESUMES.software_engineer_perfect, job);
console.log(`Overall Match Score: ${perfectResult.overallScore}%`);
console.log(`Fit Verdict: ${perfectResult.fitPrediction}`);
console.log(`Detected Experience: ${perfectResult.detectedExperience} years (Required: ${perfectResult.requiredExperience} years)`);
console.log(`Matched Skills (${perfectResult.skills.matched.length}): ${perfectResult.skills.matched.join(', ')}`);
console.log(`Missing Skills (${perfectResult.skills.missing.length}): ${perfectResult.skills.missing.join(', ')}`);

if (perfectResult.overallScore < 80) {
  console.error("❌ FAIL: Perfect match score should be >= 80%");
  process.exit(1);
}

// 2. Partial Fit test
console.log("\n--- Running Test 2: Partial Fit Resume ---");
const partialResult = analyzeResume(SAMPLE_RESUMES.software_engineer_partial, job);
console.log(`Overall Match Score: ${partialResult.overallScore}%`);
console.log(`Fit Verdict: ${partialResult.fitPrediction}`);
console.log(`Detected Experience: ${partialResult.detectedExperience} years`);
console.log(`Matched Skills (${partialResult.skills.matched.length}): ${partialResult.skills.matched.join(', ')}`);
console.log(`Missing Skills (${partialResult.skills.missing.length}): ${partialResult.skills.missing.join(', ')}`);

if (partialResult.overallScore < 40 || partialResult.overallScore >= 80) {
  console.error("❌ FAIL: Partial match score should be in [40%, 79%] range");
  process.exit(1);
}

// 3. Unrelated Fit test
console.log("\n--- Running Test 3: Unrelated Resume ---");
const unrelatedResult = analyzeResume(SAMPLE_RESUMES.unrelated_resume, job);
console.log(`Overall Match Score: ${unrelatedResult.overallScore}%`);
console.log(`Fit Verdict: ${unrelatedResult.fitPrediction}`);
console.log(`Detected Experience: ${unrelatedResult.detectedExperience} years`);
console.log(`Matched Skills (${unrelatedResult.skills.matched.length}): ${unrelatedResult.skills.matched.join(', ')}`);

if (unrelatedResult.overallScore >= 45) {
  console.error("❌ FAIL: Unrelated resume match score should be low (< 45%)");
  process.exit(1);
}

console.log("\n✅ All automated verification tests passed successfully!");
process.exit(0);
