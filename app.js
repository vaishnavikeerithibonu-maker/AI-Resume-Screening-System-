import { JOB_TEMPLATES, SAMPLE_RESUMES } from './data.js';
import { analyzeResume } from './analyzer.js';

// Setup app state
let state = {
  activeTab: 'single', // 'single' or 'batch'
  jobTemplates: JOB_TEMPLATES,
  activeJobIndex: 0,
  singleResumeText: '',
  singleResult: null,
  batchFiles: [],
  batchResults: [],
  totalProcessedCount: 0,
  avgMatchScore: 0,
  topMatchCategory: 'N/A'
};

// SVG circular gauge perimeter (radius = 38, perimeter = 2 * pi * r = ~238.76)
const GAUGE_PERIMETER = 238.76;

// Document Ready
document.addEventListener('DOMContentLoaded', () => {
  // Configure PDF.js Worker
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
  }

  initApp();
});

function initApp() {
  renderJobPresets();
  setupEventListeners();
  loadJobTemplate(0);
  updateDashboardStats();
  toggleTab('single');
}

// Render Job Preset selection chips
function renderJobPresets() {
  const container = document.getElementById('job-presets');
  container.innerHTML = '';
  
  state.jobTemplates.forEach((job, index) => {
    const chip = document.createElement('div');
    chip.className = `preset-chip ${index === state.activeJobIndex ? 'active' : ''}`;
    chip.textContent = job.title;
    chip.dataset.index = index;
    chip.addEventListener('click', () => loadJobTemplate(index));
    container.appendChild(chip);
  });
}

// Load selected job details into inputs
function loadJobTemplate(index) {
  state.activeJobIndex = index;
  
  // Highlight active chip
  document.querySelectorAll('.preset-chip').forEach((chip, i) => {
    chip.classList.toggle('active', i === index);
  });

  const job = state.jobTemplates[index];
  
  // Update inputs
  document.getElementById('job-title').value = job.title;
  document.getElementById('job-department').value = job.department;
  document.getElementById('job-experience').value = job.experienceYears;
  document.getElementById('job-skills').value = job.skills.join(', ');
  document.getElementById('job-keywords').value = job.keywords.join(', ');
  document.getElementById('job-desc').value = job.description;

  // Re-run analysis if there's already a resume processed
  if (state.singleResumeText) {
    runSingleAnalysis();
  }
}

// Gather job details from form inputs
function getJobFromForm() {
  const title = document.getElementById('job-title').value.trim();
  const department = document.getElementById('job-department').value.trim();
  const experienceYears = parseInt(document.getElementById('job-experience').value.trim(), 10) || 0;
  
  const skills = document.getElementById('job-skills').value
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);
    
  const keywords = document.getElementById('job-keywords').value
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const description = document.getElementById('job-desc').value.trim();

  return {
    title,
    department,
    experienceYears,
    skills,
    keywords,
    description
  };
}

// Update local stats on dashboard
function updateDashboardStats() {
  document.getElementById('stat-processed').textContent = state.totalProcessedCount;
  document.getElementById('stat-avg-score').textContent = state.avgMatchScore ? `${state.avgMatchScore}%` : '0%';
  document.getElementById('stat-top-role').textContent = state.topMatchCategory;
}

// Update stats after a run
function recalculateStats(allScores = []) {
  if (allScores.length === 0) return;
  
  state.totalProcessedCount += allScores.length;
  
  // Sum and average
  const totalSum = allScores.reduce((sum, score) => sum + score, 0);
  const newAvg = Math.round(totalSum / allScores.length);
  
  state.avgMatchScore = state.avgMatchScore === 0 
    ? newAvg 
    : Math.round((state.avgMatchScore + newAvg) / 2);

  // Find top matching job template title
  state.topMatchCategory = state.jobTemplates[state.activeJobIndex].title.split(' (')[0];
  
  updateDashboardStats();
}

