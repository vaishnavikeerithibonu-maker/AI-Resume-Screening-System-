/**
 * AI Resume Screening and Analyzer Engine (Client-side)
 */

// Helper to escape regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parses contact information from the resume text
 */
export function extractContactInfo(text) {
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/;
  const urlRegex = /(?:https?:\/\/)?(?:www\.)?(github\.com|linkedin\.com|behance\.net|portfolio|dribbble\.com)\/[a-zA-Z0-9_-]+/gi;

  const emailMatch = text.match(emailRegex);
  const phoneMatch = text.match(phoneRegex);
  
  const links = [];
  let linkMatch;
  while ((linkMatch = urlRegex.exec(text)) !== null) {
    links.push(linkMatch[0]);
  }

  return {
    email: emailMatch ? emailMatch[0] : null,
    phone: phoneMatch ? phoneMatch[0] : null,
    links: [...new Set(links)]
  };
}

/**
 * Extracts years of experience from the resume text
 */
export function estimateExperience(text) {
  let totalYears = 0;
  
  // Method 1: Look for explicit declarations like "5+ years of experience" or "3 yrs"
  const expDeclarations = [
    /\b(\d+)\+?\s*years?(?:\s+of)?\s+experience\b/i,
    /\b(\d+)\+?\s*(?:yrs|years?)\b/i,
    /\bexperience\s*:\s*(\d+)\+?\s*years?\b/i
  ];

  for (const regex of expDeclarations) {
    const match = text.match(regex);
    if (match) {
      const years = parseInt(match[1], 10);
      if (years > 0 && years < 40) {
        totalYears = Math.max(totalYears, years);
      }
    }
  }

  // Method 2: Look for date ranges like "2020 - 2023" or "2018 - Present"
  // e.g. "2018 to 2022", "Oct 2019 - Present"
  const yearRangeRegex = /\b(19\d{2}|20\d{2})\s*[-–to\s]+\s*(19\d{2}|20\d{2}|present|current)\b/gi;
  let rangeMatch;
  const currentYear = new Date().getFullYear();
  let computedYears = 0;

  while ((rangeMatch = yearRangeRegex.exec(text)) !== null) {
    const start = parseInt(rangeMatch[1], 10);
    let end = currentYear;
    if (rangeMatch[2].toLowerCase() !== 'present' && rangeMatch[2].toLowerCase() !== 'current') {
      end = parseInt(rangeMatch[2], 10);
    }
    
    if (start > 1980 && end >= start && end <= currentYear) {
      computedYears += (end - start);
    }
  }

  // Use the maximum of the explicit statement or the cumulative date range
  return Math.max(totalYears, computedYears) || 1; // Default to 1 if undetected
}

/**
 * Analyzes resume content against a job template
 */
