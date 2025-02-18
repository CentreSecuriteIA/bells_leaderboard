// Mock data - in production this would come from your backend
const safeguardsData = {
    'Lakera Guard': { BELLS_score: 0.91, description: 'Industry-leading content filtering API' },
    'LLM Guard': { BELLS_score: 0.86, description: 'Comprehensive open-source safety toolkit' },
    'NeMo Guardrails': { BELLS_score: 0.83, description: 'Open-source framework for LLM safety' },
    'Langkit': { BELLS_score: 0.78, description: 'Lightweight content filtering solution' },
    'Prompt Guard': { BELLS_score: 0.71, description: 'Specialized jailbreak detection system' }
};

const performanceMetrics = {
    'Lakera Guard': { tpr_adversarial: 0.98, tpr_non_adversarial: 0.95, fpr: 0.02 },
    'LLM Guard': { tpr_adversarial: 0.92, tpr_non_adversarial: 0.94, fpr: 0.02 },
    'NeMo Guardrails': { tpr_adversarial: 0.89, tpr_non_adversarial: 0.91, fpr: 0.026 },
    'Langkit': { tpr_adversarial: 0.85, tpr_non_adversarial: 0.88, fpr: 0.03 },
    'Prompt Guard': { tpr_adversarial: 0.82, tpr_non_adversarial: 0.84, fpr: 0.127 }
};

const harmCategories = [
    'Harassment/Discrimination', 'Malware/Hacking', 'Physical_harm',
    'Economic_harm', 'Fraud/Deception', 'Disinformation',
    'Sexual/Adult_content', 'Privacy', 'Expert_advice', 'Government_decision_making'
];

// Add debug logging and better error handling
async function loadData() {
    const dataFiles = {
        safeguardData: '/data/safeguard_evaluation_results.csv',
        harmfulPrompts: '/data/harmful_non-adversarial.csv',
        borderlinePrompts: '/data/borderline_non-adversarial.csv',
        benignPrompts: '/data/benign_non-adversarial.csv',
        harmfulJailbreaks: '/data/harmful_jailbreaks.csv',
        borderlineJailbreaks: '/data/borderline_jailbreaks.csv',
        benignJailbreaks: '/data/benign_jailbreaks.csv'
    };

    try {
        console.log('Starting data loading...');
        console.log('Attempting to load data from:', dataFiles.safeguardData);
        
        // Load each file individually with error handling
        const loadedData = {};
        for (const [key, path] of Object.entries(dataFiles)) {
            console.log(`Loading ${key} from ${path}`);
            try {
                const response = await fetch(path);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const csvText = await response.text();
                loadedData[key] = d3.csvParse(csvText);
                console.log(`Successfully loaded ${key}:`, loadedData[key]);
            } catch (error) {
                console.error(`Error loading ${key} from ${path}:`, error);
                throw new Error(`Failed to load ${key}: ${error.message}`);
            }
        }

        return {
            safeguardData: loadedData.safeguardData,
            datasets: {
                'Harmful': {
                    'Non-Adversarial': loadedData.harmfulPrompts,
                    'Adversarial': loadedData.harmfulJailbreaks
                },
                'Borderline': {
                    'Non-Adversarial': loadedData.borderlinePrompts,
                    'Adversarial': loadedData.borderlineJailbreaks
                },
                'Benign': {
                    'Non-Adversarial': loadedData.benignPrompts,
                    'Adversarial': loadedData.benignJailbreaks
                }
            }
        };
    } catch (error) {
        console.error('Error in loadData:', error);
        document.querySelector('.dashboard-container').innerHTML = `
            <div class="alert alert-danger">
                <h4>Error Loading Data</h4>
                <p>${error.message}</p>
                <p>Debug Information:</p>
                <ul>
                    <li>Current URL: ${window.location.href}</li>
                    <li>Attempted data path: ${dataFiles.safeguardData}</li>
                </ul>
            </div>
        `;
        throw error;
    }
}