// Event Listeners setup
function setupEventListeners() {
  // Tab buttons
  document.getElementById('tab-single-btn').addEventListener('click', () => toggleTab('single'));
  document.getElementById('tab-batch-btn').addEventListener('click', () => toggleTab('batch'));

  // Sample resume buttons
  document.getElementById('load-sample-perfect').addEventListener('click', () => loadSampleResume('software_engineer_perfect'));
  document.getElementById('load-sample-partial').addEventListener('click', () => loadSampleResume('software_engineer_partial'));
  document.getElementById('load-sample-unrelated').addEventListener('click', () => loadSampleResume('unrelated_resume'));

  // Form submit / scan buttons
  document.getElementById('scan-single-btn').addEventListener('click', () => {
    runSingleAnalysis();
  });

  // Single File Drag & Drop
  const singleDropzone = document.getElementById('single-dropzone');
  const singleFileInput = document.getElementById('single-file-input');

  singleDropzone.addEventListener('click', () => singleFileInput.click());
  
  singleFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleSingleFileUpload(e.target.files[0]);
    }
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    singleDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      singleDropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    singleDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      singleDropzone.classList.remove('dragover');
    }, false);
  });

  singleDropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleSingleFileUpload(files[0]);
    }
  });

  // Batch Files Drag & Drop
  const batchDropzone = document.getElementById('batch-dropzone');
  const batchFileInput = document.getElementById('batch-file-input');
  
  batchDropzone.addEventListener('click', () => batchFileInput.click());
  
  batchFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleBatchFilesUpload(e.target.files);
    }
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    batchDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      batchDropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    batchDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      batchDropzone.classList.remove('dragover');
    }, false);
  });

  batchDropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleBatchFilesUpload(files);
    }
  });

  // Batch actions
  document.getElementById('batch-clear-btn').addEventListener('click', clearBatchData);
  document.getElementById('batch-run-btn').addEventListener('click', runBatchAnalysis);

  // Modal actions
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-overlay')) {
      closeDetailsModal();
    }
  });
  document.getElementById('modal-close-btn').addEventListener('click', closeDetailsModal);
}

// Switch dashboard tabs
function toggleTab(tab) {
  state.activeTab = tab;
  
  document.getElementById('tab-single-btn').classList.toggle('active', tab === 'single');
  document.getElementById('tab-batch-btn').classList.toggle('active', tab === 'batch');

  document.getElementById('single-screener-view').style.display = tab === 'single' ? 'grid' : 'none';
  document.getElementById('batch-screener-view').style.display = tab === 'batch' ? 'block' : 'none';
}

// Load sample resume into textarea
function loadSampleResume(key) {
  const resumeText = SAMPLE_RESUMES[key];
  document.getElementById('resume-text').value = resumeText;
  state.singleResumeText = resumeText;
  
  // Reset dropzone styling to show loaded name
  const dropzoneIcon = document.querySelector('#single-dropzone .dropzone-icon');
  const dropzoneTitle = document.querySelector('#single-dropzone .dropzone-text h4');
  const dropzoneSub = document.querySelector('#single-dropzone .dropzone-text p');

  dropzoneIcon.innerHTML = '📄';
  dropzoneTitle.textContent = `Loaded sample: ${key.replace(/_/g, ' ')}`;
  dropzoneSub.textContent = "Click 'Analyze Resume' to parse details";
  
  // Highlight action button
  const scanBtn = document.getElementById('scan-single-btn');
  scanBtn.classList.add('pulse-animation');
}

// Read text from uploaded files (PDF or TXT)
async function readFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    if (file.type === "application/pdf" || file.name.endsWith('.pdf')) {
      reader.onload = async function() {
        try {
          const typedarray = new Uint8Array(this.result);
          const pdf = await window.pdfjsLib.getDocument({ data: typedarray }).promise;
          let text = "";
          
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map(item => item.str).join(" ");
            text += pageText + "\n";
          }
          resolve(text);
        } catch (err) {
          reject("Error parsing PDF file: " + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (file.type === "text/plain" || file.name.endsWith('.txt')) {
      reader.onload = function(e) {
        resolve(e.target.result);
      };
      reader.readAsText(file);
    } else {
      // Fallback for docx or other formats - try parsing as plain text or reject
      reader.onload = function(e) {
        resolve(e.target.result);
      };
      reader.readAsText(file);
    }
  });
}

