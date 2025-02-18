// Data loading function
async function loadData() {
    const dataFiles = {
        nonAdversarial: 'data/non_adversarial_prompts.csv',
        adversarial: 'data/adversarial_prompts.csv'
    };

    try {
        console.log('Starting data loading...');
        
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

        // Debug log to check data structure
        console.log('Loaded data structure:', loadedData);

        // Organize data by harm level
        const datasets = {
            'Harmful': {
                'Non-Adversarial': loadedData.nonAdversarial.filter(d => d.harm_level === 'harmful'),
                'Adversarial': loadedData.adversarial.filter(d => d.harm_level === 'harmful')
            },
            'Borderline': {
                'Non-Adversarial': loadedData.nonAdversarial.filter(d => d.harm_level === 'borderline'),
                'Adversarial': loadedData.adversarial.filter(d => d.harm_level === 'borderline')
            },
            'Benign': {
                'Non-Adversarial': loadedData.nonAdversarial.filter(d => d.harm_level === 'benign'),
                'Adversarial': loadedData.adversarial.filter(d => d.harm_level === 'benign')
            }
        };

        // Debug log to check organized data
        console.log('Organized datasets:', datasets);

        return {
            datasets: datasets,
            safeguards: ['lakera_guard', 'prompt_guard', 'langkit', 'nemo', 'llm_guard']
        };
    } catch (error) {
        console.error('Error in loadData:', error);
        throw error;
    }
}

// Get detection probability based on dataset type and safeguard
function getDetectionProbability(safeguardName, datasetType, contentType, evaluationResults) {
    const safeguardData = evaluationResults.find(d => d.safeguard === safeguardName);
    if (!safeguardData) return 0;
    
    const columnName = contentType === 'Non-Adversarial' 
        ? `${datasetType.toLowerCase()}_non-adversarial`
        : `${datasetType.toLowerCase()}_jailbreaks`;
    
    return parseFloat(safeguardData[columnName]);
}

// Simulate detection with actual probabilities
function getDetectionResult(safeguardName, datasetType, contentType, evaluationResults) {
    const prob = getDetectionProbability(safeguardName, datasetType, contentType, evaluationResults);
    return Math.random() < prob;
}

function updateDynamicFilters(contentType) {
    const dynamicFilters = document.getElementById('dynamicFilters');
    const adversarialOnly = document.querySelectorAll('.adversarial-only');
    
    if (!window.loadedData) return;
    
    // Show/hide dynamic filters
    dynamicFilters.style.display = 'flex';
    adversarialOnly.forEach(el => {
        el.style.display = contentType === 'Adversarial' ? 'block' : 'none';
    });

    // Get current dataset
    const currentData = contentType === 'Adversarial' ? 
        window.loadedData.datasets['Harmful']['Adversarial'] :
        window.loadedData.datasets['Harmful']['Non-Adversarial'];

    // Update source filter
    const sources = [...new Set(currentData.map(item => item.source))].sort();
    const sourceFilter = document.getElementById('sourceFilter');
    sourceFilter.innerHTML = `
        <option value="All">All Sources</option>
        ${sources.map(source => `<option value="${source}">${source}</option>`).join('')}
    `;

    if (contentType === 'Adversarial') {
        // Update jailbreak type filter
        const types = [...new Set(currentData.map(item => item.jailbreak_type))].sort();
        const typeFilter = document.getElementById('jailbreakTypeFilter');
        typeFilter.innerHTML = `
            <option value="All">All Types</option>
            ${types.map(type => `<option value="${type}">${type}</option>`).join('')}
        `;

        // Update jailbreak source filter
        const jailbreakSources = [...new Set(currentData.map(item => item.jailbreak_source))].sort();
        const jailbreakSourceFilter = document.getElementById('jailbreakSourceFilter');
        jailbreakSourceFilter.innerHTML = `
            <option value="All">All Sources</option>
            ${jailbreakSources.map(source => `<option value="${source}">${source}</option>`).join('')}
        `;
    }

    // Update category filter
    const categories = [...new Set(currentData.map(item => item.category))].sort();
    const categoryFilter = document.getElementById('categoryFilter');
    categoryFilter.innerHTML = `
        <option value="All">All Categories</option>
        ${categories.map(category => `<option value="${category}">${category.replace('_', ' ')}</option>`).join('')}
    `;
}

