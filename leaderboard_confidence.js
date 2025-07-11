// Add this at the top of the file
function toggleAnalysis(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const analysisId = button.getAttribute('data-analysis');
    const analysisContent = document.querySelector(`[data-analysis-content="${analysisId}"]`);
    
    if (!analysisContent) {
        console.error(`Analysis content not found for id: ${analysisId}`);
        return;
    }

    // Toggle visibility directly with display property
    const isVisible = analysisContent.style.display !== 'none';
    analysisContent.style.display = isVisible ? 'none' : 'block';

    // Remove existing icon if present
    const existingIcon = button.querySelector('i');
    if (existingIcon) {
        existingIcon.remove();
    }

    // Create new icon
    const icon = document.createElement('i');
    icon.className = isVisible ? 'fas fa-chart-line' : 'fas fa-chevron-up';
    
    // Update button text
    button.textContent = isVisible ? ' View Analysis' : ' Hide Analysis';
    button.insertBefore(icon, button.firstChild);
}

// Data loading function
async function loadData() {
    console.log("Starting data loading...");
    const dataFiles = {
        safeguardData: 'data/safeguard_evaluation_results.csv',
        confidenceData: 'data/safeguard_evaluation_results_confidence.csv',
        coherenceData: 'data/metacognitive_results.csv',
        llamaGuardData: 'data/safeguard_evaluation_results_llama.csv'
    };

    try {
        const [safeguardResponse, confidenceResponse, coherenceResponse, llamaGuardResponse] = await Promise.all([
            fetch(dataFiles.safeguardData),
            fetch(dataFiles.confidenceData),
            fetch(dataFiles.coherenceData),
            fetch(dataFiles.llamaGuardData)
        ]);
        
        if (!safeguardResponse.ok || !confidenceResponse.ok || !coherenceResponse.ok || !llamaGuardResponse.ok) {
            throw new Error('One or more HTTP requests failed');
        }
        
        const safeguardData = d3.csvParse(await safeguardResponse.text());
        const confidenceData = d3.csvParse(await confidenceResponse.text());
        const coherenceData = d3.csvParse(await coherenceResponse.text());
        const llamaGuardData = d3.csvParse(await llamaGuardResponse.text());
        
        // Validate data
        console.log('CSV columns:', Object.keys(safeguardData[0]));
        console.log('Confidence CSV columns:', Object.keys(confidenceData[0]));
        console.log('Sample row:', safeguardData[0]);
        console.log('Llama Guard Data:', llamaGuardData[0]);

        
        return {
            standardData: safeguardData,
            confidenceData: confidenceData,
            coherenceData: coherenceData,
            llamaGuardData: llamaGuardData
        };
    } catch (error) {
        console.error("Error loading data:", error);
        throw error;
    }
}

// Visualization functions (from original scripts.js)
function createStatsCards(data) {
    // ... (copy the existing createStatsCards function)
}

function createBELLSScorePlot(data) {
    // Sort data by BELLS score
    const sortedData = [...confidenceData].sort((a, b) => parseFloat(b.bells_score) - parseFloat(a.bells_score));

    const trace = {
        x: sortedData.map(d => parseFloat(d.bells_score)),
        y: sortedData.map(d => d.safeguard),
        type: 'bar',
        orientation: 'h',
        marker: {
            color: '#4A90E2',
            opacity: 0.8
        }
    };

    const layout = {
        title: 'BELLS Score Comparison',
        xaxis: {
            title: 'BELLS Score',
            range: [0, 1]
        },
        yaxis: {
            title: 'Safeguard'
        },
        margin: { l: 150 },  // Increase left margin for safeguard names
        height: 400,
        showlegend: false
    };

    Plotly.newPlot('bellsScorePlot', [trace], layout);
}

function createRadarPlot(data) {
    const metrics = [
        'tpr_harmful_adversarial',
        'tpr_harmful_non-adversarial',
        'tpr_borderline_adversarial',
        'tpr_borderline_non-adversarial',
        '1-fpr_benign'  // Using 1-FPR for consistency (higher is better)
    ];

    const metricLabels = [
        'TPR Harmful Adversarial',
        'TPR Harmful Non-Adversarial',
        'TPR Borderline Adversarial',
        'TPR Borderline Non-Adversarial',
        'TNR Benign'
    ];

    const traces = data.map(safeguard => ({
        type: 'scatterpolar',
        r: metrics.map(m => m === '1-fpr_benign' ? 
            1 - parseFloat(safeguard.fpr_benign) : 
            parseFloat(safeguard[m])),
        theta: metricLabels,
        name: safeguard.safeguard,
        fill: 'toself',
        opacity: 0.5
    }));

    const layout = {
        polar: {
            radialaxis: {
                visible: true,
                range: [0, 1]
            }
        },
        showlegend: true,
        title: 'Detection Performance Across Categories',
        height: 500
    };

    Plotly.newPlot('radarPlot', traces, layout);
}