// Initialize visualization with better error handling
document.addEventListener('DOMContentLoaded', async function() {
    try {
        window.loadedData = await loadData();
        
        // Initialize existing visualizations
        createStatsCards(window.loadedData.safeguardData);
        createBELLSScorePlot(window.loadedData.safeguardData);
        createRadarPlot(window.loadedData.safeguardData);
        createHarmPreventionPlot(window.loadedData.safeguardData);
        
        // Initialize new features
        initializePlayground(window.loadedData);
        initializeRecommendationSystem();

        // Add window resize handler for responsive plots
        window.addEventListener('resize', function() {
            const plots = ['bellsScorePlot', 'radarPlot', 'harmPreventionPlot'];
            plots.forEach(plotId => {
                const plotElement = document.getElementById(plotId);
                if (plotElement) {
                    Plotly.Plots.resize(plotElement);
                }
            });
        });
    } catch (error) {
        console.error('Initialization error:', error);
        document.querySelector('.dashboard-container').innerHTML = `
            <div class="alert alert-danger">
                <h4>Initialization Error</h4>
                <p>${error.message}</p>
            </div>
        `;
    }
});

function createStatsCards(safeguardData) {
    const statsRow = document.querySelector('.stats-row');
    const totalSafeguards = safeguardData.length;
    const avgScore = d3.mean(safeguardData, d => +d.BELLS_score);
    const maxScore = d3.max(safeguardData, d => +d.BELLS_score);

    const stats = [
        { title: 'Total Safeguards', value: totalSafeguards, icon: 'shield-alt' },
        { title: 'Average BELLS Score', value: avgScore.toFixed(2), icon: 'chart-line' },
        { title: 'Highest Score', value: maxScore.toFixed(2), icon: 'trophy' }
    ];

    statsRow.innerHTML = stats.map(stat => `
        <div class="col-md-4">
            <div class="stats-card">
                <h5><i class="fas fa-${stat.icon}"></i> ${stat.title}</h5>
                <h2 class="text-primary">${stat.value}</h2>
            </div>
        </div>
    `).join('');
}

function createBELLSScorePlot(safeguardData) {
    const data = [{
        x: safeguardData.map(d => d.safeguard),
        y: safeguardData.map(d => +d.BELLS_score),
        type: 'bar',
        marker: {
            color: 'rgb(55, 83, 109)'
        }
    }];

    const layout = {
        margin: { t: 30, r: 30, l: 50, b: 80 },
        yaxis: {
            title: 'BELLS Score',
            range: [0, 1]
        },
        xaxis: {
            title: 'Safeguard',
            tickangle: -45
        }
    };

    Plotly.newPlot('bellsScorePlot', data, layout);
}

function createRadarPlot(safeguardData) {
    const data = safeguardData.map(d => ({
        type: 'scatterpolar',
        r: [
            +d.harmful_jailbreaks,
            +d.harmful_non_adversarial,
            1 - +d.benign_non_adversarial,
            +d.harmful_jailbreaks // Close the polygon
        ],
        theta: [
            'TPR Adversarial',
            'TPR Non-Adversarial',
            '1 - FPR',
            'TPR Adversarial'
        ],
        name: d.safeguard,
        fill: 'toself'
    }));

    const layout = {
        polar: {
            radialaxis: {
                visible: true,
                range: [0, 1]
            }
        },
        showlegend: true,
        margin: { t: 30, r: 30, l: 30, b: 30 }
    };

    Plotly.newPlot('radarPlot', data, layout);
}

function createHarmPreventionPlot(safeguardData) {
    const harmCategories = [
        'Harassment/Discrimination', 'Malware/Hacking', 'Physical_harm',
        'Economic_harm', 'Fraud/Deception', 'Disinformation',
        'Sexual/Adult_content', 'Privacy', 'Expert_advice', 'Government_decision_making'
    ];

    const data = safeguardData.map(d => ({
        x: harmCategories,
        y: harmCategories.map(cat => +d[cat]),
        type: 'bar',
        name: d.safeguard
    }));

    const layout = {
        barmode: 'group',
        margin: { t: 30, r: 30, l: 50, b: 120 },
        yaxis: {
            title: 'Prevention Score',
            range: [0, 1]
        },
        xaxis: {
            tickangle: -45
        },
        legend: {
            orientation: 'h',
            y: -0.2
        }
    };

    Plotly.newPlot('harmPreventionPlot', data, layout);
}