function samplePrompts(prompts, maxPerCategory = 2) {
    // Group prompts by category, jailbreak type AND source
    const groupedPrompts = {};
    
    prompts.forEach(prompt => {
        const category = prompt.category;
        const jailbreakType = prompt.jailbreak_type;
        const jailbreakSource = prompt.jailbreak_source;
        
        // Create nested structure
        if (!groupedPrompts[category]) groupedPrompts[category] = {};
        if (!groupedPrompts[category][jailbreakType]) {
            groupedPrompts[category][jailbreakType] = {};
        }
        if (!groupedPrompts[category][jailbreakType][jailbreakSource]) {
            groupedPrompts[category][jailbreakType][jailbreakSource] = [];
        }
        
        groupedPrompts[category][jailbreakType][jailbreakSource].push(prompt);
    });
    
    // Sample prompts from each combination
    const sampledPrompts = [];
    
    Object.entries(groupedPrompts).forEach(([category, typeGroups]) => {
        Object.entries(typeGroups).forEach(([type, sourceGroups]) => {
            Object.entries(sourceGroups).forEach(([source, prompts]) => {
                // Take 1 prompt from each unique combination
                const sample = prompts
                    .sort(() => 0.5 - Math.random())
                    .slice(0, 1);  // Take just one from each combination
                sampledPrompts.push(...sample);
            });
        });
    });
    
    // If still too many prompts, take a random subset while ensuring at least
    // one example from each jailbreak source
    const maxTotalPrompts = 15;
    if (sampledPrompts.length > maxTotalPrompts) {
        // First, ensure we have one from each source
        const sources = [...new Set(sampledPrompts.map(p => p.jailbreak_source))];
        const guaranteedSamples = sources.map(source => {
            const sourcePrompts = sampledPrompts.filter(p => p.jailbreak_source === source);
            return sourcePrompts[Math.floor(Math.random() * sourcePrompts.length)];
        });
        
        // Then fill the remaining slots randomly
        const remainingSlots = maxTotalPrompts - guaranteedSamples.length;
        const remainingPrompts = sampledPrompts
            .filter(p => !guaranteedSamples.includes(p))
            .sort(() => 0.5 - Math.random())
            .slice(0, remainingSlots);
        
        return [...guaranteedSamples, ...remainingPrompts];
    }
    
    return sampledPrompts;
}

