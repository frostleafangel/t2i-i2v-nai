
import fs from 'fs';
import path from 'path';

const COMFY_URL = "http://eb36d82cf7e2469bae5bbdd93a72a2b0.cloud.lanyun.net:18189";
const INPUT_FILE = "/home/frostleaf/CascadeProjects/正常模型工作流参考/双人工作流极简.json";

// Types
interface ComfyNode {
    id: number;
    type: string;
    pos: [number, number];
    size: [number, number];
    flags: any;
    order: number;
    mode: number;
    inputs: Array<{
        name: string;
        type: string;
        link: number | null;
    }>;
    outputs: Array<{
        name: string;
        type: string;
        links: number[] | null;
        slot_index: number;
    }>;
    properties: any;
    widgets_values?: any[];
}

interface WebWorkflow {
    nodes: ComfyNode[];
}

interface ApiNode {
    inputs: Record<string, any>;
    class_type: string;
}

async function main() {
    try {
        console.log("1. Reading workflow file...");
        const rawFile = fs.readFileSync(INPUT_FILE, 'utf-8');
        const webWorkflow: WebWorkflow = JSON.parse(rawFile);

        console.log("2. Fetching object_info...");
        const objInfoRes = await fetch(`${COMFY_URL}/object_info`);
        const objectInfo = await objInfoRes.json();

        console.log("3. Converting to API format...");
        const prompt: Record<string, ApiNode> = {};

        // ... (existing code to build prompt) ...

        // AFTER loop, before queueing
        // Wait, I need to insert the log at the end of the loop logic. 
        // Let's replace the loop end and logging part.


        // Create a map of link ID to [nodeId, slotIndex]
        const linkMap = new Map<number, [string, number]>();
        for (const node of webWorkflow.nodes) {
            if (node.outputs) {
                for (let i = 0; i < node.outputs.length; i++) {
                    const output = node.outputs[i];
                    if (output.links) {
                        for (const linkId of output.links) {
                            linkMap.set(linkId, [String(node.id), i]);
                        }
                    }
                }
            }
        }

        for (const node of webWorkflow.nodes) {
            if (node.type === "Reroute") continue;

            const nodeDef = objectInfo[node.type];
            if (!nodeDef) {
                console.warn(`Warning: Node type ${node.type} (ID ${node.id}) not found in object_info.`);
            }

            const apiNode: ApiNode = {
                class_type: node.type,
                inputs: {}
            };

            // 1. First, Map Inputs from Links
            if (node.inputs) {
                for (const input of node.inputs) {
                    if (input.link !== null) {
                        const source = linkMap.get(input.link);
                        if (source) {
                            apiNode.inputs[input.name] = source;
                        }
                    }
                }
            }

            // 2. Then, Process Widgets (Consuming values but NOT overwriting existing links)
            if (node.widgets_values && nodeDef) {
                const required = nodeDef.input?.required || {};
                const optional = nodeDef.input?.optional || {};
                const hidden = nodeDef.input?.hidden || {};

                const orderRequired = nodeDef.input_order?.required || Object.keys(required);
                const orderOptional = nodeDef.input_order?.optional || Object.keys(optional);
                // hidden is usually implicitly ordered or not in input_order. 
                // We'll append hidden keys at the end just in case, but usually widgets_values match required+optional.
                // NOTE: ZmlPowerLoraLoader had hidden input "lora_loader_data" which was populated in widgets_values.
                // So we MUST iterate hidden ones too if we want to consume all widgets properly?
                // Actually, standard ComfyUI logic iterates input_order.

                const fullOrder = [...orderRequired, ...orderOptional];

                // Append hidden keys that are not in fullOrder
                for (const key of Object.keys(hidden)) {
                    if (!fullOrder.includes(key)) {
                        fullOrder.push(key);
                    }
                }

                let widgetIndex = 0;

                const processInputs = (names: string[]) => {
                    for (const name of names) {
                        const typeDef = required[name] || optional[name] || hidden[name];
                        if (!typeDef) continue;

                        const typeName = Array.isArray(typeDef) ? typeDef[0] : typeDef;
                        const typeString = Array.isArray(typeName) ? "COMBO" : typeName;

                        const isLinkType = ["MODEL", "VAE", "CLIP", "CONDITIONING", "LATENT", "IMAGE", "MASK"].includes(typeString);

                        // Decide if this input corresponds to a widget value
                        // Usually: INT, FLOAT, STRING, BOOLEAN, COMBO are widgets.
                        // Standard link types are NOT widgets.

                        // ZML_MultiTextInput3 input "文本1" is STRING. So it is treated as a widget.

                        if (!isLinkType || typeString === "STRING" || Array.isArray(typeName)) {
                            if (widgetIndex < node.widgets_values!.length) {
                                let val = node.widgets_values![widgetIndex];

                                // Consume widget index
                                widgetIndex++;

                                // Special logic: extra widget for control_after_generate or seed
                                const config = Array.isArray(typeDef) ? typeDef[1] : null;
                                const shouldconsumeExtra = (config && config.control_after_generate) || name === "seed";

                                if (shouldconsumeExtra) {
                                    widgetIndex++;
                                }

                                // Seed Fix
                                if (name === "seed" && (val === -1 || val === "-1")) {
                                    val = Math.floor(Math.random() * 1000000000);
                                }

                                // Only assign if NOT already linked!
                                if (apiNode.inputs[name] === undefined) {
                                    apiNode.inputs[name] = val;
                                } else {
                                    // console.log(`[Node ${node.id}] Skipping widget assignment for '${name}' because it is already linked.`);
                                }
                            }
                        }
                    }
                };

                processInputs(fullOrder);
            }

            prompt[String(node.id)] = apiNode;
        }

        console.log("JSON_OUTPUT_START");
        console.log(JSON.stringify(prompt, null, 2));
        console.log("JSON_OUTPUT_END");

        console.log("4. Queueing prompt...");
        const queueRes = await fetch(`${COMFY_URL}/prompt`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt })
        });

        if (!queueRes.ok) {
            throw new Error(`Failed to queue prompt: ${queueRes.status} ${await queueRes.text()}`);
        }

        const queueData = await queueRes.json();
        const promptId = queueData.prompt_id;
        console.log(`Prompt ID: ${promptId}`);

        console.log("5. Polling history...");
        while (true) {
            const historyRes = await fetch(`${COMFY_URL}/history/${promptId}`);
            const history = await historyRes.json();

            if (history[promptId]) {
                // Check for error
                if (history[promptId].status && history[promptId].status.status_str === 'error') {
                    console.error("Task failed with error:", JSON.stringify(history[promptId].status, null, 2));
                    break;
                }

                const outputs = history[promptId].outputs;
                console.log("Generation complete!");

                for (const nodeId in outputs) {
                    const output = outputs[nodeId];
                    if (output.images) {
                        for (const img of output.images) {
                            console.log(`Image: ${COMFY_URL}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`);
                        }
                    }
                }
                break;
            }

            await new Promise(r => setTimeout(r, 1000));
        }

    } catch (error) {
        console.error("Failed:", error);
    }
}

main();
