
const COMFY_URL = "http://eb36d82cf7e2469bae5bbdd93a72a2b0.cloud.lanyun.net:18189";
const PROMPT_ID = "8b6916a9-ab6c-4018-9b03-c799669242f6";

async function main() {
    try {
        const historyRes = await fetch(`${COMFY_URL}/history/${PROMPT_ID}`);
        const history = await historyRes.json();
        console.log(JSON.stringify(history, null, 2));
    } catch (e) {
        console.error(e);
    }
}
main();