// Enhanced Playground functionality
function initializePlayground(data) {
    // Populate safeguard select
    const safeguardSelect = document.getElementById('safeguardSelect');
    safeguardSelect.innerHTML = '<option value="All">All Safeguards</option>';
    data.safeguardData.forEach(safeguard => {
        const option = document.createElement('option');
        option.value = safeguard.safeguard;
        option.textContent = safeguard.safeguard;
        safeguardSelect.appendChild(option);
    });

    // Add category filter
    const categories = [...new Set(Object.values(data.datasets)
        .flatMap(types => Object.values(types))
        .flatMap(dataset => dataset.map(item => item.Category)))
    ].filter(Boolean);

    const filterContainer = document.createElement('div');
    filterContainer.className = 'row mt-3';
    filterContainer.innerHTML = `
        <div class="col-md-6">
            <label class="form-label">Category Filter</label>
            <select class="form-select" id="categoryFilter">
                <option value="All">All Categories</option>
                ${categories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
            </select>
        </div>
        <div class="col-md-6">
            <label class="form-label">Search Prompts</label>
            <input type="text" class="form-control" id="promptSearch" placeholder="Search by keyword...">
        </div>
    `;
    document.querySelector('.playground-controls').appendChild(filterContainer);

    // Add event listeners
    document.querySelectorAll('input[name="datasetType"]').forEach(radio => {
        radio.addEventListener('change', updatePlayground);
    });
    document.querySelectorAll('input[name="contentType"]').forEach(radio => {
        radio.addEventListener('change', updatePlayground);
    });
    safeguardSelect.addEventListener('change', updatePlayground);
    document.getElementById('categoryFilter').addEventListener('change', updatePlayground);
    document.getElementById('promptSearch').addEventListener('input', debounce(updatePlayground, 300));

    // Initial update
    updatePlayground();
}

function updatePlayground() {
    const datasetType = document.querySelector('input[name="datasetType"]:checked').value;
    const contentType = document.querySelector('input[name="contentType"]:checked').value;
    const selectedSafeguard = document.getElementById('safeguardSelect').value;
    const selectedCategory = document.getElementById('categoryFilter').value;
    const searchTerm = document.getElementById('promptSearch').value.toLowerCase();
    
    // Get and filter dataset
    let currentDataset = window.loadedData.datasets[datasetType][contentType];
    
    // Apply category filter
    if (selectedCategory !== 'All') {
        currentDataset = currentDataset.filter(prompt => prompt.Category === selectedCategory);
    }
    
    // Apply search filter
    if (searchTerm) {
        currentDataset = currentDataset.filter(prompt => 
            (prompt.Goal?.toLowerCase().includes(searchTerm) ||
             prompt.Behavior?.toLowerCase().includes(searchTerm) ||
             prompt.Jailbreak?.toLowerCase().includes(searchTerm) ||
             prompt.Attack?.toLowerCase().includes(searchTerm))
        );
    }

    const promptsContainer = document.getElementById('promptsContainer');
    promptsContainer.innerHTML = '';

    // Show filter results count
    const resultsCount = document.createElement('div');
    resultsCount.className = 'alert alert-info';
    resultsCount.textContent = `Showing ${currentDataset.length} results`;
    promptsContainer.appendChild(resultsCount);

    // Display filtered prompts
    currentDataset.forEach(prompt => {
        const card = document.createElement('div');
        card.className = 'prompt-card';
        
        // Create detection status header
        const detectionHeader = document.createElement('div');
        detectionHeader.className = 'row align-items-center mb-3';
        
        if (selectedSafeguard === 'All') {
            // Show all safeguards' detection status
            const safeguardStatuses = window.loadedData.safeguardData.map(safeguard => {
                const detected = Math.random() < 0.7; // Simulate detection (replace with actual logic)
                return `
                    <div class="col-auto">
                        <span class="detection-badge ${detected ? 'success' : 'danger'}">
                            ${detected ? '✅' : '❌'} ${safeguard.safeguard}
                        </span>
                    </div>
                `;
            }).join('');
            detectionHeader.innerHTML = safeguardStatuses;
        } else {
            // Show single safeguard detection status
            const detected = Math.random() < 0.7; // Simulate detection (replace with actual logic)
            detectionHeader.innerHTML = `
                <div class="col-auto">
                    <span class="detection-badge ${detected ? 'success' : 'danger'}">
                        ${detected ? '✅' : '❌'} ${selectedSafeguard}
                    </span>
                </div>
            `;
        }
        
        // Add prompt content
        const content = document.createElement('div');
        content.innerHTML = `
            <h5>${prompt.Goal || prompt.Behavior}</h5>
            ${contentType === 'Adversarial' ? 
                `<div class="jailbreak-content mt-3">
                    <strong>Jailbreak Attempt:</strong>
                    <p class="text-muted">${prompt.Jailbreak || prompt.Attack}</p>
                </div>` : 
                `<div class="behavior-content mt-3">
                    <strong>Expected Behavior:</strong>
                    <p class="text-muted">${prompt.Behavior}</p>
                </div>`
            }
            ${prompt.Category ? `<div class="mt-2"><strong>Category:</strong> ${prompt.Category}</div>` : ''}
        `;
        
        card.appendChild(detectionHeader);
        card.appendChild(content);
        promptsContainer.appendChild(card);
    });
}

