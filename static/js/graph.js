document.addEventListener('DOMContentLoaded', async () => {
    // Elements
    const networkContainer = document.getElementById('network-container');
    const threatsList = document.getElementById('threatsList');
    const threatCount = document.getElementById('threatCount');
    const elementDetails = document.getElementById('elementDetails');
    const detailsModal = new bootstrap.Modal(document.getElementById('detailsModal'));
    const detailsModalContent = document.getElementById('detailsModalContent');
    const detailsModalLabel = document.getElementById('detailsModalLabel');
    
    // Filter buttons
    const showAllBtn = document.getElementById('showAllBtn');
    const showComponentsBtn = document.getElementById('showComponentsBtn');
    const showDataFlowsBtn = document.getElementById('showDataFlowsBtn');
    const showAssetsBtn = document.getElementById('showAssetsBtn');
    const showTrustBoundariesBtn = document.getElementById('showTrustBoundariesBtn');
    
    // Network visualization variables
    let network = null;
    let nodes = new vis.DataSet();
    let edges = new vis.DataSet();
    
    // Threat model data
    let threatModel = null;
    
    // Node and edge maps for quick reference
    let nodeMap = new Map();
    let edgeMap = new Map();
    
    // Display modes and current filters
    const DISPLAY_MODES = {
        ALL: 'all',
        COMPONENTS: 'components',
        DATA_FLOWS: 'dataFlows',
        ASSETS: 'assets',
        TRUST_BOUNDARIES: 'trustBoundaries'
    };
    
    let currentDisplayMode = DISPLAY_MODES.ALL;
    
    // Colors for different node types (darker theme)
    const COLORS = {
        component: {
            background: '#2196F3',
            border: '#1976D2',
            highlight: { background: '#42A5F5', border: '#1976D2' },
            font: { color: '#FFFFFF' }
        },
        asset: {
            background: '#FFC107',
            border: '#FFA000',
            highlight: { background: '#FFD54F', border: '#FFA000' },
            font: { color: '#212121' }
        },
        dataFlow: {
            color: '#64B5F6',
            width: 3,
            highlight: '#42A5F5',
            hover: { color: '#42A5F5' }
        },
        threat: {
            background: '#F44336',
            border: '#D32F2F',
            highlight: { background: '#EF5350', border: '#D32F2F' },
            font: { color: '#FFFFFF' }
        },
        trustBoundary: {
            background: '#4CAF50',
            border: '#388E3C',
            highlight: { background: '#66BB6A', border: '#388E3C' },
            font: { color: '#FFFFFF' }
        }
    };
    
    // Risk level colors
    const RISK_COLORS = {
        high: '#F44336',
        medium: '#FFA000',
        low: '#FFC107'
    };
    
    // Enhanced network options with better spacing
    const options = {
        nodes: {
            shape: 'box',
            margin: 12,
            borderWidth: 2,
            shadow: true,
            widthConstraint: {
                maximum: 180
            },
            font: {
                size: 14,
                face: 'Roboto, Arial, sans-serif',
                color: '#FFFFFF'
            },
            // Désactiver les effets de survol qui causent des problèmes
            hover: {
                enabled: false
            }
        },
        edges: {
            arrows: {
                to: { enabled: true, scaleFactor: 1.2 }
            },
            width: 2,
            font: {
                size: 12,
                face: 'Roboto, Arial, sans-serif',
                align: 'middle',
                background: 'rgba(33, 33, 33, 0.9)',
                color: '#FFFFFF',
                strokeWidth: 2,
                strokeColor: '#000000',
                padding: 5,
                multi: 'html',
                bold: true
            },
            color: {
                color: '#64B5F6',
                highlight: '#42A5F5',
                hover: '#42A5F5'
            },
            // Désactiver les effets de survol qui causent des problèmes
            hover: {
                enabled: false
            },
            // Better spacing for data flows with more curve
            smooth: { 
                type: 'curvedCW', 
                roundness: 0.3,
                forceDirection: 'none'
            },
            // Ajouter un effet de lueur pour les flux de données
            shadow: true,
            shadowColor: 'rgba(100, 181, 246, 0.5)',
            shadowSize: 5,
            shadowBlur: 10
        },
        physics: {
            enabled: true,
            barnesHut: {
                gravitationalConstant: -5000,
                centralGravity: 0.1,
                springLength: 200,
                springConstant: 0.05,
                damping: 0.09,
                avoidOverlap: 1
            },
            solver: 'barnesHut',
            stabilization: {
                iterations: 200,
                fit: true
            }
        },
        interaction: {
            hover: false, // Désactiver le survol global
            tooltipDelay: 200,
            hideEdgesOnDrag: false, // Garder les arêtes visibles pendant le déplacement
            navigationButtons: true,
            keyboard: true,
            zoomView: true
        },
        layout: {
            improvedLayout: true,
            randomSeed: 42 // For more consistent layouts
        }
    };
    
    // Fetch and render the threat model
    try {
        const response = await fetch(`/get_task_data/${taskId}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
        }
        
        threatModel = await response.json();
        renderThreatModel();
    } catch (error) {
        console.error('Error loading threat model:', error);
        networkContainer.innerHTML = `
            <div class="alert alert-danger text-center my-5">
                <p>Failed to load threat model data:</p>
                <p>${error.message}</p>
            </div>
        `;
    }
    
    // Initialize the network visualization
    function initializeNetwork() {
        const data = {
            nodes: nodes,
            edges: edges
        };
        
        network = new vis.Network(networkContainer, data, options);
        
        // Network events
        network.on('click', handleNetworkClick);
        network.on('stabilizationIterationsDone', () => {
            // Once the network is stable, fit it to view and disable physics
            network.fit({
                animation: {
                    duration: 1000,
                    easingFunction: 'easeInOutQuad'
                }
            });
            // Disable physics after stabilization
            network.setOptions({ physics: { enabled: false } });
        });
    }
    
    // Create graph nodes from components
    function createComponentNodes() {
        if (!threatModel.components) return;
        
        threatModel.components.forEach(component => {
            const nodeId = `component-${component.id}`;
            const node = {
                id: nodeId,
                label: component.name,
                title: component.description || component.name,
                group: 'component',
                type: 'component',
                originalData: component,
                color: COLORS.component,
                font: { color: '#000000' }
            };
            
            nodes.add(node);
            nodeMap.set(nodeId, node);
        });
    }
    
    // Create graph nodes from assets
    function createAssetNodes() {
        if (!threatModel.assets) return;
        
        threatModel.assets.forEach(asset => {
            const nodeId = `asset-${asset.id}`;
            const node = {
                id: nodeId,
                label: asset.name,
                title: asset.description || asset.name,
                group: 'asset',
                type: 'asset',
                originalData: asset,
                color: COLORS.asset,
                font: { color: '#000000' }
            };
            
            nodes.add(node);
            nodeMap.set(nodeId, node);
            
            // Connect assets to components
            threatModel.components.forEach(component => {
                if (component.assets && component.assets.includes(asset.id)) {
                    const edgeId = `edge-comp-asset-${component.id}-${asset.id}`;
                    const edge = {
                        id: edgeId,
                        from: `component-${component.id}`,
                        to: nodeId,
                        arrows: { to: { enabled: false } },
                        dashes: true,
                        label: 'uses',
                        font: { align: 'middle' },
                        originalData: { type: 'component-asset' }
                    };
                    
                    edges.add(edge);
                    edgeMap.set(edgeId, edge);
                }
            });
        });
    }
    
    // Create graph edges from data flows
    function createDataFlowEdges() {
        if (!threatModel.dataFlows) return;
        
        threatModel.dataFlows.forEach(flow => {
            const sourceNodeId = `component-${flow.source}`;
            const destNodeId = `component-${flow.destination}`;
            
            if (nodeMap.has(sourceNodeId) && nodeMap.has(destNodeId)) {
                const edgeId = `flow-${flow.id}`;
                const edge = {
                    id: edgeId,
                    from: sourceNodeId,
                    to: destNodeId,
                    label: flow.description || `Flow ${flow.id}`,
                    title: `Data Classification: ${flow.dataClassification || 'Unclassified'}`,
                    color: COLORS.dataFlow,
                    originalData: flow,
                    type: 'dataFlow'
                };
                
                edges.add(edge);
                edgeMap.set(edgeId, edge);
            }
        });
    }
    
    // Create trust boundary shapes
    function createTrustBoundaries() {
        if (!threatModel.trustBoundaries) return;
        
        threatModel.trustBoundaries.forEach(boundary => {
            // Add a node for the boundary label
            const nodeId = `boundary-${boundary.id}`;
            const node = {
                id: nodeId,
                label: boundary.name,
                title: boundary.description || boundary.name,
                group: 'trustBoundary',
                type: 'trustBoundary',
                originalData: boundary,
                color: COLORS.trustBoundary,
                font: { color: '#000000' },
                shape: 'ellipse',
                borderWidth: 2,
                borderDashes: [5, 5]
            };
            
            nodes.add(node);
            nodeMap.set(nodeId, node);
        });
    }
    
    // Populate threats list in sidebar
    function populateThreatsTable() {
        if (!threatModel.threats) return;
        
        threatCount.textContent = threatModel.threats.length;
        
        // Update component and asset counts
        const componentCount = document.getElementById('componentCount');
        const assetCount = document.getElementById('assetCount');
        
        if (componentCount) {
            componentCount.textContent = threatModel.components ? threatModel.components.length : 0;
        }
        
        if (assetCount) {
            assetCount.textContent = threatModel.assets ? threatModel.assets.length : 0;
        }
        
        threatModel.threats.forEach(threat => {
            const riskLevel = threat.riskLevel ? 
                (threat.riskLevel.likelihood && threat.riskLevel.impact ? 
                    `${threat.riskLevel.likelihood}/${threat.riskLevel.impact}` : 
                    'unknown') : 
                'unknown';
            
            const riskColor = threat.riskLevel && threat.riskLevel.likelihood ? 
                RISK_COLORS[threat.riskLevel.likelihood.toLowerCase()] || '#CCCCCC' : 
                '#CCCCCC';
            
            const threatItem = document.createElement('button');
            threatItem.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
            threatItem.dataset.threatId = threat.id;
            threatItem.innerHTML = `
                <div>
                    <div class="fw-bold">${threat.name}</div>
                    <small class="text-muted">${threat.category || 'Uncategorized'}</small>
                </div>
                <span class="badge" style="background-color: ${riskColor};">${riskLevel}</span>
            `;
            
            threatsList.appendChild(threatItem);
            
            // Add event listener for threat selection
            threatItem.addEventListener('click', () => {
                showThreatDetails(threat);
            });
        });
    }
    
    // Show threat details in modal
    function showThreatDetails(threat) {
        detailsModalLabel.textContent = threat.name;
        
        // Format affected components
        const affectedComponents = threat.affectedComponents && threat.affectedComponents.length > 0 ?
            threat.affectedComponents.map(componentId => {
                const component = threatModel.components.find(c => c.id === componentId || c.id === componentId.replace('component-', ''));
                return component ? component.name : componentId;
            }).join(', ') : 'None';
        
        // Format affected data flows
        const affectedDataFlows = threat.affectedDataFlows && threat.affectedDataFlows.length > 0 ?
            threat.affectedDataFlows.map(flowId => {
                const flow = threatModel.dataFlows.find(f => f.id === flowId || f.id === flowId.replace('flow-', ''));
                return flow ? (flow.description || `Flow ${flow.id}`) : flowId;
            }).join(', ') : 'None';
        
        // Format mitigations
        const mitigations = threat.mitigations && threat.mitigations.length > 0 ?
            threat.mitigations.map(mitigation => `
                <div class="card mb-2" style="background-color: #2a2a2a; border: 1px solid #333;">
                    <div class="card-body p-3">
                        <h6 class="card-title" style="color: #fff;">${mitigation.name}</h6>
                        <p class="card-text" style="color: #b3b3b3;">${mitigation.description}</p>
                        <span class="badge bg-info">${mitigation.type || 'N/A'}</span>
                    </div>
                </div>
            `).join('') : '<p class="text-muted">No mitigations defined</p>';
        
        // Populate modal content
        detailsModalContent.innerHTML = `
            <div class="row threat-details">
                <div class="col-md-6">
                    <h6>Category</h6>
                    <p>${threat.category || 'Uncategorized'}</p>
                    
                    <h6>Description</h6>
                    <p>${threat.description || 'No description available'}</p>
                    
                    <h6>Risk Level</h6>
                    <p>
                        ${threat.riskLevel && threat.riskLevel.likelihood ? `Likelihood: <strong>${threat.riskLevel.likelihood}</strong><br>` : ''}
                        ${threat.riskLevel && threat.riskLevel.impact ? `Impact: <strong>${threat.riskLevel.impact}</strong>` : ''}
                        ${!threat.riskLevel ? 'Not specified' : ''}
                    </p>
                </div>
                <div class="col-md-6">
                    <h6>Affected Components</h6>
                    <p>${affectedComponents}</p>
                    
                    <h6>Affected Data Flows</h6>
                    <p>${affectedDataFlows}</p>
                </div>
            </div>
            
            <h6 class="mt-3">Mitigations</h6>
            <div class="mitigations-container">
                ${mitigations}
            </div>
        `;
        
        // Show the modal
        detailsModal.show();
        
        // Highlight affected components and data flows in the graph
        highlightThreatPath(threat);
    }
    
    // Highlight the threat path in the network
    function highlightThreatPath(threat) {
        // Reset all nodes and edges
        nodes.forEach(node => {
            if (node.originalColor) {
                node.color = node.originalColor;
            }
        });
        
        edges.forEach(edge => {
            if (edge.originalColor) {
                edge.color = edge.originalColor;
            }
        });
        
        // Save original colors if not already saved
        nodes.forEach(node => {
            if (!node.originalColor) {
                node.originalColor = node.color;
            }
        });
        
        edges.forEach(edge => {
            if (!edge.originalColor) {
                edge.originalColor = edge.color;
            }
        });
        
        // Highlight affected components
        if (threat.affectedComponents) {
            threat.affectedComponents.forEach(componentId => {
                const normalizedId = componentId.startsWith('component-') ? componentId : `component-${componentId}`;
                const node = nodes.get(normalizedId);
                if (node) {
                    nodes.update({ id: normalizedId, color: COLORS.threat });
                }
            });
        }
        
        // Highlight affected data flows
        if (threat.affectedDataFlows) {
            threat.affectedDataFlows.forEach(flowId => {
                const normalizedId = flowId.startsWith('flow-') ? flowId : `flow-${flowId}`;
                const edge = edges.get(normalizedId);
                if (edge) {
                    edges.update({ 
                        id: normalizedId, 
                        color: { color: COLORS.threat.border, highlight: COLORS.threat.border }
                    });
                }
            });
        }
        
        // Update the network
        network.redraw();
    }
    
    // Show details for the selected element
    function showElementDetails(element) {
        let html = '';
        
        if (element.type === 'component') {
            const component = element.originalData;
            html = `
                <h5>${component.name}</h5>
                <p>${component.description || 'No description available'}</p>
                <dl class="row">
                    <dt class="col-sm-4">Type</dt>
                    <dd class="col-sm-8">${component.type || 'Not specified'}</dd>
                    
                    <dt class="col-sm-4">Trust Level</dt>
                    <dd class="col-sm-8">${component.trustLevel || 'Not specified'}</dd>
                </dl>
                
                <h6>Associated Assets</h6>
                <ul class="list-group list-group-flush mb-3">
                    ${component.assets && component.assets.length > 0 ? 
                        component.assets.map(assetId => {
                            const asset = threatModel.assets.find(a => a.id === assetId);
                            return asset ? 
                                `<li class="list-group-item">${asset.name} <span class="badge bg-info">${asset.sensitivity || 'N/A'}</span></li>` : 
                                `<li class="list-group-item">Asset ${assetId}</li>`;
                        }).join('') : 
                        '<li class="list-group-item text-muted">No assets associated</li>'}
                </ul>
                
                <h6>Related Threats</h6>
                <ul class="list-group list-group-flush">
                    ${getThreatsForComponent(component.id).map(threat => 
                        `<li class="list-group-item d-flex justify-content-between align-items-center">
                            ${threat.name}
                            <span class="badge bg-danger">${threat.category || 'N/A'}</span>
                        </li>`
                    ).join('') || '<li class="list-group-item text-muted">No threats associated</li>'}
                </ul>
            `;
        } else if (element.type === 'asset') {
            const asset = element.originalData;
            html = `
                <h5>${asset.name}</h5>
                <p>${asset.description || 'No description available'}</p>
                <dl class="row">
                    <dt class="col-sm-4">Sensitivity</dt>
                    <dd class="col-sm-8">${asset.sensitivity || 'Not specified'}</dd>
                </dl>
                
                <h6>Used by Components</h6>
                <ul class="list-group list-group-flush">
                    ${getComponentsForAsset(asset.id).map(component => 
                        `<li class="list-group-item">${component.name}</li>`
                    ).join('') || '<li class="list-group-item text-muted">No components use this asset</li>'}
                </ul>
            `;
        } else if (element.type === 'dataFlow') {
            const flow = element.originalData;
            const sourceComponent = threatModel.components.find(c => c.id === flow.source);
            const destComponent = threatModel.components.find(c => c.id === flow.destination);
            
            html = `
                <h5>Data Flow</h5>
                <p>${flow.description || 'No description available'}</p>
                <dl class="row">
                    <dt class="col-sm-4">Source</dt>
                    <dd class="col-sm-8">${sourceComponent ? sourceComponent.name : flow.source}</dd>
                    
                    <dt class="col-sm-4">Destination</dt>
                    <dd class="col-sm-8">${destComponent ? destComponent.name : flow.destination}</dd>
                    
                    <dt class="col-sm-4">Classification</dt>
                    <dd class="col-sm-8">${flow.dataClassification || 'Not specified'}</dd>
                </dl>
                
                <h6>Related Threats</h6>
                <ul class="list-group list-group-flush">
                    ${getThreatsForDataFlow(flow.id).map(threat => 
                        `<li class="list-group-item d-flex justify-content-between align-items-center">
                            ${threat.name}
                            <span class="badge bg-danger">${threat.category || 'N/A'}</span>
                        </li>`
                    ).join('') || '<li class="list-group-item text-muted">No threats associated</li>'}
                </ul>
            `;
        } else if (element.type === 'trustBoundary') {
            const boundary = element.originalData;
            html = `
                <h5>${boundary.name}</h5>
                <p>${boundary.description || 'No description available'}</p>
                
                <h6>Components within Boundary</h6>
                <ul class="list-group list-group-flush">
                    ${boundary.components && boundary.components.length > 0 ? 
                        boundary.components.map(componentId => {
                            const component = threatModel.components.find(c => c.id === componentId);
                            return component ? 
                                `<li class="list-group-item">${component.name}</li>` : 
                                `<li class="list-group-item">Component ${componentId}</li>`;
                        }).join('') : 
                        '<li class="list-group-item text-muted">No components defined</li>'}
                </ul>
            `;
        }
        
        elementDetails.innerHTML = html;
    }
    
    // Helper to get threats for a component
    function getThreatsForComponent(componentId) {
        if (!threatModel.threats) return [];
        
        return threatModel.threats.filter(threat => 
            threat.affectedComponents && 
            threat.affectedComponents.some(c => c === componentId || c === `component-${componentId}`)
        );
    }
    
    // Helper to get threats for a data flow
    function getThreatsForDataFlow(flowId) {
        if (!threatModel.threats) return [];
        
        return threatModel.threats.filter(threat => 
            threat.affectedDataFlows && 
            threat.affectedDataFlows.some(f => f === flowId || f === `flow-${flowId}`)
        );
    }
    
    // Helper to get components for an asset
    function getComponentsForAsset(assetId) {
        if (!threatModel.components) return [];
        
        return threatModel.components.filter(component => 
            component.assets && component.assets.includes(assetId)
        );
    }
    
    // Handle click on a node or edge in the network
    function handleNetworkClick(params) {
        if (params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            const node = nodeMap.get(nodeId);
            if (node) {
                showElementDetails(node);
            }
        } else if (params.edges.length > 0) {
            const edgeId = params.edges[0];
            const edge = edgeMap.get(edgeId);
            if (edge && edge.originalData) {
                showElementDetails({
                    type: 'dataFlow',
                    originalData: edge.originalData
                });
            }
        }
    }
    
    // Update the network display based on the selected filter
    function updateNetworkDisplay(mode) {
        currentDisplayMode = mode;
        
        // Reset all nodes and edges to visible
        nodes.forEach(node => {
            nodes.update({ id: node.id, hidden: false });
        });
        
        edges.forEach(edge => {
            edges.update({ id: edge.id, hidden: false });
        });
        
        if (mode === DISPLAY_MODES.ALL) {
            // All elements are already visible
            return;
        }
        
        // Hide elements based on the selected mode
        if (mode === DISPLAY_MODES.COMPONENTS) {
            // Show only components
            nodes.forEach(node => {
                if (node.type !== 'component') {
                    nodes.update({ id: node.id, hidden: true });
                }
            });
            
            // Hide all edges
            edges.forEach(edge => {
                edges.update({ id: edge.id, hidden: true });
            });
        } else if (mode === DISPLAY_MODES.DATA_FLOWS) {
            // Show components and data flow edges
            nodes.forEach(node => {
                if (node.type !== 'component') {
                    nodes.update({ id: node.id, hidden: true });
                }
            });
            
            edges.forEach(edge => {
                if (edge.type !== 'dataFlow') {
                    edges.update({ id: edge.id, hidden: true });
                }
            });
        } else if (mode === DISPLAY_MODES.ASSETS) {
            // Show components, assets, and component-asset edges
            nodes.forEach(node => {
                if (node.type !== 'component' && node.type !== 'asset') {
                    nodes.update({ id: node.id, hidden: true });
                }
            });
            
            edges.forEach(edge => {
                if (edge.originalData && edge.originalData.type !== 'component-asset') {
                    edges.update({ id: edge.id, hidden: true });
                }
            });
        } else if (mode === DISPLAY_MODES.TRUST_BOUNDARIES) {
            // Show only trust boundaries
            nodes.forEach(node => {
                if (node.type !== 'trustBoundary') {
                    nodes.update({ id: node.id, hidden: true });
                }
            });
            
            // Hide all edges
            edges.forEach(edge => {
                edges.update({ id: edge.id, hidden: true });
            });
        }
    }
    
    // Render the threat model visualization
    function renderThreatModel() {
        // Create nodes and edges
        createComponentNodes();
        createAssetNodes();
        createDataFlowEdges();
        createTrustBoundaries();
        
        // Initialize the network
        initializeNetwork();
        
        // Populate the threats list
        populateThreatsTable();
    }
    
    // Filter button event listeners
    showAllBtn.addEventListener('click', () => updateNetworkDisplay(DISPLAY_MODES.ALL));
    showComponentsBtn.addEventListener('click', () => updateNetworkDisplay(DISPLAY_MODES.COMPONENTS));
    showDataFlowsBtn.addEventListener('click', () => updateNetworkDisplay(DISPLAY_MODES.DATA_FLOWS));
    showAssetsBtn.addEventListener('click', () => updateNetworkDisplay(DISPLAY_MODES.ASSETS));
    showTrustBoundariesBtn.addEventListener('click', () => updateNetworkDisplay(DISPLAY_MODES.TRUST_BOUNDARIES));
});