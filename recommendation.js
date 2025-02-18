// Data loading function
async function loadData() {
    try {
        const response = await fetch('/data/safeguard_evaluation_results.csv');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const csvText = await response.text();
        return d3.csvParse(csvText);
    } catch (error) {
        console.error('Error loading data:', error);
        throw error;
    }
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
        primaryFocus: formData.get('primaryFocus'),
        jailbreakPriority: formData.get('jailbreakPriority'),
        minBellsScore: formData.get('minBellsScore'),
        maxFalsePositive: formData.get('maxFalsePositive'),
        categories: formData.getAll('categories')
    };
    
    // Generate recommendation based on preferences
    const recommendation = generateRecommendation(preferences);
    displayRecommendation(recommendation);
}

function generateRecommendation(preferences) {
    console.log("Selected categories:", preferences.categories);
    console.log("Available data columns:", Object.keys(window.safeguardData[0]));
    console.log("Generating recommendation with preferences:", preferences);
    const safeguards = window.safeguardData;

    // First, apply threshold filters
    let filteredSafeguards = safeguards.filter(safeguard => {
        const bellsScore = parseFloat(safeguard.BELLS_score);
        const falsePositiveRate = parseFloat(safeguard['benign_non-adversarial']);
        
        return bellsScore >= parseFloat(preferences.minBellsScore) && 
               falsePositiveRate <= parseFloat(preferences.maxFalsePositive);
    });

    if (filteredSafeguards.length === 0) {
        return formatError("No safeguards meet the minimum requirements. Try adjusting your thresholds.");
    }

    // Define base weights according to primary focus
    const baseWeights = {
        'benign': {
            benign_weight: 0.7,
            harmful_weight: 0.15,
            jailbreak_weight: 0.15
        },
        'harmful': {
            benign_weight: 0.2,
            harmful_weight: 0.6,
            jailbreak_weight: 0.2
        },
        'jailbreak': {
            benign_weight: 0.2,
            harmful_weight: 0.2,
            jailbreak_weight: 0.6
        },
        'balanced': {
            benign_weight: 0.33,
            harmful_weight: 0.33,
            jailbreak_weight: 0.34
        }
    };

    // Define jailbreak type weights
    const jailbreakWeights = {
        'narrative': { narrative: 0.6, syntactic: 0.2, generative: 0.2 },
        'syntactic': { narrative: 0.2, syntactic: 0.6, generative: 0.2 },
        'generative': { narrative: 0.2, syntactic: 0.2, generative: 0.6 },
        'balanced': { narrative: 0.33, syntactic: 0.33, generative: 0.34 }
    };

    // Define category mappings and weights
    const categoryColumns = {
        'Physical_harm': 'Physical_harm',
        'Economic_harm': 'Economic_harm',
        'Privacy': 'Privacy',
        'Harassment_and_discrimination': 'Harassment_and_discrimination',
        'Disinformation': 'Disinformation',
        'Expert_advice': 'Expert_advice',
        'Sexual/Adult_content': 'Sexual/Adult_content',
        'Malware/Hacking': 'Malware/Hacking',
        'Fraud/Deception': 'Fraud/Deception',
        'Government_decision_making': 'Government_decision_making',
        'CBRN': 'CBRN'
    };

    const selectedBaseWeights = baseWeights[preferences.primaryFocus];
    const selectedJailbreakWeights = jailbreakWeights[preferences.jailbreakPriority];

    // Score each safeguard
    const scoredSafeguards = filteredSafeguards.map(safeguard => {
        // Calculate base metrics
        const benignScore = 1 - parseFloat(safeguard['benign_non-adversarial']);
        const harmfulScore = parseFloat(safeguard['harmful_non-adversarial']);
        
        // Calculate weighted jailbreak score
        const jailbreakScore = (
            parseFloat(safeguard.jailbreak_type_narrative) * selectedJailbreakWeights.narrative +
            parseFloat(safeguard.jailbreak_type_syntactic) * selectedJailbreakWeights.syntactic +
            parseFloat(safeguard.jailbreak_type_generative) * selectedJailbreakWeights.generative
        );

        // Calculate base score
        let baseScore = (
            benignScore * selectedBaseWeights.benign_weight +
            harmfulScore * selectedBaseWeights.harmful_weight +
            jailbreakScore * selectedBaseWeights.jailbreak_weight
        );

        let finalScore = baseScore;
        let categoryAdjustment = 0;
        let categoryScores = {};

        // Category-specific scoring
        if (preferences.categories && preferences.categories.length > 0) {
            const categoryValues = preferences.categories.map(category => {
                const columnName = categoryColumns[category];
                const value = parseFloat(safeguard[columnName]);
                categoryScores[category] = isNaN(value) ? 0 : value;
                return isNaN(value) ? 0 : value;
            });
            
            const avgCategoryScore = categoryValues.reduce((a, b) => a + b, 0) / preferences.categories.length;
            categoryAdjustment = avgCategoryScore * 0.3; // 30% weight for categories
            finalScore = (baseScore * 0.7) + categoryAdjustment; // 70% base, 30% categories
        }

        // Score breakdown for transparency
        const scoreBreakdown = {
            benign: (benignScore * selectedBaseWeights.benign_weight).toFixed(3),
            harmful: (harmfulScore * selectedBaseWeights.harmful_weight).toFixed(3),
            jailbreak: (jailbreakScore * selectedBaseWeights.jailbreak_weight).toFixed(3),
            categoryAdjustment: preferences.categories.length > 0 ? categoryAdjustment.toFixed(3) : "N/A"
        };

        // Detailed metrics for display
        const metrics = {
            name: safeguard.safeguard,
            BELLS_score: parseFloat(safeguard.BELLS_score).toFixed(3),
            false_positive_rate: (parseFloat(safeguard['benign_non-adversarial']) * 100).toFixed(1),
            harmful_detection: (parseFloat(safeguard['harmful_non-adversarial']) * 100).toFixed(1),
            jailbreak_resistance: {
                overall: (jailbreakScore * 100).toFixed(1),
                narrative: (parseFloat(safeguard.jailbreak_type_narrative) * 100).toFixed(1),
                syntactic: (parseFloat(safeguard.jailbreak_type_syntactic) * 100).toFixed(1),
                generative: (parseFloat(safeguard.jailbreak_type_generative) * 100).toFixed(1)
            }
        };

        // Add category-specific scores
        if (Object.keys(categoryScores).length > 0) {
            metrics.category_scores = {};
            Object.entries(categoryScores).forEach(([category, score]) => {
                metrics.category_scores[category] = (score * 100).toFixed(1);
            });
        }

        return {
            name: safeguard.safeguard,
            score: finalScore,
            scoreBreakdown: scoreBreakdown,
            metrics: metrics
        };
    });

    // Sort by score and get top 3
    scoredSafeguards.sort((a, b) => b.score - a.score);
    return formatRecommendation(scoredSafeguards.slice(0, 3), preferences);
}

