
import fs from 'fs';
import path from 'path';

const COMFY_URL = "http://eb36d82cf7e2469bae5bbdd93a72a2b0.cloud.lanyun.net:18189";

async function fetchObjectInfo() {
    try {
        const response = await fetch(`${COMFY_URL}/object_info/KSampler`);
        if (!response.ok) {
            throw new Error(`Failed to fetch object_info: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Error:", error);
    }
}

fetchObjectInfo();