export function analyzeResume(resumeText, jobTemplate) {
  if (!resumeText || !jobTemplate) return null;

  const normalizedResume = resumeText.toLowerCase();

  // 1. Skill Matching
  const matchedSkills = [];
  const missingSkills = [];
  
  jobTemplate.skills.forEach(skill => {
    // Escape regex characters of skill and look for word boundaries or symbol-safe boundaries
    const escaped = escapeRegExp(skill.toLowerCase());
    // For programming languages like C++, C#, .NET, React.js, let's create a boundary-safe check
    let regex;
    if (/[+#.a-z0-9]/i.test(escaped)) {
      // Handles C++, ReactJS, .NET
      regex = new RegExp(`(?:\\b|\\s)${escaped}(?:\\b|\\s|[,.;:\\)]|$)`, 'i');
    } else {
      regex = new RegExp(`\\b${escaped}\\b`, 'i');
    }

    if (regex.test(normalizedResume)) {
      matchedSkills.push(skill);
    } else {
      missingSkills.push(skill);
    }
  });

  const skillScore = jobTemplate.skills.length > 0 
    ? Math.round((matchedSkills.length / jobTemplate.skills.length) * 100)
    : 100;

  // 2. Keyword Matching (Keyword Density)
  const matchedKeywords = [];
  const missingKeywords = [];

  jobTemplate.keywords.forEach(keyword => {
    const escaped = escapeRegExp(keyword.toLowerCase());
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    
    if (regex.test(normalizedResume)) {
      matchedKeywords.push(keyword);
    } else {
      missingKeywords.push(keyword);
    }
  });

  const keywordScore = jobTemplate.keywords.length > 0
    ? Math.round((matchedKeywords.length / jobTemplate.keywords.length) * 100)
    : 100;

  // 3. Experience Match
  const detectedExperience = estimateExperience(resumeText);
  const requiredExperience = jobTemplate.experienceYears;
  
  let experienceScore = 100;
  if (detectedExperience < requiredExperience) {
    // Lose points proportionally if below required experience
    experienceScore = Math.max(0, Math.round((detectedExperience / requiredExperience) * 100));
  }

  // 4. ATS formatting and structure check
  const contact = extractContactInfo(resumeText);
  const sections = {
    experience: /\b(experience|work history|employment|history|professional experience)\b/i.test(normalizedResume),
    education: /\b(education|academic|credentials|qualification|university|college)\b/i.test(normalizedResume),
    skills: /\b(skills|technical skills|key skills|expertise|technologies)\b/i.test(normalizedResume),
    summary: /\b(summary|objective|profile|about me|professional summary)\b/i.test(normalizedResume)
  };

  let atsChecks = [];
  let atsScore = 0;

  // Check section headers
  const missingSections = Object.keys(sections).filter(sec => !sections[sec]);
  if (missingSections.length === 0) {
    atsScore += 40;
    atsChecks.push({ status: "pass", message: "All standard resume sections (Summary, Experience, Skills, Education) detected." });
  } else {
    atsScore += (4 - missingSections.length) * 10;
    atsChecks.push({ 
      status: "warning", 
      message: `Missing standard section headers: ${missingSections.map(s => s.toUpperCase()).join(', ')}. Use clear headings to help ATS systems parse your resume.` 
    });
  }

  // Check contact details
  if (contact.email) {
    atsScore += 20;
    atsChecks.push({ status: "pass", message: `Email address detected: ${contact.email}` });
  } else {
    atsChecks.push({ status: "fail", message: "No email address found. Ensure your contact info is easy to find." });
  }

  if (contact.phone) {
    atsScore += 20;
    atsChecks.push({ status: "pass", message: `Phone number detected: ${contact.phone}` });
  } else {
    atsChecks.push({ status: "warning", message: "No phone number found. Adding one increases recruiter callback rates." });
  }

  if (contact.links.length > 0) {
    atsScore += 20;
    atsChecks.push({ status: "pass", message: `Professional links detected: ${contact.links.join(', ')}` });
  } else {
    atsChecks.push({ status: "warning", message: "No LinkedIn or GitHub profiles found. Online professional presence is highly recommended." });
  }

  // 5. Overall Weighted Match Score
  // Skill: 40%, Keywords: 25%, Experience: 20%, ATS formatting: 15%
  const overallScore = Math.round(
    (skillScore * 0.40) +
    (keywordScore * 0.25) +
    (experienceScore * 0.20) +
    (atsScore * 0.15)
  );

  // Determine fit prediction
  let fitPrediction = "Low Match";
  let fitColor = "var(--red-neon)";
  if (overallScore >= 80) {
    fitPrediction = "Strong Match";
    fitColor = "var(--green-neon)";
  } else if (overallScore >= 60) {
    fitPrediction = "Potential Match";
    fitColor = "var(--yellow-neon)";
  }

  // Generate actionable tips
  const recommendations = [];
  if (missingSkills.length > 0) {
    recommendations.push(`Incorporate missing skills: ${missingSkills.slice(0, 3).join(', ')} to target this specific role.`);
  }
  if (missingKeywords.length > 0) {
    recommendations.push(`Use keywords like: "${missingKeywords.slice(0, 3).join('", "')}" in your job experience descriptions to increase matching density.`);
  }
  if (detectedExperience < requiredExperience) {
    recommendations.push(`Highlight transferrable project work to compensate for being below the preferred ${requiredExperience} years of experience (detected: ${detectedExperience} years).`);
  }
  if (missingSections.length > 0) {
    recommendations.push("Ensure your resume uses standard section headers like 'Skills', 'Experience', and 'Education' on single lines.");
  }
  if (!contact.links.length) {
    recommendations.push("Add a link to your online portfolio, GitHub, or LinkedIn profile to show complete credentials.");
  }

  return {
    overallScore,
    fitPrediction,
    fitColor,
    detectedExperience,
    requiredExperience,
    skills: {
      score: skillScore,
      matched: matchedSkills,
      missing: missingSkills
    },
    keywords: {
      score: keywordScore,
      matched: matchedKeywords,
      missing: missingKeywords
    },
    experience: {
      score: experienceScore,
      detected: detectedExperience,
      required: requiredExperience
    },
    ats: {
      score: atsScore,
      checks: atsChecks
    },
    contact,
    recommendations
  };
}