function createHarmPreventionPlot(data) {
    // Prepare data for harm prevention plot
    const categories = ['harmful', 'borderline', 'benign'];
    const types = ['adversarial', 'non-adversarial'];
    
    const traces = data.map(safeguard => {
        const adversarialData = categories.map(cat => parseFloat(safeguard[`tpr_${cat}_adversarial`]));
        const nonAdversarialData = categories.map(cat => 
            cat === 'benign' ? 1 - parseFloat(safeguard.fpr_benign) : parseFloat(safeguard[`tpr_${cat}_non-adversarial`])
        );

        return {
            name: safeguard.safeguard,
            x: [...categories, ...categories],
            y: [...adversarialData, ...nonAdversarialData],
            type: 'scatter',
            mode: 'lines+markers',
            line: {
                dash: ['solid', 'dash'][0]
            }
        };
    });

    const layout = {
        title: 'Harm Prevention Performance',
        xaxis: {
            title: 'Content Category',
            showgrid: true
        },
        yaxis: {
            title: 'Detection Rate',
            range: [0, 1],
            showgrid: true
        },
        showlegend: true,
        height: 500
    };

    Plotly.newPlot('harmPreventionPlot', traces, layout);
}

function createRankingList(data) {
    const confidenceData = data.confidenceData;
    const standardData = data.standardData;
    
    // Sort data by BELLS score
    const sortedData = [...confidenceData].sort((a, b) => 
        parseFloat(b.BELLS_score_value) - parseFloat(a.BELLS_score_value));
    
    // Log data for debugging
    console.log('Confidence Data:', confidenceData);
    console.log('Sorted Data:', sortedData);
    
    const rankingContainer = document.getElementById('rankingList');
    rankingContainer.innerHTML = ''; // Clear existing content
    
    // Create header
    const header = document.createElement('div');
    header.className = 'ranking-header';
    header.innerHTML = `
        <div class="rank-column">
            <div class="column-title">Rank</div>
        </div>
        <div class="metric-column">
            <div class="column-title">
                Safeguard
            </div>
        </div>
        <div class="metric-column">
            <div class="column-title">
                Detection Rate
                <div class="metric-subtext">
                    Adversarial
                    <i class="fas fa-info-circle" data-bs-toggle="tooltip" data-bs-placement="top" 
                    title="Detection rate for adversarial harmful content, measuring how often safeguards successfully identify sophisticated attacks"></i>
                </div>
            </div>
        </div>
        <div class="metric-column">
            <div class="column-title">
                Detection Rate
                <div class="metric-subtext">
                    Non-Adversarial
                    <i class="fas fa-info-circle" data-bs-toggle="tooltip" data-bs-placement="top" 
                    title="Detection rate for direct harmful content, showing baseline effectiveness against straightforward harmful prompts"></i>
                </div>
            </div>
        </div>
        <div class="metric-column">
            <div class="column-title">
                False Positive Rate
                <i class="fas fa-info-circle" data-bs-toggle="tooltip" data-bs-placement="top" 
                title="False Positive Rate on non-harmful non-adversarial prompts, measuring over-triggering on safe content"></i>
            </div>
        </div>
        <div class="metric-column">
            <div class="column-title">
                BELLS Score
                <i class="fas fa-info-circle" data-bs-toggle="tooltip" data-bs-placement="top" 
                title="Balanced Evaluation of Language Learning Safeguards - A comprehensive metric combining detection rates and false positive rates"></i>
            </div>
        </div>
    `;
    rankingContainer.appendChild(header);

    // Add color legend
    const legend = document.createElement('div');
    legend.className = 'legend-scale mb-4';
    legend.innerHTML = `
        <div class="legend-item">
            <div class="legend-color poor"></div>
            <span>Limited (&lt; 50%)*</span>
        </div>
        <div class="legend-item">
            <div class="legend-color fair"></div>
            <span>Moderate (50-70%)*</span>
        </div>
        <div class="legend-item">
            <div class="legend-color good"></div>
            <span>Strong (70-90%)*</span>
        </div>
        <div class="legend-item">
            <div class="legend-color excellent"></div>
            <span>Very Strong (&gt; 90%)*</span>
        </div>
        <div class="legend-note">
            <span>* Inverted for False Positive Rate (lower is better)</span>
        </div>
    `;
    rankingContainer.appendChild(legend);

    // Find best scores for each metric
    const bestScores = {
        detection_adv: Math.max(...confidenceData.map(item => parseFloat(item.harmful_jailbreaks_value) || 0)),
        detection_non_adv: Math.max(...confidenceData.map(item => parseFloat(item["harmful_non-adversarial_value"]) || 0)),
        fpr: Math.min(...confidenceData.map(item => parseFloat(item["benign_non-adversarial_value"]) || 1)), // Lower is better for FPR
        bells: Math.max(...confidenceData.map(item => parseFloat(item.BELLS_score_value) || 0))
    };

    // Create ranking items
    sortedData.forEach((item, index) => {
        // Ensure all values are properly parsed with fallbacks to 0
        const bells_score = parseFloat(item.BELLS_score_value || 0).toFixed(3);
        const bells_confidence = parseFloat(item.BELLS_score_confidence || 0).toFixed(3);
        const detection_adv = (parseFloat(item.harmful_adversarial_value || 0) * 100).toFixed(1);
        const detection_adv_confidence = (parseFloat(item.harmful_adversarial_confidence || 0) * 100).toFixed(1);
        const detection_non_adv = (parseFloat(item["harmful_non-adversarial_value"] || 0) * 100).toFixed(1);
        const detection_non_adv_confidence = (parseFloat(item["harmful_non-adversarial_confidence"] || 0) * 100).toFixed(1);
        const fpr = (parseFloat(item["benign_non-adversarial_value"] || 0) * 100).toFixed(1);
        const fpr_confidence = (parseFloat(item["benign_non-adversarial_confidence"] || 0) * 100).toFixed(1);

        // Get raw values for color class determination
        const detection_adv_raw = parseFloat(item.harmful_adversarial_value || 0);
        const detection_non_adv_raw = parseFloat(item["harmful_non-adversarial_value"] || 0);
        const fpr_raw = parseFloat(item["benign_non-adversarial_value"] || 0);
        const bells_raw = parseFloat(item.BELLS_score_value || 0);
        
        // Create ranking item
        const rankingItem = document.createElement('div');
        rankingItem.className = `ranking-item ${index === 0 ? 'first-place' : ''}`;
        
        // Create rank number with medal for top 3
        let rankDisplay = '';
        if (index === 0) rankDisplay = '🥇';
        else if (index === 1) rankDisplay = '🥈';
        else if (index === 2) rankDisplay = '🥉';
        else rankDisplay = `#${index + 1}`;

        rankingItem.innerHTML = `
            <div class="rank-column">
                <div class="rank-number ${index < 3 ? 'medal-rank' : ''}">${rankDisplay}</div>
            </div>
            <div class="safeguard-column">
                <span class="safeguard-name">${item.safeguard}</span>
            </div>
            <div class="metric-column">
                <div class="score ${getScoreClass(detection_adv_raw)} ${Math.abs(detection_adv_raw - bestScores.detection_adv) < 0.001 ? 'best-score' : ''}">${detection_adv}% ±${detection_adv_confidence}%</div>
            </div>
            <div class="metric-column">
                <div class="score ${getScoreClass(detection_non_adv_raw)} ${Math.abs(detection_non_adv_raw - bestScores.detection_non_adv) < 0.001 ? 'best-score' : ''}">${detection_non_adv}% ±${detection_non_adv_confidence}%</div>
            </div>
            <div class="metric-column">
                <div class="score ${getScoreClass(1 - fpr_raw)} ${Math.abs(fpr_raw - bestScores.fpr) < 0.001 ? 'best-score' : ''}">${fpr}% ±${fpr_confidence}%</div>
            </div>
            <div class="metric-column">
                <div class="score ${getScoreClass(bells_raw)} ${Math.abs(bells_raw - bestScores.bells) < 0.001 ? 'best-score' : ''}">${bells_score} ±${bells_confidence}</div>
            </div>
        `;
        rankingContainer.appendChild(rankingItem);
    });

    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

function getScoreClass(value) {
    // Ensure value is treated as a decimal between 0 and 1
    const normalizedValue = value > 1 ? value / 100 : value;
    
    if (normalizedValue >= 0.9) return 'score-excellent';
    if (normalizedValue >= 0.7) return 'score-good';
    if (normalizedValue >= 0.5) return 'score-fair';
    return 'score-poor';
}

function createHeatmap(data) {
    const container = document.getElementById('customHeatmap');
    if (!container || !data) {
        console.error('Container or data not found for heatmap');
        return;
    }

    // Create grid container
    const grid = document.createElement('div');
    grid.className = 'heatmap-grid';
    
    // Add empty cell for top-left corner
    const cornerCell = document.createElement('div');
    grid.appendChild(cornerCell);
    
    // Add column headers
    const categories = [
        'Harassment/Discrimination',
        'Malware/Hacking',
        'Physical_harm',
        'Economic_harm',
        'Fraud/Deception',
        'Disinformation',
        'Sexual/Adult_content',
        'Privacy',
        'Expert_advice',
        'Government_decision_making',
        'CBRN'
    ];

    categories.forEach(category => {
        const header = document.createElement('div');
        header.className = 'heatmap-col-label';
        // Special handling for Harassment/Discrimination
        if (category === 'Harassment/Discrimination') {
            header.innerHTML = 'Harassment/<br>Discrimination';
        } else {
            header.textContent = category.replace(/_/g, ' ');
        }
        grid.appendChild(header);
    });

    // Add data rows
    data.forEach(item => {
        // Add row label
        const rowLabel = document.createElement('div');
        rowLabel.className = 'heatmap-row-label safeguard-name';
        rowLabel.textContent = item.safeguard;
        grid.appendChild(rowLabel);

        // Add score cells
        categories.forEach(category => {
            const score = parseFloat(item[category]) || 0;
            const cell = document.createElement('div');
            cell.className = `heatmap-cell ${getScoreClass(score)}`;
            cell.style.fontWeight = 'normal';
            cell.textContent = (score * 100).toFixed(1) + '%';
            
            // Add hover tooltip
            cell.addEventListener('mouseover', (e) => {
                showTooltip(e, item.safeguard, category, score);
            });
            cell.addEventListener('mouseout', hideTooltip);
            
            grid.appendChild(cell);
        });
    });

    container.appendChild(grid);

    // Add legend
    addLegend(container);
}

function showTooltip(event, safeguard, category, score) {
    const tooltipContainer = document.querySelector('.heatmap-tooltip');
    if (!tooltipContainer) {
        console.error('Tooltip container not found');
        return;
    }
    
    tooltipContainer.innerHTML = `
        <div class="tooltip-content">
            <strong>${safeguard}</strong><br>
            Category: ${category.replace(/_/g, ' ')}<br>
            Score: ${(score * 100).toFixed(1)}%
        </div>
    `;
    
    // Position tooltip relative to viewport
    const rect = event.target.getBoundingClientRect();
    const tooltipX = rect.left + (rect.width / 2);
    const tooltipY = rect.top;
    
    tooltipContainer.style.left = `${tooltipX}px`;
    tooltipContainer.style.top = `${tooltipY - 10}px`;
    tooltipContainer.style.transform = 'translate(-50%, -100%)';
    tooltipContainer.style.display = 'block';
}

function hideTooltip() {
    const tooltipContainer = document.querySelector('.heatmap-tooltip');
    if (tooltipContainer) {
        tooltipContainer.style.display = 'none';
    }
}

function addLegend(container) {
    const legend = document.createElement('div');
    legend.className = 'heatmap-legend';
    legend.innerHTML = `
        <div class="legend-item">
            <div class="legend-color score-excellent"></div>
            <span>Very Strong (≥90%)</span>
        </div>
        <div class="legend-item">
            <div class="legend-color score-good"></div>
            <span>Strong (70-90%)</span>
        </div>
        <div class="legend-item">
            <div class="legend-color score-fair"></div>
            <span>Moderate (50-70%)</span>
        </div>
        <div class="legend-item">
            <div class="legend-color score-poor"></div>
            <span>Limited (<50%)</span>
        </div>
    `;
    container.appendChild(legend);
}

function createFPRComparison(data) {
    // Configuration
    const margin = { top: 60, right: 30, bottom: 100, left: 150 };
    const width = 1000 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    // Process data
    const processedData = data.map(d => ({
        safeguard: d.safeguard,
        fpr: Math.min(100, parseFloat(d['benign_non-adversarial']) * 100)
    })).sort((a, b) => a.fpr - b.fpr);

    // Create SVG
    d3.select("#fprPlot").html("");
    const svg = d3.select("#fprPlot")
        .append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Define scales
    const x = d3.scaleBand()
        .range([0, width])
        .domain(processedData.map(d => d.safeguard))
        .padding(0.4);

    const y = d3.scaleLinear()
        .range([height, 0])
        .domain([0, 100]);

    // Add grid lines
    svg.append("g")
        .attr("class", "grid-lines")
        .call(d3.axisLeft(y)
            .tickSize(-width)
            .tickFormat("")
            .ticks(5));

    // Add bars with gradient based on performance
    svg.selectAll("rect.bar")
        .data(processedData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.safeguard))
        .attr("y", d => y(d.fpr))
        .attr("width", x.bandwidth())
        .attr("height", d => height - y(d.fpr))
        .attr("rx", 6)
        .attr("ry", 6)
        .style("fill", d => {
            const color = d3.scaleLinear()
                .domain([0, 50, 100])
                .range(["#0567a5", "#f6a4a4", "#dc2626"]);
            return color(d.fpr);
        });

    // Add X axis
    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end");

    // Add Y axis
    svg.append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(y)
            .ticks(5)
            .tickFormat(d => d + "%"));

    // Add value labels
    svg.selectAll(".value-label")
        .data(processedData)
        .enter()
        .append("text")
        .attr("class", "value-label")
        .attr("x", d => x(d.safeguard) + x.bandwidth() / 2)
        .attr("y", d => y(d.fpr) - 10)
        .attr("text-anchor", "middle")
        .text(d => `${d.fpr.toFixed(1)}%`);

    // Add title with consistent styling
    svg.append("text")
        .attr("class", "plot-title")
        .attr("x", width / 2)
        .attr("y", -margin.top / 2)
        .attr("text-anchor", "middle")
        .text("False Positive Rate (Lower is Better)");

    // Add subtitle with consistent styling
    svg.append("text")
        .attr("class", "plot-subtitle")
        .attr("x", width / 2)
        .attr("y", -margin.top / 2 + 25)
        .attr("text-anchor", "middle")
        .text("Percentage of benign inputs incorrectly flagged as harmful");
}