// Single mode file upload
async function handleSingleFileUpload(file) {
  const dropzoneIcon = document.querySelector('#single-dropzone .dropzone-icon');
  const dropzoneTitle = document.querySelector('#single-dropzone .dropzone-text h4');
  const dropzoneSub = document.querySelector('#single-dropzone .dropzone-text p');

  dropzoneIcon.innerHTML = '🔄';
  dropzoneTitle.textContent = "Extracting text...";
  dropzoneSub.textContent = `Processing file: ${file.name}`;

  try {
    const text = await readFileContent(file);
    state.singleResumeText = text;
    document.getElementById('resume-text').value = text;
    
    dropzoneIcon.innerHTML = '✅';
    dropzoneTitle.textContent = "File uploaded successfully!";
    dropzoneSub.textContent = file.name;
    
    // Auto-run analysis for smoother UX
    runSingleAnalysis();
  } catch (err) {
    dropzoneIcon.innerHTML = '❌';
    dropzoneTitle.textContent = "Failed to parse file";
    dropzoneSub.textContent = typeof err === 'string' ? err : "Please paste text directly or upload a valid text/PDF resume.";
  }
}

// Single mode analysis runner
function runSingleAnalysis() {
  // Grab raw text from the editor, in case it was edited manually
  state.singleResumeText = document.getElementById('resume-text').value.trim();

  if (!state.singleResumeText) {
    alert("Please upload a resume file or paste your resume text in the field provided.");
    return;
  }

  const jobTemplate = getJobFromForm();
  
  // Show loading indicator in Results Panel
  const resultsContainer = document.getElementById('results-panel');
  resultsContainer.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 0;">
      <div class="logo-icon pulse-animation" style="margin-bottom: 20px;">AI</div>
      <p style="font-weight: 600; color: var(--text-secondary);">Analyzing candidate match profiles...</p>
    </div>
  `;

  // Simulate short AI analysis buffer for visual effect
  setTimeout(() => {
    const analysis = analyzeResume(state.singleResumeText, jobTemplate);
    state.singleResult = analysis;
    
    // Remove pulse styling from scan btn
    document.getElementById('scan-single-btn').classList.remove('pulse-animation');

    // Recalculate dashboard analytics
    recalculateStats([analysis.overallScore]);
    
    renderSingleResults(analysis);
  }, 750);
}

// Render analysis outputs to results pane
function renderSingleResults(data) {
  const container = document.getElementById('results-panel');
  container.className = "panel fade-in";
  
  // Generate checks items list HTML
  const checkItemsHtml = data.ats.checks.map(chk => `
    <div class="ats-check-item">
      <span class="check-icon ${chk.status}">
        ${chk.status === 'pass' ? '✓' : chk.status === 'warning' ? '⚠' : '✗'}
      </span>
      <span class="check-msg">${chk.message}</span>
    </div>
  `).join('');

  // Generate recommendation list HTML
  const recommendationsHtml = data.recommendations.length > 0
    ? data.recommendations.map(rec => `
        <div class="rec-item">
          <span class="rec-icon">⚡</span>
          <span class="rec-text">${rec}</span>
        </div>
      `).join('')
    : `
        <div class="rec-item" style="border-color: var(--green-neon);">
          <span class="rec-icon" style="color: var(--green-neon);">✓</span>
          <span class="rec-text" style="color: var(--green-neon);"><strong>Perfect Alignment!</strong> No immediate resume updates needed to match standard job requirements.</span>
        </div>
      `;

  // Skills tags list HTML
  const matchedTags = data.skills.matched.length > 0
    ? data.skills.matched.map(s => `<span class="tag tag-matched">✓ ${s}</span>`).join('')
    : '<span class="text-muted" style="font-size:0.8rem">No matching skills identified</span>';
    
  const missingTags = data.skills.missing.length > 0
    ? data.skills.missing.map(s => `<span class="tag tag-missing">✕ ${s}</span>`).join('')
    : '<span class="text-muted" style="font-size:0.8rem">None</span>';

  container.innerHTML = `
    <div class="panel-header">
      <h3 class="panel-title"><i class="logo-icon" style="width:28px; height:28px; font-size:0.8rem; border-radius:6px;">AI</i> Analysis Results</h3>
      <span style="font-size:0.85rem; color:var(--text-secondary); font-weight:600;">Overall Match</span>
    </div>
    
    <div class="results-container">
      <!-- Prediction summary box -->
      <div class="prediction-card" style="border-left-color: ${data.fitColor}; background: rgba(${data.overallScore >= 80 ? '74, 222, 128' : data.overallScore >= 60 ? '250, 204, 21' : '239, 68, 68'}, 0.04);">
        <div class="prediction-info">
          <h4>Fit Assessment</h4>
          <p>Candidate exhibits ${data.overallScore}% compatibility with the role criteria.</p>
        </div>
        <div class="prediction-badge" style="background: rgba(${data.overallScore >= 80 ? '74, 222, 128' : data.overallScore >= 60 ? '250, 204, 21' : '239, 68, 68'}, 0.15); color: ${data.fitColor};">
          ${data.fitPrediction}
        </div>
      </div>

      <!-- Main gauges grid -->
      <div class="gauges-grid">
        <div class="gauge-item">
          <div class="gauge-circle">
            <svg width="90" height="90">
              <circle class="gauge-bg" cx="45" cy="45" r="38"></circle>
              <circle id="gauge-overall" class="gauge-bar" cx="45" cy="45" r="38" 
                stroke="var(--primary)" 
                stroke-dasharray="${GAUGE_PERIMETER}" 
                stroke-dashoffset="${GAUGE_PERIMETER}">
              </circle>
            </svg>
            <div class="gauge-value" style="color: var(--primary-light);">${data.overallScore}</div>
          </div>
          <span class="gauge-label">Match Score</span>
        </div>

        <div class="gauge-item">
          <div class="gauge-circle">
            <svg width="90" height="90">
              <circle class="gauge-bg" cx="45" cy="45" r="38"></circle>
              <circle id="gauge-skills" class="gauge-bar" cx="45" cy="45" r="38" 
                stroke="var(--green-neon)" 
                stroke-dasharray="${GAUGE_PERIMETER}" 
                stroke-dashoffset="${GAUGE_PERIMETER}">
              </circle>
            </svg>
            <div class="gauge-value" style="color: var(--green-neon);">${data.skills.score}%</div>
          </div>
          <span class="gauge-label">Skills Match</span>
        </div>

        <div class="gauge-item">
          <div class="gauge-circle">
            <svg width="90" height="90">
              <circle class="gauge-bg" cx="45" cy="45" r="38"></circle>
              <circle id="gauge-experience" class="gauge-bar" cx="45" cy="45" r="38" 
                stroke="var(--secondary)" 
                stroke-dasharray="${GAUGE_PERIMETER}" 
                stroke-dashoffset="${GAUGE_PERIMETER}">
              </circle>
            </svg>
            <div class="gauge-value" style="color: var(--secondary);">${data.experience.detected} yrs</div>
          </div>
          <span class="gauge-label">Experience</span>
        </div>

        <div class="gauge-item">
          <div class="gauge-circle">
            <svg width="90" height="90">
              <circle class="gauge-bg" cx="45" cy="45" r="38"></circle>
              <circle id="gauge-ats" class="gauge-bar" cx="45" cy="45" r="38" 
                stroke="var(--yellow-neon)" 
                stroke-dasharray="${GAUGE_PERIMETER}" 
                stroke-dashoffset="${GAUGE_PERIMETER}">
              </circle>
            </svg>
            <div class="gauge-value" style="color: var(--yellow-neon);">${data.ats.score}%</div>
          </div>
          <span class="gauge-label">ATS Check</span>
        </div>
      </div>

      <!-- Skills Details Section -->
      <div class="skills-sec">
        <div class="skills-box">
          <h4 style="color: var(--green-neon);">Matched Skills (${data.skills.matched.length})</h4>
          <div class="tag-list">${matchedTags}</div>
        </div>
        <div class="skills-box">
          <h4 style="color: var(--red-neon);">Missing Skills (${data.skills.missing.length})</h4>
          <div class="tag-list">${missingTags}</div>
        </div>
      </div>

      <!-- ATS Alignment Report card -->
      <div style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-card); border-radius: var(--radius-md); padding: 20px;">
        <h4 style="font-size: 0.95rem; margin-bottom: 12px; font-weight: 700; color: var(--text-primary);">ATS Format Check</h4>
        <div>${checkItemsHtml}</div>
      </div>

      <!-- Recs section -->
      <div>
        <h4 style="font-size: 0.95rem; margin-bottom: 12px; font-weight: 700; color: var(--text-primary);">Recommendations for Improvement</h4>
        <div class="rec-list">${recommendationsHtml}</div>
      </div>
    </div>
  `;

  // Trigger SVG offset animation in next thread frame
  setTimeout(() => {
    animateGaugeOffset('gauge-overall', data.overallScore);
    animateGaugeOffset('gauge-skills', data.skills.score);
    
    // For experience, bound the percentage
    const expPercent = Math.min(100, Math.round((data.experience.detected / data.experience.required) * 100));
    animateGaugeOffset('gauge-experience', expPercent);
    
    animateGaugeOffset('gauge-ats', data.ats.score);
  }, 50);
}

// Animate stroke-dashoffset based on score
function animateGaugeOffset(id, percentage) {
  const element = document.getElementById(id);
  if (!element) return;
  const offset = GAUGE_PERIMETER - (GAUGE_PERIMETER * percentage) / 100;
  element.style.strokeDashoffset = offset;
}

// Batch mode file handlers
function handleBatchFilesUpload(files) {
  for (const file of files) {
    // Prevent duplicate files
    if (state.batchFiles.some(f => f.name === file.name)) continue;
    state.batchFiles.push(file);
  }
  
  renderBatchFileList();
}

// Clear batch items
function clearBatchData() {
  state.batchFiles = [];
  state.batchResults = [];
  renderBatchFileList();
  renderBatchResultsTable();
}

// Render list of batch uploads ready to screen
function renderBatchFileList() {
  const filesListContainer = document.getElementById('uploaded-files-list');
  const actionRow = document.getElementById('batch-action-row');
  
  if (state.batchFiles.length === 0) {
    filesListContainer.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">📂</span>
        <h3>No files uploaded</h3>
        <p>Drag and drop multiple resumes or click to browse files.</p>
      </div>
    `;
    actionRow.style.display = 'none';
    return;
  }

  actionRow.style.display = 'flex';
  
  filesListContainer.innerHTML = `
    <h4>Queue: (${state.batchFiles.length} files loaded)</h4>
    <div style="max-height: 250px; overflow-y: auto;">
      ${state.batchFiles.map((file, i) => `
        <div class="file-row-item">
          <span class="file-row-name">📄 ${file.name}</span>
          <span class="file-row-status" style="color: var(--text-muted);">Ready to process</span>
        </div>
      `).join('')}
    </div>
  `;
}

