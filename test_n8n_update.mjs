import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

// --- Configuration - PLEASE FILL THESE IN --- 
const N8N_API_URL = 'https://primary-production-d902.up.railway.app/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlZjI4NjdjZC0xNmNjLTQxZWYtYTU1Mi05Mjk1ZWU5ZTFiN2IiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzQ3NDQwMDYyfQ.y0wO9czCQxel5Iub3zeSZ6z32blyaXAtsHYDUXSpGu8'; // Your n8n API Key
const WORKFLOW_ID_TO_UPDATE = '40GFe1dyCOxzL2zA';
const NEW_WORKFLOW_NAME = 'JS Direct API Update Test';
const WORKFLOW_DETAILS_FILE = './workflow_details.json'; // Corrected: Assumes workflow_details.json is in the same directory as the script
// --- End Configuration ---

async function testUpdateWorkflow() {
    console.log(`Attempting to update workflow ID: ${WORKFLOW_ID_TO_UPDATE} to name: "${NEW_WORKFLOW_NAME}"`);

    let currentWorkflow;
    try {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const filePath = path.resolve(__dirname, WORKFLOW_DETAILS_FILE);

        console.log(`Reading workflow details from: ${filePath}`);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        currentWorkflow = JSON.parse(fileContent);
        console.log(`Successfully read and parsed ${WORKFLOW_DETAILS_FILE}.`);
    } catch (error) {
        console.error(`Error reading or parsing ${WORKFLOW_DETAILS_FILE}:`, error.message);
        console.error("Please ensure you've run the PowerShell script first to generate this file in the workspace root.");
        return;
    }

    if (!currentWorkflow || !currentWorkflow.nodes || !currentWorkflow.connections) {
        console.error('Could not find valid nodes or connections in workflow_details.json');
        return;
    }

    const payload = {
        name: NEW_WORKFLOW_NAME,
        nodes: currentWorkflow.nodes,
        connections: currentWorkflow.connections,
        settings: {}, // Minimal settings object as per our last attempt
        // staticData is intentionally omitted based on previous tests
    };

    const headers = {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    const url = `${N8N_API_URL}/workflows/${WORKFLOW_ID_TO_UPDATE}`;

    console.log(`Sending PUT request to: ${url}`);
    // console.log('Payload:', JSON.stringify(payload, null, 2)); // Uncomment to see full payload

    try {
        const response = await axios.put(url, payload, { headers });
        console.log('\n--- Update Successful! ---');
        console.log('Status:', response.status, response.statusText);
        console.log('Response Data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('\n--- Update Failed! ---');
        if (axios.isAxiosError(error) && error.response) {
            console.error('Status:', error.response.status, error.response.statusText);
            console.error('Error Response Data:', JSON.stringify(error.response.data, null, 2));
            // console.error('Error Response Headers:', JSON.stringify(error.response.headers, null, 2));
        } else {
            console.error('An unexpected error occurred:', error.message);
        }
    }
}

testUpdateWorkflow(); 