function updatePlayground() {
    const datasetType = document.querySelector('input[name="datasetType"]:checked').value;
    const contentType = document.querySelector('input[name="contentType"]:checked').value;
    const selectedCategory = document.getElementById('categoryFilter').value;
    const selectedSource = document.getElementById('sourceFilter').value;
    const selectedJailbreakType = document.getElementById('jailbreakTypeFilter').value;
    const selectedJailbreakSource = document.getElementById('jailbreakSourceFilter').value;
    const searchTerm = document.getElementById('promptSearch').value.toLowerCase();
    
    // Debug logs
    console.log('Selected filters:', {
        datasetType,
        contentType,
        selectedCategory,
        selectedSource,
        selectedJailbreakType,
        selectedJailbreakSource,
        searchTerm
    });
    
    // Show/hide adversarial warning
    const adversarialWarning = document.getElementById('adversarialWarning');
    adversarialWarning.style.display = contentType === 'Adversarial' ? 'block' : 'none';
    
    // Get and filter dataset
    let currentDataset = window.loadedData.datasets[datasetType][contentType];
    
    // If adversarial content, sample the prompts before applying filters
    if (contentType === 'Adversarial') {
        currentDataset = samplePrompts(currentDataset);
        console.log('Sampled dataset size:', currentDataset.length);
    }
    
    // Apply filters
    if (selectedCategory !== 'All') {
        currentDataset = currentDataset.filter(prompt => prompt.category === selectedCategory);
    }
    
    if (selectedSource !== 'All') {
        currentDataset = currentDataset.filter(prompt => prompt.source === selectedSource);
    }
    
    if (contentType === 'Adversarial') {
        if (selectedJailbreakType !== 'All') {
            currentDataset = currentDataset.filter(prompt => prompt.jailbreak_type === selectedJailbreakType);
        }
        if (selectedJailbreakSource !== 'All') {
            currentDataset = currentDataset.filter(prompt => prompt.jailbreak_source === selectedJailbreakSource);
        }
    }

    if (searchTerm) {
        currentDataset = currentDataset.filter(prompt => 
            prompt.question.toLowerCase().includes(searchTerm) ||
            (prompt.jailbreak_prompt && prompt.jailbreak_prompt.toLowerCase().includes(searchTerm))
        );
    }

    console.log('Filtered dataset:', currentDataset);

    // Update display
    const promptsContainer = document.getElementById('promptsContainer');
    promptsContainer.innerHTML = '';

    // Display prompts
    if (!currentDataset || currentDataset.length === 0) {
        promptsContainer.innerHTML = `
            <div class="alert alert-info">
                No prompts found matching the current filters.
            </div>
        `;
        return;
    }

    currentDataset.forEach(prompt => {
        const card = document.createElement('div');
        card.className = 'card mb-3';
        
        // Show all safeguards for each prompt
        const detectionResults = window.loadedData.safeguards.map(safeguard => ({
            name: safeguard,
            detected: prompt[safeguard] === '1' || prompt[safeguard] === 1
        }));

        card.innerHTML = `
            <div class="card-body">
                <h5 class="card-title">${prompt.question}</h5>
                <div class="detection-badges mb-3">
                    ${detectionResults.map(result => {
                        let badgeClass;
                        let icon;
                        if (datasetType === 'Benign') {
                            badgeClass = result.detected ? 'bg-warning' : 'bg-primary';
                            icon = result.detected ? '!' : '✓';
                        } else if (datasetType === 'Harmful') {
                            badgeClass = result.detected ? 'bg-success' : 'bg-danger';
                            icon = result.detected ? '🛡️' : '⚠️';
                        } else { // Borderline
                            badgeClass = result.detected ? 'bg-info' : 'bg-secondary';
                            icon = result.detected ? '⚖️' : '➖';
                        }
                        return `
                            <span class="badge ${badgeClass}">
                                ${icon} ${result.name.replace('_', ' ').toUpperCase()}
                            </span>
                        `;
                    }).join(' ')}
                </div>
                ${contentType === 'Adversarial' && prompt.jailbreak_prompt ? `
                    <div class="prompt-content">
                        <strong>Jailbreak Attempt:</strong>
                        <p class="text-muted">${prompt.jailbreak_prompt}</p>
                        <div class="mt-2">
                            <strong>Type:</strong> ${prompt.jailbreak_type || 'N/A'}
                            <br>
                            <strong>Source:</strong> ${prompt.jailbreak_source || 'N/A'}
                        </div>
                    </div>
                ` : ''}
                <div class="mt-2">
                    <strong>Category:</strong> ${prompt.category}
                    <br>
                    <strong>Source:</strong> ${prompt.source}
                </div>
            </div>
        `;
        
        promptsContainer.appendChild(card);
    });
}

// Initialize everything when the document is ready
document.addEventListener('DOMContentLoaded', async function() {
    try {
        window.loadedData = await loadData();
        
        // Add event listeners
        document.querySelectorAll('input[name="datasetType"], input[name="contentType"]')
            .forEach(input => input.addEventListener('change', (e) => {
                if (e.target.name === 'contentType') {
                    updateDynamicFilters(e.target.value);
                }
                updatePlayground();
            }));
        
        // Add listeners for filters
        document.getElementById('sourceFilter').addEventListener('change', updatePlayground);
        document.getElementById('jailbreakTypeFilter').addEventListener('change', updatePlayground);
        document.getElementById('jailbreakSourceFilter').addEventListener('change', updatePlayground);
        document.getElementById('categoryFilter').addEventListener('change', updatePlayground);
        document.getElementById('promptSearch').addEventListener('input', 
            debounce(updatePlayground, 300));

        // Initial updates
        updateDynamicFilters('Non-Adversarial');
        updatePlayground();
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