// Run batch matching pipeline
async function runBatchAnalysis() {
  if (state.batchFiles.length === 0) return;

  const jobTemplate = getJobFromForm();
  state.batchResults = [];

  // Update status indicators to loader
  const rows = document.querySelectorAll('.file-row-item');
  rows.forEach(row => {
    const status = row.querySelector('.file-row-status');
    if (status) {
      status.textContent = "Queued...";
      status.style.color = "var(--yellow-neon)";
    }
  });

  const scores = [];

  for (let i = 0; i < state.batchFiles.length; i++) {
    const file = state.batchFiles[i];
    const row = rows[i];
    const statusElement = row ? row.querySelector('.file-row-status') : null;
    
    if (statusElement) {
      statusElement.textContent = "Screening...";
      statusElement.style.color = "var(--primary-light)";
    }

    try {
      const text = await readFileContent(file);
      const result = analyzeResume(text, jobTemplate);
      
      state.batchResults.push({
        fileName: file.name,
        candidateName: parseCandidateName(text, file.name),
        result
      });

      scores.push(result.overallScore);

      if (statusElement) {
        statusElement.textContent = "Done";
        statusElement.style.color = "var(--green-neon)";
      }
    } catch (err) {
      state.batchResults.push({
        fileName: file.name,
        candidateName: file.name.split('.')[0],
        error: true,
        errorMessage: typeof err === 'string' ? err : "Failed to screen file"
      });

      if (statusElement) {
        statusElement.textContent = "Error";
        statusElement.style.color = "var(--red-neon)";
      }
    }
  }

  // Recalculate stats
  recalculateStats(scores);

  // Sort candidates by highest score
  state.batchResults.sort((a, b) => {
    if (a.error) return 1;
    if (b.error) return -1;
    return b.result.overallScore - a.result.overallScore;
  });

  renderBatchResultsTable();
}