function createJailbreakComparison(data) {
    // Add this at the beginning of the function
    // Create container if it doesn't exist
    let container = document.querySelector('.jailbreak-plot-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'jailbreak-plot-container';
        const backButtonContainer = document.createElement('div');
        backButtonContainer.className = 'back-button-container';
        container.appendChild(backButtonContainer);
        document.getElementById('jailbreakPlot').parentNode.insertBefore(container, document.getElementById('jailbreakPlot'));
        container.appendChild(document.getElementById('jailbreakPlot'));
    }

    // Initialize view state
    let currentView = 'type';
    let currentType = null;

    // Mapping of jailbreak types to their sources
    const typeToSourceMapping = {
        'generative': ['PAIR'],
        'narrative': ['huggingface', 'deck_of_many_prompts', 'deep_inception'],
        'syntactic': ['base64', 'rot13', 'binary', 'hex', 'ascii', 'leet', 'url_encoded', 'uppercase', 'reverse']
    };

    // Professional color palette using corporate-friendly colors
    const colors = {
        'Generative': '#1e40af',   // Dark blue
        'Narrative': '#2563eb',    // Medium blue  
        'Syntactic': '#3b82f6'     // Light blue
    };

    // Updated source colors for a more professional palette
    const sourceColors = {
        // Generative sources - Blues
        'PAIR': '#1e40af',
        'deck_of_many_prompts': '#2563eb',
        'deep_inception': '#3b82f6',
        
        // Narrative sources - Grays
        'huggingface': '#334155',
        'url_encoded': '#475569',
        'uppercase': '#64748b',
        'reverse': '#94a3b8',
        'disemvowel': '#cbd5e1',
        
        // Syntactic sources - Cool grays (for table)
        'base64': '#1f2937',
        'rot13': '#374151',
        'binary': '#4b5563',
        'hex': '#6b7280',
        'ascii': '#9ca3af',
        'leet': '#d1d5db'
    };

    // Common layout settings
    // In createJailbreakComparison function, update the commonLayout
    const commonLayout = {
        barmode: 'group',
        bargap: 0.15,
        bargroupgap: 0.1,
        xaxis: {
            tickfont: { size: 12 }
        },
        yaxis: {
            title: 'Detection Rate',
            range: [0, 1],
            tickformat: ',.0%',
            gridcolor: '#e2e8f0',
            gridwidth: 1
        },
        legend: {
            orientation: 'h',
            y: -0.28,  // Moved further down to avoid overlap with x labels
            xanchor: 'center',
            x: 0.5,
            bgcolor: 'rgba(255, 255, 255, 0.9)',
            bordercolor: '#e2e8f0',
            borderwidth: 1
        },
        margin: { l: 60, r: 30, t: 40, b: 80 },  // Increased bottom margin from 80 to 100
        height: 500,
        width: null,  // Keep responsive
        autosize: true,
        showlegend: true,
        hovermode: 'closest',
        hoverlabel: { 
            bgcolor: '#1e293b',
            bordercolor: '#475569',
            font: { 
                size: 13,
                color: 'white'
            }
        },
        plot_bgcolor: 'white',
        paper_bgcolor: 'white'
    };
    

    function createTypeView() {
        currentView = 'type';
        currentType = null;

        // Clear the back button container
        const backButtonContainer = document.querySelector('.back-button-container');
        backButtonContainer.innerHTML = ''; // Empty the container but keep it

        // Clear any existing table
        const existingTable = document.querySelector('.syntactic-table');
        if (existingTable) existingTable.remove();

        // Clear the plot div and ensure it's visible
        const plotDiv = document.getElementById('jailbreakPlot');
        plotDiv.style.display = 'block';
        plotDiv.innerHTML = '';

        const typeData = {
            'Generative': data.map(d => parseFloat(d.jailbreak_type_generative)),
            'Narrative': data.map(d => parseFloat(d.jailbreak_type_narrative)),
            'Syntactic': data.map(d => parseFloat(d.jailbreak_type_syntactic))
        };

        const traces = Object.entries(typeData).map(([type, values]) => ({
            name: type,
            x: data.map(d => d.safeguard),
            y: values,
            type: 'bar',
            marker: { 
                color: colors[type],
                line: { 
                    color: colors[type].replace('0.85', '1'), 
                    width: 1 
                },
                shape: 'rounded',
                radius: 4
            },
            hovertemplate: `<b>%{x}</b><br>${type}: %{y:.1%}<extra></extra>`
        }));

        const layout = {
            ...commonLayout,
            title: 'Click on a jailbreak type in the legend to see source breakdown',
            xaxis: {
                ...commonLayout.xaxis,
                title: 'Supervision Systems'
            }
        };

        Plotly.newPlot('jailbreakPlot', traces, layout, {
            responsive: true,
            displayModeBar: false
        });

        const plot = document.getElementById('jailbreakPlot');
        plot.on('plotly_legendclick', function(data) {
            const type = data.data[data.curveNumber].name.toLowerCase();
            if (type === 'syntactic') {
                createSyntacticTable(type);
            } else {
                createSourceView(type);
            }
            return false;
        });
    }

    function createSourceView(type) {
        currentView = 'source';
        currentType = type;

        const relevantSources = typeToSourceMapping[type];
        
        const traces = relevantSources.map(source => {
            const displayName = source.split('_')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            
            // Get values for this source
            const values = data.map(d => parseFloat(d[`jailbreak_source_${source}`]));
            
            // Create array of objects with safeguard names and values for sorting
            const sortedData = data.map((d, i) => ({
                safeguard: d.safeguard,
                value: values[i]
            })).sort((a, b) => b.value - a.value); // Sort by decreasing value
            
            return {
                name: displayName,
                x: sortedData.map(d => d.safeguard), // Use sorted safeguard names
                y: sortedData.map(d => d.value),     // Use sorted values
                type: 'bar',
                marker: { 
                    color: sourceColors[source],
                    line: { 
                        color: sourceColors[source],
                        width: 1 
                    },
                    shape: 'rounded',
                    radius: 4
                },
                hovertemplate: `<b>%{x}</b><br>${displayName}: %{y:.1%}<extra></extra>`
            };
        });

        const layout = {
            ...commonLayout,
            title: `${type.charAt(0).toUpperCase() + type.slice(1)} Jailbreak Sources`,
            xaxis: {
                ...commonLayout.xaxis,
                title: 'Supervision Systems',
                tickangle: 0
            }
        };

        // Replace empty container content with actual button
        const backButton = document.createElement('button');
        backButton.textContent = '← Back to Types View';
        backButton.className = 'back-button';
        backButton.onclick = createTypeView;

        const container = document.querySelector('.back-button-container');
        container.innerHTML = ''; // Clear the container
        container.appendChild(backButton);

        Plotly.newPlot('jailbreakPlot', traces, layout, {
            responsive: true,
            displayModeBar: false
        });
    }

    function createSyntacticTable(type) {
        currentView = 'source';
        currentType = type;

        // Clear the plot div
        const plotDiv = document.getElementById('jailbreakPlot');
        plotDiv.style.display = 'none';

        // Remove any existing table
        const existingTable = document.querySelector('.syntactic-table');
        if (existingTable) existingTable.remove();

        // Create and add back button
        const backButton = document.createElement('button');
        backButton.textContent = '← Back to Types View';
        backButton.className = 'back-button';
        backButton.onclick = createTypeView;

        const container = document.querySelector('.back-button-container');
        container.innerHTML = ''; // Clear the container
        container.appendChild(backButton);

        // Create table
        const table = document.createElement('table');
        table.className = 'syntactic-table';

        // Get sources for syntactic type
        const syntacticSources = typeToSourceMapping[type];
        
        // Format source names for header
        const sourceHeaders = syntacticSources.map(source => 
            source.split('_')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ')
        );

        // Create header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `
            <th>Supervision System</th>
            ${sourceHeaders.map(header => `<th>${header}</th>`).join('')}
        `;
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create body
        const tbody = document.createElement('tbody');
        data.forEach(safeguard => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${safeguard.safeguard}</td>
                ${syntacticSources.map(source => `
                    <td>${(parseFloat(safeguard[`jailbreak_source_${source}`]) * 100).toFixed(1)}%</td>
                `).join('')}
            `;
            tbody.appendChild(row);
        });
        table.appendChild(tbody);

        // Add table to plot div
        plotDiv.parentNode.insertBefore(table, plotDiv.nextSibling);
    }

    // Initialize with type view
    createTypeView();
}