// Enhanced Recommendation System
function generateRecommendation(preferences) {
    const safeguards = window.loadedData.safeguardData;
    
    // Define weight factors for different criteria
    const weights = {
        systemCompatibility: 3,
        ragCompatibility: 2,
        performance: {
            Low: 1,
            Medium: 2,
            High: 3
        },
        riskLevel: {
            'Very Low': 1,
            'Low': 2,
            'Medium': 3,
            'High': 4
        },
        interactionTypes: {
            'General chat': 1,
            'Content generation': 1.5,
            'Code generation': 2,
            'Data analysis': 1.5,
            'Expert advice': 2,
            'Customer service': 1
        },
        bellsScore: 2.5,
        falsePositiveRate: 2,
        latency: {
            Low: 3,
            Medium: 2,
            High: 1
        }
    };

    const scoredSafeguards = safeguards.map(safeguard => {
        let score = 0;
        let scoreBreakdown = {};

        // System compatibility score
        const systemScore = calculateSystemCompatibilityScore(safeguard, preferences.systemType);
        score += systemScore * weights.systemCompatibility;
        scoreBreakdown.systemCompatibility = systemScore;

        // RAG compatibility score
        const ragScore = calculateRagCompatibilityScore(safeguard, preferences.ragEnabled);
        score += ragScore * weights.ragCompatibility;
        scoreBreakdown.ragCompatibility = ragScore;

        // Performance score based on request volume
        const performanceScore = calculatePerformanceScore(safeguard, preferences.requestVolume);
        score += performanceScore * weights.performance[preferences.requestVolume];
        scoreBreakdown.performance = performanceScore;

        // Risk level consideration
        const riskScore = calculateRiskScore(safeguard, preferences.riskLevel);
        score += riskScore * weights.riskLevel[preferences.riskLevel];
        scoreBreakdown.riskLevel = riskScore;

        // Interaction types compatibility
        const interactionScore = calculateInteractionScore(safeguard, preferences.interactionTypes, weights.interactionTypes);
        score += interactionScore;
        scoreBreakdown.interactionTypes = interactionScore;

        // BELLS score weight
        const bellsScore = safeguard.BELLS_score * weights.bellsScore;
        score += bellsScore;
        scoreBreakdown.bellsScore = bellsScore;

        return {
            safeguard: safeguard.safeguard,
            score: score,
            details: safeguard,
            scoreBreakdown: scoreBreakdown
        };
    });

    // Normalize scores to 0-100 range
    const maxScore = Math.max(...scoredSafeguards.map(s => s.score));
    scoredSafeguards.forEach(s => {
        s.normalizedScore = (s.score / maxScore) * 100;
    });

    // Sort by normalized score
    scoredSafeguards.sort((a, b) => b.normalizedScore - a.normalizedScore);

    return {
        topRecommendations: scoredSafeguards.slice(0, 3),
        explanation: generateDetailedExplanation(preferences, scoredSafeguards[0]),
        scoreBreakdown: scoredSafeguards[0].scoreBreakdown
    };
}