function formatRecommendation(recommendations, preferences) {
    const resultDiv = document.getElementById('recommendationResult');
    
    const rankLabels = ['🥇', '🥈', '🥉'];
    const rankClasses = ['first', 'second', 'third'];
    
    const html = `
        <div class="recommendation-cards">
            ${recommendations.map((rec, idx) => `
                <div class="recommendation-card ${rankClasses[idx]}">
                    <div class="rank-badge rank-${idx + 1}">${rankLabels[idx]}</div>
                    <div class="card-content">
                        <h3 class="safeguard-name">${rec.name}</h3>
                        <div class="metrics-breakdown">
                            <div class="metric">
                                <span>BELLS Score</span>
                                <strong>${rec.metrics.BELLS_score}</strong>
                            </div>
                            <div class="metric">
                                <span>False Positive Rate</span>
                                <strong>${rec.metrics.false_positive_rate}%</strong>
                            </div>
                            <div class="metric">
                                <span>Harmful Detection</span>
                                <strong>${rec.metrics.harmful_detection}%</strong>
                            </div>
                            <div class="metric">
                                <span>Jailbreak Resistance</span>
                                <strong>${rec.metrics.jailbreak_resistance.overall}%</strong>
                                <div class="small">
                                    Narrative: ${rec.metrics.jailbreak_resistance.narrative}% | 
                                    Syntactic: ${rec.metrics.jailbreak_resistance.syntactic}% | 
                                    Generative: ${rec.metrics.jailbreak_resistance.generative}%
                                </div>
                            </div>
                            ${Object.keys(rec.metrics.category_scores || {}).length > 0 ? `
                                <div class="metric">
                                    <span>Category Scores</span>
                                    ${Object.entries(rec.metrics.category_scores).map(([category, score]) => `
                                        <div class="small">
                                            ${category}: ${score}%
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    resultDiv.innerHTML = html;
}

function formatError(message) {
    return `
        <div class="alert alert-warning">
            <h4>Notice</h4>
            <p>${message}</p>
        </div>
    `;
}

function displayRecommendation(recommendation) {
    const resultDiv = document.getElementById('recommendationResult');
    resultDiv.innerHTML = `
        <div class="card">
            <div class="card-body">
                <h4 class="card-title">Recommended Safeguards</h4>
                <div class="row mb-4">
                    ${recommendation.topRecommendations.map((rec, index) => `
                        <div class="col-md-4">
                            <div class="card ${index === 0 ? 'border-primary' : ''}">
                                <div class="card-body">
                                    <h5 class="card-title">
                                        ${index === 0 ? '🏆 ' : ''}${rec.safeguard}
                                    </h5>
                                    <div class="score-details">
                                        <div class="score-item">
                                            <span>BELLS Score:</span>
                                            <strong>${rec.metrics.BELLS_score}</strong>
                                        </div>
                                        <div class="score-item">
                                            <span>Match Score:</span>
                                            <strong>${rec.normalizedScore.toFixed(1)}%</strong>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="recommendation-details">
                    ${recommendation.explanation}
                </div>
            </div>
        </div>
    `;
}

// Initialize everything when the document is ready
document.addEventListener('DOMContentLoaded', async function() {
    try {
        window.safeguardData = await loadData();
        console.log("Loaded data:", window.safeguardData); // Debug log
        initializeRecommendationSystem();
    } catch (error) {
        console.error('Initialization error:', error);
        document.querySelector('.dashboard-container').innerHTML = `
            <div class="alert alert-danger">
                <h4>Error</h4>
                <p>${error.message}</p>
            </div>
        `;
    }
}); 