function toggleInterpretation(interpretationId) {
    const content = document.getElementById(interpretationId);
    const button = content.previousElementSibling;
    
    // Toggle the content visibility
    content.classList.toggle('show');
    
    // Update button text and icon
    if (content.classList.contains('show')) {
        button.innerHTML = '<i class="fas fa-lightbulb"></i>Hide Interpretation';
    } else {
        button.innerHTML = '<i class="fas fa-lightbulb"></i>View Interpretation';
    }
}

function createSensitivityAnalysis(data) {
    // Common layout settings
    const commonLayout = {
        barmode: 'group',
        bargap: 0.15,
        bargroupgap: 0.1,
        xaxis: {
            title: 'Supervision Systems',
            tickfont: { size: 12 },
            tickangle: -45
        },
        yaxis: {
            title: 'Detection Rate',
            range: [0, 1],
            tickformat: ',.0%',
            gridcolor: '#e2e8f0',
            gridwidth: 1
        },
        legend: {
            title: { text: 'Content Category' },
            orientation: 'h',
            y: -0.5,  // Changed from -0.4 to -0.5
            xanchor: 'center',
            x: 0.5
        },
        margin: { l: 60, r: 20, t: 40, b: 120 },  // Increased bottom margin from 100 to 120
        height: 500,
        showlegend: true,
        hovermode: 'closest',
        hoverlabel: { 
            bgcolor: '#1e293b',  // Dark background for better contrast
            bordercolor: '#475569',
            font: { 
                size: 13,
                color: 'white'  // White text for better visibility
            }
        },
        plot_bgcolor: 'white',
        paper_bgcolor: 'white'
    };

    // Color scheme with better contrast and opacity
    const colors = {
        benign: 'rgba(75, 85, 99, 0.85)',
        borderline: 'rgba(245, 158, 11, 0.85)',
        harmful: 'rgba(220, 38, 38, 0.85)'
    };

    // Common trace settings
    const createTrace = (name, color, borderColor, yValues) => ({
        name,
        x: data.map(d => d.safeguard),
        y: yValues,
        type: 'bar',
        marker: { 
            color,
            line: {
                color: borderColor,
                width: 1
            },
            shape: 'rounded',  // Rounded corners for bars
            radius: 4         // Radius size for rounded corners
        },
        hovertemplate: `<b>%{x}</b><br>${name}: %{y:.1%}<extra></extra>`,
        hoverlabel: {
            align: 'left'
        }
    });

    // Create traces for standard content
    const standardTraces = [
        createTrace('Benign', colors.benign, 'rgba(75, 85, 99, 1)', 
            data.map(d => parseFloat(d['benign_non-adversarial']))),
        createTrace('Borderline', colors.borderline, 'rgba(245, 158, 11, 1)', 
            data.map(d => parseFloat(d['borderline_non-adversarial']))),
        createTrace('Harmful', colors.harmful, 'rgba(220, 38, 38, 1)', 
            data.map(d => parseFloat(d['harmful_non-adversarial'])))
    ];

    // Create traces for adversarial content
    const adversarialTraces = [
        createTrace('Benign', colors.benign, 'rgba(75, 85, 99, 1)', 
            data.map(d => parseFloat(d['benign_jailbreaks']))),
        createTrace('Borderline', colors.borderline, 'rgba(245, 158, 11, 1)', 
            data.map(d => parseFloat(d['borderline_jailbreaks']))),
        createTrace('Harmful', colors.harmful, 'rgba(220, 38, 38, 1)', 
            data.map(d => parseFloat(d['harmful_jailbreaks'])))
    ];

    const config = {
        responsive: true,
        displayModeBar: false,
        staticPlot: false
    };

    Plotly.newPlot('harmfulnessSensitivityPlot', 
        standardTraces, 
        {
            ...commonLayout, 
            title: 'Standard Content Sensitivity'
        },
        config
    );

    Plotly.newPlot('adversarialSensitivityPlot', 
        adversarialTraces, 
        {
            ...commonLayout, 
            title: 'Adversarial Content Sensitivity'
        },
        config
    );
}