// Render compared batch candidates in ranked table
function renderBatchResultsTable() {
  const container = document.getElementById('batch-comparison-view');
  
  if (state.batchResults.length === 0) {
    container.innerHTML = '';
    return;
  }

  const tableRows = state.batchResults.map((item, index) => {
    if (item.error) {
      return `
        <tr>
          <td><span class="rank-badge" style="background:rgba(239,68,68,0.1); color:var(--red-neon);">!</span> ${item.candidateName}</td>
          <td colspan="5" style="color: var(--red-neon); font-style: italic;">Failed to analyze document: ${item.errorMessage}</td>
        </tr>
      `;
    }

    const { result } = item;
    
    // Limit displaying list of matched skills
    const skillsLimit = 4;
    const skillsSummary = result.skills.matched.slice(0, skillsLimit).join(', ') + 
      (result.skills.matched.length > skillsLimit ? ` +${result.skills.matched.length - skillsLimit} more` : '');

    return `
      <tr>
        <td>
          <div class="candidate-name-cell">
            <strong><span class="rank-badge">#${index + 1}</span>${item.candidateName}</strong>
            <span>${item.fileName}</span>
          </div>
        </td>
        <td>
          <span class="score-cell-badge" style="background: rgba(${result.overallScore >= 80 ? '74, 222, 128' : result.overallScore >= 60 ? '250, 204, 21' : '239, 68, 68'}, 0.15); color: ${result.fitColor};">
            ${result.overallScore}%
          </span>
        </td>
        <td><strong>${result.fitPrediction}</strong></td>
        <td>${result.experience.detected} / ${result.experience.required} yrs</td>
        <td style="max-width: 200px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
          ${skillsSummary || '<span class="text-muted">None</span>'}
        </td>
        <td>
          <button class="sample-load-btn details-modal-trigger" data-index="${index}" style="margin:0; padding:6px 12px;">
            View Match Detail
          </button>
        </td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div class="panel fade-in" style="margin-top: 30px;">
      <div class="panel-header">
        <h3 class="panel-title">🏆 Screening Rank Matrix</h3>
        <span style="font-size:0.85rem; color:var(--text-secondary); font-weight:600;">Best fit candidates ranked by score</span>
      </div>
      
      <div class="comparison-table-wrapper">
        <table class="comparison-table">
          <thead>
            <tr>
              <th>Candidate Name</th>
              <th>Overall Score</th>
              <th>Fit Verdict</th>
              <th>Exp Match</th>
              <th>Core Matched Skills</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Hook details modal triggers
  document.querySelectorAll('.details-modal-trigger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.index, 10);
      showDetailsModal(idx);
    });
  });
}

// Display full candidate audit scorecard in modal overlay
function showDetailsModal(index) {
  const item = state.batchResults[index];
  if (!item || item.error) return;

  const { result } = item;
  const modalBody = document.getElementById('modal-details-body');
  
  const matchedTags = result.skills.matched.map(s => `<span class="tag tag-matched">✓ ${s}</span>`).join('');
  const missingTags = result.skills.missing.map(s => `<span class="tag tag-missing">✕ ${s}</span>`).join('');
  
  const checkItemsHtml = result.ats.checks.map(chk => `
    <div class="ats-check-item">
      <span class="check-icon ${chk.status}">
        ${chk.status === 'pass' ? '✓' : chk.status === 'warning' ? '⚠' : '✗'}
      </span>
      <span class="check-msg">${chk.message}</span>
    </div>
  `).join('');

  const recommendationsHtml = result.recommendations.map(rec => `
    <div class="rec-item">
      <span class="rec-icon">⚡</span>
      <span class="rec-text">${rec}</span>
    </div>
  `).join('');

  modalBody.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:15px;">
      <div>
        <h2 style="font-size:1.4rem; font-weight:700;">${item.candidateName}</h2>
        <p style="font-size:0.8rem; color:var(--text-secondary);">${item.fileName}</p>
      </div>
      <div style="text-align:right;">
        <span class="score-cell-badge" style="font-size:1rem; background: rgba(${result.overallScore >= 80 ? '74, 222, 128' : result.overallScore >= 60 ? '250, 204, 21' : '239, 68, 68'}, 0.15); color: ${result.fitColor};">
          ${result.overallScore}% Match
        </span>
        <p style="font-size:0.8rem; color:var(--text-secondary); margin-top:4px;">${result.fitPrediction}</p>
      </div>
    </div>

    <div style="display:flex; flex-direction:column; gap:20px;">
      <!-- Exp / Contact box -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; background:rgba(255,255,255,0.01); padding:16px; border-radius:var(--radius-md); border:1px solid var(--border-card);">
        <div>
          <span class="label-text" style="margin:0;">Experience Metric</span>
          <p style="font-size:0.9rem; font-weight:600; color:var(--secondary);">${result.experience.detected} years detected</p>
          <span style="font-size:0.75rem; color:var(--text-secondary);">Job requirement: ${result.experience.required}+ years</span>
        </div>
        <div>
          <span class="label-text" style="margin:0;">Contact Info</span>
          <p style="font-size:0.8rem; color:var(--text-primary); text-overflow:ellipsis; overflow:hidden;">${result.contact.email || 'No Email'}</p>
          <p style="font-size:0.8rem; color:var(--text-secondary);">${result.contact.phone || 'No Phone'}</p>
        </div>
      </div>

      <!-- Skills Box -->
      <div>
        <span class="label-text">Skills Matching breakdown</span>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div class="skills-box" style="padding:12px;">
            <h5 style="color:var(--green-neon); font-size:0.8rem; margin-bottom:8px;">Matched (${result.skills.matched.length})</h5>
            <div class="tag-list">${matchedTags || 'None'}</div>
          </div>
          <div class="skills-box" style="padding:12px;">
            <h5 style="color:var(--red-neon); font-size:0.8rem; margin-bottom:8px;">Missing (${result.skills.missing.length})</h5>
            <div class="tag-list">${missingTags || 'None'}</div>
          </div>
        </div>
      </div>

      <!-- ATS -->
      <div>
        <span class="label-text">ATS formatting audit</span>
        <div style="background:rgba(255,255,255,0.01); border:1px solid var(--border-card); border-radius:var(--radius-md); padding:12px 16px;">
          ${checkItemsHtml}
        </div>
      </div>

      <!-- Recommendations -->
      <div>
        <span class="label-text">Tailoring Recommendations</span>
        <div class="rec-list">
          ${recommendationsHtml || '<p style="font-size:0.8rem; color:var(--green-neon);">No recommendations needed!</p>'}
        </div>
      </div>
    </div>
  `;

  document.getElementById('modal-overlay').classList.add('active');
}

function closeDetailsModal() {
  document.getElementById('modal-overlay').classList.remove('active');
}

// Helper: Try to extract a clean candidate name from resume text
function parseCandidateName(text, fallbackName) {
  if (!text) return fallbackName;
  
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return fallbackName;

  // Candidate names are typically on the first 1-3 lines of a resume
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const line = lines[i];
    // Filter out typical header meta stuff (address, links, email, phone)
    if (
      line.includes('@') || 
      line.includes('|') || 
      /\b(github|linkedin|resume|cv)\b/i.test(line) ||
      /\d{3}[-.\s]\d{3}/.test(line) ||
      line.length > 35
    ) {
      continue;
    }
    
    // Verify it looks like a name (words starting with capitals)
    if (/^[A-Z][a-zA-Z]*(\s+[A-Z][a-zA-Z]*)+$/.test(line)) {
      return line;
    }
  }

  // Fallback to cleaning the file name (e.g. "John_Doe_CV.pdf" -> "John Doe CV")
  const baseName = fallbackName.split('.')[0];
  return baseName.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
