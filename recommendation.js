// Data loading function
async function loadData() {
    const dataFiles = {
        safeguardData: '/data/safeguard_evaluation_results.csv'
    };

    try {
        console.log('Starting data loading...');
        
        const response = await fetch(dataFiles.safeguardData);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text();
        const safeguardData = d3.csvParse(csvText);
        console.log('Successfully loaded safeguard data:', safeguardData);

        return {
            safeguardData: safeguardData
        };
    } catch (error) {
        console.error('Error in loadData:', error);
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

function generateRecommendation(preferences) {
    const safeguards = window.loadedData.safeguardData;
    
    // Define weights for different scenarios
    const weights = {
        // System type compatibility weights
        systemTypeWeights: {
            'Black Box API': {
                api_available: 1.0,
                self_hosted: 0.2
            },
            'Direct Access': {
                api_available: 0.2,
                self_hosted: 1.0
            }
        },
        // Risk level weights for metrics
        riskLevelWeights: {
            'Very Low': {
                detection_rate_adversarial: 0.2,
                detection_rate_non_adversarial: 0.3,
                fpr: 0.5  // Higher weight on FPR for very low risk
            },
            'Low': {
                detection_rate_adversarial: 0.3,
                detection_rate_non_adversarial: 0.4,
                fpr: 0.3
            },
            'Medium': {
                detection_rate_adversarial: 0.4,
                detection_rate_non_adversarial: 0.4,
                fpr: 0.2
            },
            'High': {
                detection_rate_adversarial: 0.5,
                detection_rate_non_adversarial: 0.4,
                fpr: 0.1  // Lower weight on FPR for high risk
            }
        },
        // Request volume performance weights
        volumeWeights: {
            'Low': { performance_score: 0.2 },
            'Medium': { performance_score: 0.4 },
            'High': { performance_score: 0.6 }
        }
    };

    // Score each safeguard
    const scoredSafeguards = safeguards.map(safeguard => {
        let score = 0;
        let explanation = [];

        // 1. System Type Compatibility
        const systemScore = weights.systemTypeWeights[preferences.systemType][
            safeguard.api_available ? 'api_available' : 'self_hosted'
        ];
        score += systemScore;
        explanation.push({
            factor: 'System Compatibility',
            score: systemScore,
            details: `${preferences.systemType} compatibility: ${(systemScore * 100).toFixed(0)}%`
        });

        // 2. Risk Level Scoring
        const riskWeights = weights.riskLevelWeights[preferences.riskLevel];
        const riskScore = (
            safeguard.detection_rate_adversarial * riskWeights.detection_rate_adversarial +
            safeguard.detection_rate_non_adversarial * riskWeights.detection_rate_non_adversarial +
            (1 - safeguard.fpr) * riskWeights.fpr
        );
        score += riskScore;
        explanation.push({
            factor: 'Risk Management',
            score: riskScore,
            details: `Risk level (${preferences.riskLevel}) score: ${(riskScore * 100).toFixed(0)}%`
        });

        // 3. Performance Score based on volume
        const volumeScore = safeguard.performance_score * weights.volumeWeights[preferences.requestVolume].performance_score;
        score += volumeScore;
        explanation.push({
            factor: 'Performance',
            score: volumeScore,
            details: `Volume handling (${preferences.requestVolume}): ${(volumeScore * 100).toFixed(0)}%`
        });

        // 4. RAG Compatibility
        if (preferences.ragEnabled === 'Yes' && !safeguard.rag_compatible) {
            score *= 0.5;  // Significant penalty for RAG incompatibility
            explanation.push({
                factor: 'RAG Compatibility',
                score: -0.5,
                details: 'Penalty applied: Safeguard not compatible with RAG'
            });
        }

        return {
            safeguard: safeguard.safeguard,
            score: score,
            normalizedScore: 0,  // Will be calculated after
            details: safeguard,
            explanation: explanation
        };
    });

    // Normalize scores
    const maxScore = Math.max(...scoredSafeguards.map(s => s.score));
    scoredSafeguards.forEach(s => {
        s.normalizedScore = (s.score / maxScore) * 100;
    });

    // Sort by normalized score
    scoredSafeguards.sort((a, b) => b.normalizedScore - a.normalizedScore);

    return {
        topRecommendations: scoredSafeguards.slice(0, 3),
        explanation: generateDetailedExplanation(preferences, scoredSafeguards[0]),
        scoreBreakdown: scoredSafeguards[0].explanation
    };
}

function generateDetailedExplanation(preferences, topSafeguard) {
    return `
        <div class="recommendation-explanation">
            <h4>Analysis Based on Your Requirements</h4>
            <div class="requirements-summary">
                <h5>Your Requirements:</h5>
                <ul>
                    <li>System Type: ${preferences.systemType}</li>
                    <li>RAG Integration: ${preferences.ragEnabled}</li>
                    <li>Request Volume: ${preferences.requestVolume}</li>
                    <li>Risk Level: ${preferences.riskLevel}</li>
                    <li>Use Cases: ${preferences.interactionTypes.join(', ')}</li>
                </ul>
            </div>
            <div class="recommendation-rationale">
                <h5>Why ${topSafeguard.safeguard}?</h5>
                <ul>
                    <li>BELLS Score: ${topSafeguard.details.BELLS_score} 
                        (${getScoreQualification(topSafeguard.details.BELLS_score)})</li>
                    <li>Performance Rating: Handles ${preferences.requestVolume} volume efficiently</li>
                    <li>Risk Protection: Suitable for ${preferences.riskLevel} risk environments</li>
                    ${preferences.ragEnabled === 'Yes' ? 
                        `<li>RAG Compatible: Seamless integration with retrieval-augmented generation</li>` : ''}
                </ul>
            </div>
        </div>
    `;
}

function getScoreQualification(score) {
    if (score >= 0.9) return "Excellent";
    if (score >= 0.8) return "Very Good";
    if (score >= 0.7) return "Good";
    if (score >= 0.6) return "Fair";
    return "Basic";
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
                                            <strong>${rec.details.BELLS_score}</strong>
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
        const data = await loadData();
        window.loadedData = data;
        initializeRecommendationSystem();
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