// Add this function after the createSensitivityAnalysis function
function createCoherenceAnalysis(data) {
    const plotDiv = document.getElementById('coherencePlot');
    if (!plotDiv) {
        console.error("Coherence plot div not found!");
        return;
    }

    console.log("Starting createCoherenceAnalysis with data:", data);

    // Process the data
    const modelGroups = {};
    
    // Helper function to format model names
    function formatModelName(name) {
        return name
            .replace('claude-3-', 'Claude 3.')  // Claude models
            .replace('claude-3.5-', 'Claude 3.5 ')
            .replace('claude-3.7-', 'Claude 3.7 ')
            .replace('sonnet-20250419', '')
            .replace('-20250419', '')
            .replace('-latest', '')
            .replace('gpt-4', 'GPT-4')  // GPT models
            .replace('gpt-3.5-turbo', 'GPT-3.5')
            .replace('gpt-4o', 'GPT-4o')
            .replace('deepseek-ai/deepseek-v3', 'DeepSeek V3')  // Other models
            .replace('meta/llama-2', 'Llama-2')
            .replace('meta/llama-3', 'Llama-3')
            .replace('mistral/mixtral', 'Mixtral')
            .replace('gemini-1.5', 'Gemini 1.5')
            .replace('gemini-2.5', 'Gemini 2.5');
    }

    data.forEach(row => {
        let modelName = formatModelName(row.model);

        // Default to coherent
        let incoherenceType = 'coherent';
        
        if (row.harmfulness === 'harmful' && row.response_type === 'answers') {
            incoherenceType = 'harmful_but_answers';
        }
        
        if (row.harmfulness === 'not_harmful' && 
            (row.response_type === 'refuses' || row.response_type === 'hedges')) {
            incoherenceType = 'benign_but_refuses';
        }

        if (!modelGroups[modelName]) {
            modelGroups[modelName] = {
                total: 0,
                coherent: 0,
                harmful_but_answers: 0,
                benign_but_refuses: 0
            };
        }
        
        modelGroups[modelName].total++;
        modelGroups[modelName][incoherenceType]++;
    });

    // Calculate percentages
    const processedData = {};
    Object.entries(modelGroups).forEach(([model, counts]) => {
        processedData[model] = {
            harmful_but_answers: counts.harmful_but_answers / counts.total,
            benign_but_refuses: counts.benign_but_refuses / counts.total
        };
    });

    // Sort models by total incoherence (descending)
    const sortedModels = Object.keys(processedData).sort((a, b) => {
        const totalA = processedData[a].harmful_but_answers + processedData[a].benign_but_refuses;
        const totalB = processedData[b].harmful_but_answers + processedData[b].benign_but_refuses;
        return totalB - totalA;
    });

    // Create traces for each incoherence type
    const traces = [
        {
            name: 'Classifies as Harmful but Answers',
            x: sortedModels,
            y: sortedModels.map(model => processedData[model].harmful_but_answers),
            type: 'bar',
            marker: {
                color: '#ff7f0e',
                line: {
                    color: '#ff7f0e',
                    width: 1
                }
            },
            text: sortedModels.map(model => 
                `${(processedData[model].harmful_but_answers * 100).toFixed(0)}%`
            ),
            textposition: 'auto',
            hovertemplate: '%{x}<br>%{y:.1%}<extra></extra>'
        },
        {
            name: 'Classifies as Benign but Refuses',
            x: sortedModels,
            y: sortedModels.map(model => processedData[model].benign_but_refuses),
            type: 'bar',
            marker: {
                color: '#1f77b4',
                line: {
                    color: '#1f77b4',
                    width: 1
                }
            },
            text: sortedModels.map(model => 
                `${(processedData[model].benign_but_refuses * 100).toFixed(0)}%`
            ),
            textposition: 'auto',
            hovertemplate: '%{x}<br>%{y:.1%}<extra></extra>'
        }
    ];

    const layout = {
        barmode: 'group',
        title: 'Types of Incoherence by Model',
        xaxis: {
            title: 'Model',
            tickangle: -45,
            tickfont: {
                size: 12
            }
        },
        yaxis: {
            title: 'Proportion of Responses',
            tickformat: ',.0%',
            range: [0, 1],
            gridcolor: '#e2e8f0',
            gridwidth: 1,
            ticktext: ['0%', '20%', '40%', '60%', '80%', '100%'],
            tickvals: [0, 0.2, 0.4, 0.6, 0.8, 1]
        },
        legend: {
            orientation: 'h',
            y: -0.7,  // Moved further down
            xanchor: 'center',
            x: 0.5,
            bgcolor: 'rgba(255, 255, 255, 0.9)',
            bordercolor: '#e2e8f0',
            borderwidth: 1
        },
        margin: {
            l: 60,
            r: 30,
            t: 40,
            b: 180  // Increased bottom margin to accommodate lower legend
        },
        height: 500,
        showlegend: true,
        hovermode: 'closest',
        hoverlabel: {
            bgcolor: '#1e293b',
            bordercolor: '#475569',
            font: {
                size: 13,
                color: 'white'
            }
        },
        plot_bgcolor: 'white',
        paper_bgcolor: 'white'
    };

    Plotly.newPlot('coherencePlot', traces, layout, {
        responsive: true,
        displayModeBar: false
    });
}

// Initialize interpretation sections on page load
document.addEventListener('DOMContentLoaded', function() {
    const interpretationContents = document.querySelectorAll('.interpretation-content');
    interpretationContents.forEach(content => {
        content.classList.remove('show');
        const button = content.previousElementSibling;
        button.innerHTML = '<i class="fas fa-lightbulb"></i>View Interpretation';
    });
    
    // Update how data is passed to functions
    loadData().then(data => {
        if (data) {
            createRankingList(data);
            createHeatmap(data.llamaGuardData);
            createFPRComparison(data.standardData);
            createJailbreakComparison(data.standardData);
            createSensitivityAnalysis(data.standardData);
            createCoherenceAnalysis(data.coherenceData);
        }
    }).catch(error => {
        console.error('Error loading data:', error);
    });
});

// Also check if the div exists in the HTML
document.addEventListener('DOMContentLoaded', function() {
    const jailbreakPlot = document.getElementById('jailbreakPlot');
    console.log("Jailbreak plot div exists:", !!jailbreakPlot);
}); 