// Helper functions for scoring
function calculateSystemCompatibilityScore(safeguard, systemType) {
    if (systemType === 'Black Box API' && safeguard.api_available) return 1;
    if (systemType === 'Direct Access' && safeguard.self_hosted) return 1;
    return 0.3; // Partial compatibility
}

function calculateRagCompatibilityScore(safeguard, ragEnabled) {
    if (ragEnabled === 'Yes' && safeguard.rag_compatible) return 1;
    if (ragEnabled === 'No') return 1;
    return 0.5;
}

function calculatePerformanceScore(safeguard, requestVolume) {
    const volumeScores = {
        'Low': 1,
        'Medium': safeguard.performance_score,
        'High': safeguard.performance_score * safeguard.performance_score
    };
    return volumeScores[requestVolume];
}

function calculateRiskScore(safeguard, riskLevel) {
    const riskScores = {
        'Very Low': safeguard.BELLS_score,
        'Low': safeguard.BELLS_score * 1.2,
        'Medium': safeguard.BELLS_score * 1.5,
        'High': safeguard.BELLS_score * 2
    };
    return riskScores[riskLevel];
}

function calculateInteractionScore(safeguard, interactionTypes, weights) {
    return interactionTypes.reduce((score, type) => {
        return score + (weights[type] || 1) * safeguard.BELLS_score;
    }, 0) / interactionTypes.length;
}

// Utility function for debouncing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Recommendation System functionality
function initializeRecommendationSystem() {
    const form = document.getElementById('recommendationForm');
    form.addEventListener('submit', handleRecommendation);
}

function handleRecommendation(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const preferences = {
        systemType: formData.get('systemType'),
        ragEnabled: formData.get('ragEnabled'),
        interactionTypes: formData.getAll('interactionTypes'),
        requestVolume: formData.get('requestVolume'),
        riskLevel: formData.get('riskLevel')
    };
    
    // Generate recommendation based on preferences
    const recommendation = generateRecommendation(preferences);
    displayRecommendation(recommendation);
}

function displayRecommendation(recommendation) {
    const resultDiv = document.getElementById('recommendationResult');
    resultDiv.innerHTML = `
        <div class="card">
            <div class="card-body">
                <h4 class="card-title">Recommended Safeguards</h4>
                <div class="row">
                    ${recommendation.topRecommendations.map((rec, index) => `
                        <div class="col-md-4">
                            <div class="card ${index === 0 ? 'border-primary' : ''}">
                                <div class="card-body">
                                    <h5 class="card-title">
                                        ${index === 0 ? '🏆 ' : ''}${rec.safeguard}
                                    </h5>
                                    <p class="card-text">
                                        BELLS Score: ${rec.details.BELLS_score}<br>
                                        Match Score: ${rec.score.toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="mt-4">
                    <h5>Recommendation Analysis</h5>
                    ${recommendation.explanation}
                </div>
            </div>
        </div>
    `;
}

function toggleAnalysis(analysisId) {
    const content = document.getElementById(analysisId);
    content.classList.toggle('show');
    
    const button = content.previousElementSibling;
    const icon = button.querySelector('i');
    
    if (content.classList.contains('show')) {
        button.innerHTML = `<i class="fas fa-chart-line"></i> Hide Analysis`;
    } else {
        button.innerHTML = `<i class="fas fa-chart-line"></i> View Analysis`;
    }
} 